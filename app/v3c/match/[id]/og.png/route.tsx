// L'immagine OG della pagina partita (#REDESIGN-V3C polish): il template del kit
// con squadre, orario, mercato e stima DA DATI VERI — la stessa board di
// /api/v3/board e della pagina (getBoard), lo stesso esito guida (gap più ampio),
// gli stessi interi %. Calcio: riga del blend 0,3/0,7. Tennis: se il numero è il
// prezzo di mercato lo si dice e non si mostra una «stima». Partita fuori dalla
// board: solo nomi e orario, nessuna cifra. A flag spento: 404.
import { ImageResponse } from "next/og";
import { v3cProductOn, getBoard } from "@/lib/v3c/board-data.server";
import { leadOutcome, outcomeLabel } from "@/lib/v3c/board-view";
import { fetchFixture } from "@/lib/v3c/line-movement-service";
import { cleanMatchId, findMatch } from "@/lib/v3c/match-view";
import { OG, OG_SIZE, OgFrame, ogAssets } from "../../../_og/og";

// polish-2: route handler (non più `opengraph-image`) così og:image può puntare
// all'URL pubblico /match/<id>/og.png (rewrite) invece che a /v3c/… — vedi lib/v3c/og-meta.ts.

const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const when = (iso: string) => {
  const d = new Date(iso);
  return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} · ${iso.slice(11, 16)} UTC`;
};
const pct = (p: number | null | undefined) => (p == null ? null : `${Math.round(p * 100)}%`);

type View = { kicker: string; home: string; away: string; market: string | null; estimate: string | null; line: string };

async function view(id: string): Promise<View | null> {
  const b = await getBoard();
  const found = b.ok ? findMatch(b.data, id) : null;
  if (found?.sport === "football") {
    const m = found.m;
    const lead = leadOutcome(m);
    const label = lead.outcome === "draw" ? "Draw" : `${outcomeLabel(m, lead.outcome)} to win`;
    return {
      kicker: `${(m.competition || m.league || "Football").toUpperCase()} · ${when(m.kickoff)}`,
      home: m.home,
      away: m.away,
      market: pct(lead.market_p),
      estimate: pct(lead.estimate_p),
      line: lead.market_p == null ? `${label}. No market price stored: the estimate is the model alone.` : `${label}. Estimate = 0.3 model + 0.7 market${m.sealed_at ? ", sealed before kick-off" : ""}.`,
    };
  }
  if (found?.sport === "tennis") {
    const m = found.m;
    const lead = m.sides.find((x) => x.side === m.focus) ?? m.sides[0];
    const marketOnly = m.probability_kind === "market_tempered";
    return {
      kicker: `${(m.tournament || "Tennis").toUpperCase()} · ${when(m.kickoff)}`,
      home: m.player1,
      away: m.player2,
      market: pct(lead.market_p ?? lead.estimate_p),
      estimate: marketOnly ? null : pct(lead.estimate_p),
      line: marketOnly ? `${lead.player}. The market price, margin removed: not a model of ours.` : `${lead.player} to win. Our Elo, tempered.`,
    };
  }
  const f = await fetchFixture(id).catch(() => null);
  return f ? { kicker: when(new Date(f.kickoff).toISOString()), home: f.home, away: f.away, market: null, estimate: null, line: "Market price, our estimate, the sealed record." } : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!v3cProductOn()) return new Response(null, { status: 404 });
  const id = cleanMatchId((await params).id);
  const v = id ? await view(id) : null;
  const a = await ogAssets("match");
  const long = v ? Math.max(v.home.length, v.away.length) > 14 : false;
  return new ImageResponse(
    (
      <OgFrame bg={a.bg} lockup={a.lockup} foot="BETREDGE.COM · 18+ · PLAY RESPONSIBLY">
        {v ? (
          <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 2, color: OG.ink2 }}>{v.kicker}</div>
            <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Display", fontSize: long ? 64 : 92, lineHeight: 1, marginTop: 14, textTransform: "uppercase" }}>
              <span>{v.home}</span>
              <span style={{ color: OG.ink2, margin: "0 18px", fontSize: long ? 44 : 64, alignSelf: "center" }}>v</span>
              <span>{v.away}</span>
            </div>
            {v.market ? (
              <div style={{ display: "flex", gap: 48, marginTop: 30, alignItems: "flex-end" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2, color: OG.sky }}>MARKET</span>
                  <span style={{ fontSize: 92, fontWeight: 800, color: OG.sky, lineHeight: 1 }}>{v.market}</span>
                </div>
                {v.estimate ? (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>OUR ESTIMATE</span>
                    <span style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, background: OG.lime, padding: "4px 12px" }}>{v.estimate}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={{ fontSize: 22, color: OG.ink2, marginTop: 22 }}>{v.line}</div>
          </div>
        ) : (
          <div style={{ fontFamily: "Display", fontSize: 92, lineHeight: 1 }}>MATCH NOT FOUND</div>
        )}
      </OgFrame>
    ),
    { ...OG_SIZE, fonts: a.fonts },
  );
}
