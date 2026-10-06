"use client";
// components/v3c/community/Community.tsx (#REDESIGN-V3C · filone pages)
// Le schedine dei creator in v3c. Stessa fonte e stesso lock della pagina di
// sempre (app/community/page.tsx): GET /api/match-builder, che
// proietta per sessione (le partite le vede chiunque; selezioni e probabilità
// solo l'accesso pieno). Ogni schedina aperta riapre /probability-view con
// ?mb=…&ref=CODICE, così l'attribuzione del creator resta.
// Niente blur: una schedina chiusa mostra le partite e dice cosa si apre con
// Pro, senza far intuire un risultato (POSITIONING §4).
import { useCallback, useEffect, useState } from "react";
import { Fascia } from "../Fascia";
import { useCommunityCopy } from "./useCopy";

type Sel = { label: string; sport: string; when: string; market: string | null; prob: number | null };
export type Slip = { id: string; creator_code: string; mb_param: string; created_at: string; locked: boolean; combined_prob: number | null; selections: Sel[] };
type Access = "none" | "partial" | "full";

const PRICING = "/pricing";

type Props = { initial?: { slips: Slip[]; access: Access } };

export function V3cCommunity({ initial }: Props = {}) {
  const t = useCommunityCopy().cm;
  const [slips, setSlips] = useState<Slip[] | null>(initial?.slips ?? null);
  const [access, setAccess] = useState<Access>(initial?.access ?? "none");
  const [error, setError] = useState(false);

  const fetchSlips = useCallback(() => {
    let alive = true;
    fetch("/api/match-builder", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlips(Array.isArray(d?.slips) ? d.slips : []);
        setAccess(d?.access === "full" || d?.access === "partial" ? d.access : "none");
      })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => (initial ? undefined : fetchSlips()), [initial, fetchSlips]);
  const retry = () => { setError(false); setSlips(null); fetchSlips(); };

  return (
    <main className="v3c-wrap v3c-cm" id="main">
      <Fascia tab={t.tab} title={t.title} meta={<><b>{t.metaStrong}</b><span>{t.metaRest}</span></>} />

      <div className="v3c-cm-bar-h">
        {access !== "full" ? (
          <div className="v3c-cm-gate">
            <p className="v3c-t-row">{access === "none" ? t.gateNoneTitle : t.gatePartial}</p>
            {access === "none" && <p className="v3c-small">{t.gateNoneSub}</p>}
          </div>
        ) : <span />}
        <div className="v3c-act">
          {/* hard nav: la vista probabilità risolve la tab al mount (come la pagina di sempre) */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav intenzionale */}
          <a className="v3c-btn v3c-btn-line" href="/probability-view">{t.create}</a>
          {access !== "full" && <a className="v3c-btn v3c-btn-cta" href={PRICING}>{t.seePlans}</a>}
        </div>
      </div>

      {error && (
        <div className="v3c-error" role="alert">
          <p>{t.loadError}</p>
          <button type="button" className="v3c-linkbtn" onClick={retry}>{t.retry}</button>
        </div>
      )}
      {!error && slips === null && <p className="v3c-cm-wait" aria-busy="true">{t.loading}</p>}
      {!error && slips !== null && slips.length === 0 && (
        <div className="v3c-empty">
          <p className="v3c-t-row">{t.emptyTitle}</p>
          <p className="v3c-small">{t.emptySub}</p>
        </div>
      )}

      {!!slips?.length && (
        <ol className="v3c-cm-slips">
          {slips.map((s) => (
            <li key={s.id} className="v3c-cm-slip">
              <div className="v3c-cm-slip-h">
                <span className="v3c-tag">{s.creator_code}</span>
                <span className="v3c-small">{new Date(s.created_at).toLocaleDateString(t.locale, { day: "numeric", month: "short" })} · {t.legs(s.selections.length)}</span>
                {!s.locked && s.combined_prob != null && (
                  <span className="v3c-cm-comb"><span className="v3c-lab">{t.combined}</span> <b className="v3c-num"><mark>{Math.round(s.combined_prob * 100)}%</mark></b></span>
                )}
              </div>
              <ul className="v3c-cm-legs">
                {s.selections.map((x, i) => (
                  <li key={i}>
                    <span className="v3c-cm-leg"><b>{x.label}</b><small>{x.sport}</small></span>
                    {!s.locked && x.market != null && (
                      <span className="v3c-cm-mk">{x.market}{x.prob != null && <b className="v3c-num"> {Math.round(x.prob * 100)}%</b>}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="v3c-cm-slip-f">
                {s.locked ? (
                  <span className="v3c-small">{t.lockedLine}</span>
                ) : (
                  <a className="v3c-linkbtn" href={`/probability-view?mb=${encodeURIComponent(s.mb_param)}&ref=${encodeURIComponent(s.creator_code)}`}>{t.open} →</a>
                )}
                <span className="v3c-fine">{t.responsible}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
