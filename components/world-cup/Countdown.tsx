"use client";

// Live countdown to kickoff. After kickoff it collapses to a "tournament live"
// badge — the hub hero swaps copy server-side on the same date logic.
import { useEffect, useState } from "react";
import { WC_KICKOFF_ISO } from "@/lib/world-cup";
import { WC_T, type WcLang } from "@/lib/world-cup-i18n";

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export default function Countdown({ lang = "it" }: { lang?: WcLang }) {
  const [left, setLeft] = useState<number | null>(null);
  const t = WC_T[lang];

  useEffect(() => {
    const target = new Date(WC_KICKOFF_ISO).getTime();
    const tick = () => setLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (left === null) return <div className="wc-countdown" aria-hidden="true" />;
  if (left <= 0) {
    return (
      <div className="wc-countdown wc-countdown-live">
        <span className="wc-live-dot" /> {t.tournamentLive}
      </div>
    );
  }
  const p = parts(left);
  return (
    <div className="wc-countdown" role="timer" aria-label="Countdown to World Cup kickoff">
      {[
        [p.days, t.days],
        [p.hours, t.hrs],
        [p.minutes, t.min],
        [p.seconds, t.sec],
      ].map(([v, label]) => (
        <span key={label as string} className="wc-countdown-cell">
          <strong>{String(v).padStart(2, "0")}</strong>
          <small>{label}</small>
        </span>
      ))}
    </div>
  );
}
