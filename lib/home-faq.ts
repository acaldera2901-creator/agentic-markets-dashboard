// #CONVERSION-FAQ-0916 — le sei domande della sezione FAQ in home (audit
// conversion di Tommy, §6 e §12). Unica fonte per la sezione visibile
// (app/landing-client.tsx) e per il FAQPage JSON-LD (app/page.tsx): lo schema
// deve dire esattamente quello che la pagina mostra.
//
// Ogni risposta è scritta contro la checklist di compliance del playbook:
// nessuna garanzia, nessun rendimento promesso, probabilità del modello sempre
// distinta dalla certezza, BetRedge mai bookmaker né esecutore. Per il rinnovo
// valgono le condizioni mostrate al checkout e nell'account: un contratto
// Shopify non prova da solo l'esecuzione degli addebiti da un'app esterna.
//
// EN e IT sono complete; es/fr/ru ricadono su EN come il resto della copy v3.

export type FaqItem = readonly [question: string, answer: string];

export const HOME_FAQ = {
  en: [
    [
      "Is billing monthly or annual, and what happens if I cancel?",
      "Base and Pro offer monthly or annual access. Check the renewal conditions shown at checkout and in your account, including any automatic charges and how to manage them. Crypto purchases provide 30 days of access through a separate payment. Contact support if the conditions are unclear before buying.",
    ],
    [
      "What exactly is in a reading, and what does Pro’s deep analysis add?",
      "A reading compares market-implied probability with the model estimate, their gap and the available reasoning. The prospective ledger records published picks with timestamps; the historical record also includes reconstructed or regraded entries and should not be treated as entirely unchanged pre-match evidence. Pro deep analysis adds available factors such as form, expected goals, Elo, serve and return, head-to-head and surface.",
    ],
    [
      "Which sports and markets does BetRedge cover?",
      "Football and tennis. In football the reading is on the match result (home, draw, away); in tennis on the match winner. Coverage follows the competitions on the board each day and is listed there — no other sports for now.",
    ],
    [
      "What does “live” mean in practice?",
      "Live refers to scores and match status updating during play. The model probabilities are pre-match estimates frozen for the event; they do not recalculate from the live score, elapsed time or momentum. Nothing is placed or executed for you.",
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
      "Base e Pro offrono accesso mensile o annuale. Controlla le condizioni di rinnovo mostrate al checkout e nel tuo account, inclusi eventuali addebiti automatici e come gestirli. Gli acquisti in crypto danno 30 giorni di accesso con un pagamento separato. Se le condizioni non sono chiare, contatta il supporto prima di acquistare.",
    ],
    [
      "Cosa c’è esattamente in una lettura, e cosa aggiunge la deep analysis di Pro?",
      "Una lettura confronta la probabilità implicita del mercato con la stima del modello, il loro scarto e il ragionamento disponibile. Il registro prospettico conserva le pick pubblicate con timestamp; lo storico comprende anche voci ricostruite o riclassificate e non equivale interamente a prove pre-partita rimaste immutate. La deep analysis di Pro aggiunge i fattori disponibili, come forma, gol attesi, Elo, servizio e risposta, scontri diretti e superficie.",
    ],
    [
      "Quali sport e mercati copre BetRedge?",
      "Calcio e tennis. Nel calcio la lettura è sull’esito della partita (1, X, 2); nel tennis sul vincitore del match. La copertura segue le competizioni presenti sul board ogni giorno ed è elencata lì — per ora nessun altro sport.",
    ],
    [
      "Cosa significa «live» in pratica?",
      "Live indica punteggi e stato della partita aggiornati durante il gioco. Le probabilità del modello sono stime pre-partita congelate per l’evento: non vengono ricalcolate da punteggio live, minuto o inerzia. Nulla viene piazzato o eseguito per te.",
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
