"use client";
// /weekly-pick — #WEEKLY-PICK-1. La MULTIPLA DELLA CASA, a livello presentazione:
// hero display, betslip disegnata con stato live delle legs, come funziona,
// storico. Riusa il design system lp-* della landing + superfici .wp-*.
// FTC-safe: nessuna quota, nessun edge/vincita promessa.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SportGlyphSprite } from "@/app/components/sport-glyphs";
import { SportIcon } from "@/app/components/sport-icon";
import { PredictionDetailModal } from "@/components/PredictionDetailModal";

type SportKind = "football" | "tennis" | "worldcup";
function sportKind(sport: string): SportKind {
  const s = sport?.toLowerCase() ?? "";
  if (s.includes("tennis")) return "tennis";
  if (s.includes("world") || s === "wc") return "worldcup";
  return "football";
}

type LegStatus = "upcoming" | "won" | "lost" | "void" | null;
type FormRec = { last: string[]; w: number; d: number; l: number; gf: number; ga: number };
type WcRow = { team: string; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number };
type Detail = {
  competition: string | null;
  stage: string | null;
  neutral: boolean;
  probs: { home: number; draw: number | null; away: number | null } | null;
  confidence: number | null;
  risk: string | null;
  why: string | null;
  xg: { home: number | null; away: number | null } | null;
  form: { home: FormRec | null; away: FormRec | null };
  injuries: { home: string[]; away: string[] };
  rotation: { home: boolean; away: boolean };
  venue: { heat: boolean; indoor: boolean; altitude: number | null; tzHome: number | null; tzAway: number | null; travelHome: number | null; travelAway: number | null };
  model: string | null;
  sample: { home: number | null; away: number | null };
  // #WEEKLY-PICK-2
  restDays?: { home: number | null; away: number | null };
  hostAdvantage?: string | null;
  squadStrength?: { home: number | null; away: number | null };
  lineups?: { home?: string[]; away?: string[] } | null;
  group?: string | null;
  standing?: { home: WcRow | null; away: WcRow | null } | null;
};
type Sel = { label: string; sport: string; market: string | null; prob: number | null; status?: LegStatus; kickoff?: string | null; id?: string | null; detail?: Detail | null };
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
  brief?: { legs: number; competitions: number; combinedProb: number | null; avgConfidence: number | null; strongest: { label: string; market: string; prob: number } | null };
  sports?: Record<string, number>;
};
type HistLeg = { label: string; sport: string; market: string; prob: number; status: Exclude<LegStatus, null> };
type HistWeek = { week_start: string; combined_prob: number | null; outcome: "live" | "won" | "lost"; legs: HistLeg[] };
type Hist = { enabled: boolean; weeks?: HistWeek[] };

