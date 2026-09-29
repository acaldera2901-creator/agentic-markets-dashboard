// lib/ui/quota-fill.ts — #QUOTA-NEXTDAY-0929
//
// Il messaggio del board quando la quota di oggi (Free 3, Base 7 per sport) è
// stata completata con le giornate successive, perché oggi si giocano meno
// partite della quota — il caso della sosta nazionali. Non è un errore: dice
// perché le card aperte non sono di oggi e quando si torna a giocare.
//
// Non scrive «sosta nazionali»: il server sa solo che oggi ci sono poche
// partite, non perché. Un martedì vuoto fuori sosta avrebbe lo stesso stato, e
// il testo deve restare vero anche lì.
import type { Lang } from "@/lib/house-banners";

export type Sport = "football" | "tennis";

/** Forma di `showcase_fill` nelle risposte di /api/predictions e /api/tennis.
 *  `resumes_at` (#QUOTA-TZ-FIX-0929) è l'ISO del calcio d'inizio più vicino fra
 *  le righe prese in prestito; opzionale solo per una risposta di un server
 *  precedente durante il rollout. */
export type ShowcaseFillPayload = { today: number; borrowed: number; resumes_on: string; resumes_at?: string | null };

const LOCALE: Record<Lang, string> = { it: "it-IT", en: "en-GB", es: "es-ES", fr: "fr-FR", ru: "ru-RU" };

const SPORT: Record<Lang, Record<Sport, string>> = {
  it: { football: "calcio", tennis: "tennis" },
  en: { football: "football", tennis: "tennis" },
  es: { football: "fútbol", tennis: "tenis" },
  fr: { football: "football", tennis: "tennis" },
  ru: { football: "футбол", tennis: "теннис" },
};

/** Il giorno in cui si riprende a giocare → "sabato 3 ottobre", nella lingua
 *  e nel FUSO dell'utente.
 *
 *  #QUOTA-TZ-FIX-0929 — prima era il giorno UTC `resumes_on` formattato in UTC,
 *  mentre le card sotto formattano l'orario nel fuso del browser (fmtKickoff,
 *  TzCtx). Andrea, 29/09, Base, calcio: banner «resumes Wednesday 30
 *  September», prima card «Thu 1 Oct, 01:30» — la stessa partita, 23:30Z del
 *  30/09. Ora si formatta l'istante `resumes_at` nello stesso `tz` delle card;
 *  `resumes_on` resta solo come ripiego (mezzogiorno UTC: non scavalca il
 *  giorno in nessun fuso abitato). */
export function fillDay(lang: Lang, fill: Pick<ShowcaseFillPayload, "resumes_on" | "resumes_at">, tz?: string): string {
  const at = fill.resumes_at ? new Date(fill.resumes_at) : null;
  const d = at && !Number.isNaN(at.getTime()) ? at : new Date(`${fill.resumes_on}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return fill.resumes_on;
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  try {
    return d.toLocaleDateString(LOCALE[lang], { ...opts, timeZone: tz || undefined });
  } catch {
    // Fuso non valido (RangeError): quello del runtime, come fa il resto del desk.
    return d.toLocaleDateString(LOCALE[lang], opts);
  }
}

export function quotaFillCopy(lang: Lang, sport: Sport, fill: ShowcaseFillPayload, tz?: string): string {
  const s = SPORT[lang][sport];
  const date = fillDay(lang, fill, tz);
  const n = Math.max(0, Math.floor(fill.today));
  if (n === 0) {
    switch (lang) {
      case "it": return `Oggi il ${s} non si gioca: riprende ${date}. Le card aperte della tua quota di oggi sono le prime partite in arrivo.`;
      case "es": return `Hoy no se juega ${s}: vuelve el ${date}. Las tarjetas abiertas de tu cuota de hoy son los primeros partidos que llegan.`;
      case "fr": return `Pas de ${s} aujourd'hui : reprise ${date}. Les cartes ouvertes de votre quota du jour sont les premiers matchs à venir.`;
      case "ru": return `Сегодня ${s} не играют: игры возобновятся — ${date}. Открытые карточки вашей квоты на сегодня — ближайшие матчи.`;
      default: return `No ${s} today: it resumes ${date}. The open cards in today's allowance are the next matches coming up.`;
    }
  }
  switch (lang) {
    case "it": return n === 1
      ? `Oggi c'è una sola partita di ${s}: la tua quota di oggi include anche quelle di ${date}.`
      : `Oggi ci sono solo ${n} partite di ${s}: la tua quota di oggi include anche quelle di ${date}.`;
    case "es": return n === 1
      ? `Hoy solo hay un partido de ${s}: tu cuota de hoy incluye también los del ${date}.`
      : `Hoy solo hay ${n} partidos de ${s}: tu cuota de hoy incluye también los del ${date}.`;
    case "fr": return n === 1
      ? `Un seul match de ${s} aujourd'hui : votre quota du jour inclut aussi ceux de ${date}.`
      : `Seulement ${n} matchs de ${s} aujourd'hui : votre quota du jour inclut aussi ceux de ${date}.`;
    // Il russo declina per numero: cifra dopo i due punti, niente sostantivo contato.
    case "ru": return `Матчей (${s}) сегодня: ${n}. Ваша квота на сегодня включает и матчи — ${date}.`;
    default: return n === 1
      ? `Only one ${s} match today: today's allowance also includes those on ${date}.`
      : `Only ${n} ${s} matches today: today's allowance also includes those on ${date}.`;
  }
}
