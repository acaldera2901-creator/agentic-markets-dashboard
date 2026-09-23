// #CONVERSION-FAQ-0916 — le sei domande della sezione FAQ in home (audit
// conversion di Tommy, §6 e §12). Unica fonte per la sezione visibile
// (app/landing-client.tsx) e per il FAQPage JSON-LD (app/page.tsx): lo schema
// deve dire esattamente quello che la pagina mostra.
//
// Ogni risposta è scritta contro la checklist di compliance del playbook:
// nessuna garanzia, nessun rendimento promesso, probabilità del modello sempre
// distinta dalla certezza, BetRedge mai bookmaker né esecutore. Le frasi su
// fatturazione e disdetta ripetono quelle del checkout (app/app/page.tsx,
// PlansTab): abbonamento carta mensile/annuale che si rinnova da sé e si
// disdice dall'account; crypto = pagamento singolo da 30 giorni, senza
// rinnovo. Non promettono nulla che il checkout non dica già.
//
// EN e IT sono complete; es/fr/ru ricadono su EN come il resto della copy v3.
//
// #RESTYLING-0921 — RISCRITTURA DI VOCE (Andrea, 23/09: «così è troppo AI»).
// I FATTI sono identici a prima, riga per riga: fatturazione, crypto a 30
// giorni, le quattro cose dentro una lettura, i fattori della deep analysis,
// calcio+tennis con 1X2 e vincente match, il live come informazione e non
// azione, il 71% come stima su molte situazioni simili, tre letture per sport
// al giorno sul Free. È cambiato SOLO come sono dette. Il tic che si è tolto è
// l'antitesi «X, non Y» ripetuta in cinque risposte su sei e la lunghezza
// uniforme di ogni risposta: una FAQ scritta da una persona è corta dove la
// risposta è corta. Se un giorno cambia un fatto, si cambia qui e basta —
// questo file resta l'unica fonte, e il FAQPage JSON-LD la legge da qui.
//
// #RESTYLING-0921 round 15 — DUE FATTI CORRETTI in «Come dovrei usarlo?».
// (1) La card non mostra più «mercato, modello, edge, perché»: dal round 13/14
// mostra SOLO la percentuale del modello, e il resto vive nella scheda che si
// apre. La FAQ descriveva un prodotto che non esiste più.
// (2) «Il Free ti dà tre letture per sport al giorno» è vero per un account
// free REGISTRATO: `showcaseAllowance` (lib/access-projection.ts) dà 3 a
// `free` e **0** ad `anonymous`. Da sloggato erano zero, e la Home è la pagina
// che legge chi non ha ancora un account. Ora la riga dice «con un account
// gratuito», che è la cosa vera.

export type FaqItem = readonly [question: string, answer: string];

