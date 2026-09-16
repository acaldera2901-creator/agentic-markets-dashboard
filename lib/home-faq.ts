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

export type FaqItem = readonly [question: string, answer: string];

export const HOME_FAQ = {
  en: [
    [
      "Is billing monthly or annual, and what happens if I cancel?",
      "Base and Pro are card subscriptions billed monthly or annually. They renew automatically and you can cancel anytime from your account: once cancelled, nothing further is charged. Paying in crypto works differently — a one-time payment for 30 days with no auto-renewal. When it runs out, you buy again only if you want to.",
    ],
    [
      "What exactly is in a reading, and what does Pro’s deep analysis add?",
      "Every reading shows four things, time-stamped before kick-off: the market-implied probability (the odds converted into a percentage), the model’s calibrated probability, the edge between the two, and the reasoning in plain words. Deep analysis, on Pro, opens the factors behind that reasoning on every match card — form, expected goals, injuries, Elo, serve and return, head-to-head, surface.",
    ],
    [
      "Which sports and markets does BetRedge cover?",
      "Football and tennis. In football the reading is on the match result (home, draw, away); in tennis on the match winner. Coverage follows the competitions on the board each day and is listed there — no other sports for now.",
    ],
    [
      "What does “live” mean in practice?",
      "On the Live Probability Board the model’s probability for a match updates as the state of the match changes — score, time, momentum — so you see the same reading moving in real time. It is information, not action: nothing is placed or executed for you. Live readings are part of the Pro plan.",
    ],
    [
      "Does BetRedge place bets, need a bookmaker account, or promise a return?",
      "No to all three. BetRedge is a probability engine, not a bookmaker or an exchange: it never places a bet, never holds your money and does not require an account anywhere else. A model probability is an estimate — a 71% reading means the model would expect that outcome about 71 times in 100 across many similar situations, not that this match is certain. No return is promised, and the public record shows how past readings settled, not a forecast.",
    ],
    [
      "How am I meant to use it?",
      "Open the board, pick a fixture and read it in order — market, model, edge, why — then check the public record to see how earlier readings settled. Whatever you decide to do with that, you decide it yourself. Start free with three readings per sport a day; move to Base or Pro when you want the whole board.",
    ],
  ],
  it: [
    [
      "La fatturazione è mensile o annuale, e cosa succede se disdico?",
      "Base e Pro sono abbonamenti con carta, mensili o annuali. Si rinnovano automaticamente e puoi disdire quando vuoi dal tuo account: dopo la disdetta non viene addebitato più nulla. Il pagamento in crypto funziona diversamente — un pagamento singolo per 30 giorni, senza rinnovo automatico. Alla scadenza ricompri solo se vuoi.",
    ],
    [
      "Cosa c’è esattamente in una lettura, e cosa aggiunge la deep analysis di Pro?",
      "Ogni lettura mostra quattro cose, con timestamp prima del fischio: la probabilità implicita del mercato (la quota convertita in percentuale), la probabilità calibrata del modello, l’edge tra le due e il ragionamento in parole semplici. La deep analysis, su Pro, apre i fattori dietro quel ragionamento su ogni scheda — forma, gol attesi, infortuni, Elo, servizio e risposta, scontri diretti, superficie.",
    ],
    [
      "Quali sport e mercati copre BetRedge?",
      "Calcio e tennis. Nel calcio la lettura è sull’esito della partita (1, X, 2); nel tennis sul vincitore del match. La copertura segue le competizioni presenti sul board ogni giorno ed è elencata lì — per ora nessun altro sport.",
    ],
    [
      "Cosa significa «live» in pratica?",
      "Sul board di probabilità live la probabilità del modello per una partita si aggiorna al cambiare dello stato del match — punteggio, minuto, inerzia — così vedi la stessa lettura muoversi in tempo reale. È informazione, non azione: nulla viene piazzato o eseguito per te. Le letture live fanno parte del piano Pro.",
    ],
    [
      "BetRedge piazza scommesse, richiede un conto bookmaker o promette un rendimento?",
      "No a tutte e tre. BetRedge è un motore di probabilità, non un bookmaker né un exchange: non piazza mai una scommessa, non custodisce il tuo denaro e non richiede un conto altrove. Una probabilità del modello è una stima — una lettura al 71% significa che il modello si aspetterebbe quell’esito circa 71 volte su 100 in molte situazioni simili, non che questa partita sia certa. Nessun rendimento è promesso, e il registro pubblico mostra come si sono chiuse le letture passate, non una previsione.",
    ],
    [
      "Come dovrei usarlo?",
      "Apri il board, scegli una partita e leggila in ordine — mercato, modello, edge, perché — poi controlla nel registro pubblico come si sono chiuse le letture precedenti. Qualunque cosa decidi di farne, la decidi tu. Inizia gratis con tre letture per sport al giorno; passa a Base o Pro quando vuoi tutto il board.",
    ],
  ],
} as const satisfies Record<string, readonly FaqItem[]>;

export type FaqLang = keyof typeof HOME_FAQ;

/** Lingue senza traduzione propria ricadono su EN (stessa regola della copy v3). */
export function homeFaq(lang: string): readonly FaqItem[] {
  return (Object.hasOwn(HOME_FAQ, lang) ? HOME_FAQ[lang as FaqLang] : HOME_FAQ.en);
}
