// components/affiliate/pure.test.ts — #AFFILIATE-V2-UI-1015
// Mappa errori wallet, mappa stati, formattazione, testi admin: tutto puro.
import { describe, it, expect } from "vitest";
import { AFF_COPY, affLang, fill } from "./copy";
import { checkAddressLocal, last6Matches, looksLikeTron, mapWalletError } from "./errors";
import { addressGroups, monthLabel, shortHash, usd } from "./format";
import { cancelText, commissionChip, payoutChip } from "./status";
import { createErrorText, nextMonth, prevMonth, reasonText, txErrorText, txFailText, TX_REJECT_TEXT } from "./admin-copy";

const A = "0x4b1e9a07c3d85f2e6a90b7c14d3e58f20a6c91d7";

describe("mappa errori wallet (SPEC-ui §3.3, 1:1 con il backend)", () => {
  const cases: [string, string | undefined, string, string | null][] = [
    ["invalid_format", "address", "invalid_format", "addr"],
    ["invalid_checksum", "address", "invalid_checksum", "addr"],
    ["zero_address", "address", "zero_address", "addr"],
    ["address_blocked", "address", "address_blocked", "addr"],
    ["address_not_allowed", "address", "address_not_allowed", "addr"],
    ["coin_not_enabled", "address", "rail_not_enabled", "addr"],
    ["network_not_enabled", "address", "rail_not_enabled", "addr"],
    ["unsupported_pair", "address", "rail_not_enabled", "addr"],
    ["last6_mismatch", "last6", "last6_mismatch", "last6"],
    ["network_ack_required", "network_ack", "network_ack_required", "netack"],
    ["invalid_legal_name", "payee_legal_name", "invalid_legal_name", "name"],
    ["invalid_country", "payee_country", "invalid_country", "country"],
    ["declaration_required", "declarations.sanctions", "declaration_sanctions", "sanc"],
    ["declaration_required", "declarations.tax", "declaration_tax", "tax"],
    ["suspended", undefined, "suspended", null],
    ["terminated", undefined, "terminated", null],
    ["program_closed", undefined, "program_closed", null],
    // guasti: «non è cambiato niente, riprova»
    ["screening_unavailable", undefined, "network", null],
    ["save_failed", undefined, "network", null],
    ["too_many_requests", undefined, "network", null],
    ["qualcosa_di_nuovo", undefined, "network", null],
  ];
  it.each(cases)("%s (%s) → %s / %s", (error, field, key, f) => {
    expect(mapWalletError(error, field)).toEqual({ key, field: f });
  });
  it("senza corpo (rete) → messaggio di rete", () => {
    expect(mapWalletError(undefined, undefined)).toEqual({ key: "network", field: null });
  });
  it("ogni chiave ha il testo in it e en, non vuoto", () => {
    for (const lang of ["it", "en"] as const) {
      for (const [k, v] of Object.entries(AFF_COPY[lang].walletErr)) expect(v, `${lang}.${k}`).toMatch(/\S/);
    }
  });
  it("it e en hanno le stesse chiavi", () => {
    const keys = (o: unknown, p = ""): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(AFF_COPY.en).sort()).toEqual(keys(AFF_COPY.it).sort());
  });
  it("il testo per lo screening non spiega il motivo", () => {
    expect(AFF_COPY.it.walletErr.address_not_allowed).not.toMatch(/BetRedge|contratt|denylist/i);
    expect(AFF_COPY.it.walletErr.address_blocked).not.toMatch(/sanzion|lista|rischio/i);
    expect(AFF_COPY.en.walletErr.address_blocked).not.toMatch(/sanction|list|risk/i);
  });
});

describe("controlli locali dell'indirizzo", () => {
  it("accetta un indirizzo di forma valida", () => expect(checkAddressLocal(A)).toBeNull());
  it("Tron (T + 34)", () => {
    const t = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(looksLikeTron(t)).toBe(true);
    expect(checkAddressLocal(t)).toBe("tron_address");
  });
  it("forma sbagliata", () => {
    expect(checkAddressLocal("0x123")).toBe("invalid_format");
    expect(checkAddressLocal("")).toBe("invalid_format");
  });
  it("indirizzo zero", () => expect(checkAddressLocal("0x" + "0".repeat(40))).toBe("zero_address"));
  it("ultime 6 cifre, case-insensitive", () => {
    expect(last6Matches(A, "6C91D7")).toBe(true);
    expect(last6Matches(A, "6c91d8")).toBe(false);
    expect(last6Matches(A, "91d7")).toBe(false);
  });
});

