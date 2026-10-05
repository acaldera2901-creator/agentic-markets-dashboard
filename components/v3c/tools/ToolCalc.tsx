"use client";
// components/v3c/tools/ToolCalc.tsx (#REDESIGN-V3C F5)
// Il calcolatore di una pagina tool: gli input (precompilati dalla query o
// da un esito della board), il risultato grande, gli altri risultati, la
// formula in una riga. La pagina è statica: la query si legge nel browser dopo
// l'idratazione (useSyncExternalStore con snapshot server vuota), così il primo
// render coincide con l'HTML e nessun input utente entra nel markup.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ToolSlug } from "@/lib/tools/registry";
import type { V3cToolCopy } from "@/lib/i18n/v3c-tools";
import { fmt } from "@/lib/i18n/v3c-tools";
import { getBoardSource, matchTitle } from "@/lib/v3c/board-source";
import { defaultValues, toolDef, valuesFromQuery, type ToolValues } from "@/lib/v3c/tools";

const subscribe = () => () => {};
const getSearch = () => window.location.search;
const getServerSearch = () => "";

/** La query string, "" sul server e al primo render client. */
function useSearch(): string {
  return useSyncExternalStore(subscribe, getSearch, getServerSearch);
}

/** L'esito della board indicato da ?m=&o= (se esiste nella sorgente). */
function boardFromSearch(search: string) {
  const sp = new URLSearchParams(search);
  const mid = sp.get("m");
  if (!mid) return null;
  const src = getBoardSource();
  const m = src.match(mid);
  if (!m) return null;
  const o = m.outcomes.find((x) => x.key === sp.get("o")) ?? src.lead(m);
  return { match: m, outcome: o };
}

type Props = { slug: ToolSlug; copy: V3cToolCopy; invalid: string };

export function ToolCalc({ slug, copy, invalid }: Props) {
  const def = useMemo(() => toolDef(slug), [slug]);
  const search = useSearch();
  const [values, setValues] = useState<ToolValues>(() => defaultValues(def));
  const [raw, setRaw] = useState<Record<string, string>>(() => Object.fromEntries(def.inputs.map((i) => [i.key, String(i.default)])));

  // Prefill, una volta, quando la query arriva dal browser.
  useEffect(() => {
    if (!search) return;
    const board = boardFromSearch(search);
    const fromBoard = board ? def.fromBoard({ outcomes: board.match.outcomes, lead: board.outcome }) : {};
    const fromQuery = valuesFromQuery(def, search);
    const next: ToolValues = { ...defaultValues(def), ...fromBoard, ...fromQuery } as ToolValues;
    // Intenzionale: la query esiste solo nel browser dopo l'idratazione (pagina statica).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues(next);
    setRaw(Object.fromEntries(def.inputs.map((i) => [i.key, next[i.key] == null ? "" : String(next[i.key])])));
  }, [def, search]);

  const results = def.compute(values);
  const [big, ...rest] = results;
  // Senza risultato (input non calcolabile) l'etichetta resta quella del primo
  // risultato del tool, con il trattino sotto: il posto non salta.
  const bigLabel = big ? fmt(copy.results[big.key] ?? big.key, big.vars) : (Object.values(copy.results)[0] ?? "");

  function onChange(key: string, text: string) {
    setRaw((r) => ({ ...r, [key]: text }));
    const n = text.trim() === "" ? null : Number(text.replace(",", "."));
    setValues((v) => ({ ...v, [key]: n == null || Number.isNaN(n) ? null : n }));
  }

  return (
    <>
      <form className="v3c-tf" style={{ "--n": def.inputs.length } as React.CSSProperties} onSubmit={(e) => e.preventDefault()}>
        {def.inputs.map((i) => (
          <label key={i.key}>
            <span className="v3c-lab">{copy.inputs[i.key] ?? i.key}</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              name={i.key}
              value={raw[i.key] ?? ""}
              onChange={(e) => onChange(i.key, e.target.value)}
              data-testid={`in-${i.key}`}
            />
          </label>
        ))}
      </form>

      <section className="v3c-tres" aria-live="polite">
        <div className="v3c-tres-big">
          <span className="v3c-lab">{bigLabel}</span>
          <b className={["v3c-n-xl", big?.flat ? "v3c-g-flat" : null, big?.market ? "v3c-m" : null].filter(Boolean).join(" ")} data-testid="out-big">
            {big ? big.value : invalid}
          </b>
        </div>
        {rest.length ? (
          <div className="v3c-tres-rest">
            {rest.map((r, i) => (
              <span key={`${r.key}-${i}`}>
                <span className="v3c-lab">{fmt(copy.results[r.key] ?? r.key, r.vars)}</span>
                <b className={["v3c-num", r.market ? "v3c-m" : null, r.flat ? "v3c-g-flat" : null].filter(Boolean).join(" ")}>{r.value}</b>
              </span>
            ))}
          </div>
        ) : null}
      </section>
      <p className="v3c-fine v3c-formula">{copy.formula}</p>
    </>
  );
}

/** Nella fascia: «prefilled from … » se la query indica un esito della board, altrimenti «type your numbers». */
export function PrefillNote({ prefilled, typeYours }: { prefilled: string; typeYours: string }) {
  const search = useSearch();
  const board = search ? boardFromSearch(search) : null;
  if (!board) return <span>{typeYours}</span>;
  // «prefilled from {match} · {outcome} {price}»: la partita è un link, il resto testo.
  const [before, after = ""] = prefilled.split("{match}");
  const vars = { outcome: board.outcome.label, price: board.outcome.price.toFixed(2) };
  return (
    <span data-testid="prefill-note">
      {fmt(before, vars)}
      <a href={board.match.href}>{matchTitle(board.match)}</a>
      {fmt(after, vars)}
    </span>
  );
}
