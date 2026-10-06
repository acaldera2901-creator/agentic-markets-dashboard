"use client";
// components/v3c/community/Leaderboard.tsx (#REDESIGN-V3C · filone pages)
// La classifica dei membri in v3c. Stessa fonte di LeaderboardTab (app/app/page.tsx):
// GET /api/leaderboard, «la tua posizione» se il profilo locale ha scelto di
// comparire (agentic-client-profile · leaderboardOptIn, come la Dashboard).
// Tolti dal rendering: «system wins», «system hit rate», la colonna hit-rate %
// e la «Top hit rate»: il lessico v3c non ha percentuali di vittoria. Restano
// rango, nome, punti, vinte/totali, sport.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { storageGet } from "@/lib/safe-storage";
import { Fascia } from "../Fascia";
import { useCommunityCopy } from "./useCopy";

export type LeaderboardRow = {
  rank: number;
  name: string;
  points: number;
  bets_won: number;
  bets_total: number;
  sport: string;
};

type Me = { name: string; optedIn: boolean } | null;

function readMe(): Me {
  try {
    const raw = storageGet("agentic-client-profile");
    if (!raw) return null;
    const p = JSON.parse(raw) as { name?: unknown; leaderboardOptIn?: unknown };
    return typeof p?.name === "string" ? { name: p.name, optedIn: p.leaderboardOptIn === true } : null;
  } catch {
    return null;
  }
}

/** Solo i campi che la pagina mostra: hit_rate dell'API non entra mai nello stato. */
export function toRows(raw: unknown): LeaderboardRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: Record<string, unknown>, i) => ({
    rank: Number(e?.rank) || i + 1,
    name: String(e?.name ?? ""),
    points: Number(e?.points) || 0,
    bets_won: Number(e?.bets_won) || 0,
    bets_total: Number(e?.bets_total) || 0,
    sport: String(e?.sport ?? ""),
  }));
}

type Props = { initial?: { rows: LeaderboardRow[] } | "error" };

export function V3cLeaderboard({ initial }: Props = {}) {
  const t = useCommunityCopy().lb;
  const [rows, setRows] = useState<LeaderboardRow[] | null>(initial && initial !== "error" ? initial.rows : null);
  const [error, setError] = useState(initial === "error");
  const [me, setMe] = useState<Me>(null);

  const load = useCallback(() => {
    let alive = true;
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setRows(toRows(d?.leaderboard)); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    // il profilo vive solo nel browser: si legge dopo il mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMe(readMe());
    if (initial) return;
    return load();
  }, [initial, load]);

  const retry = () => { setError(false); setRows(null); load(); };
  const mine = me?.optedIn ? rows?.find((r) => r.name === me.name) ?? null : null;

  return (
    <main className="v3c-wrap v3c-cm" id="main">
      <Fascia
        tab={t.tab}
        title={t.title}
        meta={
          <>
            <b>{t.metaStrong}</b>
            <span>{t.metaRest}</span>
          </>
        }
      />

      {error ? (
        <div className="v3c-error" role="alert">
          <p>{t.error}</p>
          <button type="button" className="v3c-linkbtn" onClick={retry}>{t.retry}</button>
        </div>
      ) : rows === null ? (
        <p className="v3c-cm-wait" aria-busy="true">{t.loading}</p>
      ) : rows.length === 0 ? (
        <div className="v3c-empty">
          <p className="v3c-t-row">{t.emptyTitle}</p>
          <p className="v3c-small">{t.emptyHint}</p>
        </div>
      ) : (
        <>
          <ol className="v3c-cm-podium" aria-label={t.podium}>
            {rows.slice(0, 3).map((r) => (
              <li key={r.rank} className={r.rank === 1 ? "v3c-cm-first" : undefined}>
                <span className="v3c-cm-rk v3c-num">{r.rank}</span>
                <b className="v3c-t-row">{r.name}</b>
                <span className="v3c-n-xl">{r.points}<small> {t.unit}</small></span>
                <span className="v3c-small">{r.bets_won} / {r.bets_total} · {r.sport}</span>
              </li>
            ))}
          </ol>

          <table className="v3c-cm-table">
            <thead>
              <tr>
                <th className="v3c-lab" scope="col">{t.rank}</th>
                <th className="v3c-lab" scope="col">{t.player}</th>
                <th className="v3c-lab v3c-r" scope="col">{t.points}</th>
                <th className="v3c-lab v3c-r" scope="col">{t.record}</th>
                <th className="v3c-lab v3c-cm-sp" scope="col">{t.sport}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank} className={mine?.rank === r.rank ? "v3c-cm-me" : undefined}>
                  <td className="v3c-num">{r.rank}</td>
                  <td className="v3c-cm-name">{r.name}</td>
                  <td className="v3c-num v3c-r">{r.points}</td>
                  <td className="v3c-r">{r.bets_won} / {r.bets_total}</td>
                  <td className="v3c-cm-sp">{r.sport}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <section className="v3c-cm-you" aria-label={t.yourRank}>
        <span className="v3c-lab">{t.yourRank}</span>
        {mine ? (
          <p><b className="v3c-num">#{mine.rank}</b> · {mine.name} · {t.pts(mine.points)}</p>
        ) : (
          <p className="v3c-small">{me?.optedIn ? t.notListed : t.notOptedIn}</p>
        )}
      </section>

      <p className="v3c-fine v3c-cm-note">
        {t.note} <Link className="v3c-linkbtn" href="/history">{t.recordLink}</Link>
      </p>
    </main>
  );
}
