// lib/dedupe-fixtures.ts — #DUP-FIXTURES-0821
//
// Una partita, una scheda. Il board serviva la STESSA partita due volte perché
// l'ingestione la scrive una volta per fonte, con l'id della fonte dentro la
// chiave primaria: `espn:401873989` e `oddsapi:31bd07…` sono due righe per lo
// stesso incontro. La deduplica che c'era filtrava per `match_id` — cioè
// esattamente la chiave che fra due fonti non collide mai. Il commento diceva
// «stesso fixture da fonti diverse»: l'intenzione era giusta, la chiave no.
//
// Non era un doppione cosmetico. Misurato il 2026-08-21 sulle 120 righe servite:
// 22 erano copie, e le due copie portavano EDGE DIVERSI (0,004 contro 0,0207 su
// Sirius–Häcken), perché sono due calcoli su due istantanee di quote diverse.
// Sullo stesso board comparivano due verdetti per la stessa partita, e uno
// poteva stare sopra il floor e l'altro sotto.
//
// L'identità della partita è giorno + i due nomi normalizzati e ordinati, con
// gli accenti piegati e la punteggiatura tolta: serve, perché le copie
// differivano per `BK Häcken` contro `BK Hacken` e per `Saint-Étienne` contro
// `Saint Etienne`.
//
// Vince la riga PIÙ FRESCA (`computed_at` massimo): il calcolo nuovo supersede
// il vecchio. A parità vince la prima, così l'ordine è stabile fra due chiamate.
//
// FAIL-OPEN: se la chiave non si può calcolare (kickoff assente o malformato) la
// riga NON si butta. Meglio un doppione che una partita che sparisce dal board.

import { normName } from "./odds-api";

// La chiave della DEDUPLICA non è quella che aggancia le quote, e non deve
// esserlo: sono due domande diverse. `teamPairKey` (lib/team-pair-key.ts) chiede
// «questa riga del book è la stessa partita di questa predizione?» e deve
// sbagliare per difetto — un merge di troppo attaccherebbe una quota alla
// partita sbagliata. Qui la domanda è «queste due righe sono lo stesso
// incontro?», e può essere più aggressiva: giorno uguale e due nomi che
// coincidono a meno di punteggiatura sono lo stesso incontro.
//
// Serve davvero: `normName` piega gli accenti ma non la punteggiatura, quindi
// "Saint-Étienne" e "Saint Etienne" — la stessa squadra, da due fonti —
// restavano due partite in board. Trovato in produzione il 2026-08-21.
function fixtureKey(home: string, away: string, kickoff: string): string | null {
  const day = (kickoff || "").slice(0, 10);
  if (day.length !== 10) return null;
  const strict = (n: string) => normName(n || "").replace(/[^a-z0-9]+/g, " ").trim();
  const a = strict(home);
  const b = strict(away);
  if (!a || !b) return null;
  const [x, y] = [a, b].sort();
  return `${day}:${x}|${y}`;
}

type FixtureRow = {
  home_team?: string | null;
  away_team?: string | null;
  kickoff?: string | null;
};

/** Come leggere una riga: i due chiamanti hanno nomi di campo diversi
 *  (`kickoff`/`computed_at` sul board, `starts_at`/`settled_at` nello storico) e
 *  domande diverse (lo storico deve tenere DUE MERCATI sulla stessa partita).
 *  Gli accessori evitano una seconda implementazione dell'identità. */
type DedupeOpts<T> = {
  /** quando si gioca — default `kickoff` */
  when?: (r: T) => string | null | undefined;
  /** chi vince fra due copie: il valore più ALTO — default `computed_at` */
  freshness?: (r: T) => string | null | undefined;
  /** parte extra della chiave: mercato, sport… — default nessuna */
  extra?: (r: T) => string;
};

export function dedupeByFixture<T extends FixtureRow>(rows: T[], opts: DedupeOpts<T> = {}): T[] {
  const winner = new Map<string, number>();
  const keep = rows.map(() => true);

  rows.forEach((row, i) => {
    const when = (opts.when ? opts.when(row) : (row as { kickoff?: string | null }).kickoff) ?? "";
    const base = fixtureKey(row.home_team ?? "", row.away_team ?? "", when);
    const key = base && opts.extra ? `${base}#${opts.extra(row)}` : base;
    if (!key) return; // identità sconosciuta → si tiene (fail-open)

    const prev = winner.get(key);
    if (prev === undefined) {
      winner.set(key, i);
      return;
    }
    const fresh = (r: T) =>
      (opts.freshness ? opts.freshness(r) : (r as { computed_at?: string | null }).computed_at) ?? "";
    const prevAt = fresh(rows[prev]);
    const thisAt = fresh(row);
    if (thisAt > prevAt) {
      keep[prev] = false;
      winner.set(key, i);
    } else {
      keep[i] = false;
    }
  });

  return rows.filter((_, i) => keep[i]);
}
