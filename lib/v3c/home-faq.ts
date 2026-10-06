// lib/v3c/home-faq.ts (#REDESIGN-V3C polish) — le sei domande della home v3c.
// Fonte UNICA per la FAQ visibile (components/v3c/home/Faq.tsx) e per il
// FAQPage JSON-LD di "/" a flag acceso (app/v3c/page.tsx): lo schema dice
// esattamente ciò che la pagina mostra.
//
// Perché un file a parte e non lib/home-faq.ts: quello alimenta la home di oggi
// (flag spento) e deve restare identico. Qui cambia SOLO ciò che il redesign
// rende falso: (1) i piani sono due, Free e Pro — «Base» sparisce (regola di
// Andrea 05/10, i clienti base passano a Pro senza cambio di prezzo); (2) la
// riga della board non porta più «un numero solo»: mercato, stima e gap; (3) la
// stima calcio è il blend 70% mercato + 30% modello, dichiarato.
// Fatti invariati, uno per uno: carta mensile/annuale con rinnovo, disdetta
// dall'account; crypto = un pagamento, 30 giorni, nessun rinnovo; calcio 1X2 e
// tennis vincente; live solo Pro; nessuna scommessa, nessun rendimento promesso;
// sulla board Free vede ogni partita con mercato, stima e gap e Pro aggiunge il
// perché: è la promessa di /pricing v3c (lib/v3c/pages-copy.ts), qui ripetuta
// uguale — la quota «tre letture al giorno» del sito di oggi non vale nel redesign.
import type { FaqItem } from "@/lib/home-faq";

export const V3C_HOME_FAQ = {
  en: [
    [
      "How does billing work, and can I cancel?",
      "Pro is an ordinary card subscription. You pick monthly or annual, and it renews by itself until you stop it. You stop it from your account, any day you want, and from that moment we charge you nothing further. Crypto is the odd one out: one payment, 30 days of access, no renewal of any kind. On day 31 nothing happens unless you decide to pay again.",
    ],
    [
      "What’s in a reading, and what does Pro add?",
      "Three numbers, all of them sealed before kick-off. What the market thinks, which is the odds turned into a percentage with the margin removed. Our estimate: in football that is 70% market and 30% model, and we say so next to it. And the gap between the two, in points. Pro adds the why: open any match and you see the factors the model actually weighed, like form, expected goals, Elo, serve and return numbers, head-to-head, surface.",
    ],
    [
      "Which sports do you cover?",
      "Football and tennis. That’s all, for now. In football we read the match result, so home, draw or away; in tennis, who wins the match. Which competitions show up changes from one day to the next, and the board tells you what’s there.",
    ],
    [
      "What happens on the live board?",
      "The number moves while the match does. The score changes, the clock runs, the momentum turns, and the model reads the game again, so you see the probability shift while it’s shifting. Nothing is ever placed or executed for you at any point: you’re reading a screen. Live is Pro only.",
    ],
    [
      "Do you place bets, or promise I’ll make money?",
      "No. We don’t place bets, we’re not a bookmaker, and your money is something we never touch. You don’t need an account anywhere else either, because BetRedge runs on its own. And we don’t promise a return of any kind. A probability is an estimate: when we say 71%, it means that across a lot of situations that resemble this one we would expect that outcome about 71 times in 100. What happens in this particular match, tonight, it does not know. The public record shows how past readings settled, and about the next one it says nothing.",
    ],
    [
      "How do I use it day to day?",
      "Open the board. Each row shows the outcome where our estimate and the market sit furthest apart: the market, our estimate, the gap. Tap it for all three outcomes and the prices of the connected books. Then look at the public record, because seeing how earlier readings settled tells you how much weight a number like that deserves. What you do with it after that is your call. Free shows every match on the board, gap included; Pro adds why the model disagrees.",
    ],
  ],
  it: [
    [
      "Come funziona il pagamento, e posso disdire?",
      "Pro è un normale abbonamento con carta. Scegli tu se mensile o annuale, e si rinnova da solo finché non lo fermi. Lo fermi dal tuo account, in qualsiasi giorno, e da quel momento non ti addebitiamo più niente. Le crypto vanno per conto loro: pagamento singolo, 30 giorni di accesso, nessun rinnovo. Il giorno 31 non succede niente, a meno che tu non decida di ripagare.",
    ],
    [
      "Cosa c’è dentro una lettura, e cosa aggiunge Pro?",
      "Tre numeri, tutti sigillati prima del fischio d’inizio. Cosa pensa il mercato, cioè la quota convertita in percentuale senza il margine. La nostra stima: nel calcio è 70% mercato e 30% modello, e lo scriviamo accanto. E la distanza fra le due, in punti. Pro aggiunge il perché: apri una partita e vedi i fattori che il modello ha davvero pesato, come forma, gol attesi, Elo, numeri di servizio e risposta, scontri diretti, superficie.",
    ],
    [
      "Quali sport coprite?",
      "Calcio e tennis. Per ora basta così. Nel calcio leggiamo il risultato della partita, quindi 1, X o 2; nel tennis, chi vince il match. Quali competizioni ci siano cambia da un giorno all’altro, e te lo dice il board.",
    ],
    [
      "Cosa succede sul board live?",
      "Il numero si muove insieme alla partita. Cambia il punteggio, passano i minuti, gira l’inerzia, e il modello rilegge il match, così vedi la probabilità spostarsi mentre si sta spostando. In nessun momento viene piazzato o eseguito qualcosa per te: stai guardando uno schermo. Il live è solo Pro.",
    ],
    [
      "Piazzate scommesse? Mi promettete un guadagno?",
      "No. Non piazziamo scommesse, non siamo un bookmaker, e i tuoi soldi non li tocchiamo mai. E non ti serve un conto da nessun’altra parte, perché BetRedge funziona per conto suo. Un rendimento non te lo promettiamo, di nessun tipo. Una probabilità è una stima: quando diciamo 71%, vuol dire che su tante situazioni simili a questa ci aspetteremmo quell’esito circa 71 volte su 100. Cosa succede in questa partita qui, stasera, non lo sa. Il registro pubblico mostra come si sono chiuse le letture passate, e sulla prossima non dice nulla.",
    ],
    [
      "Come lo uso, in pratica?",
      "Apri il board. Ogni riga mostra l’esito dove la nostra stima e il mercato sono più lontani: il mercato, la stima, il gap. Toccala e vedi tutti e tre gli esiti e i prezzi dei book connessi. Poi guarda il registro pubblico, perché è guardando come si sono chiuse le letture precedenti che capisci quanto peso dare a un numero del genere. Quello che ne fai dopo lo decidi tu. Free mostra ogni partita del board, gap compreso; Pro aggiunge il perché del modello.",
    ],
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

/** Lingue senza traduzione propria ricadono su EN. */
export function v3cHomeFaq(lang: string): readonly FaqItem[] {
  return lang.startsWith("it") ? V3C_HOME_FAQ.it : V3C_HOME_FAQ.en;
}
