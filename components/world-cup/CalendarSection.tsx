"use client";

// 104-fixture calendar grouped by day, with stage filter. Data arrives from
// the server page; filtering is purely client-side (no extra requests).
import { useMemo, useState } from "react";
import Link from "next/link";
import type { WcFixture } from "@/lib/world-cup";
import { teamSlug } from "@/lib/world-cup";

const STAGES: Array<{ key: "all" | WcFixture["stage"]; label: string }> = [
  { key: "all", label: "All" },
  { key: "group", label: "Groups" },
  { key: "round32", label: "R32" },
  { key: "round16", label: "R16" },
  { key: "quarter", label: "QF" },
  { key: "semi", label: "SF" },
  { key: "final", label: "Final" },
];

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});

export default function CalendarSection({ fixtures }: { fixtures: WcFixture[] }) {
  const [stage, setStage] = useState<(typeof STAGES)[number]["key"]>("all");

  const byDay = useMemo(() => {
    const filtered = stage === "all" ? fixtures : fixtures.filter((f) => f.stage === stage);
    const map = new Map<string, WcFixture[]>();
    for (const f of filtered) {
      const day = f.date.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(f);
    }
    return [...map.entries()];
  }, [fixtures, stage]);

  if (!fixtures.length) {
    return <div className="book-empty">Match calendar unavailable right now — retry shortly.</div>;
  }

  return (
    <div>
      <div className="segmented-filter wc-stage-filter" role="tablist" aria-label="Stage filter">
        {STAGES.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={stage === s.key}
            className={stage === s.key ? "active" : ""}
            onClick={() => setStage(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="wc-calendar">
        {byDay.map(([day, dayFixtures]) => (
          <div key={day} className="wc-calendar-day">
            <div className="eyebrow">{dayFmt.format(new Date(day + "T12:00:00Z"))}</div>
            {dayFixtures.map((f) => (
              <div key={f.id} className="wc-fixture-row">
                <span className="wc-fixture-time">{timeFmt.format(new Date(f.date))} UTC</span>
                <span className="wc-fixture-teams">
                  <Link href={`/world-cup/${teamSlug(f.home_team)}`} className="wc-team-link">{f.home_team}</Link>
                  {f.home_score != null && f.away_score != null ? (
                    <strong className="wc-fixture-score">{f.home_score}–{f.away_score}</strong>
                  ) : (
                    <span className="wc-fixture-vs">vs</span>
                  )}
                  <Link href={`/world-cup/${teamSlug(f.away_team)}`} className="wc-team-link">{f.away_team}</Link>
                </span>
                <span className="wc-fixture-meta">
                  {f.group ? `Group ${f.group} · ` : ""}
                  {f.venue || "Venue TBC"}{f.city ? ` · ${f.city}` : ""}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
