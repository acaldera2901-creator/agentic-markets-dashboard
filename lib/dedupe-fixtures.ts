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

// #DEDUP-NORDIC-0830 — `normName` piega i diacritici COMBINANTI (Göteborg →
// goteborg: la ö è o + U+0308, che NFKD separa). Non piega le lettere che in
// Unicode sono un carattere a sé: ø, æ, ß, đ, ł, ð, þ, œ non si decompongono, e
// il passaggio successivo `[^a-z0-9] → spazio` le CANCELLA. Misurato in
// produzione il 30/08/2026:
//   "Bodø/Glimt"      → "bod glimt"        (la ø sparisce, non diventa o)
//   "Preußen Münster" → "preu en munster"  (la ß spezza la parola in due)
// Risultato: `Bodø/Glimt v Rosenborg` (oddsapi) e `Bodo/Glimt v Rosenborg`
// (espn) restavano due righe in board per la stessa partita.
//
// Si traslittera QUI e non in `normName`, che è la chiave del join fra quote e
// predizioni: quella deve sbagliare per difetto (una quota attaccata alla
// partita sbagliata è peggio di una quota mancante), questa può essere più
// aggressiva. Vale la stessa distinzione già scritta sopra per `fixtureKey`.
const LETTERE_NON_DECOMPONIBILI: Array<[RegExp, string]> = [
  [/ø/g, "o"], [/æ/g, "ae"], [/å/g, "a"], [/ß/g, "ss"], [/đ/g, "d"],
  [/ł/g, "l"], [/ð/g, "d"], [/þ/g, "th"], [/œ/g, "oe"], [/ħ/g, "h"], [/ı/g, "i"],
];

