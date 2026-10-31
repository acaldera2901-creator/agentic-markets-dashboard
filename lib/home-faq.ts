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
// REGISTRATO = fino a 3 letture per sport al giorno, solo Pro apre tutto il
// board (#BUG-001-0928: quota giornaliera, non un numero fisso). Pro è l'unico
// abbonamento in vendita: Base non si presenta più (#COPY-NO-BASE-1031).
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
      "Pro is an ordinary card subscription. You pick monthly or annual, and it renews by itself until you stop it. You stop it from your account, any day you want, and from that moment we charge you nothing further. Crypto is the odd one out: one payment, 30 days of access, no renewal of any kind. On day 31 nothing happens unless you decide to pay again.",
    ],
    [
      "What’s in a reading, and what is the deep analysis?",
      "A reading identifies the source of its probability and shows a market comparison when the available data supports one. Some cards show a model-and-market estimate; others show a market-only reading. The public record tracks eligible pre-match predictions separately from unsealed display estimates. Pro analysis includes the statistical context available for that match. Not every displayed field is an input to the probability, and coverage varies.",
    ],
    [
      "Which sports do you cover?",
      "Football and tennis. That’s all, for now. In football we read the match result, so home, draw or away; in tennis, who wins the match. Which competitions show up changes from one day to the next, and the board tells you what’s there.",
    ],
    [
      "What happens on the live board?",
      "The live board follows scores and match status where feeds are available. Stored pre-match predictions remain frozen after the scheduled start; the model does not reprice them from the live score. Nothing is placed or executed for you. Live scores require Pro.",
    ],
    [
      "Do you place bets, or promise I’ll make money?",
      "No. We don’t place bets, we’re not a bookmaker, and your money is something we never touch. You don’t need an account anywhere else either, because BetRedge runs on its own. And we don’t promise a return of any kind. A probability is an estimate: when the model says 71%, it’s saying that across a lot of situations that resemble this one it would expect that outcome about 71 times in 100. What happens in this particular match, tonight, it does not know. The public record shows how past readings settled, and about the next one it says nothing.",
    ],
    [
      "How do I use it day to day?",
      "Open the board and check the source label beside each number. Depending on the available data, a card can show an estimate, a market-only probability, or no price. Open a match for the available details, and use the public record to examine eligible past predictions. A free account opens up to three readings per sport per day; Pro has no daily reading cap.",
    ],
  ],
  it: [
    [
      "Come funziona il pagamento, e posso disdire?",
      "Pro è un normale abbonamento con carta. Scegli tu se mensile o annuale, e si rinnova da solo finché non lo fermi. Lo fermi dal tuo account, in qualsiasi giorno, e da quel momento non ti addebitiamo più niente. Le crypto vanno per conto loro: pagamento singolo, 30 giorni di accesso, nessun rinnovo. Il giorno 31 non succede niente, a meno che tu non decida di ripagare.",
    ],
    [
      "Cosa c’è dentro una lettura, e cos’è la deep analysis?",
      "Una lettura indica la fonte della probabilità e mostra il confronto col mercato quando i dati disponibili lo consentono. Alcune schede mostrano una stima che combina modello e mercato; altre mostrano solo il mercato. Il registro pubblico traccia i pronostici pre-partita idonei separatamente dalle stime visualizzate non sigillate. L’analisi Pro include il contesto statistico disponibile per quella partita. Non tutti i campi mostrati entrano nel calcolo della probabilità e la copertura varia.",
    ],
    [
      "Quali sport coprite?",
      "Calcio e tennis. Per ora basta così. Nel calcio leggiamo il risultato della partita, quindi 1, X o 2; nel tennis, chi vince il match. Quali competizioni ci siano cambia da un giorno all’altro, e te lo dice il board.",
    ],
    [
      "Cosa succede sul board live?",
      "Il board live segue punteggi e stato delle partite dove sono disponibili le fonti. I pronostici pre-partita memorizzati restano congelati dopo l’orario di inizio; il modello non li ricalcola in base al punteggio live. Non viene piazzato o eseguito nulla per te. I punteggi live richiedono Pro.",
    ],
    [
      "Piazzate scommesse? Mi promettete un guadagno?",
      "No. Non piazziamo scommesse, non siamo un bookmaker, e i tuoi soldi non li tocchiamo mai. E non ti serve un conto da nessun’altra parte, perché BetRedge funziona per conto suo. Un rendimento non te lo promettiamo, di nessun tipo. Una probabilità è una stima: quando il modello dice 71%, sta dicendo che su tante situazioni simili a questa si aspetterebbe quell’esito circa 71 volte su 100. Cosa succede in questa partita qui, stasera, non lo sa. Il registro pubblico mostra come si sono chiuse le letture passate, e sulla prossima non dice nulla.",
    ],
    [
      "Come lo uso, in pratica?",
      "Apri il board e controlla l’etichetta della fonte accanto a ogni numero. Secondo i dati disponibili, una scheda può mostrare una stima, la sola probabilità del mercato o nessuna quota. Apri la partita per i dettagli disponibili e consulta il registro pubblico per esaminare i pronostici passati idonei. Un account gratuito apre fino a tre letture per sport al giorno; Pro non ha un limite giornaliero di letture.",
    ],
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

export type FaqLang = keyof typeof HOME_FAQ;

/** Lingue senza traduzione propria ricadono su EN (stessa regola della copy v3). */
export function homeFaq(lang: string): readonly FaqItem[] {
  // #CLASSIC-INT-1008 — a flag acceso tre risposte cambiano (lib/classic/home-faq.ts).
  // #CLASSIC-PARITY-1008 — `require` nel ramo del flag, in un'espressione: a
  // flag spento il ramo è morto e la funzione resta quella di main.
  return __CLASSIC_BUILD__
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? (require("@/lib/classic/home-faq") as typeof import("@/lib/classic/home-faq")).homeFaqClassic(lang)
    : (Object.hasOwn(HOME_FAQ, lang) ? HOME_FAQ[lang as FaqLang] : HOME_FAQ.en);
}
