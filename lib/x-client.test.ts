// lib/x-client.test.ts — #X-PIPELINE-0810
//
// Two things are worth testing on a client with no credentials to try:
//   1. the OAuth 1.0a signature, against X's OWN published worked example. This
//      is the only part of the file that can be wrong in a way no HTTP error
//      would explain, and it is verifiable offline.
//   2. the fail-closed paths, asserted by proving fetch was never called. A
//      "silent send" bug looks identical to a refusal from the return value
//      alone — the only real evidence is that no request left the process.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  oauth1Header,
  resolveXCredentials,
  postTweet,
  uploadMedia,
  publishWithMedia,
  X_MEDIA_MAX_BYTES,
} from "./x-client";

const CREDS = {
  apiKey: "k",
  apiSecret: "ks",
  accessToken: "t",
  accessSecret: "ts",
};

const FULL_ENV = {
  X_API_KEY: "k",
  X_API_SECRET: "ks",
  X_ACCESS_TOKEN: "t",
  X_ACCESS_SECRET: "ts",
  X_PUBLISH_ENABLED: "true",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  // The client logs every refusal on purpose; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("oauth1Header", () => {
  it("riproduce la firma dell'esempio pubblicato da X", () => {
    // docs.x.com/resources/fundamentals/authentication/oauth-1-0a/creating-a-signature
    // — stessi consumer/token secret, nonce, timestamp, host api.x.com e status.
    // Se questa asserzione cade, la firma è sbagliata e X risponderà 401 su
    // OGNI chiamata: è l'unico modo di accorgersene senza credenziali vere.
    const header = oauth1Header(
      "POST",
      "https://api.x.com/1.1/statuses/update.json?include_entities=true",
      {
        apiKey: "xvz1evFS4wEEPTGEFPHBog",
        apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
        accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        accessSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      },
      {
        extraSignedParams: { status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
        nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
        timestampSeconds: 1318622958,
      }
    );
    const signature = decodeURIComponent(header.match(/oauth_signature="([^"]+)"/)![1]);
    expect(signature).toBe("Ls93hJiZbQ3akF3HF3x1Bz8/zU4=");
  });

  it("porta tutti i campi OAuth obbligatori, percent-encoded", () => {
    const header = oauth1Header("POST", "https://api.x.com/2/tweets", CREDS);
    for (const field of [
      "oauth_consumer_key",
      "oauth_nonce",
      "oauth_signature",
      "oauth_signature_method",
      "oauth_timestamp",
      "oauth_token",
      "oauth_version",
    ]) {
      expect(header, field).toContain(`${field}="`);
    }
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(header.startsWith("OAuth ")).toBe(true);
  });

  it("cambia firma se cambia il nonce (non è una costante mascherata)", () => {
    const a = oauth1Header("POST", "https://api.x.com/2/tweets", CREDS, { nonce: "a", timestampSeconds: 1 });
    const b = oauth1Header("POST", "https://api.x.com/2/tweets", CREDS, { nonce: "b", timestampSeconds: 1 });
    expect(a).not.toBe(b);
  });
});

