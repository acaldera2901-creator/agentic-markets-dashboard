// #LIVE-INVERTED-1007 — live tennis score label for the lobby card, oriented
// to the BOARD's player order.
//
// /api/tennis-live lists the players in ESPN's competitor order, which is not
// the board's: the card is matched by an order-independent last-name pair key,
// then prints `player1 <score> player2` from the board row. Without orienting,
// the sets of the ESPN-first player land under the board-first player — the
// score shows inverted whenever the two orders differ (measured 07/10:
// board "Ann Li vs Elina Svitolina", ESPN "Svitolina, Li").
// Same last-name rule as the detail card (`liveOrient` in app/app/page.tsx).

export interface LiveTennisSets {
  player1: string;
  sets_p1: number[];
  sets_p2: number[];
}

function lastName(s: string): string {
  return (s.split(" ").pop() ?? s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function tennisLiveScoreLabel(live: LiveTennisSets, boardPlayer1: string): string {
  const sameOrder = lastName(live.player1) === lastName(boardPlayer1);
  const mine = sameOrder ? live.sets_p1 : live.sets_p2;
  const theirs = sameOrder ? live.sets_p2 : live.sets_p1;
  return mine.map((v, i) => `${v}-${theirs[i] ?? ""}`).join(" ");
}
