// Steve's workspace: tracking gaps, experiment backlog, weekly memo, access
// list. Presentational only — content comes in already validated, so the
// host (this app or the CRM later) decides where it is stored. v6: the four
// progress tiles at the top are the tabs; every state comes from the JSON in
// content/ and is read-only here (no control pretends to save).

import type { ReactNode } from "react";
import { Lockup } from "../brand/Lockup";
import { LockIcon, Why, fmtInt } from "../primitives";
import { ThemeToggle } from "../ThemeToggle";
import { ACCESS_STATUSES, type AccessSource, EXPERIMENT_STATUSES, type Experiment, GAP_STATUSES, type TrackingGap, type WorkContent } from "./content";

/** Read-only stepper: the steps of a status list, the current one marked, the past ones filled. */
function Stepper({ steps, current, label }: { steps: readonly string[]; current: string; label: string }) {
  const idx = steps.indexOf(current);
  return (
    <ol className="g-step" aria-label={`${label}: ${current}`}>
      {steps.map((s, i) => (
        <li key={s} data-done={i < idx ? "true" : undefined} aria-current={i === idx ? "step" : undefined}>
          {s}
        </li>
      ))}
    </ol>
  );
}

function ProgressTile({ href, title, count, total, note }: { href: string; title: string; count: number; total: number; note: string }) {
  return (
    <a href={href} className="g-card g-prog">
      <div className="flex items-baseline justify-between gap-2">
        <span className="g-label">{title}</span>
        <span className="g-num g-num--sm">
          {fmtInt(count)}
          <span className="g-meta font-normal"> / {fmtInt(total)}</span>
        </span>
      </div>
      <div className="g-bar" role="img" aria-label={`${count} of ${total}`}>
        <span style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
      </div>
      <div className="g-meta mt-1.5">{note}</div>
    </a>
  );
}

function Section({ id, title, file, intro, children, aside }: { id: string; title: string; file: string; intro: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={`${id}-h`} className="g-h g-h--section">
          {title}
        </h2>
        {aside}
      </div>
      <p className="g-caveat">{intro}</p>
      <p className="g-meta">
        Edited in <code className="break-all">{file}</code> with a commit: this page saves nothing.
      </p>
      {children}
    </section>
  );
}