const COPY = {
  it: { back: "← Board", tag: "Multipla della casa", eyebrow: "Multipla della casa", h1a: "La schedina più", h1b: "probabile della settimana.", sub: "Le migliori pick del nostro modello, combinate in una sola schedina. Nessuna quota, nessun edge promesso — solo probabilità.", kProb: "prob. combinata", kLegs: "selezioni", kLeft: "ancora da giocare", loading: "Caricamento…", loadError: "Impossibile caricare la weekly pick.", retry: "Riprova", soon: "La multipla di questa settimana è in arrivo.", slip: "Schedina", note: "Probabilità combinata del modello.", unlockTitle: "Sblocca la Weekly Pick", unlockCta: "Sblocca", unlocking: "Attendi…", checkoutError: "Impossibile avviare il pagamento. Riprova.", proCta: "…oppure passa a Pro", responsible: "18+ · gioca responsabilmente", howEyebrow: "Come funziona", howTitle: "Una multipla, ogni settimana.", how1t: "Selezione", how1d: "Le pick a più alta probabilità del modello, combinate in una sola schedina.", how2t: "Ogni lunedì", how2d: "Una nuova multipla ogni lunedì; scade a fine settimana.", how3t: "Sblocco", how3d: "Inclusa nel Pro. Per gli altri, sblocco one-off.", histEyebrow: "Track record", histTitle: "Settimane precedenti.", histEmpty: "Il primo storico arriva a fine settimana.", oLive: "In corso", oWon: "Passata", oLost: "Non passata", locked: "Bloccata", briefEyebrow: "La settimana", briefLegs: "selezioni", briefComp: "competizioni", briefConf: "confidenza media", briefStrongest: "La più solida", briefFactors: "Ogni partita analizzata su forma, gol attesi, assenze, contesto e formazioni.", unlockPromo: "Cosa sblocchi", unlockList: ["Il nostro pronostico per ogni partita", "Probabilità e confidenza del modello", "Gol attesi (xG) e forma recente", "Assenze, contesto e formazioni", "Stato live della schedina"], anaTitle: "Analisi partita per partita.", locale: "it-IT" },
  en: { back: "← Board", tag: "House accumulator", eyebrow: "House accumulator", h1a: "The week's most", h1b: "probable slip.", sub: "Our model's best picks, combined into a single slip. No odds, no promised edge — just probability.", kProb: "combined prob.", kLegs: "selections", kLeft: "still to play", loading: "Loading…", loadError: "Couldn't load the weekly pick.", retry: "Retry", soon: "This week's slip is on its way.", slip: "Slip", note: "Model's combined probability.", unlockTitle: "Unlock the Weekly Pick", unlockCta: "Unlock", unlocking: "Please wait…", checkoutError: "Couldn't start the payment. Please try again.", proCta: "…or go Pro", responsible: "18+ · gamble responsibly", howEyebrow: "How it works", howTitle: "One accumulator, every week.", how1t: "Selection", how1d: "The model's highest-probability picks, combined into one slip.", how2t: "Every Monday", how2d: "A new accumulator every Monday; it expires at week's end.", how3t: "Unlock", how3d: "Included in Pro. For everyone else, a one-off unlock.", histEyebrow: "Track record", histTitle: "Previous weeks.", histEmpty: "The first history lands at the end of the week.", oLive: "Live", oWon: "Landed", oLost: "Didn't land", locked: "Locked", briefEyebrow: "This week", briefLegs: "selections", briefComp: "competitions", briefConf: "avg. confidence", briefStrongest: "Most solid", briefFactors: "Every match analysed on form, expected goals, absences, context and line-ups.", unlockPromo: "What you unlock", unlockList: ["Our pick for every match", "Model probability and confidence", "Expected goals (xG) and recent form", "Absences, context and line-ups", "Live status of the slip"], anaTitle: "Match-by-match analysis.", locale: "en-GB" },
  es: { back: "← Board", tag: "Combinada de la casa", eyebrow: "Combinada de la casa", h1a: "La combinada más", h1b: "probable de la semana.", sub: "Las mejores picks de nuestro modelo, combinadas en una sola. Sin cuotas, sin edge prometido — solo probabilidad.", kProb: "prob. combinada", kLegs: "selecciones", kLeft: "por jugarse", loading: "Cargando…", loadError: "No se pudo cargar la weekly pick.", retry: "Reintentar", soon: "La combinada de esta semana está en camino.", slip: "Combinada", note: "Probabilidad combinada del modelo.", unlockTitle: "Desbloquea la Weekly Pick", unlockCta: "Desbloquear", unlocking: "Espera…", checkoutError: "No se pudo iniciar el pago. Inténtalo de nuevo.", proCta: "…o hazte Pro", responsible: "18+ · juega con responsabilidad", howEyebrow: "Cómo funciona", howTitle: "Una combinada, cada semana.", how1t: "Selección", how1d: "Las picks de mayor probabilidad del modelo, combinadas en una.", how2t: "Cada lunes", how2d: "Una nueva combinada cada lunes; caduca al final de la semana.", how3t: "Desbloqueo", how3d: "Incluida en Pro. Para el resto, desbloqueo único.", histEyebrow: "Track record", histTitle: "Semanas anteriores.", histEmpty: "El primer historial llega al final de la semana.", oLive: "En curso", oWon: "Acertada", oLost: "No acertada", locked: "Bloqueada", briefEyebrow: "La semana", briefLegs: "selecciones", briefComp: "competiciones", briefConf: "confianza media", briefStrongest: "La más sólida", briefFactors: "Cada partido analizado en forma, goles esperados, ausencias, contexto y alineaciones.", unlockPromo: "Qué desbloqueas", unlockList: ["Nuestro pronóstico para cada partido", "Probabilidad y confianza del modelo", "Goles esperados (xG) y forma reciente", "Ausencias, contexto y alineaciones", "Estado en vivo de la combinada"], anaTitle: "Análisis partido por partido.", locale: "es-ES" },
  fr: { back: "← Board", tag: "Combiné de la maison", eyebrow: "Combiné de la maison", h1a: "Le combiné le plus", h1b: "probable de la semaine.", sub: "Les meilleures prédictions de notre modèle, combinées en un seul combiné. Aucune cote, aucun edge promis — juste la probabilité.", kProb: "prob. combinée", kLegs: "sélections", kLeft: "encore à jouer", loading: "Chargement…", loadError: "Impossible de charger la weekly pick.", retry: "Réessayer", soon: "Le combiné de cette semaine arrive bientôt.", slip: "Combiné", note: "Probabilité combinée du modèle.", unlockTitle: "Débloquez la Weekly Pick", unlockCta: "Débloquer", unlocking: "Patientez…", checkoutError: "Impossible de démarrer le paiement. Réessayez.", proCta: "…ou passez à Pro", responsible: "18+ · jouez de manière responsable", howEyebrow: "Comment ça marche", howTitle: "Un combiné, chaque semaine.", how1t: "Sélection", how1d: "Les prédictions les plus probables du modèle, combinées en un seul.", how2t: "Chaque lundi", how2d: "Un nouveau combiné chaque lundi ; il expire en fin de semaine.", how3t: "Déblocage", how3d: "Inclus dans Pro. Pour les autres, un déblocage unique.", histEyebrow: "Track record", histTitle: "Semaines précédentes.", histEmpty: "Le premier historique arrive en fin de semaine.", oLive: "En cours", oWon: "Gagné", oLost: "Perdu", locked: "Bloqué", briefEyebrow: "La semaine", briefLegs: "sélections", briefComp: "compétitions", briefConf: "confiance moy.", briefStrongest: "La plus solide", briefFactors: "Chaque match analysé sur la forme, les buts attendus, les absences, le contexte et les compositions.", unlockPromo: "Ce que vous débloquez", unlockList: ["Notre pronostic pour chaque match", "Probabilité et confiance du modèle", "Buts attendus (xG) et forme récente", "Absences, contexte et compositions", "Statut en direct du combiné"], anaTitle: "Analyse match par match.", locale: "fr-FR" },
  ru: { back: "← Board", tag: "Экспресс от команды", eyebrow: "Экспресс от команды", h1a: "Самый вероятный", h1b: "экспресс недели.", sub: "Лучшие пики нашей модели в одном экспрессе. Без коэффициентов и обещанного edge — только вероятность.", kProb: "совокупн. вероятн.", kLegs: "выборы", kLeft: "ещё сыграют", loading: "Загрузка…", loadError: "Не удалось загрузить weekly pick.", retry: "Повторить", soon: "Экспресс этой недели уже готовится.", slip: "Экспресс", note: "Совокупная вероятность модели.", unlockTitle: "Откройте Weekly Pick", unlockCta: "Открыть", unlocking: "Подождите…", checkoutError: "Не удалось начать оплату. Попробуйте снова.", proCta: "…или оформите Pro", responsible: "18+ · играйте ответственно", howEyebrow: "Как это работает", howTitle: "Один экспресс каждую неделю.", how1t: "Отбор", how1d: "Самые вероятные пики модели, собранные в один экспресс.", how2t: "Каждый понедельник", how2d: "Новый экспресс каждый понедельник; истекает в конце недели.", how3t: "Доступ", how3d: "Входит в Pro. Для остальных — разовая покупка.", histEyebrow: "Track record", histTitle: "Прошлые недели.", histEmpty: "Первая история появится в конце недели.", oLive: "В игре", oWon: "Зашёл", oLost: "Не зашёл", locked: "Закрыто", briefEyebrow: "Эта неделя", briefLegs: "выборы", briefComp: "турниры", briefConf: "ср. уверенность", briefStrongest: "Самый надёжный", briefFactors: "Каждый матч разобран по форме, ожидаемым голам, отсутствиям, контексту и составам.", unlockPromo: "Что вы открываете", unlockList: ["Наш прогноз на каждый матч", "Вероятность и уверенность модели", "Ожидаемые голы (xG) и форма", "Отсутствия, контекст и составы", "Статус экспресса в реальном времени"], anaTitle: "Разбор матч за матчем.", locale: "ru-RU" },
} as const;

