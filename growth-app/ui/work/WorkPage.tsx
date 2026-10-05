// Steve's workspace: tracking gaps, experiment backlog, weekly memo, access
// list. Presentational only — content comes in already validated, so the
// host (this app or the CRM later) decides where it is stored.

import type { ReactNode } from "react";
import type { AccessSource, Experiment, TrackingGap, WorkContent } from "./content";

interface Column<T> {
  label: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

// A table on desktop, stacked cards under md: no horizontal scroll at 390px.
function ResponsiveTable<T>({ rows, columns, rowKey }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string }) {
  return (
    <>
      <table className="hidden md:table w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
            {columns.map((c) => (
              <th key={c.label} className={`font-medium py-2 px-3 border-b border-gray-800 align-bottom ${c.className ?? ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-gray-800/70 align-top">
              {columns.map((c) => (
                <td key={c.label} className={`py-3 px-3 text-gray-200 leading-snug ${c.className ?? ""}`}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="md:hidden flex flex-col gap-3">
        {rows.map((r) => (
          <li key={rowKey(r)} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <dl className="flex flex-col gap-2 text-sm">
              {columns.map((c) => (
                <div key={c.label} className="min-w-0">
                  <dt className="text-gray-500 text-[11px] uppercase tracking-wider">{c.label}</dt>
                  <dd className="text-gray-200 leading-snug break-words">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

const PRIORITY_STYLE: Record<TrackingGap["priority"], string> = {
  P0: "bg-red-950 text-red-300 border-red-800",
  P1: "bg-amber-950 text-amber-300 border-amber-800",
  P2: "bg-gray-800 text-gray-300 border-gray-700",
};

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-block text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${className}`}>{children}</span>;
}

const neutralPill = "bg-gray-900 text-gray-300 border-gray-700";

function Section({ id, title, file, intro, children }: { id: string; title: string; file: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-gray-400 text-sm leading-snug">{intro}</p>
        <p className="text-gray-500 text-[11px]">
          Si modifica in <code className="text-gray-400 break-all">{file}</code>
        </p>
      </div>
      {children}
    </section>
  );
}

const gapColumns: Column<TrackingGap>[] = [
  {
    label: "Gap",
    cell: (g) => (
      <>
        <span className="text-gray-500 text-xs mr-1.5">{g.id}</span>
        <span className="font-medium text-white">{g.title}</span>
        <p className="text-gray-400 text-xs mt-1">{g.problem}</p>
        {g.dependsOn && <p className="text-gray-300 text-xs mt-1"><span className="text-gray-500">Dipende da:</span> {g.dependsOn}</p>}
        {g.tiles && <p className="text-amber-300 text-xs mt-1"><span className="text-gray-500">Rende reali le tile PROXY:</span> {g.tiles.join(" · ")}</p>}
      </>
    ),
    className: "md:w-[38%]",
  },
  { label: "Priorità", cell: (g) => <Pill className={PRIORITY_STYLE[g.priority]}>{g.priority}</Pill> },
  { label: "KPI sbloccati", cell: (g) => <ul className="flex flex-col gap-0.5">{g.unlocks.map((k) => <li key={k}>· {k}</li>)}</ul> },
  { label: "Owner suggerito", cell: (g) => g.owner },
  { label: "Stato", cell: (g) => <Pill className={neutralPill}>{g.status}</Pill> },
];

const experimentColumns: Column<Experiment>[] = [
  { label: "Ipotesi", cell: (e) => <><span className="text-gray-500 text-xs mr-1.5">{e.id}</span>{e.hypothesis}{e.note && <p className="text-amber-300 text-[11px] mt-1">{e.note}</p>}</>, className: "md:w-[26%]" },
  { label: "KPI target", cell: (e) => e.kpiTarget },
  { label: "Fonte dato", cell: (e) => e.dataSource },
  { label: "Durata", cell: (e) => e.duration },
  { label: "Soglia di decisione", cell: (e) => e.decisionThreshold },
  { label: "Stato", cell: (e) => <Pill className={neutralPill}>{e.status}</Pill> },
];

const ACCESS_STYLE: Record<AccessSource["status"], string> = {
  "da concedere": "bg-amber-950 text-amber-300 border-amber-800",
  concesso: "bg-sky-950 text-sky-300 border-sky-800",
  verificato: "bg-emerald-950 text-emerald-300 border-emerald-800",
};

// One operational block per source: what, which role, how to grant, who, how to check.
function AccessCard({ s }: { s: AccessSource }) {
  return (
    <article id={`accesso-${s.id}`} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-white leading-snug">{s.tool}</h3>
        <Pill className={ACCESS_STYLE[s.status]}>{s.status}</Pill>
      </div>
      <dl className="flex flex-col gap-2.5 text-sm">
        <div><dt className="text-gray-500 text-[11px] uppercase tracking-wider">Cosa si legge</dt><dd className="text-gray-300 leading-snug break-words">{s.reads}</dd></div>
        <div><dt className="text-gray-500 text-[11px] uppercase tracking-wider">Ruolo minimo da chiedere</dt><dd className="text-gray-200 leading-snug break-words">{s.role}</dd></div>
        <div>
          <dt className="text-gray-500 text-[11px] uppercase tracking-wider">Passi per concederlo</dt>
          <dd>
            <ol className="list-decimal pl-5 flex flex-col gap-1 text-gray-300 leading-snug break-words">
              {s.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </dd>
        </div>
        <div><dt className="text-gray-500 text-[11px] uppercase tracking-wider">Chi lo concede</dt><dd className="text-gray-200 break-words">{s.owner}</dd></div>
        <div><dt className="text-gray-500 text-[11px] uppercase tracking-wider">Come si verifica</dt><dd className="text-gray-300 leading-snug break-words">{s.verify}</dd></div>
      </dl>
    </article>
  );
}

const NAV = [
  { id: "gap", label: "Tracking gaps" },
  { id: "esperimenti", label: "Esperimenti" },
  { id: "memo", label: "Memo settimanale" },
  { id: "accessi", label: "Accessi e fonti" },
];

export function WorkPage({ content, dashboardHref }: { content: WorkContent; /** Link back to the numbers; omitted → no link. */ dashboardHref?: string }) {
  const { gaps, experiments, sources, memos, memoTemplate } = content;
  const openGaps = gaps.filter((g) => g.status !== "chiuso").length;
  const accessCount = (st: AccessSource["status"]) => sources.filter((s) => s.status === st).length;
  return (
    <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-10 min-w-0">
      <header className="flex flex-col gap-2">
        {dashboardHref && (
          <a href={dashboardHref} className="self-start text-sm text-gray-400 hover:text-white underline underline-offset-4 decoration-gray-700">
            ← Numeri
          </a>
        )}
        <h1 className="text-2xl font-bold text-white">Lavoro Growth</h1>
        <p className="text-gray-400 text-sm leading-snug max-w-3xl">
          Lo spazio di lavoro di Steve: cosa non si misura ancora, cosa testiamo, cosa decidiamo ogni settimana, dove si leggono i dati.
          Il contenuto è versionato nel repo e si aggiorna con un commit: questa pagina non salva nulla. Istruzioni in{" "}
          <code className="text-gray-300">growth-app/content/README.md</code>.
        </p>
        <nav className="flex flex-wrap gap-2 mt-1">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white">
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="gap" title={`Tracking gaps · ${openGaps} non chiusi su ${gaps.length}`} file="content/tracking-gaps.json" intro="Cosa oggi non si può misurare, quali KPI sblocca chiuderlo e chi dovrebbe farlo. Priorità e owner sono proposte da confermare.">
        <ResponsiveTable rows={gaps} columns={gapColumns} rowKey={(g) => g.id} />
      </Section>

      <Section id="esperimenti" title="Backlog esperimenti" file="content/experiments.json" intro="Ogni esperimento ha una soglia scritta prima di partire. I numeri di partenza vengono dallo snapshot reale del 05/10, ma gli esperimenti sono esempi da validare con Steve.">
        {experiments.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Nessun esperimento nel backlog.</p>
        ) : (
          <ResponsiveTable rows={experiments} columns={experimentColumns} rowKey={(e) => e.id} />
        )}
      </Section>

      <Section id="memo" title="Memo settimanale — scale / fix / kill" file="content/memo/AAAA-Www.md" intro="Una pagina a settimana con le tre domande: cosa funziona, cosa no, cosa testiamo. Copia il template in un nuovo file con il numero della settimana (es. 2026-W41.md) e committalo.">
        {memos.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Nessun memo ancora: il primo lo scrive Steve.</p>
        ) : (
          memos.map((m) => (
            <article key={m.file} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-gray-500 text-[11px] mb-2">{m.file}</div>
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-200 font-sans">{m.body}</pre>
            </article>
          ))
        )}
        <details className="bg-gray-900/60 border border-dashed border-gray-700 rounded-xl p-4">
          <summary className="cursor-pointer text-sm text-gray-300">Template (content/memo/_template.md)</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-gray-400 font-mono">{memoTemplate}</pre>
        </details>
      </Section>

      <Section
        id="accessi"
        title={`Accessi e fonti · ${accessCount("verificato")} verificati, ${accessCount("concesso")} concessi, ${accessCount("da concedere")} da concedere`}
        file="content/sources.json"
        intro="Per ogni fonte: cosa si legge, il ruolo minimo da chiedere, i passi per concederlo, chi lo concede e il numero che prova che funziona. Lo stato passa a «concesso» quando l'owner ha fatto i passi, a «verificato» quando il numero torna."
      >
        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 text-sm text-gray-300 leading-snug">
          <span className="font-semibold text-white">Privilegio minimo.</span> Sempre un invito nominativo a Steve con il ruolo più basso che basta per leggere.
          Mai password condivise, mai account admin, mai il login principale di un servizio. Dove il nome del ruolo o il percorso non è certo, c&apos;è scritto
          «da verificare nell&apos;interfaccia»: lo controlla chi concede, non si indovina. Un accesso che non serve più si revoca.
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sources.map((s) => <AccessCard key={s.id} s={s} />)}
        </div>
      </Section>
    </main>
  );
}
