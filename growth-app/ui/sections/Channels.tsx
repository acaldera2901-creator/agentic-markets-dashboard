// Filone A — source chain: source → sessions → signups → profiles → paying.
// Presentational only. The two attribution bases are shown as two column
// groups, and the holes in the attribution are rows of their own.

import { type ChainRow, MIN_SIGNUPS_FOR_PCT, UNATTRIBUTED, chainRates, chainTotals } from "@/core/channels";
import { formatPct, ratio, windowLabel } from "@/core/kpi";
import type { GrowthData, Result } from "@/core/model";

const fmtInt = (n: number) => n.toLocaleString("it-IT");

function Header({ w }: { w: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-gray-800 pb-2">
      <h2 className="text-white font-semibold">Catena per fonte</h2>
      <span className="text-gray-500 text-xs">fonte → sessioni → signup → profili → paganti · {w}</span>
    </div>
  );
}

export function Channels({ data }: { data: GrowthData & { chain?: Result<ChainRow[]> } }) {
  const W = windowLabel(data.window);
  const ch = data.chain;
  if (!ch || !ch.ok) {
    return (
      <section className="space-y-3">
        <Header w={W} />
        <div className={`bg-gray-900 border rounded-xl p-4 text-sm ${ch ? "border-red-800 text-red-400" : "border-dashed border-gray-800 text-gray-400"}`}>
          {ch ? "Lettura fallita — nessun valore mostrato." : "Catena per fonte non presente in questa sorgente dati: nessun valore mostrato (non è uno 0)."}
        </div>
      </section>
    );
  }
  const t = chainTotals(ch.data);
  const pvNoSess = data.traffic.ok ? formatPct(ratio(data.traffic.data.page_views_no_session, data.traffic.data.page_views), 0) : null;
  const pct = (r: number | null) => (r === null ? <span className="text-gray-600">—</span> : <span className="text-gray-400">{formatPct(r, 0)}</span>);

  return (
    <section className="space-y-3">
      <Header w={W} />
      <div className="bg-gray-900 border border-amber-900/60 rounded-xl p-3 text-[12px] text-amber-200/90 leading-snug space-y-1">
        <div>
          <span className="font-semibold">Limiti dell&apos;attribuzione.</span> Sessioni e signup vengono dagli eventi delle sole sessioni con
          consenso: in questa finestra {pvNoSess ?? "una parte"} dei page_view non ha sessione e non è attribuibile.
          {t.signupsUnattributed > 0 && ` ${fmtInt(t.signupsUnattributed)} su ${fmtInt(t.signup_started)} signup avviati non hanno una fonte (righe in fondo).`}
        </div>
        <div>
          Profili e paganti vengono da profiles.acquisition, che esiste solo per i signup recenti: gli storici sono NULL
          {` (${fmtInt(t.profilesUnattributed)} su ${fmtInt(t.profiles)} profili della finestra, riga «(non registrata)»)`}. Le due basi non si
          dividono fra loro: «profili / signup» non è un tasso.
        </div>
        <div>Con meno di {MIN_SIGNUPS_FOR_PCT} signup una fonte mostra solo i conteggi. Referrer ridotti al dominio, codici referral mascherati.</div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
        {ch.data.length === 0 ? (
          <div className="text-sm text-gray-400">Nessuna sessione, signup o profilo nella finestra (lettura riuscita: è 0 reale).</div>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-gray-500 text-[11px] uppercase tracking-wider">
                <th className="font-normal text-left pb-1" rowSpan={2}>Fonte</th>
                <th className="font-normal text-center pb-1 border-b border-gray-800" colSpan={4}>Eventi (sessioni con consenso)</th>
                <th className="font-normal text-center pb-1 border-b border-gray-800 pl-4" colSpan={3}>Profili (acquisition)</th>
              </tr>
              <tr className="text-gray-500 text-[11px] uppercase tracking-wider text-right">
                <th className="font-normal pt-1 px-2">Sessioni</th>
                <th className="font-normal pt-1 px-2">Signup avv.</th>
                <th className="font-normal pt-1 px-2">Sess→signup</th>
                <th className="font-normal pt-1 px-2">Signup compl.</th>
                <th className="font-normal pt-1 px-2 pl-4">Profili</th>
                <th className="font-normal pt-1 px-2">Paganti</th>
                <th className="font-normal pt-1 px-2">Prof→pag.</th>
              </tr>
            </thead>
            <tbody>
              {ch.data.map((r) => {
                const rt = chainRates(r);
                const hole = UNATTRIBUTED.has(r.source);
                return (
                  <tr key={r.source} className={`border-t border-gray-800 text-right ${hole ? "text-gray-500 italic" : "text-gray-200"}`}>
                    <td className="text-left py-1.5 pr-3 not-italic">{r.source}</td>
                    <td className="px-2">{fmtInt(r.sessions)}</td>
                    <td className="px-2">{fmtInt(r.signup_started)}</td>
                    <td className="px-2">{pct(rt.sessionToSignup)}</td>
                    <td className="px-2">{fmtInt(r.signup_completed)}</td>
                    <td className="px-2 pl-4">{fmtInt(r.profiles)}</td>
                    <td className="px-2">{fmtInt(r.paying)}</td>
                    <td className="px-2">{pct(rt.profileToPaying)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-700 text-right text-white font-semibold">
                <td className="text-left py-1.5 pr-3">Totale</td>
                <td className="px-2">{fmtInt(t.sessions)}</td>
                <td className="px-2">{fmtInt(t.signup_started)}</td>
                <td className="px-2" />
                <td className="px-2">{fmtInt(t.signup_completed)}</td>
                <td className="px-2 pl-4">{fmtInt(t.profiles)}</td>
                <td className="px-2">{fmtInt(t.paying)}</td>
                <td className="px-2" />
              </tr>
            </tbody>
          </table>
        )}
        <p className="text-gray-500 text-[11px] mt-2 leading-snug">
          Paganti = profili creati nella finestra con piano base/premium da un canale a pagamento e non scaduto. «—» = meno di{" "}
          {MIN_SIGNUPS_FOR_PCT} signup (o nessuna sessione): percentuale non mostrata.
        </p>
      </div>
    </section>
  );
}
