"""
TennisSettlementAgent — resolves tennis match outcomes and settles paper bets.

Resolution order per cycle:
  1. On first run, bulk-expires all predictions older than EXPIRE_AFTER_DAYS
     (old Betfair market IDs are gone — no way to resolve them).
  2. For recent predictions (< EXPIRE_AFTER_DAYS, played > MIN_ELAPSED_HOURS
     ago): Matchbook settled markets when configured, plus the ESPN day
     ARCHIVE — che filtra sul flag esplicito `status.type.completed` della
     fonte (#SETTLE-0909 A2). Il tabellone header con le note «A bt B» NON e'
     piu' una fonte di settlement: deduceva il «concluso» da un verbo e
     gradava partite in corso.
  3. Predictions that can't be resolved are left pending until they expire.
     In dubbio non si settla: un buco dichiarato (`unresolved`) e' preferibile
     a un esito falso pubblicato.

Every settlement (win/loss AND expiry) is bridged to the served
unified_predictions row so the public track record (/api/v2/history)
includes tennis — without the bridge those rows stay un-historical forever
(the unified settlement cycle in ResultSettlementAgent is football-only).

Runs every POLL_INTERVAL seconds.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from agents.base import BaseAgent
from core.db import AsyncSessionLocal, TennisPrediction, TennisBet
from core.espn_tennis_client import get_completed_results_for_days
from core.supabase_client import settle_unified_tennis, unified_tennis_ancora_aperte
from core.tennis_names import canonical_player_key
from core.tennis_set_validation import settlement_allowed
from models.elo_surface import EloSurfaceModel
from sqlalchemy import select, update

# #SETTLE-0909 A1/A4 — pre-filtro di COSTO, non criterio di validita': evita di
# chiedere all'archivio i giorni in cui non e' ancora finito niente. Il criterio
# di validita' e' il flag `completed` della fonte piu' la coerenza dei set.
MIN_ELAPSED_HOURS = 1
EXPIRE_AFTER_DAYS = 7
POLL_INTERVAL = 300
# #SETTLE-0909 B3 — un risultato si lega alla pick di QUELLA partita: stessa
# coppia E stessa data entro un giorno. Era +-3 giorni, e non si applicava mai.
MATCH_DATE_TOLERANCE = timedelta(days=1)

logger = logging.getLogger(__name__)


class TennisSettlementAgent(BaseAgent):
    def __init__(self):
        super().__init__("TennisSettlementAgent")
        self._elo = EloSurfaceModel()
        self._stale_expired = False  # run bulk-expire once per process lifetime

    async def _main_loop(self):
        while self._running:
            await self._settlement_cycle()
            await asyncio.sleep(POLL_INTERVAL)

    async def _settlement_cycle(self):
        if not self._stale_expired:
            await self._bulk_expire_stale()
            self._stale_expired = True

        await self._settle_recent()
        # #SETTLE-0909 — DOPO il settlement, sempre: la riconciliazione del
        # ponte. Gira a ogni ciclo, non una volta per processo, perche' e' il
        # rimedio a un ponte FALLITO — e un rimedio che parte una volta sola
        # eredita lo stesso difetto che deve curare.
        await self._riconcilia_ponte()

    async def _bulk_expire_stale(self):
        """Mark all predictions older than EXPIRE_AFTER_DAYS as 'expired' in one query."""
        cutoff = datetime.utcnow() - timedelta(days=EXPIRE_AFTER_DAYS)
        async with AsyncSessionLocal() as session:
            # Collect match_ids BEFORE the update so the unified rows can be
            # flagged unresolved too (the public history must not keep them open
            # forever — but #TENNIS-VOID-FIX-1: an aged-out row is NOT a real
            # void; report it as 'unresolved' so it leaves the live board
            # without polluting the track record as a confirmed no-result).
            stale_ids = [
                row[0] for row in (
                    await session.execute(
                        select(TennisPrediction.match_id).where(
                            TennisPrediction.outcome.is_(None),
                            TennisPrediction.computed_at < cutoff,
                        )
                    )
                ).all()
            ]
            result = await session.execute(
                update(TennisPrediction)
                .where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.computed_at < cutoff,
                )
                .values(outcome="expired", settled_at=datetime.utcnow())
            )
            await session.commit()
            n = result.rowcount
        if n:
            self.logger.info(
                f"[SETTLEMENT] bulk-expired {n} stale predictions (> {EXPIRE_AFTER_DAYS}d old)"
            )
        unresolved = 0
        for match_id in stale_ids:
            if await settle_unified_tennis(match_id, None, unresolved=True):
                unresolved += 1
        if unresolved:
            self.logger.info(
                f"[SETTLEMENT] flagged {unresolved} unified tennis rows unresolved (expired)"
            )

    async def _riconcilia_ponte(self):
        """
        Le righe PUBBLICHE ancora aperte, richiuse dal loro esito a monte.
        (#SETTLE-0909)

        IL DIFETTO CHE CHIUDE. Misurate il 10/09: 27 pick pubblicate e mostrate
        con `result` NULL, partite fra l'11/06 e il 24/08. Non vinte, non perse,
        non void, non `unresolved`: invisibili in entrambe le direzioni — fuori
        dal track record e non contate nemmeno come buchi.

        Come ci sono arrivate: `_bulk_expire_stale` le aveva marcate `expired` a
        monte, e la chiamata al ponte non era passata. Quel metodo gira UNA
        VOLTA per processo e i suoi fallimenti li conta e li dimentica; da lì in
        poi nessuno le riguarda, perche' lui seleziona `outcome IS NULL` e il
        backstop TS pretende `winner NOT NULL`. Un buco permanente per
        costruzione, invisibile a qualunque test: ogni pezzo era corretto da
        solo.

        La domanda giusta non e' «quali predizioni ho chiuso» ma «quali righe
        PUBBLICHE sono ancora aperte»: la si chiede alla tabella pubblica.
        Idempotente — il ponte scrive solo dove `result` e' ancora NULL, quindi
        ripassare non fa danni.
        """
        try:
            aperte = await unified_tennis_ancora_aperte()
        except Exception as e:
            self.logger.warning(f"[SETTLEMENT] riconciliazione non avviata: {e}")
            return
        if not aperte:
            return

        async with AsyncSessionLocal() as session:
            righe = (await session.execute(
                select(TennisPrediction).where(TennisPrediction.match_id.in_(aperte))
            )).scalars().all()
        per_match = {r.match_id: r for r in righe}

        chiuse = dichiarate = 0
        for match_id in aperte:
            pred = per_match.get(match_id)
            if pred is None or pred.outcome is None:
                # A monte non e' ancora chiusa: la chiudera' il ciclo normale.
                continue
            if pred.winner:
                if await settle_unified_tennis(
                    match_id, pred.winner,
                    verification_source="espn-archive",
                    verification_note="riconciliazione-ponte",
                ):
                    chiuse += 1
            else:
                # `expired` senza vincitore: la fonte non ha mai dato un esito.
                # Si dichiara come buco, che e' meglio di restare invisibile.
                if await settle_unified_tennis(match_id, None, unresolved=True):
                    dichiarate += 1

        if chiuse or dichiarate:
            self.logger.info(
                "[SETTLEMENT] ponte riconciliato: %d righe pubbliche chiuse col "
                "loro esito, %d dichiarate senza esito (su %d aperte)",
                chiuse, dichiarate, len(aperte),
            )

    async def _select_pending(self) -> list:
        """
        Unsettled predictions eleggibili al settlement (outcome IS NULL).

        #SETTLE-0909 A1 — la finestra sta su `scheduled_at`, cioe' QUANDO SI
        GIOCA, e non piu' su `computed_at`, che e' quando ABBIAMO CALCOLATO il
        pronostico. Con la finestra sbagliata una riga diventava candidata al
        settlement mentre la partita era ancora in corso: bastava che il
        pronostico fosse stato calcolato 4 ore prima, cosa che per una pick del
        mattino su una partita della sera e' sempre vera. E' la meta' della
        causa delle 289 righe gradate su un punteggio parziale.

        `computed_at` resta solo come limite di scadenza: una pick piu' vecchia
        di EXPIRE_AFTER_DAYS non si chiude piu'. `scheduled_at IS NOT NULL` e'
        richiesto perche' senza la data un risultato non si puo' legare alla
        partita giusta (B3) — misurato il 09/09: 0 righe su 2.755 hanno
        `scheduled_at` nullo, quindi il requisito non esclude nulla.
        """
        now = datetime.utcnow()
        eleggibile = now - timedelta(hours=MIN_ELAPSED_HOURS)
        max_age = now - timedelta(days=EXPIRE_AFTER_DAYS)
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(
                    TennisPrediction.outcome.is_(None),
                    TennisPrediction.scheduled_at.is_not(None),
                    TennisPrediction.scheduled_at <= eleggibile,
                    TennisPrediction.computed_at >= max_age,
                )
            )
            return result.scalars().all()

    async def _settle_recent(self):
        """Attempt settlement for predictions within the last EXPIRE_AFTER_DAYS days."""
        pending = await self._select_pending()
        if not pending:
            return

        resolved = await self._resolve_all(pending)
        if not resolved:
            return

        async with AsyncSessionLocal() as session:
            await self._elo.load_from_db_async(session)

        # Apply each physical match to the Elo model exactly once. Before the
        # unique index on tennis_predictions (#ELO-FIX-1) the same match could
        # arrive as N duplicate rows, and the old loop re-ran the Elo update once
        # per row — inflating ratings (Zverev to 813 matches). The unique index
        # prevents new duplicates, and this dedup keeps the rating idempotent even
        # if duplicates ever slip through again.
        await self._chiudi(resolved)

    async def _chiudi(self, resolved: list[tuple]) -> int:
        """Chiude le righe risolte: Elo, riga a monte, scommesse, track record.

        #SETTLE-TIMBRO-0911 — estratto da `_settle_recent` per poter essere
        provato. Il difetto che viveva qui (il settlement pubblico chiamato
        senza `verification_source`, quindi righe chiuse e invisibili nel track
        record) non era coperto da nessun test perche' il ciclo era sepolto in
        un metodo che interroga il database: si poteva verificare solo l'esito
        finale, che era gia' giusto. Ora si puo' guardare COSA VIENE PASSATO.
        """
        elo_applied: set = set()
        updated = 0
        for entry in resolved:
            # Resolver tuples: (pred, position) or (pred, position, score_text).
            pred, winner_position = entry[0], entry[1]
            score_text = entry[2] if len(entry) > 2 else None
            # #SETTLE-TIMBRO-0911: chi ha risolto la riga (matchbook | espn).
            fonte = entry[3] if len(entry) > 3 else None
            outcome = "P1_WIN" if winner_position == "P1" else "P2_WIN"
            winner_name = pred.player1 if winner_position == "P1" else pred.player2
            loser_name = pred.player2 if winner_position == "P1" else pred.player1
            surface = pred.surface or "hard"
            # #18: key the dedup on the PHYSICAL match (match_id + player pair),
            # not the pair alone. Duplicate rows of one match share match_id →
            # Elo moves once; a legitimate REMATCH (same players, different
            # match_id/date) gets its own key → Elo moves again, as it should.
            match_identity = (
                getattr(pred, "match_id", None),
                frozenset((
                    canonical_player_key(winner_name),
                    canonical_player_key(loser_name),
                )),
            )
            if match_identity not in elo_applied:
                self._elo.update(winner_name, loser_name, surface)
                elo_applied.add(match_identity)
            await self._update_prediction(pred.id, outcome, winner_name)
            await self._settle_bets(pred.match_id, outcome)
            # Bridge to the public track record (/api/v2/history) — with the
            # REAL set score when ESPN provided one (#021).
            # Il favorito secondo il modello, dalla fonte popolata al 100%.
            # Serve al ponte quando `unified_predictions.pick` e' vuoto (47%
            # delle righe tennis): senza, un esito vero diventa un `void`.
            # #SETTLE-TIMBRO-0911 — QUI MANCAVA IL TIMBRO, ed e' il ciclo
            # normale: quello che chiude la stragrande maggioranza delle righe.
            #
            # `settle_unified_tennis` marca `verification_state='verified'` SOLO
            # se riceve `verification_source` — il suo docstring lo dichiara
            # obbligatorio per ogni esito reale — e /api/v2/history pubblica
            # SOLO le righe verificate. Senza timbro la riga veniva chiusa
            # correttamente nel database e poi spariva dal track record.
            #
            # Misurato l'11/09: negli ultimi 7 giorni **334 righe concluse senza
            # timbro** (232 football, 102 tennis) contro 53 verificate, e delle
            # 8 partite chiuse in giornata NESSUNA compariva nella cronologia.
            # La riconciliazione-ponte (poco sopra) timbrava; il ciclo normale
            # no — cioe' si vedeva la toppa e non il vestito.
            #
            # La fonte e' quella VERA, non un'etichetta di comodo: Matchbook o
            # ESPN, secondo chi ha risolto davvero la riga. Se per qualsiasi
            # motivo non la conoscessimo, si resta senza timbro: una riga non
            # verificata fuori dal track record e' un buco, una riga marcata
            # `verified` senza sapere da dove viene e' una bugia.
            await settle_unified_tennis(
                pred.match_id,
                winner_name,
                final_score=score_text,
                verification_source=fonte,
                verification_note="settlement-tennis" if fonte else None,
            )
            updated += 1

        if updated:
            async with AsyncSessionLocal() as session:
                await self._elo.save_to_db_async(session)
            self.logger.info(
                f"[SETTLEMENT] settled {updated} recent row(s) "
                f"({len(elo_applied)} distinct match(es)), Elo updated"
            )
        return updated

    @staticmethod
    def _unresolved(pending: list, resolved: list[tuple]) -> list:
        """Le righe che il resolver precedente NON ha chiuso."""
        done = {p.id for p, *_ in resolved}
        return [p for p in pending if p.id not in done]

    async def _resolve_all(self, pending: list) -> list[tuple]:
        """
        I due resolver sono COMPLEMENTARI, non alternativi.

        Prima erano incatenati con `if not resolved:` — cioe' ESPN veniva
        interrogato SOLO quando Matchbook non aveva risolto NIENTE. Bastava che
        Matchbook chiudesse UNA riga perche' tutte le altre restassero aperte
        fino a scadere a 7 giorni in `unresolved`.

        Misurato sul log del daemon: 67 cicli su 75 hanno chiuso esattamente
        1 riga — e' l'impronta digitale del corto circuito. Effetto a valle: il
        settlement del tennis e' passato dal 55-78% (fino al 19/08) allo 0-7%
        (dal 23/08), e su 76 pick sopra il floor con kickoff fra 25h e 7 giorni
        fa solo 4 avevano un esito utilizzabile. Chi paga riceveva il pronostico
        e mai l'esito; il canale pubblico prometteva di chiudere cio' che apre e
        non ci riusciva.

        Ora Matchbook risolve quello che sa (e' un'exchange: preciso ma con
        copertura stretta), ed ESPN viene chiamato sul RESTO.
        """
        # #SETTLE-TIMBRO-0911 — ogni riga risolta porta con se' CHI l'ha
        # risolta, perche' a valle serve per timbrare `verification_source`.
        #
        # Perche' non bastava la tupla com'era: i due resolver restituiscono
        # forme diverse — ESPN tre elementi (col punteggio), Matchbook due —
        # quindi un `(*t, fonte)` avrebbe fatto finire la fonte in `entry[2]`,
        # cioe' dove il chiamante legge il PUNTEGGIO. Si normalizza invece a
        # quattro posizioni fisse: (pred, posizione, punteggio, fonte).
        #
        # `_unresolved` legge `for p, *_ in resolved`, quindi non risente della
        # lunghezza; il chiamante ora puo' leggere entry[3] senza indovinare.
        def _con_fonte(t: tuple, fonte: str) -> tuple:
            return (t[0], t[1], t[2] if len(t) > 2 else None, fonte)

        resolved = [_con_fonte(t, "matchbook") for t in await self._resolve_via_matchbook(pending)]
        remaining = self._unresolved(pending, resolved)
        if remaining:
            resolved += [_con_fonte(t, "espn") for t in await self._resolve_via_espn(remaining)]
        return resolved

    @staticmethod
    def _giorni_di(pending: list) -> set:
        """
        I giorni (UTC) delle pick pendenti: e' l'insieme minimo di date da
        chiedere all'archivio. Chiedere una finestra fissa costerebbe richieste
        per giorni in cui non c'e' niente da chiudere.

        Si chiede anche il GIORNO DOPO: una partita delle 22:00 UTC finisce
        oltre la mezzanotte e ESPN la archivia sotto la data del suo giorno di
        torneo. Prima la prendeva il tabellone corrente; da quando il settlement
        legge solo l'archivio (#SETTLE-0909 A2) senza il giorno dopo un esito
        notturno resterebbe pendente fino a scadere in `unresolved`. Il costo e'
        contenuto: i giorni passati si mettono in cache per la vita del processo.
        """
        giorni = set()
        for pred in pending:
            quando = TennisSettlementAgent._quando_si_gioca(pred)
            if quando is None:
                continue
            giorni.add(quando.date())
            giorni.add((quando + timedelta(days=1)).date())
        return giorni

    @staticmethod
    def _quando_si_gioca(pred) -> datetime | None:
        """
        Quando si gioca la partita, sempre timezone-aware (UTC) o None.

        #SETTLE-0909 B1 — `scheduled_at` e' un TIMESTAMP **naive**
        (docs/supabase_schema.sql:342), e un datetime naive **ha** l'attributo
        `tzinfo` (vale None). Il vecchio `hasattr(pred_when, "tzinfo")` era
        quindi SEMPRE vero: il ramo di conversione era codice morto, il valore
        restava naive, e la sottrazione aware - naive alzava `TypeError`. Qui si
        testa il VALORE (`tzinfo is None`), non la presenza dell'attributo.
        """
        quando = (
            getattr(pred, "scheduled", None)
            or getattr(pred, "scheduled_at", None)
            or getattr(pred, "starts_at", None)
        )
        if quando is None:
            return None
        if not isinstance(quando, datetime):
            try:
                quando = datetime.fromisoformat(str(quando).replace("Z", "+00:00"))
            except (TypeError, ValueError):
                return None
        return quando if quando.tzinfo is not None else quando.replace(tzinfo=timezone.utc)

    async def _resolve_via_espn(self, pending: list) -> list[tuple]:
        """
        Esiti dall'ARCHIVIO ESPN per data — l'unica fonte di settlement.

        #SETTLE-0909 A2 — la fonte non e' piu' `get_completed_results()`, che
        deduceva il «concluso» dal VERBO di una stringa di note («A bt B» =
        finita, «A leads B» = in corso). Un tabellone che scrive «A bt B 6-1»
        mentre la partita e' al primo set produceva un esito ben formato e
        FALSO, invisibile a qualunque test interno: e' la causa misurata delle
        289 righe su 1.401 pubblicate con un punteggio da set singolo.
        L'archivio giornaliero filtra sul flag ESPLICITO
        `status.type.completed` della fonte — lo stesso tipo di cancello che il
        football ha da sempre (`status === "FINISHED"`) e che il tennis non ha
        mai avuto.

        Restituisce (TennisPrediction, "P1"|"P2", punteggio_pubblicabile).
        """
        giorni = self._giorni_di(pending)
        if not giorni:
            return []
        try:
            results = await get_completed_results_for_days(giorni)
        except Exception as e:
            self.logger.warning(f"espn archivio fallito: {e}")
            return []
        if not results:
            return []

        # #SETTLE-0909 B3 — la coppia di nomi da sola non basta: gli stessi due
        # giocatori si incontrano piu' volte in una stagione. Si tengono TUTTI i
        # candidati per coppia e si scarta per data; se ne restano due, la riga
        # non si settla (ambiguo), come fa gia' il football su ESPN
        # (lib/espn-results.ts, che pretende un candidato unico).
        per_coppia: dict[frozenset, list[dict]] = {}
        for r in results:
            per_coppia.setdefault(
                frozenset((r["winner_key"], r["loser_key"])), []
            ).append(r)

        resolved: list[tuple] = []
        rifiutate: dict[str, int] = {}
        for pred in pending:
            k1 = canonical_player_key(pred.player1)
            k2 = canonical_player_key(pred.player2)
            candidati = per_coppia.get(frozenset((k1, k2))) or []
            if not candidati:
                continue
            candidati = self._candidati_per_data(pred, candidati)
            if not candidati:
                continue
            if len(candidati) > 1:
                rifiutate["eventi-ambigui"] = rifiutate.get("eventi-ambigui", 0) + 1
                self.logger.warning(
                    "[SETTLEMENT] %s vs %s: %d eventi candidati nella stessa "
                    "finestra — non settlo (ambiguo)",
                    pred.player1, pred.player2, len(candidati),
                )
                continue

            res = candidati[0]
            # #SETTLE-0909 A3 — secondo cancello, indipendente dal primo: anche
            # con un flag `completed` esplicito, un punteggio che non descrive
            # una partita conclusa non si scrive. In dubbio la riga resta
            # pendente: al massimo scade in `unresolved`, che e' un buco
            # dichiarato invece di un esito falso pubblicato.
            ok, motivo = settlement_allowed(
                res.get("score_text"),
                tournament=res.get("tournament") or getattr(pred, "tournament", None),
                gender=res.get("gender"),
                status_name=res.get("status_name"),
                source_completed=bool(res.get("source_completed")),
            )
            if not ok:
                rifiutate[motivo] = rifiutate.get(motivo, 0) + 1
                self.logger.info(
                    "[SETTLEMENT] %s vs %s NON settlata (%s, punteggio %r)",
                    pred.player1, pred.player2, motivo, res.get("score_text"),
                )
                continue

            resolved.append((
                pred,
                "P1" if res["winner_key"] == k1 else "P2",
                self._punteggio_pubblicabile(res, motivo),
            ))

        if rifiutate:
            # Il numero che misura il fix: deve essere > 0 subito dopo il deploy
            # (il cancello sta lavorando) e calare nel tempo.
            self.logger.info(
                "[SETTLEMENT] cancello: %d righe non settlate — %s",
                sum(rifiutate.values()),
                ", ".join(f"{k}={v}" for k, v in sorted(rifiutate.items())),
            )
        return resolved

    def _candidati_per_data(self, pred, candidati: list[dict]) -> list[dict]:
        """
        I candidati compatibili con la data della partita (#SETTLE-0909 B).

        Senza una data — della pick o dell'evento — non si settla. Il vecchio
        codice, in quel caso, teneva l'abbinamento per sola coppia di nomi: e'
        esattamente il buco da cui passava il risultato di un ALTRO incontro
        fra gli stessi due giocatori.
        """
        quando = self._quando_si_gioca(pred)
        if quando is None:
            self.logger.warning(
                "[SETTLEMENT] %s vs %s senza data di gioco: non settlo",
                pred.player1, pred.player2,
            )
            return []

        vicini: list[dict] = []
        for r in candidati:
            data_evento = r.get("event_date")
            if data_evento is None:
                continue
            try:
                if data_evento.tzinfo is None:
                    data_evento = data_evento.replace(tzinfo=timezone.utc)
                if abs(data_evento - quando) <= MATCH_DATE_TOLERANCE:
                    vicini.append(r)
            except (TypeError, ValueError, AttributeError) as e:
                # #SETTLE-0909 B2 — qui c'era `except Exception: pass`, cioe' la
                # guardia temporale si spegneva IN SILENZIO e la riga veniva
                # settlata comunque. E' la riga che ha reso il difetto
                # invisibile per mesi. Adesso e' rumorosa, e in dubbio NON si
                # settla: il candidato si scarta.
                self.logger.warning(
                    "[SETTLEMENT] data non confrontabile per %s vs %s (%s): "
                    "scarto il candidato",
                    pred.player1, pred.player2, e,
                )
        return vicini

    @staticmethod
    def _punteggio_pubblicabile(res: dict, motivo: str) -> str | None:
        """
        Il punteggio come va PUBBLICATO.

        Un ritiro si ferma a `6-1 2-0`: senza il marker una card mostrerebbe un
        punteggio impossibile come se fosse un finale regolare — cioe' proprio
        il difetto che stiamo chiudendo, per un'altra strada.
        """
        punteggio = res.get("score_text")
        if not motivo.startswith("esito-irregolare"):
            return punteggio
        marker = "w/o" if "walkover" in motivo else "ret."
        return f"{punteggio} {marker}" if punteggio else marker

    async def _resolve_via_matchbook(self, pending: list) -> list[tuple]:
        """
        Resolve outcomes from Matchbook settled markets (if configured).
        Returns list of (TennisPrediction, "P1"|"P2") for resolved matches.
        When no exchange is configured, returns empty list gracefully.
        """
        try:
            from core import matchbook_client
            if not matchbook_client.is_configured():
                return []
            if not hasattr(matchbook_client, "get_settled_tennis_result"):
                return []
        except Exception:
            return []

        resolved = []
        for pred in pending:
            try:
                result = await asyncio.to_thread(
                    matchbook_client.get_settled_tennis_result,
                    pred.player1,
                    pred.player2,
                    pred.computed_at,
                )
                if result in ("P1", "P2"):
                    resolved.append((pred, result))
            except Exception as e:
                self.logger.debug(f"matchbook settle lookup failed: {e}")
        return resolved

    async def _update_prediction(self, pred_id: int, outcome: str, winner: str):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisPrediction).where(TennisPrediction.id == pred_id)
            )
            pred = result.scalar_one_or_none()
            if pred:
                pred.outcome = outcome
                pred.winner = winner
                pred.settled_at = datetime.utcnow()
                await session.commit()

    async def _settle_bets(self, match_id: str, outcome: str):
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TennisBet).where(
                    TennisBet.match_id == match_id,
                    TennisBet.status == "pending",
                )
            )
            bets = result.scalars().all()
            for bet in bets:
                won = bet.selection == outcome[:2]  # "P1" or "P2"
                bet.status = "won" if won else "lost"
                bet.profit_loss = round(bet.stake * (bet.odds - 1), 4) if won else -bet.stake
            if bets:
                await session.commit()
