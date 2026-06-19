"use client";
// /community — Creator Picks (#MB-2): schedine pubblicate da utenti/influencer
// col Match Builder. Pagina pubblica di discovery: i match sono visibili a
// tutti, pick e probabilità restano dietro la registrazione (stessa proiezione
// per-sessione del board — il lock È la CTA). Ogni card riapre la schedina
// originale via /app?mb=...&ref=CODICE, quindi il traffico da qui mantiene
// l'attribution del creator.

import { useEffect, useState } from "react";
import Link from "next/link";

type SlipSelection = {
  label: string;
  sport: string;
  when: string;
  market: string | null;
  prob: number | null;
};

type Slip = {
  id: string;
  creator_code: string;
  mb_param: string;
  created_at: string;
  combined_prob: number | null;
  selections: SlipSelection[];
};

// BUG-007: the page was Italian-only and ignored the user's language choice.
// Mirror the board's `agentic-lang` (default IT, the prior behavior) so an EN
// user gets EN copy. Standalone route, so a tiny local dict beats wiring the
// full i18n provider.
const COPY = {
  it: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Schedine costruite dalla community col Match Builder, basate sulle probabilità del nostro modello. Nessuna quota, nessun edge promesso — solo predizioni AI selezionate dai creator.",
    create: "Crea la tua →",
    loading: "Caricamento…",
    emptyTitle: "Nessuna schedina pubblicata ancora.",
    emptySub: "Sii il primo: costruiscila col Match Builder e condividila.",
    register: "Registrati per vedere i pick →",
    open: "Apri schedina →",
    responsible: "18+ · gioca responsabilmente",
    locale: "it-IT",
  },
  en: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Accumulators built by the community with the Match Builder, based on our model's probabilities. No odds, no promised edge — just AI predictions hand-picked by creators.",
    create: "Build yours →",
    loading: "Loading…",
    emptyTitle: "No slips published yet.",
    emptySub: "Be the first: build one with the Match Builder and share it.",
    register: "Register to see the picks →",
    open: "Open slip →",
    responsible: "18+ · gamble responsibly",
    locale: "en-GB",
  },
} as const;

export default function CommunityPage() {
  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [locked, setLocked] = useState(true);
  const [lang, setLang] = useState<"it" | "en">("it");
  const t = COPY[lang];

  useEffect(() => {
    const stored = localStorage.getItem("agentic-lang");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from localStorage: a lazy initializer would mismatch the server-rendered ("it") markup at hydration.
    if (stored === "en") setLang("en");
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/match-builder", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlips(Array.isArray(d?.slips) ? d.slips : []);
        setLocked(Boolean(d?.locked));
      })
      .catch(() => { if (alive) setSlips([]); });
    return () => { alive = false; };
  }, []);

  // BUG-002: page was dark-only (hardcoded bg-[#070b14]/text-white + fixed
  // gray utilities) and ignored the theme toggle. Drive surfaces/text off the
  // design-system --am-* tokens so the page follows data-theme; dark renders
  // identically to before, light becomes coherent with the rest of the app.
  return (
    <main className="min-h-screen" style={{ background: "var(--am-bg)", color: "var(--am-text)" }}>
      <header
        className="px-6 py-4 flex items-center justify-between border-b"
        style={{ borderColor: "var(--am-line)" }}
      >
        <div>
          <Link href="/" className="text-xs font-mono transition-colors" style={{ color: "var(--am-muted)" }}>{t.back}</Link>
          <h1 className="text-2xl font-black mt-1">{t.title}</h1>
          <p className="text-xs font-mono max-w-xl" style={{ color: "var(--am-muted)" }}>
            {t.sub}
          </p>
        </div>
        {/* Plain <a> (hard nav), NOT next/link: a soft client-side nav to
            /app?tab=match-builder lands on the default Bets tab because the tab is
            resolved only in a useState initializer at mount. A full load applies
            the ?tab= deep-link correctly. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional hard nav, see comment above */}
        <a
          href="/app?tab=match-builder"
          className="text-xs font-mono px-4 py-2 rounded border transition-colors shrink-0"
          style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)", background: "var(--am-coral-dim)" }}
        >
          {t.create}
        </a>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {slips === null && (
          <p className="text-center text-xs font-mono py-16" style={{ color: "var(--am-muted-2)" }}>{t.loading}</p>
        )}
        {slips !== null && slips.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-sm font-mono" style={{ color: "var(--am-muted)" }}>{t.emptyTitle}</p>
            <p className="text-xs font-mono" style={{ color: "var(--am-muted-2)" }}>{t.emptySub}</p>
          </div>
        )}
        {slips?.map((slip) => (
          <article
            key={slip.id}
            className="rounded-lg border p-4 space-y-3"
            style={{ borderColor: "var(--am-line)", background: "var(--am-panel)" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-mono px-2 py-0.5 rounded border"
                style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)" }}
              >
                {slip.creator_code}
              </span>
              <div className="flex items-center gap-3">
                {slip.combined_prob != null && (
                  <span className="text-lg font-black font-mono" style={{ color: "var(--am-coral)" }}>
                    {Math.round(slip.combined_prob * 100)}%
                  </span>
                )}
                <span className="text-[10px] font-mono" style={{ color: "var(--am-muted-2)" }}>
                  {new Date(slip.created_at).toLocaleDateString(t.locale, { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {slip.selections.map((sel, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono gap-3">
                  <div className="min-w-0">
                    <p className="truncate" style={{ color: "var(--am-text)" }}>{sel.label}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--am-muted-2)" }}>{sel.sport}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sel.market != null ? (
                      <>
                        <span className="truncate max-w-[140px] sm:max-w-[200px]" style={{ color: "var(--am-muted)" }}>{sel.market}</span>
                        {sel.prob != null && <span style={{ color: "var(--am-coral)" }}>{Math.round(sel.prob * 100)}%</span>}
                      </>
                    ) : (
                      <span style={{ color: "var(--am-muted-2)" }}>🔒</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              {locked ? (
                <Link
                  href={`/app?mb=${encodeURIComponent(slip.mb_param)}&ref=${encodeURIComponent(slip.creator_code)}`}
                  className="text-xs font-mono px-3 py-1.5 rounded border transition-colors"
                  style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)", background: "var(--am-coral-dim)" }}
                >
                  {t.register}
                </Link>
              ) : (
                <Link
                  href={`/app?mb=${encodeURIComponent(slip.mb_param)}&ref=${encodeURIComponent(slip.creator_code)}`}
                  className="text-xs font-mono px-3 py-1.5 rounded border transition-colors"
                  style={{ borderColor: "var(--am-line-2)", color: "var(--am-muted)" }}
                >
                  {t.open}
                </Link>
              )}
              <span className="text-[9px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.responsible}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
