import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "test-secret-abcdefghijklmnop"; // >=16, come richiede getSecret()
const original = process.env.SESSION_SECRET;

beforeEach(() => { process.env.SESSION_SECRET = SECRET; });
afterEach(() => {
  if (original === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = original;
});

describe("verifySession", () => {
  // #SESSION-ANON-0829 — un visitatore anonimo non ha NESSUNA sessione da
  // verificare: il segreto non gli serve. Finché stava in un parametro di
  // default (`secret = getSecret()`), JavaScript lo valutava PRIMA del corpo
  // della funzione, quindi la guardia `if (!token) return null` non veniva mai
  // raggiunta: senza SESSION_SECRET ogni pagina pubblica rispondeva 500 invece
  // di comportarsi da anonima. Su Vercel Preview era esattamente così.
  it("senza segreto un anonimo resta anonimo, non fa cadere la rotta", () => {
    delete process.env.SESSION_SECRET;
    expect(verifySession(null)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("")).toBeNull();
  });

  it("senza segreto anche un cookie di forma non valida resta anonimo", () => {
    delete process.env.SESSION_SECRET;
    expect(verifySession("non-e-un-token")).toBeNull();
  });

  // L'asimmetria è voluta: qui una sessione VERA c'è, e dire "non autenticato"
  // sloggherebbe in silenzio chi era loggato. Un segreto mancante su una
  // sessione reale è una configurazione rotta e deve gridare (stessa dottrina
  // di dbQueryStrict).
  it("con un cookie ben formato ma senza segreto grida, non slogga in silenzio", () => {
    const token = signSession("andrea@test.io");
    delete process.env.SESSION_SECRET;
    expect(() => verifySession(token)).toThrow(/SESSION_SECRET/);
  });

  it("firma e verifica fanno andata e ritorno", () => {
    const token = signSession("andrea@test.io");
    expect(verifySession(token)?.identifier).toBe("andrea@test.io");
  });

  it("una firma manomessa non passa", () => {
    const token = signSession("andrea@test.io");
    expect(verifySession(token.slice(0, -3) + "aaa")).toBeNull();
  });

  it("un token firmato con un ALTRO segreto non passa", () => {
    const token = signSession("andrea@test.io", "un-altro-segreto-lunghissimo");
    expect(verifySession(token)).toBeNull();
  });
});
