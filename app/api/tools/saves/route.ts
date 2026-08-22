// /api/tools/saves — #TOOLS-SAVE-0810
// I calcoli salvati di CHI È LOGGATO, per un tool alla volta. Modello: la rotta
// autenticata di app/api/referral/stats (getSessionPlan + dynamic force-dynamic).
//
// Le 132 pagine /tools restano statiche e pubbliche: questa rotta è l'unico
// pezzo dinamico della feature, e la chiama solo un browser che ha già un
// profilo in locale. Un anonimo non la tocca mai — vede il CTA e basta.
//
// Il piano NON conta: salva anche un profilo free. L'obiettivo del blocco è la
// registrazione, non l'upsell — mettere il salvataggio dietro un piano a
// pagamento tolterebbe il motivo per registrarsi.

import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { getSessionPlan } from "@/lib/auth";
import { isToolSlug } from "@/lib/tools/registry";
import {
  MAX_SAVES_PER_TOOL,
  parseSaveState,
  parseSummary,
  type ToolSave,
} from "@/lib/tools/save-state";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

async function session(req: Request) {
  try {
    return await getSessionPlan(req);
  } catch (e) {
    // Errore DB sulla lettura di sessione: 401 chiuso, non 500 aperto.
    console.error("[tools/saves] session lookup failed:", String(e));
    return null;
  }
}

/** Gli ultimi salvataggi dell'utente per QUEL tool. Filtra per identifier di
 *  sessione: non esiste un parametro per guardare quelli di un altro. */
async function listSaves(identifier: string, slug: string): Promise<ToolSave[]> {
  const rows = await dbQuery<{
    id: number | string;
    summary: string;
    state: unknown;
    created_at: string;
  }>(
    `SELECT id, summary, state, created_at::text AS created_at
       FROM tool_saves
      WHERE identifier = $1 AND slug = $2
      ORDER BY created_at DESC, id DESC
      LIMIT $3`,
    [identifier, slug, MAX_SAVES_PER_TOOL]
  );
  // Uno stato che non passa la validazione è una riga scritta da una versione
  // vecchia (o a mano): si scarta invece di mandare al client qualcosa che
  // applyState rifiuterebbe comunque.
  return rows.flatMap((r) => {
    const state = parseSaveState(r.state);
    return state ? [{ id: Number(r.id), summary: r.summary, state, created_at: r.created_at }] : [];
  });
}

function readSlug(req: Request): string | null {
  const slug = new URL(req.url).searchParams.get("slug") ?? "";
  return isToolSlug(slug) ? slug : null;
}

export async function GET(req: Request) {
  const ctx = await session(req);
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401, headers: noStore });
  const slug = readSlug(req);
  if (!slug) return NextResponse.json({ error: "unknown tool" }, { status: 400, headers: noStore });
  // La tabella si applica a mano in Supabase (migration 017): questo codice può
  // girare prima che esista. dbQuery torna [] su errore, quindi la pagina mostra
  // "nessun salvataggio" invece di rompersi — e il tool resta usabile.
  return NextResponse.json({ saves: await listSaves(ctx.identifier, slug) }, { headers: noStore });
}

export async function POST(req: Request) {
  const ctx = await session(req);
  if (!ctx) return NextResponse.json({ error: "login required" }, { status: 401, headers: noStore });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400, headers: noStore });
  }
  const raw = (body ?? {}) as { slug?: unknown; state?: unknown; summary?: unknown };
  const slug = typeof raw.slug === "string" && isToolSlug(raw.slug) ? raw.slug : null;
  const state = parseSaveState(raw.state);
  const summary = parseSummary(raw.summary);
  if (!slug || !state || !summary) {
    return NextResponse.json({ error: "invalid calculation" }, { status: 400, headers: noStore });
  }

  try {
    // exec_sql non restituisce RETURNING: INSERT guardato (dbExecute alza),
    // poi la SELECT di verifica più sotto è la lista che torna al client.
    await dbExecute(
      `INSERT INTO tool_saves (identifier, slug, state, summary)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [ctx.identifier, slug, JSON.stringify(state), summary]
    );
    // FIFO: tenuti gli ultimi cinque di questo utente per questo tool, il resto
    // esce. È il cap che rende la tabella limitata per costruzione.
    await dbExecute(
      `DELETE FROM tool_saves
        WHERE identifier = $1 AND slug = $2
          AND id NOT IN (
            SELECT id FROM tool_saves
             WHERE identifier = $1 AND slug = $2
             ORDER BY created_at DESC, id DESC
             LIMIT $3
          )`,
      [ctx.identifier, slug, MAX_SAVES_PER_TOOL]
    );
  } catch (e) {
    console.error("[tools/saves] insert failed:", String(e));
    return NextResponse.json({ error: "save failed" }, { status: 500, headers: noStore });
  }

  return NextResponse.json({ saves: await listSaves(ctx.identifier, slug) }, { headers: noStore });
}
