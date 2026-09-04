// lib/x-client.ts — #X-PIPELINE-0810 · publisher for the BetRedge daily cadence on X.
//
// ── WHY OAuth 1.0a AND NOT OAuth 2.0 ────────────────────────────────────────
// Verified 2026-08-10 on docs.x.com:
//   • POST /2/tweets accepts BOTH schemes: "OAuth 2.0 Authorization Code Flow"
//     (scope tweet.write) and "User Token (HTTP OAuth scheme)" = OAuth 1.0a
//     user context.
//   • The media leg does NOT. POST /2/media/upload is documented as available to
//     OAuth 1.0a user context, while multiple current reports have an OAuth 2.0
//     user token that works on /2/tweets returning 403 on /2/media/upload. The
//     legacy v1.1 upload endpoint never supported OAuth 2.0 at all.
//   ⇒ OAuth 1.0a is the only single credential set that covers BOTH calls.
// Second reason, decisive for a cron publisher: OAuth 1.0a is four static
// long-lived strings from the developer portal. An OAuth 2.0 user token expires
// in 2h and needs refresh-token rotation plus somewhere to persist the rotating
// token — infrastructure this pipeline would carry for no benefit.
//
// ── TWO CALLS, NOT ONE ──────────────────────────────────────────────────────
// Publishing an image is two separate endpoints: upload the bytes first
// (POST /2/media/upload → media id), then create the post referencing that id
// (POST /2/tweets with media.media_ids). uploadMedia() and postTweet() mirror
// that split; publishWithMedia() chains them and stops at the first failure so a
// failed upload never produces a text-only post that was meant to carry a card.
//
// ── FAIL-CLOSED ─────────────────────────────────────────────────────────────
// Nothing here throws and nothing here sends without complete configuration:
// every function returns a discriminated XResult. Two gates must BOTH be open:
//   1. all four OAuth 1.0a credentials present in env;
//   2. X_PUBLISH_ENABLED === "true".
// Gate 2 exists because of a real incident on the Telegram side of this same
// cadence (2026-06-22: a manual "send all upcoming" run spammed 28 cards). With
// the keys in .env, any script that imports this module could publish; the flag
// makes publishing an explicit, auditable decision instead of a side effect of
// having credentials.

import { createHmac, randomBytes } from "node:crypto";

const MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
const TWEETS_URL = "https://api.x.com/2/tweets";
const REQUEST_TIMEOUT_MS = 20_000;

// X's own limit for an image uploaded via the API (docs.x.com media limits).
export const X_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export type XCredentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
};

export type XFailureReason =
  | "missing_credentials"
  | "publishing_disabled"
  | "empty_text"
  | "media_too_large"
  | "http_error"
  | "network_error"
  | "bad_response";

export type XResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: XFailureReason; detail: string };

function fail<T>(reason: XFailureReason, detail: string): XResult<T> {
  // Every refusal is logged: a fail-closed path that says nothing is
  // indistinguishable from a successful send in the daemon log.
  console.error(`[x-client] ${reason}: ${detail}`);
  return { ok: false, reason, detail };
}

const CREDENTIAL_ENV = {
  apiKey: "X_API_KEY",
  apiSecret: "X_API_SECRET",
  accessToken: "X_ACCESS_TOKEN",
  accessSecret: "X_ACCESS_SECRET",
} as const;

/** Both gates, in one place. Never partially configured: all four keys or none. */
export function resolveXCredentials(
  env: Record<string, string | undefined> = process.env
): XResult<XCredentials> {
  const missing = Object.values(CREDENTIAL_ENV).filter((k) => !env[k]?.trim());
  if (missing.length > 0) {
    return fail("missing_credentials", `env mancanti: ${missing.join(", ")}`);
  }
  if (env.X_PUBLISH_ENABLED !== "true") {
    return fail(
      "publishing_disabled",
      'X_PUBLISH_ENABLED != "true" — credenziali presenti ma pubblicazione non abilitata'
    );
  }
  return {
    ok: true,
    value: {
      apiKey: env[CREDENTIAL_ENV.apiKey]!.trim(),
      apiSecret: env[CREDENTIAL_ENV.apiSecret]!.trim(),
      accessToken: env[CREDENTIAL_ENV.accessToken]!.trim(),
      accessSecret: env[CREDENTIAL_ENV.accessSecret]!.trim(),
    },
  };
}

// RFC 3986 percent-encoding: encodeURIComponent leaves !'()* alone, OAuth does not.
function pctEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * OAuth 1.0a HMAC-SHA1 Authorization header.
 *
 * `extraSignedParams` carries form-encoded BODY parameters into the signature
 * base string. We never send a form-encoded body (JSON and multipart bodies are
 * correctly excluded from the signature), but X's own worked example is a
 * form-encoded POST — keeping the parameter lets the test pin this signer
 * against that published vector instead of against itself.
 */
