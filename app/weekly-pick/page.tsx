"use client";
// /weekly-pick — #WEEKLY-PICK-1. La MULTIPLA DELLA CASA della settimana: le
// migliori pick combinate. Inclusa nel Pro; per gli altri teaser lockato + upsell.
// Il pagamento one-off €12.99 è il pezzo GATED (checkout non ancora attivo): qui
// il prezzo è mostrato come info, il CTA funzionante è "Incluso nel Pro".

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Sel = { label: string; sport: string; market: string | null; prob: number | null };
type Data = {
  enabled: boolean;
  available?: boolean;
  unlocked?: boolean;
  included?: boolean;
  price_usd?: number;
  combined_prob?: number | null;
  selections?: Sel[];
};

const COPY = {
  it: { back: "← Board", title: "Weekly Pick", sub: "La multipla della casa: le migliori pick della settimana combinate. Nessuna quota, nessun edge promesso — solo la schedina più probabile del nostro modello.", loading: "Caricamento…", loadError: "Impossibile caricare la weekly pick.", retry: "Riprova", soon: "La multipla di questa settimana è in arrivo.", combined: "Probabilità combinata (modello)", lockedTitle: "Sblocca la Weekly Pick", oneoff: (p: string) => `Acquisto singolo ${p} · in arrivo`, includedCta: "Inclusa nel Pro → Vedi i piani", seePlans: "Vedi i piani →", responsible: "18+ · gioca responsabilmente", locale: "it-IT" },
  en: { back: "← Board", title: "Weekly Pick", sub: "The house accumulator: the best picks of the week combined. No odds, no promised edge — just our model's most probable slip.", loading: "Loading…", loadError: "Couldn't load the weekly pick.", retry: "Retry", soon: "This week's slip is on its way.", combined: "Combined probability (model)", lockedTitle: "Unlock the Weekly Pick", oneoff: (p: string) => `One-off purchase ${p} · coming soon`, includedCta: "Included in Pro → See plans", seePlans: "See plans →", responsible: "18+ · gamble responsibly", locale: "en-GB" },
  es: { back: "← Board", title: "Weekly Pick", sub: "La combinada de la casa: las mejores picks de la semana combinadas. Sin cuotas, sin edge prometido — solo la combinada más probable de nuestro modelo.", loading: "Cargando…", loadError: "No se pudo cargar la weekly pick.", retry: "Reintentar", soon: "La combinada de esta semana está en camino.", combined: "Probabilidad combinada (modelo)", lockedTitle: "Desbloquea la Weekly Pick", oneoff: (p: string) => `Compra única ${p} · próximamente`, includedCta: "Incluida en Pro → Ver planes", seePlans: "Ver planes →", responsible: "18+ · juega con responsabilidad", locale: "es-ES" },
  fr: { back: "← Board", title: "Weekly Pick", sub: "Le combiné de la maison : les meilleures prédictions de la semaine combinées. Aucune cote, aucun edge promis — juste le combiné le plus probable de notre modèle.", loading: "Chargement…", loadError: "Impossible de charger la weekly pick.", retry: "Réessayer", soon: "Le combiné de cette semaine arrive bientôt.", combined: "Probabilité combinée (modèle)", lockedTitle: "Débloquez la Weekly Pick", oneoff: (p: string) => `Achat unique ${p} · bientôt`, includedCta: "Incluse dans Pro → Voir les offres", seePlans: "Voir les offres →", responsible: "18+ · jouez de manière responsable", locale: "fr-FR" },
  ru: { back: "← Board", title: "Weekly Pick", sub: "Экспресс от команды: лучшие пики недели вместе. Без коэффициентов и обещанного edge — только самый вероятный экспресс нашей модели.", loading: "Загрузка…", loadError: "Не удалось загрузить weekly pick.", retry: "Повторить", soon: "Экспресс этой недели уже готовится.", combined: "Совокупная вероятность (модель)", lockedTitle: "Откройте Weekly Pick", oneoff: (p: string) => `Разовая покупка ${p} · скоро`, includedCta: "Входит в Pro → Планы", seePlans: "Смотреть планы →", responsible: "18+ · играйте ответственно", locale: "ru-RU" },
} as const;

type Lang = keyof typeof COPY;

export default function WeeklyPickPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("it");
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
    return () => { alive = false; };
  }, []);

  useEffect(() => fetchData(), [fetchData]);
  const retry = () => { setError(false); setData(null); fetchData(); };

  const price = data?.price_usd != null ? `€${data.price_usd.toFixed(2)}` : "€12.99";

  return (
    <main className="min-h-screen" style={{ background: "var(--am-bg)", color: "var(--am-text)" }}>
      <header className="px-6 py-4 border-b" style={{ borderColor: "var(--am-line)" }}>
        <Link href="/" className="text-xs font-mono" style={{ color: "var(--am-muted)" }}>{t.back}</Link>
        <h1 className="text-2xl font-black mt-1">{t.title}</h1>
        <p className="text-xs font-mono max-w-xl" style={{ color: "var(--am-muted)" }}>{t.sub}</p>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-8 space-y-4">
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
              <span className="text-xs font-mono" style={{ color: "var(--am-muted)" }}>{data.selections?.length ?? 0} · {t.title}</span>
              {data.unlocked && data.combined_prob != null && (
                <span className="text-lg font-black font-mono" style={{ color: "var(--am-coral)" }}>{Math.round(data.combined_prob * 100)}%</span>
              )}
            </div>
            <div className="space-y-1.5">
              {data.selections?.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono gap-3">
                  <div className="min-w-0">
                    <p className="truncate" style={{ color: "var(--am-text)" }}>{s.label}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--am-muted-2)" }}>{s.sport}</p>
                  </div>
                  <div className="shrink-0">
                    {s.market != null ? (
                      <span style={{ color: "var(--am-muted)" }}>{s.market}{s.prob != null && <span style={{ color: "var(--am-coral)" }}> · {Math.round(s.prob * 100)}%</span>}</span>
                    ) : (
                      <span style={{ color: "var(--am-muted-2)" }}>🔒</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {data.unlocked ? (
              <p className="text-[10px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.combined}</p>
            ) : (
              <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--am-line)" }}>
                <p className="text-sm font-bold">{t.lockedTitle}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.oneoff(price)}</p>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav so ?tab= resolves */}
                <a href="/app?tab=plans" className="inline-block text-xs font-mono px-4 py-2 rounded" style={{ background: "var(--am-coral)", color: "#fff", fontWeight: 700 }}>{t.includedCta}</a>
              </div>
            )}
            <p className="text-[9px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.responsible}</p>
          </article>
        )}
      </section>
    </main>
  );
}
