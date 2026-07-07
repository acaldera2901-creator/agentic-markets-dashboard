"use client";
// /weekly-pick — #WEEKLY-PICK-1. Pagina strutturata della MULTIPLA DELLA CASA:
// hero + spiegazione, la multipla della settimana (stato live delle legs), come
// funziona, e lo storico delle settimane precedenti. Chi compra a metà settimana
// vede cosa ha già giocato e cosa manca. FTC-safe: nessuna quota, nessun edge.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type LegStatus = "upcoming" | "won" | "lost" | "void" | null;
type Sel = { label: string; sport: string; market: string | null; prob: number | null; status?: LegStatus; kickoff?: string | null };
type Data = {
  enabled: boolean;
  available?: boolean;
  unlocked?: boolean;
  included?: boolean;
  price_usd?: number;
  full_price_usd?: number;
  discounted?: boolean;
  combined_prob?: number | null;
  outcome?: "live" | "won" | "lost" | null;
  legs?: number;
  legs_remaining?: number;
  selections?: Sel[];
};
type HistLeg = { label: string; sport: string; market: string; prob: number; status: Exclude<LegStatus, null> };
type HistWeek = { week_start: string; combined_prob: number | null; outcome: "live" | "won" | "lost"; legs: HistLeg[] };
type Hist = { enabled: boolean; weeks?: HistWeek[] };

