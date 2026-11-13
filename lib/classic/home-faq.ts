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
//       punteggio e minuto (e lo serve ai piani a pagamento: requireAccess →
//       planHasAccess; nel copy si nomina solo Pro, l'unico in vendita —
//       i Base legacy restano serviti, #COPY-NO-BASE-1031), la stima resta
//       quella di prima del fischio, prezzi e bottone partner spariscono al calcio d'inizio;
//   6 · la scheda non porta più «un numero solo»: stima, mercato e prezzi partner.
// Le altre tre restano identiche. EN e IT come sopra; le altre lingue ricadono
// su EN, la stessa regola dichiarata in testa al file. A flag spento
// homeFaqActive() È HOME_FAQ: la Home e il suo JSON-LD restano quelli di main.
const CLASSIC_ANSWERS = {
  en: {
    1: "A reading identifies the source of its probability and shows a market comparison when the available data supports one. Some cards show a model-and-market estimate; others show a market-only reading. The public record tracks eligible pre-match predictions separately from unsealed display estimates. Pro analysis includes the statistical context available for that match. Not every displayed field is an input to the probability, and coverage varies. Eligible club-football estimates use a 30% model and 70% market blend; eligible tennis estimates use 10% Elo and 90% market and are labelled unsealed. These formulas do not describe every card or competition.",
    3: "The live board follows scores and match status where feeds are available. Stored pre-match predictions remain frozen after the scheduled start; the model does not reprice them from the live score. Nothing is placed or executed for you. Live scores require Pro. Pre-match partner prices are hidden once play starts.",
    5: "Open the board and check the source label beside each number. Depending on the available data, a card can show an estimate, a market-only probability, or no price. Open a match for the available details, and use the public record to examine eligible past predictions. A free account opens up to three readings per sport per day; Pro has no daily reading cap. Partner prices appear where available.",
  },
  it: {
    1: "Una lettura indica la fonte della probabilità e mostra il confronto col mercato quando i dati disponibili lo consentono. Alcune schede mostrano una stima che combina modello e mercato; altre mostrano solo il mercato. Il registro pubblico traccia i pronostici pre-partita idonei separatamente dalle stime visualizzate non sigillate. L’analisi Pro include il contesto statistico disponibile per quella partita. Non tutti i campi mostrati entrano nel calcolo della probabilità e la copertura varia. Le stime idonee del calcio per club combinano 30% modello e 70% mercato; quelle idonee del tennis combinano 10% Elo e 90% mercato e sono indicate come non sigillate. Queste formule non descrivono ogni scheda o competizione.",
    3: "Il board live segue punteggi e stato delle partite dove sono disponibili le fonti. I pronostici pre-partita memorizzati restano congelati dopo l’orario di inizio; il modello non li ricalcola in base al punteggio live. Non viene piazzato o eseguito nulla per te. I punteggi live richiedono Pro. Le quote pre-partita dei partner vengono nascoste all’inizio del match.",
    5: "Apri il board e controlla l’etichetta della fonte accanto a ogni numero. Secondo i dati disponibili, una scheda può mostrare una stima, la sola probabilità del mercato o nessuna quota. Apri la partita per i dettagli disponibili e consulta il registro pubblico per esaminare i pronostici passati idonei. Un account gratuito apre fino a tre letture per sport al giorno; Pro non ha un limite giornaliero di letture. Le quote dei partner compaiono dove disponibili.",
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
