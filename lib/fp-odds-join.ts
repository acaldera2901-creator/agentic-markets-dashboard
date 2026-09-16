// #BOARD-ODDS-JOIN-0910 — passo 2 di #BOARD-ODDS-GATE-0910 (APPROVE Andrea 10/09).
//
// Il passo 1 ha smesso di NASCONDERE le predizioni che nessun book partner
// prezzava: il board e' passato da 55 a 120 partite di calcio. Quelle 65 righe
// recuperate pero' si vedono SENZA prezzo, perche' la quota si cerca con una
// chiave a uguaglianza esatta (`data:normName(home)|normName(away)`) e i nomi
// divergono: `normName` toglie `FC|CF|SC|AC|AS|SV|SS|US|SSC|Calcio` ma non
// `ACF`, `CFC`, `BC`, `1907`, `1913`, e non riconcilia «Internazionale Milano»
// con «Inter».
//
// Qui il prezzo si ritrova con un fallback a token, con le stesse due cautele
// di `odds-join.ts`:
//   1. si cerca SOLO fra le partite dello STESSO GIORNO. Non e' un'ottimizzazione
//      di comodo: due squadre possono incontrarsi piu' volte nella stagione, e
//      cercare su tutto il feed vorrebbe dire attaccare il prezzo di un'altra
//      giornata. Riduce anche il lavoro da ~890 confronti per riga a ~110.
//   2. la candidata deve essere UNICA. Se piu' di una combacia, nessuna: un
//      prezzo sbagliato e' peggio di un prezzo mancante, perche' l'utente ci
//      scommette sopra.
//
// Solo CALCIO. Il tennis usa `canonicalPlayerKey` (cognomi) e un matcher a token
// sui nomi dei giocatori ragiona in modo diverso: non si tocca senza misurarlo.

// La chiave esatta NON si ricostruisce a mano: la costruisce `teamPairKey`, che
// ORDINA alfabeticamente i due nomi (`[ka, kb].sort()`). Riscriverla qui come
// `home|away` faceva mancare l'accesso esatto su meta' delle partite — bug
// trovato leggendo il costruttore prima di collegare questo file, non dopo.
import { teamPairKey } from "./team-pair-key";

// ── Normalizzazione dedicata al join delle quote ─────────────────────────────
// #ODDS-JOIN-NAMES-0916. Il fallback a token chiamava `matchModelTeam`
// (lib/summer-leagues.ts), che tokenizza senza scartare articoli, congiunzioni
// e sigle di club: il denominatore `max(|a|,|b|)` si gonfiava e lo score
// scendeva sotto la soglia anche quando le due squadre sono ovviamente la
// stessa. Misurato il 16/09 sui dati veri (120 predizioni calcio x 859 voci del
// feed partner), 8 partite su 17 senza prezzo erano PRESENTI nel feed:
//
//   RC Deportivo La Coruña v Sevilla FC       ← deportivo de a coruna v sevilla      0.50
//   FC Barcelona v Real Racing Club Santander ← barcelona v racing santander         0.50
//   FC Bayern München v 1. FC Union Berlin    ← bayern munich v 1. union berlin      0.50
//   Central Córdoba (SdE) v Defensa y Justicia← central cordoba sde v csd defensa... 0.40
//   OH Leuven v RAAL La Louvière              ← oud-heverlee leuven v raal la...     0.33
//   Austria Lustenau v Rheindorf Altach       ← austria lustenau v scr altach        0.50
//   AS Roma v FC Internazionale Milano        ← roma v inter milan                   0.00
//   TPS Turku v Ilves Tampere                 ← turun palloseura v ilves             0.00
//
// La soglia condivisa NON si tocca: `MIN_OVERLAP = 0.6` in summer-leagues.ts e'
// usata da altri tre punti — `app/api/predictions/route.ts` (decide quali
// fixture vengono SERVITE), `lib/odds-join.ts`, `lib/soft-lookup.ts` — ed era
// stata alzata da 0.50 a 0.60 il 27/07 (#TEAM-MATCH-SAFETY-0727) dopo un
// incidente vero: a 0.50 il matcher agganciava il modello alla squadra
// sbagliata. Abbassarla rimetterebbe quel rischio su TUTTO il board.
// Qui si alza lo score dei match veri ripulendo i nomi PRIMA del conto, e la
// barra resta 0.6.