const COPY = {
  it: { back: "← Board", title: "Weekly Pick", sub: "La multipla della casa: le migliori pick della settimana combinate. Nessuna quota, nessun edge promesso — solo la schedina più probabile del nostro modello.", loading: "Caricamento…", loadError: "Impossibile caricare la weekly pick.", retry: "Riprova", soon: "La multipla di questa settimana è in arrivo.", combined: "Probabilità combinata (modello)", remaining: (n: number) => `${n} ancora da giocare`, lockedTitle: "Sblocca la Weekly Pick", unlockCta: (p: string) => `Sblocca a ${p}`, unlocking: "Reindirizzamento al pagamento…", checkoutError: "Impossibile avviare il pagamento. Riprova.", includedCta: "…oppure passa a Pro", responsible: "18+ · gioca responsabilmente", howTitle: "Come funziona", how1: "Le pick a più alta probabilità del modello, combinate in una sola schedina.", how2: "Una nuova multipla ogni lunedì; scade a fine settimana.", how3: "Inclusa nel Pro. Per gli altri, sblocco one-off.", histTitle: "Settimane precedenti", histEmpty: "Il primo storico arriva a fine settimana.", outLive: "In corso", outWon: "Passata", outLost: "Non passata", stUp: "Da giocare", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "it-IT" },
  en: { back: "← Board", title: "Weekly Pick", sub: "The house accumulator: the best picks of the week combined. No odds, no promised edge — just our model's most probable slip.", loading: "Loading…", loadError: "Couldn't load the weekly pick.", retry: "Retry", soon: "This week's slip is on its way.", combined: "Combined probability (model)", remaining: (n: number) => `${n} still to play`, lockedTitle: "Unlock the Weekly Pick", unlockCta: (p: string) => `Unlock for ${p}`, unlocking: "Redirecting to payment…", checkoutError: "Couldn't start the payment. Please try again.", includedCta: "…or go Pro", responsible: "18+ · gamble responsibly", howTitle: "How it works", how1: "The model's highest-probability picks, combined into one slip.", how2: "A new accumulator every Monday; it expires at week's end.", how3: "Included in Pro. For everyone else, a one-off unlock.", histTitle: "Previous weeks", histEmpty: "The first history lands at the end of the week.", outLive: "Live", outWon: "Landed", outLost: "Didn't land", stUp: "To play", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "en-GB" },
  es: { back: "← Board", title: "Weekly Pick", sub: "La combinada de la casa: las mejores picks de la semana combinadas. Sin cuotas, sin edge prometido — solo la combinada más probable de nuestro modelo.", loading: "Cargando…", loadError: "No se pudo cargar la weekly pick.", retry: "Reintentar", soon: "La combinada de esta semana está en camino.", combined: "Probabilidad combinada (modelo)", remaining: (n: number) => `${n} por jugarse`, lockedTitle: "Desbloquea la Weekly Pick", unlockCta: (p: string) => `Desbloquear por ${p}`, unlocking: "Redirigiendo al pago…", checkoutError: "No se pudo iniciar el pago. Inténtalo de nuevo.", includedCta: "…o hazte Pro", responsible: "18+ · juega con responsabilidad", howTitle: "Cómo funciona", how1: "Las picks de mayor probabilidad del modelo, combinadas en una sola.", how2: "Una nueva combinada cada lunes; caduca al final de la semana.", how3: "Incluida en Pro. Para el resto, desbloqueo único.", histTitle: "Semanas anteriores", histEmpty: "El primer historial llega al final de la semana.", outLive: "En curso", outWon: "Acertada", outLost: "No acertada", stUp: "Por jugar", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "es-ES" },
  fr: { back: "← Board", title: "Weekly Pick", sub: "Le combiné de la maison : les meilleures prédictions de la semaine combinées. Aucune cote, aucun edge promis — juste le combiné le plus probable de notre modèle.", loading: "Chargement…", loadError: "Impossible de charger la weekly pick.", retry: "Réessayer", soon: "Le combiné de cette semaine arrive bientôt.", combined: "Probabilité combinée (modèle)", remaining: (n: number) => `${n} encore à jouer`, lockedTitle: "Débloquez la Weekly Pick", unlockCta: (p: string) => `Débloquer pour ${p}`, unlocking: "Redirection vers le paiement…", checkoutError: "Impossible de démarrer le paiement. Réessayez.", includedCta: "…ou passez à Pro", responsible: "18+ · jouez de manière responsable", howTitle: "Comment ça marche", how1: "Les prédictions les plus probables du modèle, combinées en un seul combiné.", how2: "Un nouveau combiné chaque lundi ; il expire en fin de semaine.", how3: "Inclus dans Pro. Pour les autres, un déblocage unique.", histTitle: "Semaines précédentes", histEmpty: "Le premier historique arrive en fin de semaine.", outLive: "En cours", outWon: "Gagné", outLost: "Perdu", stUp: "À jouer", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "fr-FR" },
  ru: { back: "← Board", title: "Weekly Pick", sub: "Экспресс от команды: лучшие пики недели вместе. Без коэффициентов и обещанного edge — только самый вероятный экспресс нашей модели.", loading: "Загрузка…", loadError: "Не удалось загрузить weekly pick.", retry: "Повторить", soon: "Экспресс этой недели уже готовится.", combined: "Совокупная вероятность (модель)", remaining: (n: number) => `${n} ещё сыграют`, lockedTitle: "Откройте Weekly Pick", unlockCta: (p: string) => `Открыть за ${p}`, unlocking: "Переход к оплате…", checkoutError: "Не удалось начать оплату. Попробуйте снова.", includedCta: "…или оформите Pro", responsible: "18+ · играйте ответственно", howTitle: "Как это работает", how1: "Самые вероятные пики модели, собранные в один экспресс.", how2: "Новый экспресс каждый понедельник; истекает в конце недели.", how3: "Входит в Pro. Для остальных — разовая покупка.", histTitle: "Прошлые недели", histEmpty: "Первая история появится в конце недели.", outLive: "В игре", outWon: "Зашёл", outLost: "Не зашёл", stUp: "Сыграет", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "ru-RU" },
} as const;

type Lang = keyof typeof COPY;

function statusChip(status: LegStatus, t: (typeof COPY)[Lang]) {
  if (status === "won") return { txt: t.stWon, color: "var(--am-coral)" };
  if (status === "lost") return { txt: t.stLost, color: "#ef4444" };
  if (status === "void") return { txt: t.stVoid, color: "var(--am-muted-2)" };
  return { txt: t.stUp, color: "var(--am-muted)" };
}

