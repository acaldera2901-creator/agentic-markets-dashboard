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
      <div className="g-bar" role="img" aria-label={`${count} su ${total}`}>
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
        Si modifica in <code className="break-all">{file}</code> con un commit: questa pagina non salva nulla.
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
            sblocca {g.unlocks.length} KPI · owner: {g.owner}
          </span>
        </span>
        <span className="c-s justify-self-end md:justify-self-start">
          <span className="g-prio" data-p={g.priority}>
            {g.priority}
          </span>
        </span>
        <span className="c-w md:w-[220px] w-full">
          <Stepper steps={GAP_STATUSES} current={g.status} label="stato" />
        </span>
        <span className="c-c g-why-cta">
          dettagli <span className="g-caret" aria-hidden="true">▸</span>
        </span>
      </summary>
      <div className="g-why-body flex flex-col gap-2">
        <p className="g-ink">{g.problem}</p>
        <div>
          <b>KPI sbloccati</b>
          <ul className="list-disc pl-5">
            {g.unlocks.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
        {g.tiles && (
          <p>
            <b>Rende reali le card Proxy:</b> {g.tiles.join(" · ")}
          </p>
        )}
        {g.dependsOn && (
          <p>
            <b>Dipende da:</b> {g.dependsOn}
          </p>
        )}
        <p>
          <b>Owner suggerito:</b> {g.owner} · <b>stato:</b> {g.status} (si cambia nel campo <code>status</code> di content/tracking-gaps.json)
        </p>
      </div>
    </details>
  );
}

const EXPERIMENT_COLUMNS: { title: string; statuses: readonly Experiment["status"][]; empty: string }[] = [
  { title: "Proposti", statuses: ["proposto"], empty: "Nessuna proposta." },
  { title: "In corso", statuses: ["in corso"], empty: "Nessun esperimento in corso." },
  { title: "Decisi", statuses: ["scale", "fix", "kill"], empty: "Nessuna decisione ancora: la prima la scrive Steve nel memo." },
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
      <Why label="KPI, durata e soglia">
        <p>
          <b>KPI target:</b> {e.kpiTarget}
        </p>
        <p>
          <b>Fonte dato:</b> {e.dataSource}
        </p>
        <p>
          <b>Durata:</b> {e.duration}
        </p>
        <p>
          <b>Soglia di decisione:</b> {e.decisionThreshold}
        </p>
        <p className="mt-1">
          <b>Stato:</b> {e.status} — stati possibili: {EXPERIMENT_STATUSES.join(" → ")}
        </p>
      </Why>
    </article>
  );
}