type Lang = keyof typeof COPY;

// Copy della scheda-dettaglio (modale "perché").
const DCOPY = {
  it: { open: "Apri la scheda", pick: "Il nostro pronostico", prob: "Probabilità del modello", conf: "confidenza", draw: "Pareggio", xg: "Gol attesi (modello)", form: "Forma recente", why: "Perché questa pick", ctx: "Contesto partita", inj: "Assenze", heat: "Caldo", alt: "Altitudine", tz: "Fuso orario", travel: "Viaggio", indoor: "Al coperto", rot: "Rotazione probabile", neutral: "Campo neutro", model: "Modello", games: "gare", gforga: "GF:GS", rest: "Riposo", host: "Fattore campo", squadStr: "Forza rosa", xi: "Formazione confermata", standing: "Classifica girone", pos: "pt", disclaimer: "Analisi del modello — nessuna garanzia di vincita." },
  en: { open: "Open the card", pick: "Our pick", prob: "Model probability", conf: "confidence", draw: "Draw", xg: "Expected goals (model)", form: "Recent form", why: "Why this pick", ctx: "Match context", inj: "Absences", heat: "Heat", alt: "Altitude", tz: "Time shift", travel: "Travel", indoor: "Indoor", rot: "Likely rotation", neutral: "Neutral venue", model: "Model", games: "games", gforga: "GF:GA", rest: "Rest", host: "Home factor", squadStr: "Squad strength", xi: "Confirmed line-up", standing: "Group table", pos: "pts", disclaimer: "Model analysis — no win guaranteed." },
  es: { open: "Abrir la ficha", pick: "Nuestro pronóstico", prob: "Probabilidad del modelo", conf: "confianza", draw: "Empate", xg: "Goles esperados (modelo)", form: "Forma reciente", why: "Por qué esta pick", ctx: "Contexto del partido", inj: "Ausencias", heat: "Calor", alt: "Altitud", tz: "Huso horario", travel: "Viaje", indoor: "Cubierto", rot: "Rotación probable", neutral: "Campo neutral", model: "Modelo", games: "partidos", gforga: "GF:GC", rest: "Descanso", host: "Factor campo", squadStr: "Fuerza plantilla", xi: "Alineación confirmada", standing: "Clasificación grupo", pos: "pts", disclaimer: "Análisis del modelo — sin garantía de acierto." },
  fr: { open: "Ouvrir la fiche", pick: "Notre pronostic", prob: "Probabilité du modèle", conf: "confiance", draw: "Nul", xg: "Buts attendus (modèle)", form: "Forme récente", why: "Pourquoi ce choix", ctx: "Contexte du match", inj: "Absences", heat: "Chaleur", alt: "Altitude", tz: "Décalage horaire", travel: "Voyage", indoor: "Couvert", rot: "Rotation probable", neutral: "Terrain neutre", model: "Modèle", games: "matchs", gforga: "BP:BC", rest: "Repos", host: "Facteur domicile", squadStr: "Force effectif", xi: "Composition confirmée", standing: "Classement groupe", pos: "pts", disclaimer: "Analyse du modèle — aucun gain garanti." },
  ru: { open: "Открыть карточку", pick: "Наш прогноз", prob: "Вероятность модели", conf: "уверенность", draw: "Ничья", xg: "Ожидаемые голы (модель)", form: "Форма", why: "Почему этот пик", ctx: "Контекст матча", inj: "Отсутствия", heat: "Жара", alt: "Высота", tz: "Часовой сдвиг", travel: "Перелёт", indoor: "В помещении", rot: "Вероятна ротация", neutral: "Нейтральное поле", model: "Модель", games: "игр", gforga: "ЗГ:ПГ", rest: "Отдых", host: "Фактор поля", squadStr: "Сила состава", xi: "Подтв. состав", standing: "Таблица группы", pos: "оч.", disclaimer: "Анализ модели — выигрыш не гарантирован." },
} as const;

