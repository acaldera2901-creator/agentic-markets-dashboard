"use client";
// /community — Creator Picks (#MB-2): schedine pubblicate da utenti/influencer
// col Match Builder. Pagina pubblica di discovery: i match sono visibili a
// tutti, pick e probabilità restano dietro la registrazione (stessa proiezione
// per-sessione del board — il lock È la CTA). Ogni card riapre la schedina
// originale via /app?mb=...&ref=CODICE, quindi il traffico da qui mantiene
// l'attribution del creator.

import { useCallback, useEffect, useState, type CSSProperties } from "react";
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
  locked: boolean;
  combined_prob: number | null;
  selections: SlipSelection[];
};

type Access = "none" | "partial" | "full";

// BUG-007: the page was Italian-only and ignored the user's language choice.
// Mirror the board's `agentic-lang` (default IT, the prior behavior) so users in
// any of the board's 5 languages get matching copy. Standalone route, so a tiny
// local dict beats wiring the full i18n provider.
const COPY = {
  it: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Schedine costruite dalla community col Match Builder, basate sulle probabilità del nostro modello. Nessuna quota, nessun edge promesso — solo predizioni AI selezionate dai creator.",
    create: "Crea la tua →",
    loading: "Caricamento…",
    loadError: "Impossibile caricare le schedine.",
    retry: "Riprova",
    emptyTitle: "Nessuna schedina pubblicata ancora.",
    emptySub: "Sii il primo: costruiscila col Match Builder e condividila.",
    emptyExample: "Esempio",
    register: "Registrati per vedere i pick →",
    open: "Apri schedina →",
    unlock: "Sblocca con Pro →",
    gateNoneTitle: "Le Creator Picks sono incluse in Base e Pro",
    gateNoneSub: "Sblocca le schedine dei creator con un piano a pagamento.",
    gatePartial: "Passa a Pro per vedere tutte le schedine.",
    seePlans: "Vedi i piani →",
    responsible: "18+ · gioca responsabilmente",
    locale: "it-IT",
  },
  en: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Accumulators built by the community with the Match Builder, based on our model's probabilities. No odds, no promised edge — just AI predictions hand-picked by creators.",
    create: "Build yours →",
    loading: "Loading…",
    loadError: "Couldn't load the slips.",
    retry: "Retry",
    emptyTitle: "No slips published yet.",
    emptySub: "Be the first: build one with the Match Builder and share it.",
    emptyExample: "Example",
    register: "Register to see the picks →",
    open: "Open slip →",
    unlock: "Unlock with Pro →",
    gateNoneTitle: "Creator Picks is included in Base and Pro",
    gateNoneSub: "Unlock the creators' slips with a paid plan.",
    gatePartial: "Upgrade to Pro to see every slip.",
    seePlans: "See plans →",
    responsible: "18+ · gamble responsibly",
    locale: "en-GB",
  },
  es: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Combinadas creadas por la comunidad con el Match Builder, basadas en las probabilidades de nuestro modelo. Sin cuotas, sin edge prometido — solo predicciones de IA seleccionadas por creators.",
    create: "Crea la tuya →",
    loading: "Cargando…",
    loadError: "No se pudieron cargar las combinadas.",
    retry: "Reintentar",
    emptyTitle: "Aún no hay combinadas publicadas.",
    emptySub: "Sé el primero: constrúyela con el Match Builder y compártela.",
    emptyExample: "Ejemplo",
    register: "Regístrate para ver los picks →",
    open: "Abrir combinada →",
    unlock: "Desbloquea con Pro →",
    gateNoneTitle: "Creator Picks está incluido en Base y Pro",
    gateNoneSub: "Desbloquea las combinadas de los creators con un plan de pago.",
    gatePartial: "Pasa a Pro para ver todas las combinadas.",
    seePlans: "Ver planes →",
    responsible: "18+ · juega con responsabilidad",
    locale: "es-ES",
  },
  fr: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Combinés créés par la communauté avec le Match Builder, basés sur les probabilités de notre modèle. Aucune cote, aucun edge promis — juste des prédictions IA sélectionnées par les creators.",
    create: "Créez le vôtre →",
    loading: "Chargement…",
    loadError: "Impossible de charger les combinés.",
    retry: "Réessayer",
    emptyTitle: "Aucun combiné publié pour le moment.",
    emptySub: "Soyez le premier : construisez-le avec le Match Builder et partagez-le.",
    emptyExample: "Exemple",
    register: "Inscrivez-vous pour voir les picks →",
    open: "Ouvrir le combiné →",
    unlock: "Débloquez avec Pro →",
    gateNoneTitle: "Creator Picks est inclus dans Base et Pro",
    gateNoneSub: "Débloquez les combinés des creators avec un abonnement payant.",
    gatePartial: "Passez à Pro pour voir tous les combinés.",
    seePlans: "Voir les offres →",
    responsible: "18+ · jouez de manière responsable",
    locale: "fr-FR",
  },
  ru: {
    back: "← Board",
    title: "Creator Picks",
    sub: "Экспрессы, собранные сообществом в Match Builder, на основе вероятностей нашей модели. Без коэффициентов и обещанного edge — только AI-прогнозы, отобранные креаторами.",
    create: "Создать свой →",
    loading: "Загрузка…",
    loadError: "Не удалось загрузить экспрессы.",
    retry: "Повторить",
    emptyTitle: "Пока нет опубликованных экспрессов.",
    emptySub: "Будьте первым: соберите его в Match Builder и поделитесь.",
    emptyExample: "Пример",
    register: "Зарегистрируйтесь, чтобы увидеть пики →",
    open: "Открыть экспресс →",
    unlock: "Открыть с Pro →",
    gateNoneTitle: "Creator Picks входит в Base и Pro",
    gateNoneSub: "Откройте экспрессы креаторов с платным планом.",
    gatePartial: "Перейдите на Pro, чтобы видеть все экспрессы.",
    seePlans: "Смотреть планы →",
    responsible: "18+ · играйте ответственно",
    locale: "ru-RU",
  },
} as const;