function GapRow({ g }: { g: TrackingGap }) {
  return (
    <details id={g.id} className="g-row g-row--gap">
      <summary className="!grid-cols-[minmax(0,1fr)_auto] md:!grid-cols-[48px_minmax(0,1fr)_56px_220px_90px] !items-center">
        <span className="g-meta g-tab hidden md:block">{g.id}</span>
        <span className="min-w-0 c-m">
          <span className="g-label block">
            <span className="md:hidden g-meta g-tab mr-2">{g.id}</span>
            {g.title}
          </span>
          <span className="g-meta block">
            unlocks {g.unlocks.length} {g.unlocks.length === 1 ? "KPI" : "KPIs"} · owner: {g.owner}
          </span>
        </span>
        <span className="c-s justify-self-end md:justify-self-start">
          <span className="g-prio" data-p={g.priority}>
            {g.priority}
          </span>
        </span>
        <span className="c-w md:w-[220px] w-full">
          <Stepper steps={GAP_STATUSES} current={g.status} label="status" />
        </span>
        <span className="c-c g-why-cta">
          details <span className="g-caret" aria-hidden="true">▸</span>
        </span>
      </summary>
      <div className="g-why-body flex flex-col gap-2">
        <p className="g-ink">{g.problem}</p>
        <div>
          <b>KPIs unlocked</b>
          <ul className="list-disc pl-5">
            {g.unlocks.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
        {g.tiles && (
          <p>
            <b>Makes these Proxy cards real:</b> {g.tiles.join(" · ")}
          </p>
        )}
        {g.dependsOn && (
          <p>
            <b>Depends on:</b> {g.dependsOn}
          </p>
        )}
        <p>
          <b>Suggested owner:</b> {g.owner} · <b>status:</b> {g.status} (changed in the <code>status</code> field of content/tracking-gaps.json)
        </p>
      </div>
    </details>
  );
}

const EXPERIMENT_COLUMNS: { title: string; statuses: readonly Experiment["status"][]; empty: string }[] = [
  { title: "Proposed", statuses: ["proposed"], empty: "No proposals." },
  { title: "In progress", statuses: ["in progress"], empty: "No experiment in progress." },
  { title: "Decided", statuses: ["scale", "fix", "kill"], empty: "No decision yet: Steve writes the first one in the memo." },
];

function ExperimentCard({ e }: { e: Experiment }) {
  const decided = e.status === "scale" || e.status === "fix" || e.status === "kill";
  return (
    <article className="g-card p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span className="g-meta g-tab">{e.id}</span>
        {decided && <span className="g-prio" data-p="P2" style={{ textTransform: "uppercase" }}>{e.status}</span>}
      </div>
      <p className="g-label">{e.hypothesis}</p>
      {e.note && <p className="g-meta">{e.note}</p>}
      <Why label="KPI, duration and threshold">
        <p>
          <b>KPI target:</b> {e.kpiTarget}
        </p>
        <p>
          <b>Data source:</b> {e.dataSource}
        </p>
        <p>
          <b>Duration:</b> {e.duration}
        </p>
        <p>
          <b>Decision threshold:</b> {e.decisionThreshold}
        </p>
        <p className="mt-1">
          <b>Status:</b> {e.status} — possible statuses: {EXPERIMENT_STATUSES.join(" → ")}
        </p>
      </Why>
    </article>
  );
}

// One operational block per source: what, which role, how to grant, who, how to check.
function AccessCard({ s }: { s: AccessSource }) {
  return (
    <article id={`access-${s.id}`} className="g-card p-4 flex flex-col gap-3 min-w-0">
      <h3 className="g-label">{s.tool}</h3>
      <div className="max-w-[320px]">
        <Stepper steps={ACCESS_STATUSES} current={s.status} label="access" />
      </div>
      <dl className="flex flex-col gap-2.5 text-[14px]">
        <div>
          <dt className="g-eyebrow">What you read there</dt>
          <dd className="g-caveat max-w-none break-words">{s.reads}</dd>
        </div>
        <div>
          <dt className="g-eyebrow">Minimum role to ask for</dt>
          <dd className="break-words">{s.role}</dd>
        </div>
        <Why label="steps, who grants it, how to check it">
          <ol className="list-decimal pl-5 flex flex-col gap-1">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-2">
            <b>Who grants it:</b> {s.owner}
          </p>
          <p>
            <b>How to check it:</b> {s.verify}
          </p>
        </Why>
      </dl>
    </article>
  );
}

export function WorkPage({ content, dashboardHref }: { content: WorkContent; /** Link back to the numbers; omitted → no link. */ dashboardHref?: string }) {
  const { gaps, experiments, sources, memos, memoTemplate } = content;
  const gapCount = (st: TrackingGap["status"]) => gaps.filter((g) => g.status === st).length;
  const expCount = (...st: Experiment["status"][]) => experiments.filter((e) => st.includes(e.status)).length;
  const accessCount = (st: AccessSource["status"]) => sources.filter((s) => s.status === st).length;
  const decided = expCount("scale", "fix", "kill");
  const sorted = [...gaps].sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id));

  return (
    <div className="g-page">
      <header className="g-wrap">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="flex items-center gap-3">
            <span className="inline-flex" style={{ color: "var(--lockup-ink)" }}>
              <Lockup className="h-8 w-auto" />
            </span>
            <span className="g-eyebrow">Growth · work</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {dashboardHref && (
              <a href={dashboardHref} className="text-[14px] font-semibold whitespace-nowrap inline-flex items-center min-h-[44px]">
                ← Numbers
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="g-wrap">
        <div className="flex flex-col gap-10 py-6 pb-16 max-w-[1200px]">
          <div className="flex flex-col gap-3">
            <h1 className="g-h g-h--page">Growth work</h1>
            <p className="g-caveat">
              Steve&apos;s workspace: what is not measured yet, what we test, what we decide every week, where the data is read. The content is
              versioned in the repo and updated with a commit: this page saves nothing. Instructions in <code>growth-app/content/README.md</code>.
            </p>
          </div>

          <nav aria-label="Progress" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <ProgressTile
              href="#gap"
              title="Tracking gaps"
              count={gapCount("closed")}
              total={gaps.length}
              note={`closed · ${fmtInt(gapCount("in progress"))} in progress · ${fmtInt(gapCount("mitigated"))} mitigated · ${fmtInt(gapCount("open"))} open`}
            />
            <ProgressTile
              href="#experiments"
              title="Experiments"
              count={decided}
              total={experiments.length}
              note={`decided · ${fmtInt(expCount("in progress"))} in progress · ${fmtInt(expCount("proposed"))} proposed`}
            />
            <ProgressTile href="#memo" title="Weekly memo" count={memos.length} total={Math.max(memos.length, 1)} note={memos.length === 0 ? "written · none yet: Steve writes the first one" : `written · latest: ${memos[0].file}`} />
            <ProgressTile
              href="#access"
              title="Access and sources"
              count={accessCount("verified")}
              total={sources.length}
              note={`verified · ${fmtInt(accessCount("granted"))} granted · ${fmtInt(accessCount("to grant"))} to grant`}
            />
          </nav>

          <Section
            id="gap"
            title="Tracking gaps"
            file="content/tracking-gaps.json"
            intro="What cannot be measured today, which KPIs closing it unlocks and who should do it. Priority and owner are proposals to be confirmed; the status moves open → in progress → mitigated → closed."
            aside={
              <span className="g-caveat">
                {fmtInt(gaps.length - gapCount("closed"))} not closed of {fmtInt(gaps.length)}
              </span>
            }
          >
            <div className="g-card g-rows py-2">
              <div className="g-rows-head !grid-cols-[48px_minmax(0,1fr)_56px_220px_90px]">
                <span>Id</span>
                <span>Gap</span>
                <span>Prior.</span>
                <span>Status</span>
                <span className="text-right">details</span>
              </div>
              {sorted.map((g) => (
                <GapRow key={g.id} g={g} />
              ))}
            </div>
          </Section>

          <Section
            id="experiments"
            title="Experiment backlog"
            file="content/experiments.json"
            intro="Every experiment has a threshold written before it starts. The starting numbers come from the real snapshot of Oct 5, but the experiments are examples to validate with Steve. An experiment is proposed, in progress or decided (scale / fix / kill): no data status, because it is not a number."
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
              {EXPERIMENT_COLUMNS.map((col) => {
                const items = experiments.filter((e) => col.statuses.includes(e.status));
                return (
                  <div key={col.title} className="flex flex-col gap-2">
                    <h3 className="g-h g-h--card">
                      {col.title} <span className="g-meta font-normal normal-case tracking-normal">· {fmtInt(items.length)}</span>
                    </h3>
                    {items.length === 0 ? <p className="g-caveat">{col.empty}</p> : items.map((e) => <ExperimentCard key={e.id} e={e} />)}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            id="memo"
            title="Weekly memo — scale / fix / kill"
            file="content/memo/YYYY-Www.md"
            intro="One page a week with the three questions: what works, what does not, what we test. Copy the template into a new file named with the week number (e.g. 2026-W41.md) and commit it."
          >
            {memos.length === 0 ? (
              <p className="g-caveat flex items-center gap-2">
                <LockIcon /> No memo yet: Steve writes the first one.
              </p>
            ) : (
              memos.map((m) => (
                <article key={m.file} className="g-card p-4">
                  <div className="g-meta mb-2">{m.file}</div>
                  <pre className="whitespace-pre-wrap break-words text-[14px] font-sans">{m.body}</pre>
                </article>
              ))
            )}
            <details className="g-card g-why p-4">
              <summary>
                Template (content/memo/_template.md) <span className="g-caret" aria-hidden="true">▸</span>
              </summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-[12px] g-muted font-mono">{memoTemplate}</pre>
            </details>
          </Section>

          <Section
            id="access"
            title="Access and sources"
            file="content/sources.json"
            intro="For each source: what you read there, the minimum role to ask for, the steps to grant it, who grants it and the number that proves it works. The status moves to «granted» when the owner has done the steps, to «verified» when the number matches."
            aside={
              <span className="g-caveat">
                {fmtInt(accessCount("verified"))} verified · {fmtInt(accessCount("granted"))} granted · {fmtInt(accessCount("to grant"))} to grant
              </span>
            }
          >
            <div className="g-card g-card--flat p-4 text-[14px] max-w-[80ch]">
              <b>Least privilege.</b> Always a personal invite to Steve with the lowest role that is enough to read. Never shared passwords, never admin accounts,
              never the main login of a service. Where the role name or the path is not certain, it says «to be checked in the interface»: whoever grants it
              checks it, nobody guesses. An access that is no longer needed is revoked.
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {sources.map((s) => (
                <AccessCard key={s.id} s={s} />
              ))}
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