function piegaLettere(s: string): string {
  let out = s;
  for (const [re, sub] of LETTERE_NON_DECOMPONIBILI) out = out.replace(re, sub);
  return out;
}

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
  // #DUP-CLUBNAMES-0822: l'apostrofo si RIMUOVE, non si sostituisce con uno
  // spazio. "Newell's Old Boys" diventava "newell s old boys" e non combaciava
  // con "Newells Old Boys" — la stessa squadra, due fonti, due righe in board.
  const strict = (n: string) =>
    piegaLettere(normName(n || "")).replace(/['\u2019\u0060]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const a = strict(home);
  const b = strict(away);
  if (!a || !b) return null;
  const [x, y] = [a, b].sort();
  return `${day}:${x}|${y}`;
}

// ─── Passaggio LASCO: le grafie del club ────────────────────────────────────
// #DUP-CLUBNAMES-0822 — misurato in produzione il 2026-08-22: 11 coppie sulle
// 120 righe servite erano la stessa partita con nomi scritti diversamente dalle
// due fonti ("CS Maritimo" e "Maritimo", "Royal Antwerp v Genk" e "Antwerp v
// Racing Genk"). La chiave esatta non le vede, per costruzione.
//
// La regola è il SOTTOINSIEME dei token, non una lista di alias da mantenere a
// mano: se dopo aver tolto le sigle generiche i token di un nome sono contenuti
// in quelli dell'altro, è la stessa squadra. Copre i prefissi ("Atlético
// Huracán" ⊃ "Huracán"), i suffissi ("Royal Charleroi SC" ⊃ "Charleroi") e gli
// sponsor nel nome ("Torku Konyaspor" ⊃ "Konyaspor") senza sapere nulla dei
// singoli club.
//
// Due guardie, perché il merge SBAGLIATO è peggio del doppione — farebbe
// SPARIRE una partita dal board:
//  · le riserve: "Bayern Munich II" è sottoinsieme-compatibile con "Bayern
//    Munich" ma è un'altra squadra;
//  · le sigle d'IDENTITÀ: "PSV Eindhoven" e "FC Eindhoven" sono due club. Una
//    sigla corta che non è nella lista dei tipi generici blocca il merge. È
//    l'unico punto dove serve sapere qualcosa: "PEC" è una variante del nome di
//    Zwolle (sta nella lista), "PSV" è il club (non ci sta).
//
// I due nomi devono combaciare ENTRAMBI, sulla stessa data: una fusione
// sbagliata richiederebbe due coincidenze insieme.

// Sigle di TIPO societario, prive di identità: si possono togliere.
//
// La lista va allungata quando arrivano campionati nuovi — è il prezzo di non
// fondere due club diversi. Per trovare i candidati sui dati veri:
//   curl -s .../api/predictions | (estrai i token di lunghezza <= 4 dai nomi)
// Misurato il 2026-08-22 su 228 nomi distinti: le sigle ricorrenti erano fc(41),
// sc(7), if, ac, sk, cf, us, afc, ifk, cfc, ssc, bc, ss, as, acf, is, bk.
//
// Non entrano MAI in questa lista le parole con un significato proprio, che nei
// dati veri compaiono spesso: city, town, real, club, boys, san, new, york, red,
// fire, roma, como. Toglierle fonderebbe "Manchester City" con "Manchester
// United" e "Real Madrid" con "Real Sociedad".
const SIGLE_GENERICHE = new Set([
  "fc", "sc", "cf", "ac", "as", "sv", "tsv", "vfb", "vfl", "kv", "sk", "cs", "ad",
  "rc", "cd", "ud", "bsc", "ss", "ssc", "us", "sd", "afc", "fk", "nk", "hnk",
  "mfk", "ifk", "bk", "ofk", "rcd", "rkc", "pec",
  // #DUP-CLUBNAMES-0822b: trovate in produzione dopo il primo giro. "KVC
  // Westerlo" e "Westerlo" restavano due righe perché kvc non era qui.
  "kvc", "kaa", "krc", "kvk", "kfc", "rsc", "cfc", "acf", "fsv", "msv", "bc", "is",
]);

// Marcatori di squadra NON prima: riserve, giovanili.
const RISERVE = /^(ii|iii|iv|b|c|u\d{2}|res|reserves|am|amateure|jr)$/;

/** I token identificativi di un nome di club, senza sigle generiche.
 *  Esportata per il recupero del settlement (#SETTLE-RECOVERY-0831): i nomi
 *  ESPN vanno confrontati coi nostri, e avere due normalizzatori che possono
 *  divergere e' la cosa che si paga sempre. `stessaSquadra` resta interna:
 *  la sua regola e' tarata sul dedup del NOSTRO feed, dove i nomi arrivano
 *  dalla stessa fonte, e allentarla per un caso diverso la romperebbe. */
export function tokenSquadra(nome: string): string[] {
  const grezzi = piegaLettere(normName(nome || ""))
    .replace(/['\u2019\u0060]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const nucleo = grezzi.filter((t) => !SIGLE_GENERICHE.has(t));
  // "FC" da solo non deve svuotare l'insieme: senza token non c'è identità.
  return nucleo.length ? nucleo : grezzi;
}

function stessaSquadra(a: string, b: string): boolean {
  const x = new Set(tokenSquadra(a));
  const y = new Set(tokenSquadra(b));
  if (!x.size || !y.size) return false;
  const [piccolo, grande] = x.size <= y.size ? [x, y] : [y, x];
  for (const t of piccolo) if (!grande.has(t)) return false; // non è sottoinsieme
  const differenza = [...grande].filter((t) => !piccolo.has(t));
  for (const t of differenza) {
    if (RISERVE.test(t)) return false; // squadra riserve
    // #DEDUP-NORDIC-0830: un numero CORTO fa parte del nome tedesco, non
    // identifica un altro club — "1. FC Kaiserslautern" ⊃ "Kaiserslautern",
    // "Schalke 04" ⊃ "Schalke", "Hannover 96" ⊃ "Hannover". Il token "1"
    // finiva qui e bloccava il merge. Restano bloccate le quattro cifre, che
    // sono l'anno di fondazione e SI usa per distinguere: "1860 Munich" e
    // "1899 Hoffenheim" non devono fondersi con la città.
    if (/^\d{1,2}$/.test(t)) continue;
    if (t.length <= 4 && !SIGLE_GENERICHE.has(t)) return false; // sigla d'identità
  }
  return true;
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

  // Secondo giro, LASCO: fra le righe sopravvissute, la stessa data e due nomi
  // compatibili sono la stessa partita. O(n²) sulle righe di una giornata: su
  // 120-200 righe sono confronti fra insiemi di 2-3 token, non pesa.
  const fresh = (r: T) =>
    (opts.freshness ? opts.freshness(r) : (r as { computed_at?: string | null }).computed_at) ?? "";
  const giorno = (r: T) =>
    ((opts.when ? opts.when(r) : (r as { kickoff?: string | null }).kickoff) ?? "").slice(0, 10);
  const suffisso = (r: T) => (opts.extra ? opts.extra(r) : "");

  const vivi = rows.map((_, i) => i).filter((i) => keep[i]);
  for (let a = 0; a < vivi.length; a++) {
    const i = vivi[a];
    if (!keep[i]) continue;
    for (let b = a + 1; b < vivi.length; b++) {
      const j = vivi[b];
      if (!keep[j]) continue;
      const g = giorno(rows[i]);
      if (g.length !== 10 || g !== giorno(rows[j])) continue; // fail-open
      if (suffisso(rows[i]) !== suffisso(rows[j])) continue; // mercati diversi restano
      const ci = rows[i];
      const cj = rows[j];
      const diritto =
        stessaSquadra(ci.home_team ?? "", cj.home_team ?? "") &&
        stessaSquadra(ci.away_team ?? "", cj.away_team ?? "");
      const rovescio =
        stessaSquadra(ci.home_team ?? "", cj.away_team ?? "") &&
        stessaSquadra(ci.away_team ?? "", cj.home_team ?? "");
      if (!diritto && !rovescio) continue;
      // vince la più fresca; a parità la prima, così l'ordine è stabile
      if (fresh(cj) > fresh(ci)) keep[i] = false;
      else keep[j] = false;
    }
  }

  return rows.filter((_, i) => keep[i]);
}
