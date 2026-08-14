// /api/admin/blog — il gate UMANO draft->published del blog Soro
// (#BLOG-SSR-0814; la forma "azione esplicita gated" promessa nella migration
// 20260813130000_blog_posts.sql). Il poller non pubblica mai: pubblica solo
// chi passa da qui con ADMIN_SECRET/sessione admin.
//
// GET  -> lista di tutti i post (draft + published) per la revisione.
// POST -> { slug, action: "publish" | "unpublish" }.
//   publish: published_at = COALESCE(published_at, now()) — un re-publish dopo
//   un unpublish conserva la data originale, niente date che "ringiovaniscono".
//   Il content_html NON si tocca mai da qui (il poller è ON CONFLICT DO
//   NOTHING, le correzioni editoriali a mano restano).
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQueryStrict, dbExecute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Fail-loud (dbQueryStrict): su una superficie admin un DB down deve essere
  // un 500 visibile, non una lista vuota che sembra "nessuna bozza".
  try {
    const posts = await dbQueryStrict(
      `SELECT guid, slug, title, description, status, pub_date, published_at, created_at
       FROM blog_posts
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slug?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const action = body.action;
  if (!slug || (action !== "publish" && action !== "unpublish")) {
    return NextResponse.json(
      { error: "Expected { slug, action: 'publish' | 'unpublish' }" },
      { status: 400 }
    );
  }

  try {
    const rows =
      action === "publish"
        ? await dbExecute(
            `UPDATE blog_posts
             SET status = 'published', published_at = COALESCE(published_at, now())
             WHERE slug = $1
             RETURNING slug, status, published_at`,
            [slug]
          )
        : await dbExecute(
            `UPDATE blog_posts
             SET status = 'draft'
             WHERE slug = $1
             RETURNING slug, status, published_at`,
            [slug]
          );
    if (rows.length === 0) {
      return NextResponse.json({ error: `No post with slug '${slug}'` }, { status: 404 });
    }
    console.log(`[admin/blog] ${action} slug=${slug}`);
    // Nota ISR: le pagine /blog e /blog/<slug> hanno revalidate 600 — il
    // publish è servito entro 10 minuti senza deploy.
    return NextResponse.json({ ok: true, post: rows[0] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