type Lang = keyof typeof COPY;

export default function CommunityPage() {
  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [access, setAccess] = useState<Access>("none");
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("it");
  const t = COPY[lang];

  useEffect(() => {
    const stored = localStorage.getItem("agentic-lang");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from localStorage: a lazy initializer would mismatch the server-rendered ("it") markup at hydration.
    if (stored && stored in COPY) setLang(stored as Lang);
  }, []);

  // Fetch only sets state in async callbacks (never synchronously) so the mount
  // effect stays free of the set-state-in-effect rule, mirroring the original.
  const fetchSlips = useCallback(() => {
    let alive = true;
    fetch("/api/match-builder", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlips(Array.isArray(d?.slips) ? d.slips : []);
        setAccess(d?.access === "full" || d?.access === "partial" ? d.access : "none");
      })
      // BUG-006: a network failure used to leave `slips=[]`, indistinguishable
      // from the legit empty state. Keep slips null + flag an error so we render
      // a dedicated message with retry, not a false "nothing published yet".
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => fetchSlips(), [fetchSlips]);

  // Retry is a user event (not an effect) → resetting state synchronously here
  // is fine and re-shows the loading line before the refetch.
  const retry = () => { setError(false); setSlips(null); fetchSlips(); };

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
        <a href="/app?tab=match-builder" className="btn-secondary shrink-0">
          {t.create}
        </a>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {/* #CREATOR-GATE-0626: upsell quando l'accesso non è pieno (Free/anon → none, Base → partial). */}
        {access !== "full" && (
          <div
            className="chamfer p-4 flex items-center justify-between gap-3"
            style={{ "--surf": "var(--am-coral-dim)", "--bcol": "var(--am-coral-b)" } as CSSProperties}
          >
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--am-text)" }}>
                {access === "none" ? t.gateNoneTitle : t.gatePartial}
              </p>
              {access === "none" && (
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--am-muted)" }}>{t.gateNoneSub}</p>
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav so the ?tab= deep-link resolves (see header note) */}
            <a href="/app?tab=plans" className="btn-primary shrink-0">
              {t.seePlans}
            </a>
          </div>
        )}
        {error && (
          <div className="text-center py-16 space-y-3">
            <p className="text-sm font-mono" style={{ color: "var(--am-muted)" }}>{t.loadError}</p>
            <button onClick={retry} className="btn-secondary">
              {t.retry}
            </button>
          </div>
        )}
        {!error && slips === null && (
          <p className="text-center text-xs font-mono py-16" style={{ color: "var(--am-muted-2)" }}>{t.loading}</p>
        )}
        {/* QW2 (audit 2026-07-12): l'empty state INSEGNA il next step invece di
            lasciare un messaggio isolato nel void. Un esempio "ghost" mostra la
            FORMA di una schedina creator (cosa apparirà), poi messaggio + CTA
            inline ancorati sotto — non più il "Crea la tua" isolato in alto a dx. */}
        {!error && slips !== null && slips.length === 0 && (
          <div className="py-8 space-y-6">
            <article aria-hidden className="chamfer p-4 space-y-3" style={{ opacity: 0.5 }}>
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border"
                  style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)" }}
                >
                  {t.emptyExample}
                </span>
                <span className="block rounded" style={{ width: 40, height: 20, background: "var(--am-coral-dim)" }} />
              </div>
              <div className="space-y-3 pt-1">
                {[68, 84, 56].map((w, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="space-y-1.5" style={{ flex: 1, minWidth: 0 }}>
                      <span className="block rounded" style={{ height: 9, width: `${w}%`, maxWidth: 260, background: "var(--am-line-2)" }} />
                      <span className="block rounded" style={{ height: 7, width: `${w - 28}%`, maxWidth: 150, background: "var(--am-line)" }} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="block rounded" style={{ height: 9, width: 58, background: "var(--am-line-2)" }} />
                      <span className="block rounded" style={{ height: 9, width: 26, background: "var(--am-coral-dim)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <div className="text-center space-y-3">
              <p className="text-sm font-bold" style={{ color: "var(--am-text)" }}>{t.emptyTitle}</p>
              <p className="text-xs font-mono max-w-sm mx-auto" style={{ color: "var(--am-muted)" }}>{t.emptySub}</p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav so the ?tab= deep-link resolves (see header note) */}
              <a href="/app?tab=match-builder" className="btn-primary">{t.create}</a>
            </div>
          </div>
        )}
        {slips?.map((slip) => (
          <article key={slip.id} className="chamfer p-4 space-y-3">
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
            <div
              className="space-y-1.5"
              style={slip.locked ? { filter: "blur(4px)", opacity: 0.55, pointerEvents: "none", userSelect: "none" } : undefined}
              aria-hidden={slip.locked || undefined}
            >
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
                    ) : !slip.locked ? (
                      // #7: a locked slip is already fully blurred (the single lock
                      // cue) + has the "Unlock with Pro" button — the per-row 🔒 sat
                      // under the blur, redundant. Keep 🔒 only for a rare non-locked
                      // row with no market.
                      <span style={{ color: "var(--am-muted-2)" }}>🔒</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              {slip.locked ? (
                /* #CREATOR-GATE-0626: schedina bloccata → upsell ai Piani (hard nav). */
                /* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav so ?tab= resolves */
                <a
                  href="/app?tab=plans"
                  className="text-xs font-mono uppercase tracking-wider px-3 py-1.5 border transition-colors"
                  style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)", background: "var(--am-coral-dim)" }}
                >
                  {t.unlock}
                </a>
              ) : (
                <Link
                  href={`/app?mb=${encodeURIComponent(slip.mb_param)}&ref=${encodeURIComponent(slip.creator_code)}`}
                  className="text-xs font-mono px-3 py-1.5 border transition-colors"
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
