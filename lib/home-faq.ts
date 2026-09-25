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
//
// #FAQ-UMANA-0925 — SECONDA riscrittura di voce (Andrea, 25/09: «deve essere
// molto più umana come scrittura»). Il giro del 23/09 aveva tolto l'antitesi
// «X, non Y», ma ne lasciava in piedi altri quattro, più subdoli perché non
// sono una formula da cercare col grep: sono un RITMO.
//
//   1. La chiusa a effetto, SEI volte su sei. Ogni risposta atterrava su una
//      frasetta da manifesto: «o ricompri o no», «e per ora finisce lì», «stai
//      leggendo uno schermo», «sulla prossima non dice niente», «nessuno qui
//      lo decide al posto tuo». Una persona che risponde a una domanda la
//      battuta la fa una volta su sei, non sei su sei. Ora quattro risposte
//      su sei finiscono su una frase piatta e informativa.
//   2. Il periodo unico, tutto in un fiato. Ogni risposta era una o due frasi
//      lunghe con lo stesso respiro (virgola, virgola, trattino lungo,
//      chiusa), e sei risposte lunghe uguali sono una macchina. Ora la
//      lunghezza varia DENTRO la singola risposta: frasi da quattro parole
//      accanto a frasi da trenta.
//   3. Il trattino lungo come punteggiatura di default (tre in EN, tre in IT).
//      Zero adesso: due punti, punto fermo, parentesi.
//   4. La bravura da copywriter. «No, no and no.», «Your choice.», «the layer
//      underneath that reasoning», «all stamped before kick-off», «so you can
//      read twenty matches in a glance», «an estimate, never a verdict» — e le
//      domande scritte da un SEO invece che da un utente («How am I meant to
//      use it?», «What does “live” actually mean here?», più una domanda a tre
//      canne che impacchettava scommesse + conto bookmaker + rendimento).
//
// I FATTI sono di nuovo identici, uno per uno, in EN e in IT: carta
// mensile/annuale con rinnovo automatico, disdetta dall'account in qualsiasi
// momento e zero addebiti da lì in poi; crypto pagamento singolo da 30 giorni
// senza rinnovo; le quattro cose dentro una lettura (quota→percentuale,
// probabilità calibrata, distanza fra le due, ragionamento in parole)
// registrate prima del fischio; deep analysis solo Pro coi suoi sette fattori;
// calcio 1X2 e tennis vincente match e nient'altro, per ora; live = il numero
// che si muove, mai un'azione eseguita, solo Pro; nessuna scommessa piazzata,
// nessun conto bookmaker necessario, nessun rendimento promesso, il 71% come
// frequenza attesa su molte situazioni simili e mai una certezza sulla singola
// partita, il registro pubblico che parla solo del passato; account gratuito
// REGISTRATO = 3 letture per sport al giorno, Base/Pro aprono tutto il board.
//
// NOTA PER CHI RISCRIVE DOPO DI ME: la risposta è resa in un unico nodo di
// testo (`<dd>{a}</dd>`, sia in components/lobby/HomeFaq.tsx sia in
// app/landing-client.tsx). Un `\n\n` qui dentro NON diventa un paragrafo: si
// appiattisce in uno spazio. La prosa deve reggere come blocco unico.

export type FaqItem = readonly [question: string, answer: string];