export const HOME_FAQ = {
  en: [
    [
      "Monthly or annual, and what happens if I cancel?",
      "Your choice. Base and Pro are card subscriptions, monthly or annual, and they renew on their own until you stop them. You cancel from your account whenever you like, and from that moment we charge you nothing. Crypto works differently: you pay once, you get 30 days, nothing renews. When the 30 days run out, you buy again or you don’t.",
    ],
    [
      "What’s actually in a reading, and what does Pro’s deep analysis add?",
      "Four things, all stamped before kick-off: what the market thinks (the odds turned into a percentage), what our model thinks (its calibrated probability), the gap between the two, and the reasoning written out in plain words. Deep analysis is the layer underneath that reasoning, and it comes with Pro: on any match card you can open the factors the model actually weighed — form, expected goals, injuries, Elo, serve and return numbers, head-to-head, surface.",
    ],
    [
      "Which sports and markets do you cover?",
      "Football and tennis, and for now that’s where it stops. In football we read the match result: home, draw, away. In tennis, the winner of the match. Which competitions are in depends on the day, and the board tells you which ones are there.",
    ],
    [
      "What does “live” actually mean here?",
      "It means the number moves while the match does. On the Live Probability Board the model re-reads a game as the score, the clock and the momentum change, so you watch the same probability shift in real time. At no point is anything placed or executed for you — you are reading a screen. Live comes with Pro.",
    ],
    [
      "Does BetRedge place bets, need a bookmaker account, or promise a return?",
      "No, no and no. We are a probability engine. We don’t take bets, we never touch your money, and you don’t need an account anywhere else to use us. And a probability is an estimate, never a verdict: when the model says 71%, it means that across many situations resembling this one it would expect that outcome around 71 times in 100 — about this particular match it does not know. We promise no return of any kind. The public record shows how past readings settled; it says nothing about the next one.",
    ],
    [
      "How am I meant to use it?",
      "Open the board and scan the cards: each one shows the model’s probability for that match, and nothing else — one number, so you can read twenty matches in a glance. When one is worth a closer look, open it: inside is the full reading, the reasoning written out in plain words. Then look at the public record to see how earlier readings settled, so you know what kind of thing you are reading. What you do after that is yours, and nobody here decides it for you. A free account opens three readings per sport a day; Base and Pro open the rest of the board.",
    ],
  ],
  it: [
    [
      "Mensile o annuale, e cosa succede se disdico?",
      "Come preferisci. Base e Pro sono abbonamenti con carta, mensili o annuali, e si rinnovano da soli finché non li fermi. La disdetta la fai dal tuo account quando vuoi, e da quel momento non ti addebitiamo più niente. Le crypto funzionano in un altro modo: paghi una volta, hai 30 giorni, non si rinnova nulla. Quando scadono, o ricompri o no.",
    ],
    [
      "Cosa c’è davvero dentro una lettura, e cosa aggiunge la deep analysis di Pro?",
      "Quattro cose, tutte registrate prima del fischio: cosa pensa il mercato (la quota convertita in percentuale), cosa pensa il nostro modello (la sua probabilità calibrata), la distanza fra le due, e il ragionamento scritto in parole normali. La deep analysis è lo strato sotto quel ragionamento, e arriva con Pro: da qualsiasi scheda apri i fattori che il modello ha davvero pesato — forma, gol attesi, infortuni, Elo, numeri di servizio e risposta, scontri diretti, superficie.",
    ],
    [
      "Quali sport e mercati coprite?",
      "Calcio e tennis, e per ora finisce lì. Nel calcio leggiamo l’esito della partita: 1, X, 2. Nel tennis, chi vince il match. Quali competizioni ci siano dipende dal giorno, e te lo dice il board.",
    ],
    [
      "Cosa vuol dire «live», in concreto?",
      "Vuol dire che il numero si muove mentre si muove la partita. Sul board di probabilità live il modello rilegge il match mentre cambiano punteggio, minuto e inerzia, e tu vedi la stessa probabilità spostarsi in tempo reale. In nessun momento viene piazzato o eseguito qualcosa per te: stai leggendo uno schermo. Il live arriva con Pro.",
    ],
    [
      "BetRedge piazza scommesse, richiede un conto bookmaker o promette un rendimento?",
      "No, no e no. Siamo un motore di probabilità. Non accettiamo scommesse, non tocchiamo mai i tuoi soldi, e per usarci non ti serve un conto da nessun’altra parte. E una probabilità è una stima, mai una sentenza: quando il modello dice 71%, sta dicendo che su molte situazioni simili a questa si aspetterebbe quell’esito circa 71 volte su 100 — su questa partita qui non lo sa. Non promettiamo nessun rendimento. Il registro pubblico mostra come si sono chiuse le letture passate, e sulla prossima non dice niente.",
    ],
    [
      "Come dovrei usarlo?",
      "Apri il board e scorri le card: ognuna mostra la probabilità del modello per quella partita, e nient’altro — un numero solo, così ne leggi venti in un colpo d’occhio. Quando una merita attenzione, aprila: dentro c’è la lettura completa, col ragionamento scritto in parole normali. Poi guarda il registro pubblico per vedere come si sono chiuse le letture precedenti, così sai che cosa stai leggendo. Cosa fai dopo lo decidi tu, e nessuno qui lo decide al posto tuo. Con un account gratuito apri tre letture per sport al giorno; Base e Pro aprono il resto del board.",
    ],
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

export type FaqLang = keyof typeof HOME_FAQ;

/** Lingue senza traduzione propria ricadono su EN (stessa regola della copy v3). */
export function homeFaq(lang: string): readonly FaqItem[] {
  return (Object.hasOwn(HOME_FAQ, lang) ? HOME_FAQ[lang as FaqLang] : HOME_FAQ.en);
}
