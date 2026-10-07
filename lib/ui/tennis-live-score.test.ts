import { describe, expect, it } from "vitest";
import { tennisLiveScoreLabel } from "./tennis-live-score";

// Real data, 07/10/2026: the board serves "Ann Li vs Elina Svitolina" while
// ESPN's live feed lists Svitolina first (player1) with sets_p1=[6,2],
// sets_p2=[3,1]. The lobby card prints the label under the BOARD order, so it
// must read Li's games first.
const live = { player1: "Elina Svitolina", player2: "Ann Li", sets_p1: [6, 2], sets_p2: [3, 1] };

describe("tennisLiveScoreLabel", () => {
  it("orients the sets to the board's player1 when the feed lists the players swapped", () => {
    expect(tennisLiveScoreLabel(live, "Ann Li")).toBe("3-6 1-2");
  });

  it("keeps the feed order when it already matches the board", () => {
    expect(tennisLiveScoreLabel(live, "Elina Svitolina")).toBe("6-3 2-1");
  });

  it("matches on last name, accent-insensitive (board and ESPN spell first names differently)", () => {
    const l = { player1: "Daniel Altmaier", player2: "Holger Rune", sets_p1: [1, 1], sets_p2: [6, 0] };
    expect(tennisLiveScoreLabel(l, "H. Rune")).toBe("6-1 0-1");
    expect(tennisLiveScoreLabel({ ...l, player1: "Daniel Altmäier" }, "Altmaier")).toBe("1-6 1-0");
  });

  it("pads a missing opponent set like the ticker does", () => {
    expect(tennisLiveScoreLabel({ ...live, sets_p2: [3] }, "Elina Svitolina")).toBe("6-3 2-");
  });
});
