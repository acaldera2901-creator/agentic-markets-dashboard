import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  base58Decode,
  explorerTxUrl,
  isValidEip55,
  isValidTronAddress,
  maskAddress,
  normalizeTxHash,
  validatePayoutWallet,
} from "./wallet";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Encoder di sola prova: costruisce indirizzi Tron validi da 20 byte noti, così
// il test non dipende solo da un indirizzo copiato.
function tronFrom(body20: number[]): string {
  const payload = Buffer.from([0x41, ...body20]);
  const sha = (b: Buffer) => createHash("sha256").update(b).digest();
  const full = Buffer.concat([payload, sha(sha(payload)).subarray(0, 4)]);
  let n = BigInt(`0x${full.toString("hex")}`);
  let out = "";
  while (n > BigInt(0)) {
    out = B58[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  return out;
}

// Contratto USDT su Tron: indirizzo pubblico notissimo, valido per costruzione.
const USDT_TRON_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const EVM = "0x52908400098527886E0F7030069857D2E4169EE7";

describe("isValidTronAddress", () => {
  it("accetta un indirizzo reale noto", () => {
    expect(isValidTronAddress(USDT_TRON_CONTRACT)).toBe(true);
  });

  it("accetta indirizzi costruiti con il checksum giusto", () => {
    const a = tronFrom(Array.from({ length: 20 }, (_, i) => i * 7 + 3));
    expect(a).toMatch(/^T/);
    expect(isValidTronAddress(a)).toBe(true);
  });

  it("rifiuta un refuso di un carattere (checksum)", () => {
    const typo = USDT_TRON_CONTRACT.slice(0, 10) + (USDT_TRON_CONTRACT[10] === "a" ? "b" : "a") + USDT_TRON_CONTRACT.slice(11);
    expect(isValidTronAddress(typo)).toBe(false);
  });

  it("rifiuta caratteri fuori dall'alfabeto base58 (0, O, I, l)", () => {
    expect(isValidTronAddress("T0" + USDT_TRON_CONTRACT.slice(2))).toBe(false);
    expect(base58Decode("0OIl")).toBeNull();
  });
});

describe("validatePayoutWallet", () => {
  it("USDT su Tron valido, con spazi e minuscole normalizzati", () => {
    expect(validatePayoutWallet({ coin: " usdt ", network: "TRON", address: ` ${USDT_TRON_CONTRACT} ` })).toEqual({
      ok: true,
      coin: "USDT",
      network: "tron",
      address: USDT_TRON_CONTRACT,
    });
  });

  it("USDT su Polygon valido", () => {
    expect(validatePayoutWallet({ coin: "USDT", network: "polygon", address: EVM })).toMatchObject({ ok: true });
  });

  it("rete sbagliata per il formato: indirizzo Tron su Polygon e viceversa", () => {
    expect(validatePayoutWallet({ coin: "USDT", network: "polygon", address: USDT_TRON_CONTRACT })).toEqual({
      ok: false,
      reason: "invalid_format",
    });
    expect(validatePayoutWallet({ coin: "USDT", network: "tron", address: EVM })).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });

  it("checksum Tron sbagliato", () => {
    const typo = USDT_TRON_CONTRACT.slice(0, -1) + (USDT_TRON_CONTRACT.endsWith("t") ? "u" : "t");
    expect(validatePayoutWallet({ coin: "USDT", network: "tron", address: typo })).toEqual({
      ok: false,
      reason: "invalid_checksum",
    });
  });

  it("indirizzo zero EVM rifiutato", () => {
    expect(
      validatePayoutWallet({ coin: "USDT", network: "polygon", address: "0x0000000000000000000000000000000000000000" })
    ).toEqual({ ok: false, reason: "zero_address" });
  });

  it("coin, rete e coppia non supportate", () => {
    expect(validatePayoutWallet({ coin: "BTC", network: "tron", address: USDT_TRON_CONTRACT })).toEqual({
      ok: false,
      reason: "unsupported_coin",
    });
    expect(validatePayoutWallet({ coin: "USDT", network: "ethereum", address: EVM })).toEqual({
      ok: false,
      reason: "unsupported_network",
    });
    expect(validatePayoutWallet({ coin: "USDC", network: "tron", address: USDT_TRON_CONTRACT })).toEqual({
      ok: false,
      reason: "unsupported_pair",
    });
  });

  it("input non stringa: nessuna eccezione", () => {
    expect(validatePayoutWallet({ coin: 1, network: null, address: {} })).toEqual({
      ok: false,
      reason: "unsupported_coin",
    });
  });
});

// Vettori ufficiali di EIP-55 (eips.ethereum.org/EIPS/eip-55, "Test Cases").
const EIP55_MIXED = [
  "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
  "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
  "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
];

/** Inverte maiuscola/minuscola della prima lettera hex dopo `0x`. */
function flipFirstLetter(a: string): string {
  const i = [...a].findIndex((c, k) => k > 1 && /[a-f]/i.test(c));
  const c = a[i];
  return a.slice(0, i) + (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) + a.slice(i + 1);
}

describe("isValidEip55 (PR-5, @noble/hashes)", () => {
  it("accetta i vettori ufficiali a maiuscole miste", () => {
    for (const a of EIP55_MIXED) expect(isValidEip55(a)).toBe(true);
  });

  it("tutto minuscolo / tutto maiuscolo: nessun checksum dichiarato, passa", () => {
    expect(isValidEip55(EIP55_MIXED[0].toLowerCase())).toBe(true);
    expect(isValidEip55(`0x${EIP55_MIXED[0].slice(2).toUpperCase()}`)).toBe(true);
  });

  it("una sola lettera col caso sbagliato → checksum non valido", () => {
    for (const a of EIP55_MIXED) expect(isValidEip55(flipFirstLetter(a))).toBe(false);
  });

  it("validatePayoutWallet → invalid_checksum su Polygon a maiuscole miste sbagliate", () => {
    expect(
      validatePayoutWallet({ coin: "USDT", network: "polygon", address: flipFirstLetter(EIP55_MIXED[1]) })
    ).toEqual({ ok: false, reason: "invalid_checksum" });
    expect(validatePayoutWallet({ coin: "USDT", network: "polygon", address: EIP55_MIXED[1] })).toMatchObject({
      ok: true,
      address: EIP55_MIXED[1],
    });
  });

  it("formato sbagliato → false, senza eccezioni", () => {
    expect(isValidEip55("0x123")).toBe(false);
    expect(isValidEip55("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });
});

describe("normalizeTxHash", () => {
  const hex = "AB".repeat(32);
  it("Tron: 64 hex minuscoli, senza 0x", () => {
    expect(normalizeTxHash("tron", hex)).toBe("ab".repeat(32));
    expect(normalizeTxHash("tron", `0x${hex}`)).toBe("ab".repeat(32));
  });
  it("Polygon: 0x + 64 hex minuscoli", () => {
    expect(normalizeTxHash("polygon", hex)).toBe(`0x${"ab".repeat(32)}`);
    expect(normalizeTxHash("polygon", ` 0x${hex} `)).toBe(`0x${"ab".repeat(32)}`);
  });
  it("lunghezza o caratteri sbagliati → null", () => {
    expect(normalizeTxHash("tron", "ab".repeat(31))).toBeNull();
    expect(normalizeTxHash("polygon", "zz".repeat(32))).toBeNull();
    expect(normalizeTxHash("polygon", 42)).toBeNull();
  });
});

describe("explorer e maschera", () => {
  it("link explorer per rete", () => {
    expect(explorerTxUrl("tron", "ab")).toBe("https://tronscan.org/#/transaction/ab");
    expect(explorerTxUrl("polygon", "0xab")).toBe("https://polygon.blockscout.com/tx/0xab");
  });
  it("maschera l'indirizzo", () => {
    expect(maskAddress(USDT_TRON_CONTRACT)).toBe("TR7NHq…Lj6t");
    expect(maskAddress("short")).toBe("short");
  });
});