export const HOME_FAQ = {
  en: [
    [
      "How does billing work, and can I cancel?",
      "Base and Pro are ordinary card subscriptions. You pick monthly or annual, and it renews by itself until you stop it. You stop it from your account, any day you want, and from that moment we charge you nothing further. Crypto is the odd one out: one payment, 30 days of access, no renewal of any kind. On day 31 nothing happens unless you decide to pay again.",
    ],
    [
      "What’s in a reading, and what is the deep analysis?",
      "Four things, all of them logged before kick-off. What the market thinks, which is the odds turned into a percentage. What our model thinks, which is its calibrated probability. The distance between those two numbers. And the reasoning behind it, written out in normal words. The deep analysis is what sits under that reasoning, and it comes with Pro. Open it on any match and you get the factors the model actually weighed: form, expected goals, injuries, Elo, serve and return numbers, head-to-head, surface.",
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
      "No. We don’t place bets, we’re not a bookmaker, and your money is something we never touch. You don’t need an account anywhere else either, because BetRedge runs on its own. And we don’t promise a return of any kind. A probability is an estimate: when the model says 71%, it’s saying that across a lot of situations that resemble this one it would expect that outcome about 71 times in 100. What happens in this particular match, tonight, it does not know. The public record shows how past readings settled, and about the next one it says nothing.",
    ],
    [
      "How do I use it day to day?",
      "Open the board. Every card carries one number, the model’s probability for that match, and nothing else, which is what lets you run your eye down twenty matches without reading twenty paragraphs. When one makes you stop, open it: the full reading is inside, reasoning included. Then go and look at the public record, because seeing how earlier readings settled is what tells you how much weight a number like that deserves. What you do with it after that is your call. We don’t make that one for you. Register a free account and you get three readings per sport a day; Base and Pro open the whole board.",
    ],
  ],
  it: [
    [
      "Come funziona il pagamento, e posso disdire?",
      "Base e Pro sono normali abbonamenti con carta. Scegli tu se mensile o annuale, e si rinnova da solo finché non lo fermi. Lo fermi dal tuo account, in qualsiasi giorno, e da quel momento non ti addebitiamo più niente. Le crypto vanno per conto loro: pagamento singolo, 30 giorni di accesso, nessun rinnovo. Il giorno 31 non succede niente, a meno che tu non decida di ripagare.",
    ],
    [
      "Cosa c’è dentro una lettura, e cos’è la deep analysis?",
      "Quattro cose, tutte registrate prima del fischio d’inizio. Cosa pensa il mercato, cioè la quota convertita in percentuale. Cosa pensa il nostro modello, cioè la sua probabilità calibrata. La distanza fra questi due numeri. E il ragionamento che c’è dietro, scritto in parole normali. La deep analysis è quello che sta sotto quel ragionamento, e arriva con Pro. La apri su qualsiasi partita e vedi i fattori che il modello ha davvero pesato: forma, gol attesi, infortuni, Elo, numeri di servizio e risposta, scontri diretti, superficie.",
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
      "No. Non piazziamo scommesse, non siamo un bookmaker, e i tuoi soldi non li tocchiamo mai. E non ti serve un conto da nessun’altra parte, perché BetRedge funziona per conto suo. Un rendimento non te lo promettiamo, di nessun tipo. Una probabilità è una stima: quando il modello dice 71%, sta dicendo che su tante situazioni simili a questa si aspetterebbe quell’esito circa 71 volte su 100. Cosa succede in questa partita qui, stasera, non lo sa. Il registro pubblico mostra come si sono chiuse le letture passate, e sulla prossima non dice nulla.",
    ],
    [
      "Come lo uso, in pratica?",
      "Apri il board. Ogni card porta un numero solo, la probabilità del modello per quella partita, e nient’altro: è quello che ti permette di scorrere venti partite senza leggerne venti paragrafi. Quando una ti fa fermare, aprila: dentro c’è la lettura completa, ragionamento compreso. Poi vai a vedere il registro pubblico, perché è guardando come si sono chiuse le letture precedenti che capisci quanto peso dare a un numero del genere. Quello che ne fai dopo lo decidi tu. Quella cosa lì non la decidiamo noi al posto tuo. Registrando un account gratuito hai tre letture per sport al giorno; Base e Pro aprono tutto il board.",
    ],
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

export type FaqLang = keyof typeof HOME_FAQ;

/** Lingue senza traduzione propria ricadono su EN (stessa regola della copy v3). */
export function homeFaq(lang: string): readonly FaqItem[] {
  return (Object.hasOwn(HOME_FAQ, lang) ? HOME_FAQ[lang as FaqLang] : HOME_FAQ.en);
}
