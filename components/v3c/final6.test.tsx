// components/v3c/final6.test.tsx (#REDESIGN-V3C final6) — fixdata2 «no prices once started» + fixui2 N6 «a started
// match is not in the price check»: the match page of a started match offers no «Check it →» toward the price check.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildBoardMatch, type BoardSourceRow } from "@/lib/v3c/board";
import { MatchView } from "./match/MatchView";

const src = (kickoff: string): BoardSourceRow => ({
  id: "oddsapi:fey", league: "Eredivisie", competition: "Eredivisie", kickoff,
  home: "Feyenoord", away: "FC Twente", computed_at: "2099-10-10T12:00:00Z",
  odds_home: 1.7, odds_draw: 3.9, odds_away: 4.6, model_p_home: 0.56, model_p_draw: 0.24, model_p_away: 0.2,
  p_home: 0.56, p_draw: 0.24, p_away: 0.2, sealed_at: null,
});

describe("final6 · started match page", () => {
  it("started: no price-check CTA; not started: the CTA is there", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 40 * 60_000).toISOString();
    const future = new Date(now.getTime() + 5 * 3_600_000).toISOString();
    const render = (k: string) => renderToStaticMarkup(<MatchView kind="football" m={buildBoardMatch(src(k), [], now)} series={[]} events={[]} partners links={[]} more={[]} />);
    expect(render(past)).not.toContain("/price-check?m=");
    expect(render(future)).toContain("/price-check?m=oddsapi%3Afey");
  });
});
