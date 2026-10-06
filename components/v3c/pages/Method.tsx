"use client";
// components/v3c/pages/Method.tsx (#REDESIGN-V3C F9 · filone pages) — /how-it-works = Metodo.
// Una schermata, quattro idee (nel prototipo mancava): il blend 70/30, il sigillo,
// cosa significa gap, cosa NON diciamo. ≤22 parole per elemento; il dettaglio sta
// dietro una «i» (details/summary nativo: tastiera e screen reader gratis, zero JS).
// I disegni sono schemi, NON dati: nessun numero di partita, nessun hash finto.
import type { ReactNode } from "react";
import Link from "next/link";
import { usePagesCopy } from "@/lib/v3c/pages-copy.client";
import { hubPath } from "@/lib/tools/registry";
import { Fascia } from "../Fascia";

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="v3c-pg-i">
      <summary aria-label={label} title={label}>
        <span aria-hidden="true">i</span>
      </summary>
      <p className="v3c-small">{children}</p>
    </details>
  );
}

function Block({ k, title, body, detail, more, children }: { k: string; title: string; body: string; detail: string; more: string; children?: ReactNode }) {
  return (
    <section className="v3c-pg-mb" aria-labelledby={`v3c-m-${k}`}>
      <div className="v3c-pg-mb-h">
        <span className="v3c-pg-mb-k" aria-hidden="true">
          {k}
        </span>
        <h2 className="v3c-t-sec" id={`v3c-m-${k}`}>
          {title}
        </h2>
        <Info label={more}>{detail}</Info>
      </div>
      <p className="v3c-pg-mb-b">{body}</p>
      {children ? <div className="v3c-pg-mb-v">{children}</div> : null}
    </section>
  );
}

export function V3cMethod() {
  const t = usePagesCopy().method;
  const b = t.blocks;
  return (
    <main className="v3c-wrap">
      <Fascia
        tab={t.tab}
        title={t.title}
        meta={
          <>
            <b>{t.metaStrong}</b>
            <span>{t.metaRest}</span>
          </>
        }
      />
      <div className="v3c-pg-method">
        <Block k={b.blend.k} title={b.blend.title} body={b.blend.body} detail={b.blend.detail} more={t.more(b.blend.title)}>
          <div className="v3c-pg-blend" role="img" aria-label={`70% ${b.blend.market}, 30% ${b.blend.model}`}>
            <span className="v3c-pg-blend-m">
              <b className="v3c-num">70</b> {b.blend.market}
            </span>
            <span className="v3c-pg-blend-e">
              <b className="v3c-num">30</b> {b.blend.model}
            </span>
          </div>
        </Block>

        <Block k={b.seal.k} title={b.seal.title} body={b.seal.body} detail={b.seal.detail} more={t.more(b.seal.title)}>
          <span className="v3c-seal v3c-pg-seal-ex" aria-hidden="true">
            <i>{b.seal.label}</i> hh:mm UTC
          </span>
        </Block>

        <Block k={b.gap.k} title={b.gap.title} body={b.gap.body} detail={b.gap.detail} more={t.more(b.gap.title)}>
          <div className="v3c-pg-gapdraw" role="img" aria-label={`${b.gap.gap} = ${b.gap.estimate} − ${b.gap.market}`}>
            <span className="v3c-pg-gd-track">
              <i className="v3c-pg-gd-m" />
              <b className="v3c-pg-gd-g" />
              <i className="v3c-pg-gd-e" />
            </span>
            <span className="v3c-pg-gd-l">
              <span className="v3c-m">{b.gap.market}</span>
              <span>{b.gap.gap}</span>
              <span>
                <mark>{b.gap.estimate}</mark>
              </span>
            </span>
          </div>
        </Block>

        <Block k={b.not.k} title={b.not.title} body={b.not.body} detail={b.not.detail} more={t.more(b.not.title)}>
          <p className="v3c-t-row v3c-pg-mb-line">{b.not.line}</p>
        </Block>
      </div>

      <div className="v3c-act v3c-pg-mact">
        <Link className="v3c-btn v3c-btn-line" href="/">
          {t.board}
        </Link>
        <Link className="v3c-ghost" href="/history">
          {t.record} <span aria-hidden="true">→</span>
        </Link>
        <a className="v3c-ghost" href={hubPath("en")}>
          {t.tools} <span aria-hidden="true">→</span>
        </a>
      </div>
    </main>
  );
}
