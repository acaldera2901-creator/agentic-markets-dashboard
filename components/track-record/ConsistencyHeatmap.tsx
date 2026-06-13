"use client";

import { useEffect, useState } from "react";
import type { Day } from "@/lib/track-record-history";

const WEEKS = 6; // periodo live mostrato: ultime 6 settimane (calendario Lun→Dom)
const DAY_MS = 86_400_000;
const DOW = { it: ["L", "M", "M", "G", "V", "S", "D"], en: ["M", "T", "W", "T", "F", "S", "S"] };

function utcDateStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

// Scheda "Costanza nel tempo" — vista GIORNALIERA del periodo live.
// Con poche settimane di storico reale, la griglia a 53 settimane resterebbe
// quasi vuota: qui mostriamo le ultime 6 settimane giorno-per-giorno (onesto e
// leggibile fin da subito). Si popola da sola man mano che arrivano i giorni.
export function ConsistencyHeatmap({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/v2/history?aggregate=days&limit=300`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setDays((d.days as Day[]) ?? []);
      })
      .catch(() => {
        if (alive) setDays([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const byDate = new Map((days ?? []).map((d) => [d.date, d]));

  // Calendario allineato al lunedì: ultime WEEKS settimane fino alla corrente.
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = (new Date(todayUTC).getUTCDay() + 6) % 7; // 0 = lunedì
  const start = todayUTC - dow * DAY_MS - (WEEKS - 1) * 7 * DAY_MS;

  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => {
    const ms = start + i * DAY_MS;
    const date = utcDateStr(ms);
    return { date, future: ms > todayUTC, bucket: byDate.get(date) };
  });
  const populated = cells.filter((c) => c.bucket).length;

  return (
    <>
      <div className="tr-sh">
        <span className="tr-glyph">🔥</span>
        <h2>{it ? "Costanza nel tempo" : "Consistency over time"}</h2>
      </div>
      <div className="tr-card" style={{ padding: 18 }}>
        <div className="tr-lab" style={{ margin: "0 0 12px" }}>
          {populated > 0
            ? it
              ? `Ultime ${WEEKS} settimane · ${populated} giorni con pick`
              : `Last ${WEEKS} weeks · ${populated} days with picks`
            : it
              ? "track record in costruzione"
              : "track record being built"}
        </div>
        <div className="tr-ehmd" aria-hidden="true" style={{ marginBottom: 6 }}>
          {DOW[it ? "it" : "en"].map((label, i) => (
            <span key={i} className="tr-dow">
              {label}
            </span>
          ))}
        </div>
        <div className="tr-ehmd">
          {cells.map((c, i) => {
            const w = c.bucket;
            const a = w ? Math.min(1, 0.25 + w.hitRate * 0.75) : 0;
            const title = w
              ? `${c.date}: ${(w.hitRate * 100).toFixed(0)}% (${w.decided})`
              : c.future
                ? c.date
                : it
                  ? `${c.date}: nessuna pick`
                  : `${c.date}: no picks`;
            return (
              <div
                key={i}
                className={`tr-ec${c.future ? " fut" : ""}`}
                title={title}
                style={w ? { background: `rgba(255,106,94,${a.toFixed(2)})` } : undefined}
              />
            );
          })}
        </div>
        <div className="tr-eleg">
          {it ? "meno → più · vuoto = nessuna pick" : "fewer → more · empty = no picks"}
        </div>
      </div>
    </>
  );
}