describe("resolveXCredentials — fail-closed", () => {
  it("elenca le env mancanti invece di tornare credenziali parziali", () => {
    const r = resolveXCredentials({ X_API_KEY: "k", X_PUBLISH_ENABLED: "true" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("missing_credentials");
    expect(r.detail).toContain("X_API_SECRET");
    expect(r.detail).toContain("X_ACCESS_TOKEN");
    expect(r.detail).toContain("X_ACCESS_SECRET");
  });

  it("rifiuta le env riempite di spazi", () => {
    const r = resolveXCredentials({ ...FULL_ENV, X_ACCESS_SECRET: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_credentials");
  });

  it("con le chiavi presenti ma senza X_PUBLISH_ENABLED non abilita nulla", () => {
    const r = resolveXCredentials({ ...FULL_ENV, X_PUBLISH_ENABLED: undefined });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("publishing_disabled");
  });

  it("passa solo con tutte e quattro le chiavi e il flag a \"true\"", () => {
    const r = resolveXCredentials(FULL_ENV);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.accessSecret).toBe("ts");
  });
});

describe("nessun invio silenzioso", () => {
  it("postTweet senza credenziali NON chiama fetch e non lancia", async () => {
    const fetchImpl = vi.fn();
    const r = await postTweet({ text: "ciao" }, { env: {}, fetchImpl: fetchImpl as never });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_credentials");
  });

  it("uploadMedia senza credenziali NON chiama fetch", async () => {
    const fetchImpl = vi.fn();
    const r = await uploadMedia(new Uint8Array([1, 2, 3]), { env: {}, fetchImpl: fetchImpl as never });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });

  it("publishWithMedia col flag spento NON chiama fetch", async () => {
    const fetchImpl = vi.fn();
    const r = await publishWithMedia(
      { text: "ciao", media: new Uint8Array([1]) },
      { env: { ...FULL_ENV, X_PUBLISH_ENABLED: "false" }, fetchImpl: fetchImpl as never }
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("publishing_disabled");
  });

  it("un testo vuoto non diventa un post vuoto", async () => {
    const fetchImpl = vi.fn();
    const r = await postTweet({ text: "   " }, { creds: CREDS, fetchImpl: fetchImpl as never });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_text");
  });

  it("un'immagine sopra il limite di X viene fermata prima della rete", async () => {
    const fetchImpl = vi.fn();
    const r = await uploadMedia(new Uint8Array(X_MEDIA_MAX_BYTES + 1), {
      creds: CREDS,
      fetchImpl: fetchImpl as never,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("media_too_large");
  });
});

describe("le due chiamate", () => {
  it("upload poi tweet, con il media id agganciato al post", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, body: init?.body });
      if (u.includes("/2/media/upload")) return jsonResponse({ data: { id: "media-42" } });
      return jsonResponse({ data: { id: "post-7", text: "ciao" } });
    });

    const r = await publishWithMedia(
      { text: "ciao", media: new Uint8Array([1, 2, 3]) },
      { creds: CREDS, fetchImpl: fetchImpl as never }
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({ id: "post-7", text: "ciao", mediaId: "media-42" });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("/2/media/upload");
    expect(calls[1].url).toContain("/2/tweets");
    expect(JSON.parse(calls[1].body as string)).toEqual({
      text: "ciao",
      media: { media_ids: ["media-42"] },
    });
  });

  it("se l'upload fallisce il post NON parte (mai una card promessa e non allegata)", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/2/media/upload")) return jsonResponse({ detail: "nope" }, 403);
      throw new Error("il tweet non deve partire");
    });
    const r = await publishWithMedia(
      { text: "ciao", media: new Uint8Array([1]) },
      { creds: CREDS, fetchImpl: fetchImpl as never }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("http_error");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("legge il media id anche nella forma v1.1 media_id_string", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ media_id_string: "999" }));
    const r = await uploadMedia(new Uint8Array([1]), { creds: CREDS, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("999");
  });

  it("un media id assente è un errore, non un undefined agganciato al post", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }));
    const r = await uploadMedia(new Uint8Array([1]), { creds: CREDS, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_response");
  });

  it("un errore di rete torna come risultato, non come eccezione", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const r = await postTweet({ text: "ciao" }, { creds: CREDS, fetchImpl: fetchImpl as never });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("network_error");
      expect(r.detail).toContain("ECONNRESET");
    }
  });

  it("il post senza media non manda il campo media", async () => {
    let sent = "";
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent = String(init?.body);
      return jsonResponse({ data: { id: "1", text: "x" } });
    });
    await postTweet({ text: "x" }, { creds: CREDS, fetchImpl: fetchImpl as never });
    expect(JSON.parse(sent)).toEqual({ text: "x" });
  });
});
