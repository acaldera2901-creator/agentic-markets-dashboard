import { describe, it, expect } from "vitest";
import { dedupeByFixture } from "./dedupe-fixtures";

// #DUP-FIXTURES-0821 — la stessa partita arriva da due fonti con due match_id
// diversi (espn:… e oddsapi:…) e finiva DUE VOLTE in board, con due edge
// diversi. La deduplica che c'era usava match_id, cioè la chiave che per
// costruzione non collide mai fra fonti.
const base = {
  league: "ALL",
  home_team: "IK Sirius",
  away_team: "BK Häcken",
  kickoff: "2026-08-21T17:00:00+00:00",
};

describe("dedupeByFixture", () => {
  it("collassa la stessa partita servita da due fonti, tenendo la piu' fresca", () => {
    const rows = [
      { ...base, match_id: "oddsapi:31bd07", computed_at: "2026-08-20T14:01:45Z", edge: 0.0207 },
      { ...base, match_id: "espn:401873989", computed_at: "2026-08-21T12:01:54Z", edge: 0.004 },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:401873989"); // la piu' recente vince
  });

  it("collassa anche quando i nomi differiscono solo per gli accenti", () => {
    const rows = [
      { ...base, away_team: "BK Häcken", match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, away_team: "BK Hacken", match_id: "oddsapi:2", computed_at: "2026-08-20T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(1);
  });

  // Caso reale trovato in produzione il 2026-08-21: la chiave che aggancia le
  // quote (normName) piega gli accenti ma NON la punteggiatura, quindi
  // "Saint-Étienne" e "Saint Etienne" restavano due partite.
  it("collassa quando i nomi differiscono per trattino E accento", () => {
    const rows = [
      { league: "FL2", home_team: "Saint-Étienne", away_team: "Grenoble", kickoff: "2026-08-22T18:00:00+00:00", match_id: "espn:401876774", computed_at: "2026-08-21T12:00:00Z" },
      { league: "FL2", home_team: "Saint Etienne", away_team: "Grenoble", kickoff: "2026-08-22T18:00:00+00:00", match_id: "oddsapi:738c1a", computed_at: "2026-08-20T12:00:00Z" },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:401876774");
  });

  it("non collassa partite diverse", () => {
    const rows = [
      { ...base, match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, home_team: "Sochaux", away_team: "Guingamp", match_id: "espn:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });

  it("non collassa lo stesso incontro in giorni diversi", () => {
    const rows = [
      { ...base, match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, kickoff: "2026-09-05T17:00:00+00:00", match_id: "espn:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });

  it("FAIL-OPEN: se la chiave non si puo' calcolare, la riga NON si butta", () => {
    // kickoff assente → identita' sconosciuta. Meglio un doppione che una
    // partita che sparisce dal board.
    const rows = [
      { ...base, kickoff: "", match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, kickoff: "", match_id: "oddsapi:2", computed_at: "2026-08-20T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });

  it("a parita' di freschezza tiene la prima, in modo stabile", () => {
    const rows = [
      { ...base, match_id: "espn:1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, match_id: "oddsapi:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:1");
  });

  it("conserva l'ordine delle righe sopravvissute", () => {
    const rows = [
      { ...base, home_team: "A", away_team: "B", match_id: "1", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, home_team: "C", away_team: "D", match_id: "2", computed_at: "2026-08-21T12:00:00Z" },
      { ...base, home_team: "A", away_team: "B", match_id: "3", computed_at: "2026-08-20T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows).map((r) => r.match_id)).toEqual(["1", "2"]);
  });

  // #DUP-FIXTURES-0821 (secondo giro) — lo STORICO. Il track record aggrega
  // unified_predictions: due righe per la stessa partita E lo stesso mercato
  // contano la partita DUE VOLTE nella percentuale pubblicata. Misurate 37
  // righe in eccesso su 278 il 2026-08-21.
  it("storico: collassa fixture+mercato, con nomi di campo diversi", () => {
    const rows = [
      { home_team: "Sochaux", away_team: "Guingamp", starts_at: "2026-08-21T18:00:00Z", market: "1X2", settled_at: "2026-08-21T20:00:00Z", id: "a" },
      { home_team: "Sochaux", away_team: "Guingamp", starts_at: "2026-08-21T18:00:00Z", market: "1X2", settled_at: "2026-08-21T21:00:00Z", id: "b" },
    ];
    const out = dedupeByFixture(rows, {
      when: (r) => r.starts_at,
      freshness: (r) => r.settled_at,
      extra: (r) => r.market,
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b"); // vince la regolata piu' tardi
  });

  it("storico: DUE MERCATI sulla stessa partita restano due righe", () => {
    const rows = [
      { home_team: "Sochaux", away_team: "Guingamp", starts_at: "2026-08-21T18:00:00Z", market: "1X2", settled_at: "x", id: "a" },
      { home_team: "Sochaux", away_team: "Guingamp", starts_at: "2026-08-21T18:00:00Z", market: "OU25", settled_at: "x", id: "b" },
    ];
    const out = dedupeByFixture(rows, {
      when: (r) => r.starts_at,
      freshness: (r) => r.settled_at,
      extra: (r) => r.market,
    });
    expect(out).toHaveLength(2);
  });

  // #DUP-CLUBNAMES-0822 — misurato in PRODUZIONE sulle 120 righe servite:
  // 11 coppie erano la stessa partita con grafie del club diverse fra le due
  // fonti. La chiave esatta non le vedeva. Ogni riga qui sotto è una coppia
  // REALE letta da /api/predictions il 2026-08-22.
  const coppieVere: Array<[string, string, string, string]> = [
    ["Zulte-Waregem", "Waasland-Beveren", "SV Zulte-Waregem", "SK Beveren"],
    ["CS Maritimo", "Académico de Viseu", "Maritimo", "Académico de Viseu"],
    ["SC Rheindorf Altach", "TSV Hartberg", "Rheindorf Altach", "Hartberg"],
    ["Royal Charleroi SC", "KV Mechelen", "Charleroi", "KV Mechelen"],
    ["AD Ceuta FC", "Las Palmas", "Ceuta", "Las Palmas"],
    ["Sturm Graz", "Austria Lustenau", "SK Sturm Graz", "Austria Lustenau"],
    ["Fenerbahce", "Torku Konyaspor", "Fenerbahce", "Konyaspor"],
    ["Royal Antwerp", "Genk", "Antwerp", "Racing Genk"],
    ["Heerenveen", "PEC Zwolle", "Heerenveen", "FC Zwolle"],
    ["Newells Old Boys", "Banfield", "Newell's Old Boys", "Banfield"],
    ["Huracán", "Deportivo Riestra", "Atlético Huracán", "Deportivo Riestra"],
    // trovata in produzione DOPO il primo giro: kvc non era fra le sigle note
    ["Lommel SK", "Westerlo", "Lommel SK", "KVC Westerlo"],
  ];

  it.each(coppieVere)("collassa la coppia vera %s v %s / %s v %s", (h1, a1, h2, a2) => {
    const rows = [
      { home_team: h1, away_team: a1, kickoff: base.kickoff, match_id: "espn:1", computed_at: "2026-08-22T12:00:00Z" },
      { home_team: h2, away_team: a2, kickoff: base.kickoff, match_id: "oddsapi:2", computed_at: "2026-08-21T12:00:00Z" },
    ];
    const out = dedupeByFixture(rows);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:1"); // vince la più fresca
  });

  // Il rischio del passaggio lasco è il merge SBAGLIATO: due partite diverse
  // fuse in una farebbe SPARIRE una partita dal board, che è peggio del
  // doppione. Questi casi devono restare due righe.
  const nonFondere: Array<[string, string, string, string, string]> = [
    ["due club che condividono la città", "Manchester United", "Arsenal", "Manchester City", "Arsenal"],
    ["due club che condividono il prefisso", "Real Madrid", "Betis", "Real Sociedad", "Betis"],
    ["PSV non è FC Eindhoven", "PSV Eindhoven", "Ajax", "FC Eindhoven", "Ajax"],
    ["squadre riserve", "Bayern Munich", "Koln", "Bayern Munich II", "Koln"],
    ["partite diverse", "Roma", "Lazio", "Milan", "Inter"],
  ];

  it.each(nonFondere)("NON fonde: %s", (_caso, h1, a1, h2, a2) => {
    const rows = [
      { home_team: h1, away_team: a1, kickoff: base.kickoff, match_id: "a", computed_at: "2026-08-22T12:00:00Z" },
      { home_team: h2, away_team: a2, kickoff: base.kickoff, match_id: "b", computed_at: "2026-08-21T12:00:00Z" },
    ];
    expect(dedupeByFixture(rows)).toHaveLength(2);
  });
});

// #DEDUP-NORDIC-0830 — due coppie viste in board il 30/08/2026, entrambe con la
// firma nota (una riga espn:, una oddsapi:) ma sopravvissute alla deduplica:
//   BL2  espn:401885137  "St. Pauli v Kaiserslautern"
//        oddsapi:53c8f2a "FC St. Pauli v 1. FC Kaiserslautern"
//   ELI  oddsapi:0219eb1 "Bodø/Glimt v Rosenborg"
//        espn:401843426  "Bodo/Glimt v Rosenborg"
// Causa, misurata eseguendo la normalizzazione:
//   "Bodø/Glimt"          -> "bod glimt"        (la ø non e' un diacritico
//                                                combinante: sopravvive a NFKD e
//                                                viene poi cancellata da [^a-z0-9])
//   "Preußen Munster"     -> "preu en munster"  (la ß spezza la parola in due)
//   "1. FC Kaiserslautern"-> "1 kaiserslautern" (il token "1" finisce nella
//                                                guardia sulle sigle d'identita')
const nordic = (h: string, a: string, id: string, at: string) => ({
  league: "X", home_team: h, away_team: a,
  kickoff: "2026-08-30T11:30:00+00:00", match_id: id, computed_at: at,
});

describe("dedupeByFixture — lettere non decomponibili e numeri nel nome", () => {
  it("collassa Bodo/Glimt e Bodø/Glimt (la o barrata non e' un accento)", () => {
    const out = dedupeByFixture([
      nordic("Bodø/Glimt", "Rosenborg", "oddsapi:0219eb1", "2026-08-30T09:00:00Z"),
      nordic("Bodo/Glimt", "Rosenborg", "espn:401843426", "2026-08-30T12:00:00Z"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:401843426"); // vince la piu' fresca
  });

  it("collassa 1. FC Kaiserslautern e Kaiserslautern", () => {
    const out = dedupeByFixture([
      nordic("St. Pauli", "Kaiserslautern", "espn:401885137", "2026-08-30T12:00:00Z"),
      nordic("FC St. Pauli", "1. FC Kaiserslautern", "oddsapi:53c8f2a", "2026-08-30T09:00:00Z"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe("espn:401885137");
  });

  it("collassa Preussen Munster e Preussen Munster con la esszett", () => {
    const out = dedupeByFixture([
      nordic("Preußen Münster", "Saarbrucken", "espn:1", "2026-08-30T12:00:00Z"),
      nordic("Preussen Munster", "1. FC Saarbrucken", "oddsapi:1", "2026-08-30T09:00:00Z"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("collassa Schalke 04 e Schalke, Hannover 96 e Hannover", () => {
    expect(dedupeByFixture([
      nordic("Schalke 04", "Hannover 96", "espn:2", "2026-08-30T12:00:00Z"),
      nordic("Schalke", "Hannover", "oddsapi:2", "2026-08-30T09:00:00Z"),
    ])).toHaveLength(1);
  });

  it("le squadre nordiche in board oggi non si fondono fra loro", () => {
    // Brøndby, Djurgården, Nordsjælland, Białystok: la traslitterazione non deve
    // creare collisioni fra club diversi.
    const out = dedupeByFixture([
      nordic("Brøndby IF", "Djurgården", "a:1", "2026-08-30T12:00:00Z"),
      nordic("FC Nordsjælland", "Jagiellonia Białystok", "a:2", "2026-08-30T12:00:00Z"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("NON fonde 1860 Munich con Munich: quattro cifre restano identita'", () => {
    const out = dedupeByFixture([
      nordic("1860 Munich", "Ingolstadt", "espn:3", "2026-08-30T12:00:00Z"),
      nordic("Munich", "Ingolstadt", "oddsapi:3", "2026-08-30T09:00:00Z"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("NON fonde le riserve col primo team, anche col numero nel nome", () => {
    const out = dedupeByFixture([
      nordic("Schalke 04 II", "Hannover", "espn:4", "2026-08-30T12:00:00Z"),
      nordic("Schalke 04", "Hannover", "oddsapi:4", "2026-08-30T09:00:00Z"),
    ]);
    expect(out).toHaveLength(2);
  });
});