describe("mappa stati (parola + forma, ogni stato)", () => {
  const c = AFF_COPY.it;
  it("payout", () => {
    expect(payoutChip("created", c)).toEqual({ state: "created", label: "In preparazione", check: false });
    expect(payoutChip("submitted", c).label).toBe("Inviato · in conferma");
    expect(payoutChip("paid", c)).toEqual({ state: "paid", label: "Pagato", check: true });
    expect(payoutChip("cancelled", c).label).toBe("Annullato");
  });
  it("commissioni", () => {
    const base = { payable_after: "2026-12-08T00:00:00Z", paid_out_at: null };
    expect(commissionChip({ ...base, status: "pending" }, c, "it")?.state).toBe("hold");
    expect(commissionChip({ ...base, status: "pending" }, c, "it")?.label).toMatch(/^In verifica · dal/);
    expect(commissionChip({ ...base, status: "payable" }, c, "it")?.label).toBe("Maturata");
    expect(commissionChip({ ...base, status: "in_payout" }, c, "it")?.label).toBe("In pagamento");
    expect(commissionChip({ ...base, status: "paid", paid_out_at: "2026-10-05T10:00:00Z" }, c, "it")).toMatchObject({ state: "paid", check: true });
    expect(commissionChip({ ...base, status: "reversed" }, c, "it")?.state).toBe("void");
    expect(commissionChip({ ...base, status: "void" }, c, "it")?.label).toBe("Stornata");
    expect(commissionChip({ ...base, status: "shadow" }, c, "it")).toBeNull();
  });
  it("annullo: solo codici enumerati, mai il testo libero", () => {
    expect(cancelText("wallet_changed", c)).toMatch(/cambiato wallet/);
    expect(cancelText("wallet_removed", c)).toMatch(/rimosso il wallet/);
    expect(cancelText("admin_cancelled", c)).toMatch(/Annullato da noi/);
    expect(cancelText("tx_dropped", c)).toMatch(/non è andato a buon fine/);
    expect(cancelText("affiliate_suspended", c)).toMatch(/sospesi per una verifica/);
    expect(cancelText("affiliate_suspended", AFF_COPY.en)).toMatch(/paused for a review/);
    expect(cancelText("qualunque", c)).toMatch(/Annullato da noi/);
  });
});

describe("formattazione", () => {
  it("importi", () => {
    expect(usd(23.39, "it")).toBe("$23,39");
    expect(usd(-6, "it")).toBe("−$6,00");
    expect(usd(23.39, "en")).toBe("$23.39");
  });
  it("period_month è il mese di ESECUZIONE", () => {
    expect(monthLabel("2026-10-01", AFF_COPY.it.months)).toBe("Ottobre 2026");
    expect(monthLabel("2026-10-01", AFF_COPY.en.months)).toBe("October 2026");
  });
  it("hash corto", () => expect(shortHash("0x7c2e41a9b05d3f68e1a4c7092bd5f3e86a10c4d79e2b58f3a6c0d1e4b7295f83")).toBe("0x7c2e…5f83"));
  it("indirizzo a gruppi, primi e ultimi 6 evidenziati, nessun carattere perso", () => {
    const g = addressGroups(A);
    const joined = g.map((x) => x.map((p) => p.text).join("")).join("");
    expect(joined).toBe(A);
    const hl = g.flat().filter((p) => p.hl).map((p) => p.text).join("|");
    expect(hl).toBe("4b1e9a|6c91d7");
  });
  it("fill lascia visibile una chiave mancante", () => expect(fill("a {x} {y}", { x: 1 })).toBe("a 1 {y}"));
  it("lingua: it, altrimenti en", () => {
    expect(affLang("it")).toBe("it");
    expect(affLang("fr")).toBe("en");
    expect(affLang(undefined)).toBe("en");
  });
});