export default function WeeklyPickPage() {
  const [data, setData] = useState<Data | null>(null);
  const [hist, setHist] = useState<Hist | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("it");
  const [buying, setBuying] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState(false);
  const t = COPY[lang];

  useEffect(() => {
    const stored = localStorage.getItem("agentic-lang");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from localStorage
    if (stored && stored in COPY) setLang(stored as Lang);
  }, []);

  const fetchData = useCallback(() => {
    let alive = true;
    fetch("/api/weekly-pick", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("wp"))))
      .then((d) => { if (alive) setData(d as Data); })
      .catch(() => { if (alive) setError(true); });
    fetch("/api/weekly-pick/history", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("wph"))))
      .then((h) => { if (alive) setHist(h as Hist); })
      .catch(() => { if (alive) setHist({ enabled: false }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => fetchData(), [fetchData]);
  const retry = () => { setError(false); setData(null); setHist(null); fetchData(); };

  const buy = useCallback(async () => {
    setCheckoutErr(false);
    setBuying(true);
    try {
      const r = await fetch("/api/weekly-pick/checkout", { method: "POST", credentials: "same-origin" });
      if (r.status === 401) { window.location.href = "/app?tab=account"; return; }
      const j = (await r.json().catch(() => null)) as { url?: string } | null;
      if (r.ok && j?.url) { window.location.href = j.url; return; }
      setCheckoutErr(true);
      setBuying(false);
    } catch {
      setCheckoutErr(true);
      setBuying(false);
    }
  }, []);

  const price = data?.price_usd != null ? `$${data.price_usd.toFixed(2)}` : "$12.99";
  const fullPrice = data?.full_price_usd != null ? `$${data.full_price_usd.toFixed(2)}` : null;
  const histWeeks = hist?.enabled ? (hist.weeks ?? []) : [];

  return (
    <main className="min-h-screen" style={{ background: "var(--am-bg)", color: "var(--am-text)" }}>
      <header className="px-6 py-4 border-b" style={{ borderColor: "var(--am-line)" }}>
        <Link href="/" className="text-xs font-mono" style={{ color: "var(--am-muted)" }}>{t.back}</Link>
        <h1 className="text-2xl font-black mt-1">{t.title}</h1>
        <p className="text-xs font-mono max-w-xl" style={{ color: "var(--am-muted)" }}>{t.sub}</p>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* ── LA MULTIPLA ── */}
        <div className="space-y-4">
          {error && (
            <div className="text-center py-16 space-y-3">
              <p className="text-sm font-mono" style={{ color: "var(--am-muted)" }}>{t.loadError}</p>
              <button onClick={retry} className="text-xs font-mono px-4 py-2 rounded border" style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)", background: "var(--am-coral-dim)" }}>{t.retry}</button>
            </div>
          )}
          {!error && data === null && (
            <p className="text-center text-xs font-mono py-16" style={{ color: "var(--am-muted-2)" }}>{t.loading}</p>
          )}
          {!error && data && (data.enabled === false || data.available === false) && (
            <p className="text-center text-sm font-mono py-16" style={{ color: "var(--am-muted-2)" }}>{t.soon}</p>
          )}
          {!error && data && data.available && (
            <article className="rounded-lg border p-5 space-y-3" style={{ borderColor: "var(--am-coral-b)", background: "var(--am-panel)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: "var(--am-muted)" }}>
                  {data.legs ?? data.selections?.length ?? 0} · {t.title}
                  {data.legs_remaining != null && data.legs_remaining > 0 && (
                    <span style={{ color: "var(--am-muted-2)" }}> · {t.remaining(data.legs_remaining)}</span>
                  )}
                </span>
                {data.unlocked && data.combined_prob != null && (
                  <span className="text-lg font-black font-mono" style={{ color: "var(--am-coral)" }}>{Math.round(data.combined_prob * 100)}%</span>
                )}
              </div>
              <div className="space-y-1.5">
                {data.selections?.map((s, i) => {
                  const chip = statusChip(s.status ?? null, t);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs font-mono gap-3">
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: "var(--am-text)" }}>{s.label}</p>
                        <p className="text-[10px] truncate" style={{ color: "var(--am-muted-2)" }}>{s.sport}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {s.market != null ? (
                          <>
                            <span style={{ color: "var(--am-muted)" }}>{s.market}{s.prob != null && <span style={{ color: "var(--am-coral)" }}> · {Math.round(s.prob * 100)}%</span>}</span>
                            <span style={{ color: chip.color }}>{chip.txt}</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--am-muted-2)" }}>🔒</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.unlocked ? (
                <p className="text-[10px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.combined}</p>
              ) : (
                <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--am-line)" }}>
                  <p className="text-sm font-bold">{t.lockedTitle}</p>
                  <div className="flex items-baseline gap-2">
                    {data.discounted && fullPrice && (
                      <span className="text-xs font-mono line-through" style={{ color: "var(--am-muted-2)" }}>{fullPrice}</span>
                    )}
                    <span className="text-lg font-black font-mono" style={{ color: "var(--am-coral)" }}>{price}</span>
                  </div>
                  <button
                    onClick={buy}
                    disabled={buying}
                    className="inline-block text-xs font-mono px-4 py-2 rounded"
                    style={{ background: "var(--am-coral)", color: "#fff", fontWeight: 700, opacity: buying ? 0.6 : 1, cursor: buying ? "default" : "pointer" }}
                  >
                    {buying ? t.unlocking : t.unlockCta(price)}
                  </button>
                  {checkoutErr && (
                    <p className="text-[10px] font-mono" style={{ color: "#ef4444" }}>{t.checkoutError}</p>
                  )}
                  <a href="/app?tab=plans" className="block text-[10px] font-mono underline" style={{ color: "var(--am-muted)" }}>{t.includedCta}</a>
                </div>
              )}
              <p className="text-[9px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.responsible}</p>
            </article>
          )}
        </div>

        {/* ── COME FUNZIONA ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-black">{t.howTitle}</h2>
          <ol className="space-y-1.5">
            {[t.how1, t.how2, t.how3].map((step, i) => (
              <li key={i} className="flex gap-2 text-xs font-mono" style={{ color: "var(--am-muted)" }}>
                <span className="font-black" style={{ color: "var(--am-coral)" }}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── STORICO ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-black">{t.histTitle}</h2>
          {histWeeks.length === 0 ? (
            <p className="text-xs font-mono py-4" style={{ color: "var(--am-muted-2)" }}>{t.histEmpty}</p>
          ) : (
            <div className="space-y-2">
              {histWeeks.map((w) => {
                const label = w.outcome === "won" ? t.outWon : w.outcome === "lost" ? t.outLost : t.outLive;
                const color = w.outcome === "won" ? "var(--am-coral)" : w.outcome === "lost" ? "#ef4444" : "var(--am-muted)";
                return (
                  <article key={w.week_start} className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "var(--am-line)", background: "var(--am-panel)" }}>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span style={{ color: "var(--am-muted)" }}>{new Date(w.week_start).toLocaleDateString(t.locale, { day: "2-digit", month: "short" })}</span>
                      <span className="flex items-center gap-2">
                        {w.combined_prob != null && <span style={{ color: "var(--am-muted-2)" }}>{Math.round(w.combined_prob * 100)}%</span>}
                        <span className="font-bold" style={{ color }}>{label}</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {w.legs.map((l, i) => {
                        const chip = statusChip(l.status, t);
                        return (
                          <div key={i} className="flex items-center justify-between text-[11px] font-mono gap-3">
                            <span className="truncate" style={{ color: "var(--am-muted)" }}>{l.label} · {l.market}</span>
                            <span style={{ color: chip.color }}>{chip.txt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
