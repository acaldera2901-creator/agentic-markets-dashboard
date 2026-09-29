// components/lobby/YesterdayRead.tsx — #HOOK-A-LITE-0928
//
// «Ecco come ha letto il modello ieri.» Il riquadro della Home ANONIMA: una
// lettura per sport, già conclusa, servita intera — pick, la nostra
// percentuale, il perché — e accanto com'è finita. È reciprocità con
// contenuto vero (un esito già accaduto, scelto per confidenza e non per
// esito: vinta o persa, si mostra), non un assaggio della pick di oggi.
//
// La card è LA STESSA scatola delle card del board (classi .br-card*): ciò
// che la distingue è il contenuto — pick scritto al posto di «Pro pick», il
// perché leggibile, il punteggio finale nella colonna del tabellone, l'esito
// come parola con un segno (non solo un colore) — e la linguetta sul bordo,
// lo stesso segno di «Inclusa oggi»: qui dice «Lettura completa».
//
// ⚠️ Il dato arriva da /api/v2/yesterday-read, che serve il pick di UNA riga
// storica per sport senza sessione: è l'eccezione dichiarata alla policy
// «anonimo non sblocca» — vedi la route e lib/yesterday-read.ts. Questo file
// non decide nulla di gating: rende ciò che la route ha già deciso di aprire.
"use client";

import { useEffect, useId, useState } from "react";
import { Crest } from "@/components/ui/Crest";
import { SportChip } from "@/components/ui/SportChip";
import { LeagueChip } from "@/components/ui/LeagueChip";
import { IconCheck, IconClose, IconRegister } from "@/components/ui/icons";
import { formatPct, splitLiveScore } from "@/lib/ui/prediction-card";
import { yesterdayPickLabel, type YesterdayRead as YesterdayReadRow } from "@/lib/yesterday-read";
import type { Lang } from "@/lib/house-banners";

function pick5<T>(lang: Lang, v: { it: T; en: T; es: T; fr: T; ru: T }): T {
  return v[lang];
}

const LOCALE: Record<Lang, string> = { it: "it-IT", en: "en-GB", es: "es-ES", fr: "fr-FR", ru: "ru-RU" };

function dayLabel(iso: string, lang: Lang, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short", timeZone: tz });
}

function resultCopy(result: YesterdayReadRow["result"], lang: Lang): string {
  if (result === "won") return pick5(lang, { it: "Vinta", en: "Won", es: "Ganada", fr: "Gagnée", ru: "Выиграна" });
  if (result === "lost") return pick5(lang, { it: "Persa", en: "Lost", es: "Perdida", fr: "Perdue", ru: "Проиграна" });
  return pick5(lang, { it: "Annullata", en: "Void", es: "Anulada", fr: "Annulée", ru: "Отменена" });
}

