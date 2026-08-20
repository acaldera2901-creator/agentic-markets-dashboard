// #TENNIS-VOID-NOT-LOST-0805 + #TENNIS-SHADOW-SETTLE-0805.
// In lib/ and not tests/ because vitest only collects
// {app,lib,components,features}/**/*.test.ts — the files under tests/ have never
// run in CI (#TESTS-CI-0801), and this is exactly the kind of rule that regressed
// silently for two months.
import { describe, it, expect } from "vitest";
import { gradeTennisPick, tennisWinnerSide } from "./tennis-settlement";

describe("gradeTennisPick", () => {
  it("grades a real pick", () => {
    expect(gradeTennisPick("Jannik Sinner", "Jannik Sinner")).toBe("won");
    expect(gradeTennisPick("Jannik Sinner", "Carlos Alcaraz")).toBe("lost");
  });

  it("THE BUG: a row with no pick is void, never lost", () => {
    // Live on prod: 13 tennis rows with pick=null, graded 13 lost / 0 won —
    // a one-sided error, because `String(null)` can never equal a winner.
    expect(gradeTennisPick(null, "Carlos Alcaraz")).toBe("void");
    expect(gradeTennisPick(undefined, "Carlos Alcaraz")).toBe("void");
    expect(gradeTennisPick("", "Carlos Alcaraz")).toBe("void");
    // and it must not be reachable by the old comparison either
    expect(gradeTennisPick(null, "null")).toBe("void");
  });

  it("does not settle what upstream has not settled", () => {
    expect(gradeTennisPick("Jannik Sinner", null)).toBeNull();
    expect(gradeTennisPick("Jannik Sinner", "")).toBeNull();
    expect(gradeTennisPick(null, null)).toBeNull();
  });

  it("never returns lost without both a pick and a different winner", () => {
    const cases: Array<[string | null, string | null]> = [
      [null, "A"], ["A", null], [null, null], ["A", "A"], ["A", "B"],
    ];
    const lost = cases.filter(([p, w]) => gradeTennisPick(p, w) === "lost");
    expect(lost).toEqual([["A", "B"]]);
  });
});

describe("tennisWinnerSide", () => {
  it("maps the winner onto the shadow's home/away vocabulary", () => {
    expect(tennisWinnerSide("Player A", "Player A", "Player B")).toBe("home");
    expect(tennisWinnerSide("Player B", "Player A", "Player B")).toBe("away");
  });

  it("BOTH sides must be known — matching only player1 would leave every player2 win unsettled", () => {
    expect(tennisWinnerSide("Player B", "Player A", null)).toBeNull();
    expect(tennisWinnerSide("Player B", "Player A", "Player B")).toBe("away");
  });

  it("refuses to guess rather than settle wrong", () => {
    expect(tennisWinnerSide("Someone Else", "Player A", "Player B")).toBeNull();
    expect(tennisWinnerSide(null, "Player A", "Player B")).toBeNull();
    expect(tennisWinnerSide("", "Player A", "Player B")).toBeNull();
  });
});
