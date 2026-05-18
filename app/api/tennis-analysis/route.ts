import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AnalysisRequest = {
  player1: string;
  player2: string;
  tournament: string;
  round: string;
  surface: string;
  p1: number;
  p2: number;
  odds_p1: number | null;
  odds_p2: number | null;
  edge: number | null;
  best_selection: string | null;
  elo_p1?: number | null;
  elo_p2?: number | null;
  elo_p1_overall?: number | null;
  elo_p2_overall?: number | null;
  surface_matches_p1?: number | null;
  surface_matches_p2?: number | null;
  elo_raw_p1?: number | null;
};

function buildPrompt(m: AnalysisRequest): string {
  const surfaceIT =
    m.surface === "CLAY" ? "terra battuta" : m.surface === "GRASS" ? "erba" : "cemento";

  const mktP1 =
    m.odds_p1 && m.odds_p1 > 1 ? Math.round((1 / m.odds_p1) * 100) : null;
  const mktP2 =
    m.odds_p2 && m.odds_p2 > 1 ? Math.round((1 / m.odds_p2) * 100) : null;

  const eloSection =
    m.elo_p1 != null && m.elo_p2 != null
      ? `Elo ${surfaceIT}: ${m.player1} ${m.elo_p1} · ${m.player2} ${m.elo_p2} (Δ${Math.abs(m.elo_p1 - m.elo_p2).toFixed(0)} pt)
Elo overall: ${m.player1} ${m.elo_p1_overall ?? "n/d"} · ${m.player2} ${m.elo_p2_overall ?? "n/d"}
Partite su ${surfaceIT}: ${m.player1} ${m.surface_matches_p1 ?? "n/d"} · ${m.player2} ${m.surface_matches_p2 ?? "n/d"}`
      : `Modello Elo surface-adjusted su ${surfaceIT}`;

  const fatigueNote =
    m.elo_raw_p1 != null && Math.abs(m.p1 - m.elo_raw_p1) > 0.003
      ? `\nAggiustamento fatica: ${m.player1} ${Math.round(m.elo_raw_p1 * 100)}% → ${Math.round(m.p1 * 100)}%`
      : "";

  const bestName =
    m.best_selection === "P1"
      ? m.player1
      : m.best_selection === "P2"
        ? m.player2
        : null;

  return `Sei un analista tennistico AI per una piattaforma di value betting professionale. Analizza la seguente partita in modo preciso e conciso.

PARTITA: ${m.player1} vs ${m.player2}
TORNEO: ${m.tournament} (${m.round}) — Superficie: ${surfaceIT.toUpperCase()}

DATI MODELLO:
${eloSection}${fatigueNote}
Probabilità modello: ${m.player1} ${Math.round(m.p1 * 100)}% · ${m.player2} ${Math.round(m.p2 * 100)}%
${mktP1 != null && mktP2 != null ? `Probabilità implicita mercato: ${m.player1} ${mktP1}% · ${m.player2} ${mktP2}%` : "Quote di mercato non disponibili"}
${m.edge != null ? `Edge modello: ${m.edge > 0 ? "+" : ""}${(m.edge * 100).toFixed(1)}% su ${bestName ?? "nessuno"}` : "Nessun edge rilevato"}

Scrivi un'analisi di massimo 4 frasi che risponda a: PERCHÉ il modello ${bestName ? `favorisce ${bestName}` : "non trova un edge chiaro"} su questa superficie? Considera le statistiche Elo, la specializzazione sulla superficie, il gap tra modello e mercato, e cosa rende questa partita interessante o rischiosa per un puntatore. Sii specifico ai dati, non generico. Scrivi in italiano, tono professionale.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  let body: AnalysisRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.player1 || !body.player2) {
    return NextResponse.json({ error: "player1 and player2 required" }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 350,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic API error:", err);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json() as { content: { type: string; text: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    return NextResponse.json({ analysis: text.trim() });
  } catch (e) {
    console.error("tennis-analysis error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
