type Row = Record<string, unknown>;
const normalized = (value: unknown): string => String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const time = (value: unknown): number => Date.parse(String(value ?? ""));

function context(row: Row): [string, string] {
  const competition = normalized(row.competition);
  let round = normalized(row.round);
  if (!round && typeof row.notes === "string") {
    try { round = normalized(JSON.parse(row.notes)?.round); } catch { /* optional metadata */ }
  }
  return [competition === "partner feed" ? "" : competition, round];
}

function tennisWinner(row: Row): string {
  const pick = normalized(row.pick);
  if (["1", "home", "player1", "player 1"].includes(pick)) return normalized(row.home_team);
  if (["2", "away", "player2", "player 2"].includes(pick)) return normalized(row.away_team);
  return pick;
}

/** Keep source rows intact: probabilities and picks must retain their orientation.
 * Exact event time + participant pair identify candidates, never a whole day's pair.
 * Unknown context cannot bridge two distinct known tournaments/rounds.
 */
export function deduplicatePredictions<T extends Row>(input: readonly T[], selectable: (row: T) => boolean = () => true): { rows: T[]; conflictedFixtures: number } {
  const other = new Map<string, { row: T; position: number }>();
  const tennis = new Map<string, T[]>();
  const selected: { row: T; position: number }[] = [];
  const index = new Map(input.map((row, i) => [row, i]));
  for (const [position, row] of input.entries()) {
    const home = normalized(row.home_team), away = normalized(row.away_team);
    if (row.sport !== "tennis") {
      if (!selectable(row)) continue;
      const legacyName = (name: unknown) => String(name ?? "").trim().toLowerCase();
      const key = [row.sport, legacyName(row.home_team), legacyName(row.away_team), String(row.starts_at ?? "").slice(0, 10)].join("|");
      const current = other.get(key);
      if (!current || (row.pick && !current.row.pick)) other.set(key, { row, position: current?.position ?? position });
      continue;
    }
    const start = time(row.starts_at);
    if (!home || !away || !Number.isFinite(start)) { selected.push({ row, position }); continue; }
    const key = JSON.stringify([[home, away].sort(), start, normalized(row.market)]);
    const bucket = tennis.get(key) ?? [];
    bucket.push(row);
    tennis.set(key, bucket);
  }

  selected.push(...other.values());
  let conflictedFixtures = 0;
  for (const bucket of tennis.values()) {
    const competitions = [...new Set(bucket.map(row => context(row)[0]).filter(Boolean))];
    const byCompetition = new Map<string, T[]>();
    for (const row of bucket) {
      const [competition] = context(row);
      // With multiple tournaments, an unnamed source cannot safely identify one.
      if (!competition && competitions.length > 1) { conflictedFixtures++; continue; }
      const key = competition || competitions[0] || "";
      const group = byCompetition.get(key) ?? [];
      group.push(row); byCompetition.set(key, group);
    }
    const groups: T[][] = [];
    for (const competitionRows of byCompetition.values()) {
      const rounds = [...new Set(competitionRows.map(row => context(row)[1]).filter(Boolean))];
      const byRound = new Map<string, T[]>();
      for (const row of competitionRows) {
        const round = context(row)[1];
        if (!round && rounds.length > 1) { conflictedFixtures++; continue; }
        const key = round || rounds[0] || "";
        const group = byRound.get(key) ?? [];
        group.push(row); byRound.set(key, group);
      }
      groups.push(...byRound.values());
    }
    for (const group of groups) {
      const winners = new Set(group.map(tennisWinner).filter(Boolean));
      if (winners.size > 1) { conflictedFixtures++; continue; }
      const eligible = group.filter(selectable);
      if (!eligible.length) continue;
      const position = Math.min(...group.map(row => index.get(row)!));
      eligible.sort((a, b) => Number(Boolean(b.pick)) - Number(Boolean(a.pick)) ||
        (time(b.updated_at) || 0) - (time(a.updated_at) || 0) || String(a.id).localeCompare(String(b.id)));
      selected.push({ row: eligible[0], position });
    }
  }
  // Retain board ordering rather than putting every tennis row after football.
  selected.sort((a, b) => a.position - b.position);
  return { rows: selected.map(item => item.row).filter(selectable), conflictedFixtures };
}