// One operational block per source: what, which role, how to grant, who, how to check.
function AccessCard({ s }: { s: AccessSource }) {
  return (
    <article id={`accesso-${s.id}`} className="g-card p-4 flex flex-col gap-3 min-w-0">
      <h3 className="g-label">{s.tool}</h3>
      <div className="max-w-[320px]">
        <Stepper steps={ACCESS_STATUSES} current={s.status} label="accesso" />
      </div>
      <dl className="flex flex-col gap-2.5 text-[14px]">
        <div>
          <dt className="g-eyebrow">Cosa si legge</dt>
          <dd className="g-caveat max-w-none break-words">{s.reads}</dd>
        </div>
        <div>
          <dt className="g-eyebrow">Ruolo minimo da chiedere</dt>
          <dd className="break-words">{s.role}</dd>
        </div>
        <Why label="passi, chi lo concede, come si verifica">
          <ol className="list-decimal pl-5 flex flex-col gap-1">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-2">
            <b>Chi lo concede:</b> {s.owner}
          </p>
          <p>
            <b>Come si verifica:</b> {s.verify}
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
            <span className="g-eyebrow">Growth · lavoro</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {dashboardHref && (
              <a href={dashboardHref} className="text-[14px] font-semibold whitespace-nowrap inline-flex items-center min-h-[44px]">
                ← Numeri
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="g-wrap">
        <div className="flex flex-col gap-10 py-6 pb-16 max-w-[1200px]">
          <div className="flex flex-col gap-3">
            <h1 className="g-h g-h--page">Lavoro Growth</h1>
            <p className="g-caveat">
              Lo spazio di lavoro di Steve: cosa non si misura ancora, cosa testiamo, cosa decidiamo ogni settimana, dove si leggono i dati. Il contenuto è
              versionato nel repo e si aggiorna con un commit: questa pagina non salva nulla. Istruzioni in <code>growth-app/content/README.md</code>.
            </p>
          </div>

          <nav aria-label="Avanzamento" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <ProgressTile
              href="#gap"
              title="Tracking gaps"
              count={gapCount("chiuso")}
              total={gaps.length}
              note={`chiusi · ${fmtInt(gapCount("in corso"))} in corso · ${fmtInt(gapCount("mitigato"))} mitigati · ${fmtInt(gapCount("aperto"))} aperti`}
            />
            <ProgressTile
              href="#esperimenti"
              title="Esperimenti"
              count={decided}
              total={experiments.length}
              note={`decisi · ${fmtInt(expCount("in corso"))} in corso · ${fmtInt(expCount("proposto"))} proposti`}
            />
            <ProgressTile href="#memo" title="Memo settimanale" count={memos.length} total={Math.max(memos.length, 1)} note={memos.length === 0 ? "scritti · nessuno ancora: il primo lo scrive Steve" : `scritti · ultimo: ${memos[0].file}`} />
            <ProgressTile
              href="#accessi"
              title="Accessi e fonti"
              count={accessCount("verificato")}
              total={sources.length}
              note={`verificati · ${fmtInt(accessCount("concesso"))} concessi · ${fmtInt(accessCount("da concedere"))} da concedere`}
            />
          </nav>

          <Section
            id="gap"
            title="Tracking gaps"
            file="content/tracking-gaps.json"
            intro="Cosa oggi non si può misurare, quali KPI sblocca chiuderlo e chi dovrebbe farlo. Priorità e owner sono proposte da confermare; lo stato avanza aperto → in corso → mitigato → chiuso."
            aside={
              <span className="g-caveat">
                {fmtInt(gaps.length - gapCount("chiuso"))} non chiusi su {fmtInt(gaps.length)}
              </span>
            }
          >
            <div className="g-card g-rows py-2">
              <div className="g-rows-head !grid-cols-[48px_minmax(0,1fr)_56px_220px_90px]">
                <span>Id</span>
                <span>Gap</span>
                <span>Prior.</span>
                <span>Stato</span>
                <span className="text-right">dettagli</span>
              </div>
              {sorted.map((g) => (
                <GapRow key={g.id} g={g} />
              ))}
            </div>
          </Section>

          <Section
            id="esperimenti"
            title="Backlog esperimenti"
            file="content/experiments.json"
            intro="Ogni esperimento ha una soglia scritta prima di partire. I numeri di partenza vengono dallo snapshot reale del 05/10, ma gli esperimenti sono esempi da validare con Steve. Un esperimento è proposto, in corso o deciso (scale / fix / kill): nessuno stato di dato, perché non è un numero."
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
            title="Memo settimanale — scale / fix / kill"
            file="content/memo/AAAA-Www.md"
            intro="Una pagina a settimana con le tre domande: cosa funziona, cosa no, cosa testiamo. Copia il template in un nuovo file con il numero della settimana (es. 2026-W41.md) e committalo."
          >
            {memos.length === 0 ? (
              <p className="g-caveat flex items-center gap-2">
                <LockIcon /> Nessun memo ancora: il primo lo scrive Steve.
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
            id="accessi"
            title="Accessi e fonti"
            file="content/sources.json"
            intro="Per ogni fonte: cosa si legge, il ruolo minimo da chiedere, i passi per concederlo, chi lo concede e il numero che prova che funziona. Lo stato passa a «concesso» quando l'owner ha fatto i passi, a «verificato» quando il numero torna."
            aside={
              <span className="g-caveat">
                {fmtInt(accessCount("verificato"))} verificati · {fmtInt(accessCount("concesso"))} concessi · {fmtInt(accessCount("da concedere"))} da concedere
              </span>
            }
          >
            <div className="g-card g-card--flat p-4 text-[14px] max-w-[80ch]">
              <b>Privilegio minimo.</b> Sempre un invito nominativo a Steve con il ruolo più basso che basta per leggere. Mai password condivise, mai account admin,
              mai il login principale di un servizio. Dove il nome del ruolo o il percorso non è certo, c&apos;è scritto «da verificare nell&apos;interfaccia»: lo
              controlla chi concede, non si indovina. Un accesso che non serve più si revoca.
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