describe("admin: testi", () => {
  it("ogni motivo di esclusione del server ha una frase, anche below_threshold", () => {
    for (const r of ["below_threshold", "no_wallet", "wallet_cooldown", "not_screened", "rail_disabled", "missing_payee", "suspended", "already_created"]) {
      expect(reasonText(r)).not.toBe("non pagabile ora");
    }
    expect(reasonText("boh")).toBe("non pagabile ora");
  });
  it("ogni motivo di rifiuto del verificatore ha una frase", () => {
    for (const r of ["not_found", "tx_failed", "wrong_token", "wrong_recipient", "wrong_sender", "amount_too_low", "invalid_format", "network_not_supported"]) {
      expect(TX_REJECT_TEXT[r]).toMatch(/\S/);
    }
  });
  it("errori tx: neutro sul sconosciuto, mai il codice grezzo", () => {
    expect(txErrorText("hash_already_used")).toMatch(/già stato usato/);
    expect(txErrorText("zzz")).not.toMatch(/zzz/);
  });
  it("txFailText: ogni reason di tx_not_droppable, nonce_unknown, hash scartato; mai «pagare di nuovo»", () => {
    for (const reason of ["tx_on_chain", "tx_pending", "nonce_not_consumed", "not_finalized", "transfer_found"]) {
      const t = txFailText({ error: "tx_not_droppable", reason });
      expect(t).toMatch(/\S/);
      expect(t).not.toMatch(/pagare di nuovo|paga di nuovo|ripaga/i);
    }
    expect(txFailText({ error: "nonce_unknown" })).toMatch(/nonce/);
    expect(txFailText({ error: "block_unknown" })).toMatch(/blocco/);
    expect(txFailText({ error: "from_unknown" })).toMatch(/mittente/);
    expect(TX_REJECT_TEXT.amount_too_low).toMatch(/0,01.*ESATTO/);
    expect(txFailText({ error: "hash_already_used", dropped: true })).toMatch(/annullato perché la transazione era sparita/);
    expect(txFailText({ error: "hash_already_used" })).toMatch(/già stato usato/);
    expect(txFailText({ error: "tx_not_droppable", reason: "boh" })).not.toMatch(/boh/);
  });
  it("total_mismatch mostra la differenza", () => {
    const t = createErrorText({ error: "total_mismatch", expected: "349.20", actual: "412.60" }, (n) => usd(n, "it"));
    expect(t).toMatch(/atteso \$349,20, ora \$412,60/);
    expect(t).toMatch(/\+\$63,40/);
    expect(t).toMatch(/Non è stato creato niente/);
  });
  it("mesi", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});

// #INVITE-TIERS-COPY-1022: the static copy (lede, join numbers, rules) spells out
// the renewal ladder; if the default ladder changes, this fails and the copy must follow.
describe("copy della scala sui rinnovi = DEFAULT_TIERS", () => {
  it("lede, numeri d'iscrizione e regole citano ogni gradino (it/en)", async () => {
    const { DEFAULT_TIERS } = await import("@/lib/affiliate/tiers");
    for (const l of ["it", "en"] as const) {
      const c = AFF_COPY[l];
      for (const text of [c.head.lede, `${c.enroll.t2v} ${c.enroll.t2}`, c.rules.r1, c.levels.l1b]) {
        expect(text).toMatch(/\b7%/);
        for (const s of DEFAULT_TIERS) {
          expect(text, `${l}: ${text}`).toContain(`${Math.round(s.rate * 100)}%`);
          expect(text, `${l}: ${text}`).toMatch(new RegExp(`\\b${s.min}\\b`));
        }
      }
    }
  });
});

// #INVITE-TIERS-HOW-1022: «Come funzionano i livelli» — soglie, 20% sul primo acquisto del
// referito che fa scattare il livello, nessuna stima di guadagno.
describe("copy «come funzionano i livelli»", () => {
  it("cita la prima soglia, il 20% del primo acquisto e niente importi o promesse (it/en)", async () => {
    const { DEFAULT_TIERS } = await import("@/lib/affiliate/tiers");
    const [first, second] = DEFAULT_TIERS;
    for (const l of ["it", "en"] as const) {
      const v = AFF_COPY[l].levels;
      const all = Object.values(v).join(" ");
      expect(v.l3b).toMatch(new RegExp(`\\b${first.min}(°|th)`));
      expect(v.l3b).toMatch(new RegExp(`\\b${second.min}(°|th)`));
      expect(v.l3b).toContain("20%");
      expect(v.l3b).toContain(`${Math.round(first.rate * 100)}%`);
      expect(v.l3b).toContain(`${Math.round(second.rate * 100)}%`);
      expect(v.example).toContain(`${first.min - 1} `);
      expect(v.example).toContain(`${Math.round(first.rate * 100)}%`);
      expect(all).not.toMatch(/\$\s?\d|\d\s?\$|guadagn|garantit|earn|guarantee/i);
    }
  });
});
