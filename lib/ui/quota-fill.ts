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

/** Forma di `showcase_fill` nelle risposte di /api/predictions e /api/tennis. */
export type ShowcaseFillPayload = { today: number; borrowed: number; resumes_on: string };

const LOCALE: Record<Lang, string> = { it: "it-IT", en: "en-GB", es: "es-ES", fr: "fr-FR", ru: "ru-RU" };

const SPORT: Record<Lang, Record<Sport, string>> = {
  it: { football: "calcio", tennis: "tennis" },
  en: { football: "football", tennis: "tennis" },
  es: { football: "fútbol", tennis: "tenis" },
  fr: { football: "football", tennis: "tennis" },
  ru: { football: "футбол", tennis: "теннис" },
};

/** "YYYY-MM-DD" → "sabato 3 ottobre" nella lingua dell'utente. Giorno UTC,
 *  lo stesso su cui il server conta la quota. */
export function fillDay(lang: Lang, day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function quotaFillCopy(lang: Lang, sport: Sport, fill: ShowcaseFillPayload): string {
  const s = SPORT[lang][sport];
  const date = fillDay(lang, fill.resumes_on);
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
