// lib/classic/home-faq.ts — #CLASSIC-INT-1008 / #CLASSIC-PARITY-1008
//
// La FAQ della Home a flag acceso. Sta qui e non in lib/home-faq.ts perché là,
// valutata all'avvio del modulo, cambiava il chunk della Home anche a flag
// spento: lib/home-faq.ts la carica con un `require` dentro il ramo del flag.
import { HOME_FAQ, type FaqItem, type FaqLang } from "@/lib/home-faq";
import { CLASSIC } from "@/lib/classic/flag";

// #CLASSIC-INT-1008 — con NEXT_PUBLIC_CLASSIC=1 la Home mostra la scheda Slab,
// e tre risposte di lib/home-faq.ts descriverebbero un prodotto che a flag acceso non
// c'è più. Si riscrivono SOLO quelle tre, coi fatti verificati nel codice l'8/10:
//   2 · la scheda dice «Our estimate» (calcio: 30% modello + 70% mercato,
//       lib/classic/guard MODEL_WEIGHT) o «Market only»/«Model only»; il tennis
//       oggi è quasi sempre «Market only» (Elo più vecchio di 6 h);
//   4 · nel live NON c'è un modello che rilegge la partita: /api/live serve
//       punteggio e minuto (e lo serve ai piani a pagamento, Base E Pro:
//       requireAccess → planHasAccess), la stima resta quella di prima del
//       fischio, prezzi e bottone partner spariscono al calcio d'inizio;
//   6 · la scheda non porta più «un numero solo»: stima, mercato e prezzi partner.
// Le altre tre restano identiche. EN e IT come sopra; le altre lingue ricadono
// su EN, la stessa regola dichiarata in testa al file. A flag spento
// homeFaqActive() È HOME_FAQ: la Home e il suo JSON-LD restano quelli di main.
const CLASSIC_ANSWERS = {
  en: {
    1: "Four things, all of them logged before kick-off. What the market thinks, which is the odds turned into a percentage. Our estimate: in football that is our model’s probability blended with the market, 30% model and 70% market, and the card says so. When the model is missing, stale or too far from the market, the card shows the market’s number and calls it “Market only”; in tennis that is most days for now. The distance between the two numbers. And the reasoning behind it, written out in normal words. The deep analysis is what sits under that reasoning, and it comes with Pro. Open it on any match and you get the factors the model actually weighed: form, expected goals, Elo, serve and return numbers, head-to-head, surface.",
    3: "The card follows the match: the score and the minute where a feed has them, the kick-off time where none does. The number on it stays the estimate logged before kick-off; nothing recalculates it during play. Pre-match prices and the partner button come off at kick-off. Nothing is ever placed or executed for you at any point: you’re reading a screen. Live scores come with a paid plan, Base or Pro.",
    5: "Open the board. Every card shows our estimate next to the market’s number and, where partners are available, their best prices, which is what lets you run your eye down twenty matches without reading twenty paragraphs. When one makes you stop, open it: the full reading is inside, reasoning included. Then go and look at the public record, because seeing how earlier readings settled is what tells you how much weight a number like that deserves. What you do with it after that is your call. We don’t make that one for you. Register a free account and you get up to three readings per sport a day; Base goes up to seven, and Pro opens the whole board.",
  },
  it: {
    1: "Quattro cose, tutte registrate prima del fischio d’inizio. Cosa pensa il mercato, cioè la quota convertita in percentuale. La nostra stima: nel calcio è la probabilità del nostro modello mescolata col mercato, 30% modello e 70% mercato, e la card lo dice. Quando il modello manca, è vecchio o si allontana troppo dal mercato, la card mostra il numero del mercato e lo chiama «Market only»; nel tennis, per ora, succede quasi ogni giorno. La distanza fra questi due numeri. E il ragionamento che c’è dietro, scritto in parole normali. La deep analysis è quello che sta sotto quel ragionamento, e arriva con Pro. La apri su qualsiasi partita e vedi i fattori che il modello ha davvero pesato: forma, gol attesi, Elo, numeri di servizio e risposta, scontri diretti, superficie.",
    3: "La card segue la partita: punteggio e minuto dove una fonte li ha, l’ora del calcio d’inizio dove non c’è. Il numero resta la stima registrata prima del fischio; durante il match nessuno lo ricalcola. Le quote pre-partita e il bottone del partner spariscono al calcio d’inizio. In nessun momento viene piazzato o eseguito qualcosa per te: stai guardando uno schermo. I punteggi live arrivano con un piano a pagamento, Base o Pro.",
    5: "Apri il board. Ogni card mostra la nostra stima accanto al numero del mercato e, dove i partner sono disponibili, le loro quote migliori: è quello che ti permette di scorrere venti partite senza leggerne venti paragrafi. Quando una ti fa fermare, aprila: dentro c’è la lettura completa, ragionamento compreso. Poi vai a vedere il registro pubblico, perché è guardando come si sono chiuse le letture precedenti che capisci quanto peso dare a un numero del genere. Quello che ne fai dopo lo decidi tu. Quella cosa lì non la decidiamo noi al posto tuo. Registrando un account gratuito hai fino a tre letture per sport al giorno; Base arriva fino a sette, Pro apre tutto il board.",
  },
} as const;

function withClassic(items: readonly FaqItem[], answers: Record<number, string>): readonly FaqItem[] {
  return items.map(([q, a], i) => [q, answers[i] ?? a] as const);
}

// #CLASSIC-PARITY-1008 — calcolata alla prima chiamata, non all'avvio del
// modulo: lib/home-faq.ts carica questo file dal suo stesso ramo, e un
// HOME_FAQ letto all'avvio sarebbe un ciclo d'import.
let classicFaq: Record<FaqLang, readonly FaqItem[]> | null = null;

/** Le due lingue scritte (EN, IT) con le tre risposte della Slab. */
export function homeFaqClassicAll(): Record<FaqLang, readonly FaqItem[]> {
  classicFaq ??= {
    en: withClassic(HOME_FAQ.en, CLASSIC_ANSWERS.en),
    it: withClassic(HOME_FAQ.it, CLASSIC_ANSWERS.it),
  };
  return classicFaq;
}

/** La FAQ che la Home mostra E che il suo JSON-LD dichiara: una sola fonte. */
export function homeFaqActive(): Record<FaqLang, readonly FaqItem[]> {
  return CLASSIC ? homeFaqClassicAll() : HOME_FAQ;
}

/** lib/home-faq.ts → homeFaq() a flag acceso. Lingue senza traduzione propria → EN. */
export function homeFaqClassic(lang: string): readonly FaqItem[] {
  const faq = homeFaqClassicAll();
  return (Object.hasOwn(faq, lang) ? faq[lang as FaqLang] : faq.en);
}
