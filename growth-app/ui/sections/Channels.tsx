// Filone A — source chain: source → sessions → signups → profiles → paying.
// Presentational only. The two attribution bases are shown as two column
// groups, and the holes in the attribution are rows of their own.

import { MIN_SIGNUPS_FOR_PCT, UNATTRIBUTED, chainRates, chainTotals } from "@/core/channels";
import { formatPct, ratio, windowLabel } from "@/core/kpi";
import type { GrowthData } from "@/core/model";
import { Chip, Why, fmtInt } from "../primitives";

export function Channels({ data }: { data: GrowthData }) {
  const W = windowLabel(data.window);
  const ch = data.chain;
  const title = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="g-h g-h--card">Catena per fonte</h3>
      <span className="g-meta">fonte → sessioni → signup → profili → paganti · {W}</span>
    </div>
  );
  if (!ch.ok) {
    return (
      <div className="g-card p-4 flex flex-col gap-2">
        {title}
        <p className="text-[14px]" style={{ color: "var(--s-err)" }}>
          <Chip mark="ERRORE" /> Lettura fallita ({ch.error}) — nessun valore mostrato, non sostituito con 0.
        </p>
      </div>
    );
  }
  const t = chainTotals(ch.data);
  const pvNoSess = data.traffic.ok ? formatPct(ratio(data.traffic.data.page_views_no_session, data.traffic.data.page_views), 0) : null;
  const pct = (r: number | null) => (r === null ? <span className="g-muted">n/d</span> : <span className="g-muted">{formatPct(r, 0)}</span>);

  return (
    <div className="g-card p-4 flex flex-col gap-3">
      {title}
      <Why label="limiti dell’attribuzione">
        Sessioni e signup vengono dagli eventi delle sole sessioni con consenso: in questa finestra {pvNoSess ?? "una parte"} dei page_view non ha sessione e non è
        attribuibile.
        {t.signupsUnattributed > 0 && ` ${fmtInt(t.signupsUnattributed)} su ${fmtInt(t.signup_started)} signup avviati non hanno una fonte (righe in fondo).`} Profili e
        paganti vengono da profiles.acquisition, che esiste solo per i signup recenti: gli storici sono NULL
        {` (${fmtInt(t.profilesUnattributed)} su ${fmtInt(t.profiles)} profili della finestra, riga «(non registrata)»)`}. Le due basi non si dividono fra loro:
        «profili / signup» non è un tasso. Con meno di {MIN_SIGNUPS_FOR_PCT} signup una fonte mostra solo i conteggi (n/d al posto della percentuale). Paganti =
        profili creati nella finestra con piano base/premium da un canale a pagamento e non scaduto. Referrer ridotti al dominio, codici referral mascherati.
      </Why>
      {ch.data.length === 0 ? (
        <p className="text-[14px] g-muted">Nessuna sessione, signup o profilo nella finestra (lettura riuscita: è 0 reale).</p>
      ) : (
        <div className="g-scroll">
          <table className="g-table g-tab">
            <thead>
              <tr>
                <th rowSpan={2}>Fonte</th>
                <th colSpan={4} className="text-center" style={{ borderBottom: "1px solid var(--line)" }}>
                  Eventi (sessioni con consenso)
                </th>
                <th colSpan={3} className="text-center" style={{ borderBottom: "1px solid var(--line)" }}>
                  Profili (acquisition)
                </th>
              </tr>
              <tr>
                <th className="r pt-1">Sessioni</th>
                <th className="r pt-1">Signup avv.</th>
                <th className="r pt-1">Sess→signup</th>
                <th className="r pt-1">Signup compl.</th>
                <th className="r pt-1 pl-4">Profili</th>
                <th className="r pt-1">Paganti</th>
                <th className="r pt-1">Prof→pag.</th>
              </tr>
            </thead>
            <tbody>
              {ch.data.map((r) => {
                const rt = chainRates(r);
                const hole = UNATTRIBUTED.has(r.source);
                return (
                  <tr key={r.source} className={hole ? "g-hole" : ""}>
                    <td className="break-all">{r.source}</td>
                    <td className="r">{fmtInt(r.sessions)}</td>
                    <td className="r">{fmtInt(r.signup_started)}</td>
                    <td className="r">{pct(rt.sessionToSignup)}</td>
                    <td className="r">{fmtInt(r.signup_completed)}</td>
                    <td className="r pl-4">{fmtInt(r.profiles)}</td>
                    <td className="r">{fmtInt(r.paying)}</td>
                    <td className="r">{pct(rt.profileToPaying)}</td>
                  </tr>
                );
              })}
              <tr className="g-total">
                <td>Totale</td>
                <td className="r">{fmtInt(t.sessions)}</td>
                <td className="r">{fmtInt(t.signup_started)}</td>
                <td className="r" />
                <td className="r">{fmtInt(t.signup_completed)}</td>
                <td className="r pl-4">{fmtInt(t.profiles)}</td>
                <td className="r">{fmtInt(t.paying)}</td>
                <td className="r" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
