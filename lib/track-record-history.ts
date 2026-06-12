// Aggregazioni track-record per la pagina Storico (Track Record esteso).
// Funzioni PURE e testabili: nessun accesso a DB/rete. Usate sia dall'API
// (/api/v2/history?aggregate=segments,weeks) sia dai componenti frontend.
// Vincolo: una pick conta solo se CONCLUSA (result won/lost); i pending sono esclusi.

export type TrackRow = {
  sport: string;
  competition: string;
  result: string | null;
  starts_at: string;
};

export type Segment = {
  key: string;
  label: string;
  sport: string;
  decided: number;
  won: number;
  hitRate: number; // 0..1
};

export type Week = {
  iso: string; // es. "2026-W23"
  decided: number;
  won: number;
  hitRate: number; // 0..1
};

export function filterConcluded<T extends { result: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.result === "won" || r.result === "lost");
}

export function bySegment(rows: TrackRow[]): Segment[] {
  const m = new Map<string, Segment>();
  for (const r of filterConcluded(rows)) {
    const key = `${r.sport}/${r.competition}`;
    const s =
      m.get(key) ?? { key, label: r.competition, sport: r.sport, decided: 0, won: 0, hitRate: 0 };
    s.decided += 1;
    if (r.result === "won") s.won += 1;
    s.hitRate = s.won / s.decided;
    m.set(key, s);
  }
  return [...m.values()].sort((a, b) => b.decided - a.decided);
}

// Settimana ISO-8601 (lunedì come primo giorno), in UTC.
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; // 0 = lunedì
  t.setUTCDate(t.getUTCDate() - day + 3); // giovedì della settimana corrente
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((t.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7,
    );
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weeklyHit(rows: TrackRow[]): Week[] {
  const m = new Map<string, Week>();
  for (const r of filterConcluded(rows)) {
    const iso = isoWeek(new Date(r.starts_at));
    const w = m.get(iso) ?? { iso, decided: 0, won: 0, hitRate: 0 };
    w.decided += 1;
    if (r.result === "won") w.won += 1;
    w.hitRate = w.won / w.decided;
    m.set(iso, w);
  }
  return [...m.values()].sort((a, b) => a.iso.localeCompare(b.iso));
}