// Lettere latine che NFKD non scompone (copia voluta di STROKE_FOLD in
// summer-leagues.ts: quel file non la esporta e non si tocca in questo giro).
const PIEGA_TRATTO: Record<string, string> = {
  "ł": "l", "ø": "o", "đ": "d", "ð": "d", "þ": "th",
  "æ": "ae", "œ": "oe", "ß": "ss", "ı": "i", "ħ": "h", "ŋ": "n", "ŧ": "t",
};

// Articoli, preposizioni e congiunzioni delle lingue dei campionati coperti.
// Non identificano nessuna squadra ma contano nel denominatore: «Deportivo de A
// Coruña» e «RC Deportivo La Coruña» sono la stessa squadra con quattro token
// ciascuna e due soli in comune.
const PAROLE_VUOTE = new Set([
  // it
  "di", "del", "dello", "della", "dei", "degli", "delle", "da", "dal", "il", "lo", "i", "gli", "le", "e",
  // es / pt / gl
  "de", "el", "la", "los", "las", "do", "dos", "das", "y", "o",
  // en
  "of", "the", "and",
  // fr / nl / de
  "les", "du", "des", "den", "der",
  // articolo di una lettera: «de A Coruña», «l'Aquila» → "l"
  "a", "l",
]);

// Sigle societarie. Si tolgono SOLO se sono il primo o l'ultimo token: in mezzo
// a un nome una sigla di due-tre lettere puo' essere parte del nome proprio.
// Toglierle e' anche piu' SICURO che lasciarle: il caso «KV Kortrijk» →
// «KV Mechelen» di #TEAM-MATCH-SAFETY-0727 marcava 0.50 proprio grazie al "kv"
// condiviso; senza, l'overlap fra le due squadre e' zero.
// Non entra la FAMIGLIA di una sigla, solo la sigla generica: "ks" (Klub
// Sportowy) si toglie, "gks"/"lks"/"mks" NO. Sono identita' diverse in Polonia:
// togliendole, «ŁKS Łódź» diventerebbe {lodz}, sottoinsieme di «Widzew Łódź».
const SIGLE_CLUB = new Set([
  "fc", "cf", "cfc", "afc", "acf", "sc", "scr", "ac", "as", "us", "ss", "ssc",
  "sv", "sd", "sde", "cd", "csd", "rc", "rcd", "bc", "bk", "if", "ifk", "ik",
  "sk", "fk", "ks", "ff", "aif", "kv", "oh", "ca", "ad", "ud", "club", "calcio",
]);

// Traduzioni di citta': stessa citta', due lingue, mai due squadre diverse.
const ALIAS_TOKEN: Record<string, string> = {
  munich: "munchen", muenchen: "munchen",
  // Genitivo scandinavo: «Aalesunds FK» e «Aalesund» sono lo stesso club. Qui
  // sta il singolo caso misurato, non una regola sulla -s finale: quella
  // fonderebbe anche nomi che finiscono in -s di loro. Se ne arrivano altri
  // tre, allora vale la pena di una regola sul genitivo.
  aalesunds: "aalesund",
};

// Nomi di club che le due fonti scrivono in modo non riconducibile a token:
// la chiave e' il nome GIA' normalizzato (vuote+sigle tolte), il valore la
// forma canonica. Tenuta corta di proposito — solo i casi visti sui dati veri.
const ALIAS_NOME: Record<string, string> = {
  "inter milan": "internazionale milano",
  "tps turku": "turun palloseura",
};

/** Token del nome ai fini del solo join quote: piega i diacritici, butta la
 *  punteggiatura, scarta parole vuote e sigle di bordo, applica gli alias. */