/** La singola card. Esportata per i test e per chi voglia montarla altrove. */
export function YesterdayReadCard({ read, lang, tz }: { read: YesterdayReadRow; lang: Lang; tz: string }) {
  const winLabel = pick5(lang, { it: "vince", en: "to win", es: "gana", fr: "gagne", ru: "победа" });
  const drawLabel = pick5(lang, { it: "Pareggio", en: "Draw", es: "Empate", fr: "Match nul", ru: "Ничья" });
  const pick = yesterdayPickLabel(read, { winLabel, drawLabel });
  const score = splitLiveScore(read.final_score);
  const outcome = resultCopy(read.result, lang);
  const when = dayLabel(read.starts_at, lang, tz);

  return (
    <article className="br-card" data-variant="settled" data-id={read.id} data-result={read.result} data-testid="yesterday-card">
      <span className="br-card__inc" data-testid="yesterday-tab">
        <IconCheck size={10} stroke={2.5} />
        {pick5(lang, { it: "Lettura completa", en: "Full reading", es: "Lectura completa", fr: "Lecture complète", ru: "Полный прогноз" })}
      </span>
      <header className="br-card__kicker">
        <span className="br-card__meta">
          <SportChip sport={read.sport} />
          <LeagueChip league={read.league ?? read.competition} />
        </span>
        <span className="br-card__status">
          {when && <span className="br-card__when">{when}</span>}
          {/* L'esito è una PAROLA con un segno: la spunta o la croce lo dicono
              anche a chi non distingue i colori, e il badge resta monocromo
              come ogni altro badge della card (round 3). */}
          <span className="br-badge" data-kind="result" data-result={read.result} data-testid="yesterday-result">
            {read.result === "won" ? <IconCheck size={12} stroke={2.5} /> : read.result === "lost" ? <IconClose size={12} stroke={2.5} /> : null}
            {outcome}
          </span>
        </span>
      </header>

      <div className="br-card__match">
        <h3 className="br-card__teams" data-score={score ? "true" : undefined}>
          <span className="br-card__team" data-role="home">
            <Crest team={read.home} sport={read.sport} size={22} role="home" />
            <span className="br-card__name" title={read.home}>{read.home}</span>
            {score && <span className="br-card__score" data-testid="final-home" aria-hidden="true">{score.home.map((c, i) => <span key={i}>{c === "" ? "–" : c}</span>)}</span>}
          </span>
          <span className="br-card__vs">vs</span>
          <span className="br-card__team" data-role="away">
            <Crest team={read.away} sport={read.sport} size={22} role="away" />
            <span className="br-card__name" title={read.away}>{read.away}</span>
            {score && <span className="br-card__score" data-testid="final-away" aria-hidden="true">{score.away.map((c, i) => <span key={i}>{c === "" ? "–" : c}</span>)}</span>}
          </span>
          {read.final_score && (
            <span className="br-card__vs">
              {pick5(lang, { it: "Risultato finale", en: "Final score", es: "Resultado final", fr: "Score final", ru: "Итоговый счёт" })} {read.final_score}
            </span>
          )}
        </h3>
      </div>

      <p className="br-card__pick">
        <span className="br-label">Pick</span>
        <span className="br-card__pick-v" title={pick}>{pick}</span>
      </p>

      <p className="br-card__model" data-size="md">
        <span className="br-card__model-n">
          {formatPct(read.model_pct)}
          {read.model_pct != null && <span className="br-card__model-pc">%</span>}
        </span>
        <span className="br-label">Our model</span>
      </p>

      {/* Il perché a tutta larghezza; senza CTA: la partita è finita, non c'è
          una scheda da aprire. Se la riga non porta prosa il piede non c'è —
          nessun testo di riempimento. */}
      {read.explanation && (
        <footer className="br-card__foot">
          <p className="br-card__why">
            <strong>{pick5(lang, { it: "Perché.", en: "Why.", es: "Por qué.", fr: "Pourquoi.", ru: "Почему." })}</strong> {read.explanation}
          </p>
        </footer>
      )}
    </article>
  );
}

/** Il riquadro intero: testo + CTA a sinistra, le card a destra. Non rende
 *  nulla finché non ha almeno una lettura: nessuno scheletro, nessuna card
 *  finta — se ieri non c'è stato nulla di concluso, la Home resta com'è. */