export function oauth1Header(
  method: string,
  url: string,
  creds: XCredentials,
  opts: {
    extraSignedParams?: Record<string, string>;
    nonce?: string;
    timestampSeconds?: number;
  } = {}
): string {
  const parsed = new URL(url);
  const baseUrl = `${parsed.origin}${parsed.pathname}`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: opts.nonce ?? randomBytes(24).toString("base64url"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(opts.timestampSeconds ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const signed: Record<string, string> = { ...oauthParams, ...(opts.extraSignedParams ?? {}) };
  parsed.searchParams.forEach((v, k) => {
    signed[k] = v;
  });

  const paramString = Object.keys(signed)
    .map((k) => [pctEncode(k), pctEncode(signed[k])] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${pctEncode(baseUrl)}&${pctEncode(paramString)}`;
  const signingKey = `${pctEncode(creds.apiSecret)}&${pctEncode(creds.accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  const header = Object.entries({ ...oauthParams, oauth_signature: signature })
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${pctEncode(k)}="${pctEncode(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}

type FetchLike = typeof fetch;

async function request(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit
): Promise<XResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (e) {
    return fail("network_error", `${url}: ${String(e)}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await resp.text().catch(() => "");
  if (!resp.ok) {
    return fail("http_error", `${url} → ${resp.status}: ${body.slice(0, 300)}`);
  }
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return fail("bad_response", `${url}: risposta non JSON: ${body.slice(0, 200)}`);
  }
}

/**
 * First of the two calls: upload the PNG bytes, get a media id back.
 *
 * The id lives in `data.id` on /2/media/upload; the v1.1 endpoint used
 * `media_id_string` and some responses still carry it. Both are read because
 * this could not be verified against the live API (no credentials — see
 * docs/x-api-limits.md), and reading only one of the two would fail silently
 * with a media id of `undefined` attached to a real post.
 */
export async function uploadMedia(
  media: Uint8Array,
  opts: {
    creds?: XCredentials;
    env?: Record<string, string | undefined>;
    mediaCategory?: string;
    contentType?: string;
    fetchImpl?: FetchLike;
  } = {}
): Promise<XResult<string>> {
  const creds = opts.creds ?? (() => {
    const r = resolveXCredentials(opts.env);
    return r.ok ? r.value : null;
  })();
  if (!creds) return resolveXCredentials(opts.env) as XResult<string>;

  if (media.byteLength === 0) return fail("empty_text", "media vuoto: 0 byte");
  if (media.byteLength > X_MEDIA_MAX_BYTES) {
    return fail(
      "media_too_large",
      `${media.byteLength} byte > limite X di ${X_MEDIA_MAX_BYTES}`
    );
  }

  const form = new FormData();
  form.set(
    "media",
    new Blob([new Uint8Array(media)], { type: opts.contentType ?? "image/png" }),
    "card.png"
  );
  form.set("media_category", opts.mediaCategory ?? "tweet_image");

  const res = await request(opts.fetchImpl ?? fetch, MEDIA_UPLOAD_URL, {
    method: "POST",
    // No content-type header: fetch must set the multipart boundary itself.
    // A multipart body is NOT part of the OAuth 1.0a signature base string.
    headers: { authorization: oauth1Header("POST", MEDIA_UPLOAD_URL, creds) },
    body: form,
  });
  if (!res.ok) return res as XResult<string>;

  const payload = res.value as {
    data?: { id?: string };
    id?: string;
    media_id_string?: string;
  };
  const id = payload?.data?.id ?? payload?.media_id_string ?? payload?.id;
  if (typeof id !== "string" || id.length === 0) {
    return fail("bad_response", `media id assente nella risposta: ${JSON.stringify(payload).slice(0, 200)}`);
  }
  return { ok: true, value: id };
}

/** Second of the two calls: create the post, optionally referencing media ids. */
export async function postTweet(
  input: { text: string; mediaIds?: string[] },
  opts: {
    creds?: XCredentials;
    env?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  } = {}
): Promise<XResult<{ id: string; text: string }>> {
  const creds = opts.creds ?? (() => {
    const r = resolveXCredentials(opts.env);
    return r.ok ? r.value : null;
  })();
  if (!creds) return resolveXCredentials(opts.env) as XResult<{ id: string; text: string }>;

  const text = input.text.trim();
  if (!text) return fail("empty_text", "testo vuoto: nessun post inviato");

  const body: Record<string, unknown> = { text };
  if (input.mediaIds && input.mediaIds.length > 0) {
    body.media = { media_ids: input.mediaIds };
  }

  const res = await request(opts.fetchImpl ?? fetch, TWEETS_URL, {
    method: "POST",
    headers: {
      authorization: oauth1Header("POST", TWEETS_URL, creds),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return res as XResult<{ id: string; text: string }>;

  const payload = res.value as { data?: { id?: string; text?: string } };
  const id = payload?.data?.id;
  if (typeof id !== "string" || id.length === 0) {
    return fail("bad_response", `post id assente: ${JSON.stringify(payload).slice(0, 200)}`);
  }
  return { ok: true, value: { id, text: payload.data?.text ?? text } };
}

/**
 * Both calls, in order, aborting on the first failure.
 *
 * `media` is raw bytes and not a path on purpose: the probability card is
 * rendered in memory by the Maven Studio worker (satori → resvg → Buffer, sent
 * straight to Telegram, never written to disk). Taking the buffer means the same
 * card object reaches X with no file round-trip and no second renderer.
 */
export async function publishWithMedia(
  input: { text: string; media: Uint8Array; contentType?: string },
  opts: {
    creds?: XCredentials;
    env?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  } = {}
): Promise<XResult<{ id: string; text: string; mediaId: string }>> {
  const credsResult = opts.creds ? { ok: true as const, value: opts.creds } : resolveXCredentials(opts.env);
  if (!credsResult.ok) return credsResult;

  const upload = await uploadMedia(input.media, {
    creds: credsResult.value,
    contentType: input.contentType,
    fetchImpl: opts.fetchImpl,
  });
  if (!upload.ok) return upload;

  const tweet = await postTweet(
    { text: input.text, mediaIds: [upload.value] },
    { creds: credsResult.value, fetchImpl: opts.fetchImpl }
  );
  if (!tweet.ok) return tweet;

  return { ok: true, value: { ...tweet.value, mediaId: upload.value } };
}