// Icone inline (mai emoji).
const IChk = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>;
const IX = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
const IClock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4.4l3 1.8" /></svg>;
const ILock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
const IDash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>;

function statusIcon(status: LegStatus) {
  if (status === "won") return <IChk />;
  if (status === "lost") return <IX />;
  if (status === "void") return <IDash />;
  return <IClock />;
}

// Riga forma: sequenza W/D/L (ultime 5) + record + gol fatti/subiti.
function FormLine({ team, f, gforga }: { team: string; f: FormRec; gforga: string }) {
  return (
    <div className="wp-d-form">
      <span className="wp-d-form-team">{team}</span>
      <span className="wp-d-form-seq">
        {f.last.map((r, i) => (
          <span key={i} className={`wp-d-fchip ${r === "W" ? "won" : r === "L" ? "lost" : "draw"}`}>{r}</span>
        ))}
      </span>
      <span className="wp-d-form-rec">{f.w}-{f.d}-{f.l} · {gforga} {f.gf}:{f.ga}</span>
    </div>
  );
}

// Corpo della modale-dettaglio: pronostico + gol attesi + probabilità + forma +
// il PERCHÉ (explanation) + contesto partita + modello. FTC-safe: mai quote/edge.
function LegDetail({ sel, lang }: { sel: Sel; lang: Lang }) {
  const d = sel.detail;
  const t = DCOPY[lang];
  const parts = sel.label.split(/\s+vs\s+/i);
  const home = parts[0] ?? sel.label;
  const away = parts[1] ?? "";
  const pct = (v: number | null | undefined) => (v != null ? `${Math.round(v * 100)}%` : "—");
  const chips: string[] = [];
  if (d) {
    if (d.neutral) chips.push(t.neutral);
    if (d.venue.indoor) chips.push(t.indoor);
    if (d.venue.heat) chips.push(t.heat);
    if (d.venue.altitude != null && d.venue.altitude >= 1000) chips.push(`${t.alt} ${d.venue.altitude}m`);
    const travel = Math.max(d.venue.travelHome ?? 0, d.venue.travelAway ?? 0);
    if (travel >= 2000) chips.push(`${t.travel} ${(travel / 1000).toFixed(1)}k km`);
    const tz = Math.max(Math.abs(d.venue.tzHome ?? 0), Math.abs(d.venue.tzAway ?? 0));
    if (tz >= 3) chips.push(`${t.tz} ${tz}h`);
    if (d.rotation.home) chips.push(`${t.rot}: ${home}`);
    if (d.rotation.away) chips.push(`${t.rot}: ${away}`);
    if (d.injuries.home.length) chips.push(`${t.inj} ${home}: ${d.injuries.home.join(", ")}`);
    if (d.injuries.away.length) chips.push(`${t.inj} ${away}: ${d.injuries.away.join(", ")}`);
    if (d.restDays && (d.restDays.home != null || d.restDays.away != null)) {
      chips.push(`${t.rest} ${d.restDays.home ?? "—"}/${d.restDays.away ?? "—"}`);
    }
    if (d.hostAdvantage) chips.push(`${t.host}: ${d.hostAdvantage}`);
  }
  const hasForm = !!(d?.form.home || d?.form.away);
  const sampleN = d?.sample.home ?? d?.sample.away ?? null;

  return (
    <div className="wp-d">
      <div className="wp-d-pick">
        <span className="wp-d-lab">{t.pick}</span>
        <span className="wp-d-pick-row">
          <span className="wp-d-pick-val">{sel.market}</span>
          {sel.prob != null && <span className="wp-d-pick-prob">{Math.round(sel.prob * 100)}%</span>}
          {d?.confidence != null && <span className="wp-d-conf">{t.conf} {d.confidence}%</span>}
        </span>
      </div>

      {d?.probs && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.prob}</span>
          <div className="wp-d-probs">
            <span className="wp-d-prob"><em>{home}</em><b>{pct(d.probs.home)}</b></span>
            {d.probs.draw != null && d.probs.draw > 0 && <span className="wp-d-prob"><em>{t.draw}</em><b>{pct(d.probs.draw)}</b></span>}
            {away && <span className="wp-d-prob"><em>{away}</em><b>{pct(d.probs.away)}</b></span>}
          </div>
        </div>
      )}

      {d?.xg && (d.xg.home != null || d.xg.away != null) && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.xg}</span>
          <div className="wp-d-xg">
            <span className="wp-d-xg-side"><em>{home}</em><b>{d.xg.home != null ? d.xg.home.toFixed(1) : "—"}</b></span>
            <span className="wp-d-xg-sep">–</span>
            <span className="wp-d-xg-side"><em>{away}</em><b>{d.xg.away != null ? d.xg.away.toFixed(1) : "—"}</b></span>
          </div>
        </div>
      )}

      {hasForm && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.form}</span>
          <div className="wp-d-forms">
            {d?.form.home && <FormLine team={home} f={d.form.home} gforga={t.gforga} />}
            {d?.form.away && <FormLine team={away} f={d.form.away} gforga={t.gforga} />}
          </div>
        </div>
      )}

      {d?.squadStrength && (d.squadStrength.home != null || d.squadStrength.away != null) && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.squadStr}</span>
          <div className="wp-d-xg">
            <span className="wp-d-xg-side"><em>{home}</em><b>{d.squadStrength.home != null ? `${Math.round(d.squadStrength.home * 100)}%` : "—"}</b></span>
            <span className="wp-d-xg-sep">·</span>
            <span className="wp-d-xg-side"><em>{away}</em><b>{d.squadStrength.away != null ? `${Math.round(d.squadStrength.away * 100)}%` : "—"}</b></span>
          </div>
        </div>
      )}

      {d?.lineups && (!!d.lineups.home?.length || !!d.lineups.away?.length) && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.xi}</span>
          {d.lineups.home?.length ? <p className="wp-d-xi"><em>{home}:</em> {d.lineups.home.join(", ")}</p> : null}
          {d.lineups.away?.length ? <p className="wp-d-xi"><em>{away}:</em> {d.lineups.away.join(", ")}</p> : null}
        </div>
      )}

      {d?.standing && (d.standing.home || d.standing.away) && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.standing}{d.group ? ` ${d.group}` : ""}</span>
          <div className="wp-d-stand">
            {d.standing.home && <span><em>{home}</em> {d.standing.home.points} {t.pos} · {d.standing.home.won}-{d.standing.home.drawn}-{d.standing.home.lost}</span>}
            {d.standing.away && <span><em>{away}</em> {d.standing.away.points} {t.pos} · {d.standing.away.won}-{d.standing.away.drawn}-{d.standing.away.lost}</span>}
          </div>
        </div>
      )}

      {d?.why && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.why}</span>
          <p className="wp-d-why">{d.why}</p>
        </div>
      )}

      {chips.length > 0 && (
        <div className="wp-d-block">
          <span className="wp-d-lab">{t.ctx}</span>
          <div className="wp-d-chips">
            {chips.map((c, i) => <span key={i} className="wp-d-chip">{c}</span>)}
          </div>
        </div>
      )}

      {(d?.model || sampleN != null) && (
        <p className="wp-d-model">
          {t.model}{d?.model ? `: ${d.model}` : ""}{sampleN != null ? ` · ${sampleN} ${t.games}` : ""}
        </p>
      )}
      <p className="wp-d-disc">{t.disclaimer}</p>
    </div>
  );
}

