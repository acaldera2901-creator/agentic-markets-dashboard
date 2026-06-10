import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { siteOrigin, hashActivationToken, tokenHashMatches } from "@/lib/activation";

export const dynamic = "force-dynamic";

// HIGH-3: account activation. The user lands here from the link in the
// activation email. We verify the token (only its SHA-256 hash is stored),
// mark the profile activated, drop the token, issue the session cookie, and
// redirect into the app. An expired/invalid/missing token never activates.

type Row = {
  identifier: string;
  activated_at: string | null;
  activation_token_hash: string | null;
  activation_token_expires: string | null;
};

function redirect(req: Request, query: string): NextResponse {
  return NextResponse.redirect(`${siteOrigin(req)}/${query}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const id = (url.searchParams.get("id") ?? "").trim().toLowerCase();
  if (!token || !id) return redirect(req, "?activation=invalid");

  const rows = await dbQuery<Row>(
    "SELECT identifier, activated_at, activation_token_hash, activation_token_expires FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1",
    [id]
  );
  const row = rows[0];
  if (!row) return redirect(req, "?activation=invalid");

  // Already activated → just send them in to log in normally.
  if (row.activated_at) return redirect(req, "?activation=already");

  if (!row.activation_token_hash || !row.activation_token_expires) {
    return redirect(req, "?activation=invalid");
  }
  if (new Date(row.activation_token_expires).getTime() < Date.now()) {
    return redirect(req, "?activation=expired");
  }

  if (!tokenHashMatches(hashActivationToken(token), row.activation_token_hash)) {
    return redirect(req, "?activation=invalid");
  }

  try {
    await dbExecute(
      "UPDATE profiles SET activated_at = NOW(), activation_token_hash = NULL, activation_token_expires = NULL, updated_at = NOW() WHERE identifier = $1",
      [row.identifier]
    );
  } catch (e) {
    console.error("[auth/activate] activation write failed:", String(e));
    return redirect(req, "?activation=error");
  }

  // Activated → issue the session cookie and land on the board.
  const res = redirect(req, "?activated=1");
  res.cookies.set(SESSION_COOKIE, signSession(row.identifier), SESSION_COOKIE_OPTIONS);
  return res;
}
