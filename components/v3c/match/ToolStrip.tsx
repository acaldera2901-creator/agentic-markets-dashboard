"use client";
// components/v3c/match/ToolStrip.tsx (#REDESIGN-V3C F4)
// Tre tool precompilati con i numeri di QUESTA partita (o dei prezzi digitati
// nel price check). Il risultato è calcolato dalle stesse funzioni della
// pagina tool (lib/v3c/tools → lib/betting-math); il link porta al tool con
// gli stessi input nella query. Ponte tool ↔ prodotto, nessun partner.
import Link from "next/link";
import { fmt, getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import type { StripItem } from "@/lib/v3c/match-view";
import { toolDef } from "@/lib/v3c/tools";
import { ToolMark } from "../Monogramma";

type Props = { title: string; all: string; items: readonly StripItem[]; lang: string };

export function ToolStrip({ title, all, items, lang }: Props) {
  const copy = getV3cToolsCopy(lang === "it" ? "it" : "en");
  return (
    <section className="v3c-mt-strip" aria-label={title}>
      <div className="v3c-mt-strip-h">
        <span className="v3c-lab">{title}</span>
        <Link className="v3c-ghost" href="/tools">
          {all}
        </Link>
      </div>
      <div className="v3c-mt-strip-r">
        {items.map((it) => {
          const tc = copy.tools[it.slug];
          const r = it.result;
          return (
            <a key={it.slug} className="v3c-mt-ts" href={it.href}>
              <ToolMark sigla={it.sigla} name={tc.name} />
              <span>
                <span className="v3c-lab">{tc.name}</span>
                <b className={["v3c-num", r?.flat ? "v3c-g-flat" : null, r?.market ? "v3c-m" : null].filter(Boolean).join(" ")}>{r ? r.value : "—"}</b>
                <small>
                  {r ? fmt(tc.results[r.key] ?? r.key, r.vars) : ""} · {toolDef(it.slug).previewInput(it.values)}
                </small>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