export default function WeeklyPickPage() {
  const [data, setData] = useState<Data | null>(null);
  const [hist, setHist] = useState<Hist | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("it");
  const [buying, setBuying] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState(false);
  const [openLeg, setOpenLeg] = useState<{ sel: Sel; rect: DOMRect } | null>(null);
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
  const available = !error && data && data.available;
  const unlocked = !!data?.unlocked;
  const fmtWeek = (iso: string) => { try { return new Date(iso).toLocaleDateString(t.locale, { day: "2-digit", month: "short" }); } catch { return iso; } };
  const fmtKick = (iso?: string | null) => { if (!iso) return null; try { return new Date(iso).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" }); } catch { return null; } };

  return (
    <main className="wp-page">
      <SportGlyphSprite />
      <nav className="wp-nav">
        <Link href="/" className="wp-back">{t.back}</Link>
        <span className="wp-nav-tag">{t.tag}</span>
      </nav>

      {/* ── HERO ── */}
      <header className="wp-hero">
        <p className="lp-eyebrow">{t.eyebrow}</p>
        <h1 className="lp-what-head">{t.h1a} <span className="lp-what-head-2">{t.h1b}</span></h1>
        <p className="lp-what-body">{t.sub}</p>
        {available && (
          <div className="lp-kpis">
            {unlocked && data?.combined_prob != null && (
              <div className="lp-kpi">
                <b className="lp-kpi-val accent">{Math.round(data.combined_prob * 100)}<span className="lp-kpi-unit">%</span></b>
                <span className="lp-kpi-lab">{t.kProb}</span>
              </div>
            )}
            <div className="lp-kpi">
              <b className="lp-kpi-val">{data?.legs ?? data?.selections?.length ?? 0}</b>
              <span className="lp-kpi-lab">{t.kLegs}</span>
            </div>
            {data?.legs_remaining != null && (
              <div className="lp-kpi">
                <b className="lp-kpi-val">{data.legs_remaining}</b>
                <span className="lp-kpi-lab">{t.kLeft}</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── BRIEF DELLA SETTIMANA ── */}
      {available && data?.brief && (
        <section className="wp-brief">
          <p className="lp-eyebrow">{t.briefEyebrow}</p>
          <div className="wp-brief-stats">
            <span className="wp-bstat"><b>{data.brief.legs}</b>{t.briefLegs}</span>
            <span className="wp-bstat"><b>{data.brief.competitions}</b>{t.briefComp}</span>
            {unlocked && data.brief.combinedProb != null && (
              <span className="wp-bstat accent"><b>{Math.round(data.brief.combinedProb * 100)}%</b>{t.kProb}</span>
            )}
            {unlocked && data.brief.avgConfidence != null && (
              <span className="wp-bstat"><b>{data.brief.avgConfidence}%</b>{t.briefConf}</span>
            )}
          </div>
          {unlocked && data.brief.strongest && (
            <p className="wp-brief-strong">
              {t.briefStrongest}: <b>{data.brief.strongest.label}</b> — {data.brief.strongest.market} · {Math.round(data.brief.strongest.prob * 100)}%
            </p>
          )}
          <p className="wp-brief-factors">{t.briefFactors}</p>
        </section>
      )}

      {/* ── LA MULTIPLA (betslip) ── */}
      <section className="wp-wrap">
        {error && (
          <div className="wp-msg">
            <p>{t.loadError}</p>
            <button onClick={retry} className="wp-retry">{t.retry}</button>
          </div>
        )}
        {!error && data === null && <p className="wp-msg">{t.loading}</p>}
        {!error && data && (data.enabled === false || data.available === false) && <p className="wp-msg">{t.soon}</p>}

        {available && (
          <article className="wp-slip">
            <div className="wp-slip-top">
              <svg className="wp-slip-ic" aria-hidden="true"><use href="#g-ticket" /></svg>
              <span className="wp-slip-ttl">{t.slip}</span>
              {unlocked && data?.outcome && (
                <span className={`wp-slip-badge ${data.outcome}`}>
                  {data.outcome === "won" ? <><IChk />{t.oWon}</> : data.outcome === "lost" ? <><IX />{t.oLost}</> : <><IClock />{t.oLive}</>}
                </span>
              )}
              {!unlocked && data?.legs_remaining != null && data.legs_remaining > 0 && (
                <span className="wp-slip-badge live"><IClock />{data.legs_remaining} {t.kLeft}</span>
              )}
            </div>

            <ul className="wp-legs">
              {data?.selections?.map((s, i) => {
                const kick = fmtKick(s.kickoff);
                const openable = !!(unlocked && s.id);
                const openIt = (el: HTMLElement) => setOpenLeg({ sel: s, rect: el.getBoundingClientRect() });
                return (
                  <li
                    key={i}
                    className={`wp-leg${openable ? " is-open" : ""}`}
                    role={openable ? "button" : undefined}
                    tabIndex={openable ? 0 : undefined}
                    aria-haspopup={openable ? "dialog" : undefined}
                    onClick={openable ? (e) => openIt(e.currentTarget) : undefined}
                    onKeyDown={openable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIt(e.currentTarget); } } : undefined}
                  >
                    <span className="wp-leg-sport"><SportIcon sport={sportKind(s.sport)} size={20} variant="sm" /></span>
                    <span className="wp-leg-main">
                      <span className="wp-leg-match">{s.label}</span>
                      {s.market != null ? (
                        <span className="wp-leg-pick"><b>{s.market}</b>{s.detail?.competition && <span className="wp-leg-comp">· {s.detail.competition}</span>}</span>
                      ) : (
                        <span className="wp-leg-pick locked"><ILock /><span className="dots">••••</span></span>
                      )}
                    </span>
                    <span className="wp-leg-meta">
                      {s.prob != null && <span className="wp-leg-prob">{Math.round(s.prob * 100)}%</span>}
                      {unlocked && s.status && (
                        <span className={`wp-leg-st ${s.status}`}>
                          {statusIcon(s.status)}
                          {s.status === "upcoming" && kick ? kick : null}
                        </span>
                      )}
                      {openable && <span className="wp-leg-chev" aria-hidden="true">›</span>}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="wp-slip-foot">
              {unlocked ? (
                <p className="wp-note">{t.note}</p>
              ) : (
                <>
                  <div className="wp-unlock-list">
                    <span className="wp-unlock-list-ttl">{t.unlockPromo}</span>
                    <ul>
                      {t.unlockList.map((x, i) => (
                        <li key={i}><IChk />{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="wp-unlock">
                    <div className="wp-unlock-txt">
                      <span className="wp-unlock-ttl">{t.unlockTitle}</span>
                      <span className="wp-price">
                        {data?.discounted && fullPrice && <span className="wp-price-full">{fullPrice}</span>}
                        <span className="wp-price-now">{price}</span>
                      </span>
                    </div>
                    <button onClick={buy} disabled={buying} className="wp-cta">
                      {buying ? t.unlocking : `${t.unlockCta} · ${price}`}
                    </button>
                  </div>
                  {checkoutErr && <p className="wp-err">{t.checkoutError}</p>}
                </>
              )}
              <div className="wp-foot-row">
                {!unlocked && <a href="/app?tab=plans" className="wp-pro">{t.proCta}</a>}
                <span className="wp-resp">{t.responsible}</span>
              </div>
            </div>
          </article>
        )}
      </section>

      {/* ── ANALISI PARTITA PER PARTITA (inline, sbloccata) ── */}
      {available && unlocked && data?.selections?.some((s) => s.detail) && (
        <section className="wp-analysis">
          <header className="wp-hist-head">
            <p className="lp-eyebrow">{t.briefEyebrow}</p>
            <h2 className="lp-how-title">{t.anaTitle}</h2>
          </header>
          <div className="wp-acards">
            {data.selections.filter((s) => s.detail).map((s, i) => {
              const kick = fmtKick(s.kickoff);
              return (
                <article key={i} className="wp-acard">
                  <div className="wp-acard-top">
                    <span className="wp-leg-sport"><SportIcon sport={sportKind(s.sport)} size={20} variant="sm" /></span>
                    <span className="wp-acard-match">{s.label}</span>
                    {s.status && (
                      <span className={`wp-leg-st ${s.status}`}>
                        {statusIcon(s.status)}
                        {s.status === "upcoming" && kick ? kick : null}
                      </span>
                    )}
                  </div>
                  <LegDetail sel={s} lang={lang} />
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── STORICO ── */}
      <section className="wp-hist-sec">
        <header className="wp-hist-head">
          <p className="lp-eyebrow">{t.histEyebrow}</p>
          <h2 className="lp-how-title">{t.histTitle}</h2>
        </header>
        {histWeeks.length === 0 ? (
          <p className="wp-hist-empty">{t.histEmpty}</p>
        ) : (
          <div className="wp-hist">
            {histWeeks.map((w) => (
              <article key={w.week_start} className="wp-hist-card">
                <div className="wp-hist-top">
                  <span className="wp-hist-date">{fmtWeek(w.week_start)}</span>
                  <span className="wp-hist-top" style={{ margin: 0, gap: 8 }}>
                    {w.combined_prob != null && <span className="wp-hist-prob">{Math.round(w.combined_prob * 100)}%</span>}
                    <span className={`wp-hist-out ${w.outcome}`}>
                      {w.outcome === "won" ? <><IChk />{t.oWon}</> : w.outcome === "lost" ? <><IX />{t.oLost}</> : <><IClock />{t.oLive}</>}
                    </span>
                  </span>
                </div>
                <div>
                  {w.legs.map((l, i) => (
                    <div key={i} className="wp-hist-leg">
                      <span>{l.label} · <b style={{ color: "var(--am-muted)" }}>{l.market}</b></span>
                      <span className={`wp-hl-st ${l.status}`}>{statusIcon(l.status)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="wp-foot">{t.responsible}</footer>

      <PredictionDetailModal
        open={!!openLeg}
        onClose={() => setOpenLeg(null)}
        anchorRect={openLeg?.rect ?? null}
        titleId="wp-leg-detail"
        lang={lang}
        title={openLeg?.sel.label ?? ""}
        subtitle={[openLeg?.sel.detail?.competition, openLeg?.sel.detail?.stage].filter(Boolean).join(" · ") || undefined}
        hideExtraMarkets
      >
        {openLeg && <LegDetail sel={openLeg.sel} lang={lang} />}
      </PredictionDetailModal>
    </main>
  );
}
