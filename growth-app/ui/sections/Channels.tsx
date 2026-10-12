// Filone A — source chain: source → sessions → signups → profiles → paying.
// Presentational only. The two attribution bases are shown as two column
// groups, and the holes in the attribution are rows of their own.

import { MIN_SIGNUPS_FOR_PCT, UNATTRIBUTED, chainRates, chainTotals } from "@/core/channels";
import { INTERNAL_ENTRY_LABEL, INTERNAL_REFERRER_RULE } from "@/core/estimate";
import { formatPct, ratio, windowLabel } from "@/core/kpi";
import type { GrowthData } from "@/core/model";
import { Chip, Why, fmtInt, sourceLabel } from "../primitives";

export function Channels({ data }: { data: GrowthData }) {
  const W = windowLabel(data.window);
  const ch = data.chain;
  const title = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h3 className="g-h g-h--card">Chain by source</h3>
      <span className="g-meta">source → sessions → signups → profiles → paying · {W}</span>
    </div>
  );
  if (!ch.ok) {
    return (
      <div className="g-card p-4 flex flex-col gap-2">
        {title}
        <p className="text-[14px]" style={{ color: "var(--s-err)" }}>
          <Chip mark="ERRORE" /> Read failed ({ch.error}) — no value shown, not replaced with 0.
        </p>
      </div>
    );
  }
  const t = chainTotals(ch.data);
  const pvNoSess = data.traffic.ok ? formatPct(ratio(data.traffic.data.page_views_no_session, data.traffic.data.page_views), 0) : null;
  const pct = (r: number | null) => (r === null ? <span className="g-muted">n/a</span> : <span className="g-muted">{formatPct(r, 0)}</span>);

  return (
    <div className="g-card p-4 flex flex-col gap-3">
      {title}
      <Why label="limits of the attribution">
        Sessions and signups come from the events of consented sessions only: in this window {pvNoSess ?? "a share"} of the page_views have no session and cannot be
        attributed.
        {t.signupsUnattributed > 0 && ` ${fmtInt(t.signupsUnattributed)} of ${fmtInt(t.signup_started)} signups started have no source (rows at the bottom).`} Profiles and
        paying come from profiles.acquisition, which the product stores only with cookie consent: a signup without consent stays without a source, like the profiles created
        before attribution existed
        {` (${fmtInt(t.profilesUnattributed)} of ${fmtInt(t.profiles)} profiles in the window, row «(not recorded)»)`}. The two bases are not divided by each other:
        «profiles / signups» is not a rate. With fewer than {MIN_SIGNUPS_FOR_PCT} signups a source shows counts only (n/a instead of the percentage). External paying
        (today) = among the profiles created in the window, those that are external paying customers today (same rule as the «External paying customers» card: not internal,
        base/premium plan from a paid channel, not expired, with a paid order recorded). Internal/test sources are excluded from the totals and shown in a separate row
        ({INTERNAL_REFERRER_RULE}). Team traffic without an explicit source stays inside the counts: no exclusion by country. Referrers cut to the domain, referral
        codes masked.
      </Why>
      {ch.data.length === 0 ? (
        <p className="text-[14px] g-muted">No session, signup or profile in the window (read succeeded: it is a real 0).</p>
      ) : (
        <div className="g-scroll">
          <table className="g-table g-tab">
            <thead>
              <tr>
                <th rowSpan={2}>Source</th>
                <th colSpan={4} className="text-center" style={{ borderBottom: "1px solid var(--line)" }}>
                  Events (consented sessions)
                </th>
                <th colSpan={3} className="text-center" style={{ borderBottom: "1px solid var(--line)" }}>
                  Profiles (acquisition)
                </th>
              </tr>
              <tr>
                <th className="r pt-1">Sessions</th>
                <th className="r pt-1">Signups start.</th>
                <th className="r pt-1">Sess→signup</th>
                <th className="r pt-1">Signups compl.</th>
                <th className="r pt-1 pl-4">Profiles</th>
                <th className="r pt-1">External paying (today)</th>
                <th className="r pt-1">Prof→pay.</th>
              </tr>
            </thead>
            <tbody>
              {ch.data.filter((r) => r.source !== INTERNAL_ENTRY_LABEL).map((r) => {
                const rt = chainRates(r);
                const hole = UNATTRIBUTED.has(r.source);
                return (
                  <tr key={sourceLabel(r.source)} className={hole ? "g-hole" : ""}>
                    <td className="break-all">{sourceLabel(r.source)}</td>
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
                <td>Total</td>
                <td className="r">{fmtInt(t.sessions)}</td>
                <td className="r">{fmtInt(t.signup_started)}</td>
                <td className="r" />
                <td className="r">{fmtInt(t.signup_completed)}</td>
                <td className="r pl-4">{fmtInt(t.profiles)}</td>
                <td className="r">{fmtInt(t.paying)}</td>
                <td className="r" />
              </tr>
              {t.internal && (
                <tr className="g-hole" data-internal-row>
                  <td>internal/test (excluded from the total)</td>
                  <td className="r">{fmtInt(t.internal.sessions)}</td>
                  <td className="r">{fmtInt(t.internal.signup_started)}</td>
                  <td className="r" />
                  <td className="r">{fmtInt(t.internal.signup_completed)}</td>
                  <td className="r pl-4">{fmtInt(t.internal.profiles)}</td>
                  <td className="r">{fmtInt(t.internal.paying)}</td>
                  <td className="r" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