export function YesterdayRead({ lang, tz, onRegister, reads: initial }: {
  lang: Lang;
  tz: string;
  onRegister: () => void;
  /** Per i test e per il render statico: salta il fetch. */
  reads?: YesterdayReadRow[];
}) {
  const [reads, setReads] = useState<YesterdayReadRow[] | null>(initial ?? null);
  const titleId = useId();

  useEffect(() => {
    if (initial) return;
    let alive = true;
    (async () => {
      try {
        const resp = await fetch("/api/v2/yesterday-read");
        if (!resp.ok) return;
        const data = await resp.json() as { reads?: YesterdayReadRow[] };
        if (alive) setReads(Array.isArray(data.reads) ? data.reads : []);
      } catch { /* la Home non dipende da questo blocco */ }
    })();
    return () => { alive = false; };
  }, [initial]);

  if (!reads || reads.length === 0) return null;

  // Se per uno sport si è dovuti risalire più indietro di ieri, l'occhiello
  // non dice «ieri»: dice il giorno. Un'etichetta che mente su una data è la
  // prima cosa che un lettore attento nota.
  const allYesterday = reads.every((r) => r.is_yesterday);
  const whenWord = allYesterday
    ? pick5(lang, { it: "Ieri", en: "Yesterday", es: "Ayer", fr: "Hier", ru: "Вчера" })
    : dayLabel(reads[0].starts_at, lang, tz);

  return (
    <section className="br-yr" aria-labelledby={titleId} data-testid="yesterday-read">
      <div className="br-yr__text">
        <p className="br-yr__eyebrow">
          {whenWord} · {pick5(lang, { it: "esito reale", en: "real outcome", es: "resultado real", fr: "résultat réel", ru: "реальный исход" })}
        </p>
        <h2 className="br-yr__title" id={titleId}>
          {pick5(lang, {
            it: "Ecco come ha letto il modello.",
            en: "This is how the model read it.",
            es: "Así lo leyó el modelo.",
            fr: "Voici la lecture du modèle.",
            ru: "Вот как модель это прочитала.",
          })}
        </h2>
        <p className="br-yr__body">
          {pick5(lang, {
            it: "Pick, probabilità e perché: la lettura intera, com'era prima del via — e com'è finita. Oggi il Free ne apre fino a 3 nuove al giorno per sport, gratis.",
            en: "Pick, probability and the why: the whole reading, as it stood before kick-off — and how it ended. Today, Free opens up to 3 new ones per sport a day, for free.",
            es: "Pick, probabilidad y porqué: la lectura entera, tal como estaba antes del inicio — y cómo terminó. Hoy, Free abre hasta 3 nuevas por deporte al día, gratis.",
            fr: "Pick, probabilité et pourquoi : la lecture entière, telle qu'elle était avant le coup d'envoi — et comment elle a fini. Aujourd'hui, Free en ouvre jusqu'à 3 nouvelles par sport et par jour, gratuitement.",
            ru: "Пик, вероятность и почему: весь прогноз, каким он был до начала — и чем всё закончилось. Сегодня Free открывает до 3 новых на вид спорта в день, бесплатно.",
          })}
        </p>
        <div className="br-yr__actions">
          <button type="button" className="btn-primary" onClick={onRegister} data-testid="yesterday-cta">
            <IconRegister size={14} stroke={2} />
            {pick5(lang, { it: "Crea l'account gratis", en: "Create a free account", es: "Crea la cuenta gratis", fr: "Créer un compte gratuit", ru: "Создать бесплатный аккаунт" })}
          </button>
        </div>
        {/* La riga che rende onesto il blocco: la scelta non guarda l'esito.
            Senza, una lettura vinta in Home sarebbe indistinguibile da una
            lettura scelta perché vinta. */}
        <p className="br-yr__note">
          {pick5(lang, {
            it: "Scelta per confidenza del modello, non per esito: vinta o persa, la mostriamo.",
            en: "Picked by model confidence, not by outcome: won or lost, we show it.",
            es: "Elegida por la confianza del modelo, no por el resultado: ganada o perdida, la mostramos.",
            fr: "Choisie selon la confiance du modèle, pas selon le résultat : gagnée ou perdue, on la montre.",
            ru: "Выбрана по уверенности модели, а не по исходу: выиграна или проиграна — мы её показываем.",
          })}
        </p>
      </div>
      <div className="br-yr__cards">
        {reads.map((r) => <YesterdayReadCard key={r.id} read={r} lang={lang} tz={tz} />)}
      </div>
    </section>
  );
}
