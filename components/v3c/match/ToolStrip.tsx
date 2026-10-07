"use client";
// components/v3c/match/ToolStrip.tsx (#REDESIGN-V3C F4)
// Tre tool precompilati con i numeri di QUESTA partita (o dei prezzi digitati
// nel price check). Il risultato è calcolato dalle stesse funzioni della
// pagina tool (lib/v3c/tools → lib/betting-math); il link porta al tool con
// gli stessi input nella query. Ponte tool ↔ prodotto, nessun partner.
import Link from "next/link";
import { fmt, getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import type { StripItem } from "@/lib/v3c/match-view";
import { matchCopyFor } from "@/lib/v3c/match-copy";
import { eur, toolDef } from "@/lib/v3c/tools";
import { ToolMark } from "../Monogramma";
import { previewWordsFor } from "@/lib/v3c/fixui3-copy";
import { v3cLang } from "@/lib/v3c/copy";

type Props = { title: string; all: string; items: readonly StripItem[]; lang: string; /** polish: il campo bankroll del Kelly, se la pagina lo offre */ bank?: React.ReactNode };

export function ToolStrip({ title, all, items, lang, bank }: Props) {
  const copy = getV3cToolsCopy(v3cLang(lang));
  const mc = matchCopyFor(lang);
  return (
    <section className="v3c-mt-strip" aria-label={title}>
      <div className="v3c-mt-strip-h">
        <span className="v3c-lab">{title}</span>
        {bank}
        <Link className="v3c-ghost" href="/tools">
          {all}
        </Link>
      </div>
      <div className="v3c-mt-strip-r">
        {items.map((it) => {
          const tc = copy.tools[it.slug];
          const r = it.result;
          // polish: Kelly = la frazione grande, l'importo a parole sul bankroll (prima «0.4% · €2» illeggibile)
          const kelly = it.slug === "kelly-criterion" && r && !r.flat ? r.value.split(" · ") : null;
          const bankV = it.values.bank;
          return (
            <a key={it.slug} className="v3c-mt-ts" href={it.href}>
              <ToolMark sigla={it.sigla} name={tc.name} slug={it.slug} />
              <span>
                <span className="v3c-lab">{tc.name}</span>
                <b className={["v3c-num", r?.flat ? "v3c-g-flat" : null, r?.market ? "v3c-m" : null].filter(Boolean).join(" ")}>{kelly ? kelly[0] : r ? r.value : "—"}</b>
                <small>
                  {kelly && kelly[1] && bankV != null ? mc.pc.kellyOf(kelly[1], eur(bankV)) : r ? fmt(tc.results[r.key] ?? r.key, r.vars) : ""} · {toolDef(it.slug).previewInput(it.values, previewWordsFor(lang))}
                </small>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