export function tokenQuota(nome: string): Set<string> {
  const grezzi = nome
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[łøđðþæœßıħŋŧ]/g, (c) => PIEGA_TRATTO[c] ?? c)
    // apostrofi e punti spariscono senza lasciare spazio ("St. Gallen" →
    // "st gallen"); tutto il resto (parentesi, trattini, slash) separa.
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ALIAS_TOKEN[w] ?? w);
  if (grezzi.length === 0) return new Set();

  let utili = grezzi.filter((w) => !PAROLE_VUOTE.has(w));
  // Un nome fatto di sole parole vuote non esiste, ma se capitasse svuotarlo
  // renderebbe il matcher cieco: si tiene il nome grezzo.
  if (utili.length === 0) utili = grezzi;

  while (utili.length > 1 && SIGLE_CLUB.has(utili[0])) utili = utili.slice(1);
  while (utili.length > 1 && SIGLE_CLUB.has(utili[utili.length - 1])) utili = utili.slice(0, -1);

  const canonico = ALIAS_NOME[utili.join(" ")];
  return new Set(canonico ? canonico.split(" ") : utili);
}

// Stessa barra della soglia condivisa (0.6): il fix alza lo score dei match
// veri, non abbassa l'asticella. Vive qui perche' questo join e' l'unico a
// usarla; la costante di summer-leagues.ts resta intoccata.
const SOGLIA_QUOTE = 0.6;

/** Due nomi indicano la stessa squadra ai fini del join quote? */
export function stessaSquadra(a: string, b: string): boolean {
  const ta = tokenQuota(a);
  const tb = tokenQuota(b);
  if (ta.size === 0 || tb.size === 0) return false;

  // Il feed marca le partite femminili con "(wom)". Senza questa guardia
  // «Manchester City» (uomini) verrebbe abbinato a «manchester city lfc (wom)»
  // quando quel giorno il feed ha solo la partita femminile: una quota vera, ma
  // di un'altra partita.
  if (ta.has("wom") !== tb.has("wom")) return false;

  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap += 1;
  if (overlap === 0) return false;
  // Contenimento a TOKEN, non a sottostringa: «Rheindorf Altach» contiene
  // «Altach», ma «Internazionale Milano» NON contiene «Milan» (che invece e'
  // sottostringa di "milano" — il confronto a stringa abbinerebbe il Milan
  // all'Inter).
  if (overlap === Math.min(ta.size, tb.size)) return true;
  return overlap / Math.max(ta.size, tb.size) >= SOGLIA_QUOTE;
}

export type QuotaPartner = { homeKey: string; awayKey: string };

/** Indice per giorno, costruito una volta sola: la mappa arriva chiavata
 *  `YYYY-MM-DD:home|away`, quindi il giorno e' il prefisso fino ai due punti. */
export function indicizzaPerGiorno<T extends QuotaPartner>(
  quote: Record<string, T> | null | undefined,
): Map<string, T[]> {
  const indice = new Map<string, T[]>();
  if (!quote) return indice;
  for (const [chiave, voce] of Object.entries(quote)) {
    const giorno = chiave.slice(0, chiave.indexOf(":"));
    if (giorno.length !== 10) continue;
    const lista = indice.get(giorno);
    if (lista) lista.push(voce);
    else indice.set(giorno, [voce]);
  }
  return indice;
}

export type EsitoQuota<T> = {
  quota: T | null;
  via: "esatto" | "token" | "ambiguo" | "nessuna";
};

export function abbinaQuotaPartner<T extends QuotaPartner>(
  home: string | null | undefined,
  away: string | null | undefined,
  kickoffIso: string | null | undefined,
  quote: Record<string, T> | null | undefined,
  indicePerGiorno: Map<string, T[]>,
): EsitoQuota<T> {
  if (!home || !away || !kickoffIso || !quote) return { quota: null, via: "nessuna" };
  const giorno = kickoffIso.slice(0, 10);
  if (giorno.length !== 10) return { quota: null, via: "nessuna" };

  const chiave = teamPairKey("soccer", home, away, kickoffIso);
  const esatta = chiave ? quote[chiave] : undefined;
  if (esatta) return { quota: esatta, via: "esatto" };

  const delGiorno = indicePerGiorno.get(giorno);
  if (!delGiorno || delGiorno.length === 0) return { quota: null, via: "nessuna" };

  const candidate = delGiorno.filter(
    (v) => stessaSquadra(v.homeKey, home) && stessaSquadra(v.awayKey, away),
  );
  if (candidate.length === 1) return { quota: candidate[0], via: "token" };
  if (candidate.length > 1) return { quota: null, via: "ambiguo" };
  return { quota: null, via: "nessuna" };
}
