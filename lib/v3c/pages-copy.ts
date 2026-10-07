// lib/v3c/pages-copy.ts (#REDESIGN-V3C · filone pages)
// La copy di News · Books · Pro · Metodo e del paywall «why». EN è la fonte, IT è
// completa; le altre nove lingue ricadono sull'inglese (F10 le completa, chiavi in
// docs/redesign/v3c-pages-i18n-keys.md). ≤22 parole per elemento.
// Lessico (POSITIONING §2): market · estimate · gap (in points) · sealed · record ·
// explain. Mai: beat the market, ROI, CLV, hit rate, guaranteed, lock, sure win.
// Nessun numero qui dentro: prezzi e conteggi arrivano dalle fonti (commercial-plan,
// board, catalogo partner) come argomenti.
import { v3cLang, type V3cLang } from "./copy";

export type PagesLang = V3cLang;

const EN = {
  pricing: {
    tab: "Plans · two, no trial tricks",
    title: "Free shows the gap. Pro shows why.",
    metaStrong: (monthly: string) => `Pro ${monthly} a month`,
    metaRest: "Prices in USD. The card subscription is cancelled from your account.",
    freeName: "Free",
    freeLede: "The whole reading, free.",
    proName: "Pro",
    proLede: "The why behind the number, and more depth.",
    perMonth: "/ month",
    perYear: (annual: string) => `· ${annual} a year`,
    included: "Included",
    pro: "Pro",
    notLive: "Not live yet",
    free: [
      ["Today’s board", "every match: market, estimate and the signed gap"],
      ["The record", "every sealed estimate, won and lost"],
      ["Price check and 11 tools", "no account needed"],
      ["Watchlist", "the matches you follow, saved on this device"],
    ] as [string, string][],
    freeSoon: ["Alerts and bet tracker", "planned for Free; not live yet"] as [string, string],
    proItems: [
      ["Why the model disagrees", "each factor behind the estimate: form, venue, goals"],
      ["Full line movement", "every stored price since the market opened"],
      ["Live probabilities", "the estimate updates during the match"],
      ["Probability view", "combine markets on one match, model against market"],
      ["Weekly Model Case", "a worked example of how the model reads a week; not a bet to place"],
    ] as [string, string][],
    everythingFree: "Everything in Free",
    freeCta: "Create a free account",
    proCta: "Go Pro",
    railCard: "Card: a subscription that renews monthly; cancel it from your account.",
    railCardAnnual: "Yearly by card: renews every 12 months.",
    railCrypto: "Crypto: one payment for 30 days, no renewal.",
    railPaypal: "PayPal: available at checkout.",
    railUsdt: "USDT (TRC20) transfer: one payment, checked by hand.",
    withdrawal: "Before paying you confirm that Pro starts at once, which ends the 14-day withdrawal right.",
    promo: (until: string) => `Launch offer: the first purchase is half price until ${until}. It applies at checkout.`,
    sameStrong: "Same in both:",
    same: "every price, estimate, gap and the whole record. Pro never hides a number Free shows; it adds the why.",
    anatomyTitle: "What Pro opens on a match",
    anatomyLede: "Factor titles are visible to everyone. The first is explained in Free; the rest open with Pro.",
    anatomyNever: "Never shown when estimate and market agree (gap under 1.5 points).",
    fine: "Analysis, not advice. 18+. BetRedge is not a bookmaker and takes no bets.",
  },
  paywall: {
    lab: "Pro · the why",
    title: "Unlock why the model disagrees",
    lede: "See the factors that move our estimate away from the market price on this match. Analysis only, not advice. 18+.",
    blend: "Football estimates start from the market (70%); the model moves them (30%).",
    open: "Open in Free",
    closed: "Opens with Pro",
    cta: (price: string) => `See Pro · ${price}/month`,
    cancel: "Cancel the card subscription anytime from your account.",
    factorKinds: [
      ["Form", "Recent results of both sides, counted, not weighted by feeling."],
      ["Venue", "Home and away records this season, and how far apart they are."],
      ["Goals", "Expected goals for and against, where the data exists."],
    ] as [string, string][],
    example: "Layout example: titles only, no match data.",
  },
  news: {
    tab: "News · guides and match notes",
    tabOff: "News · guides", // final2: tab with the live notes off (only our guides)
    title: "What moves a price",
    metaStrong: (n: number) => (n === 1 ? "1 article" : `${n} articles`),
    metaRest: "written by us; numbers explained, no picks",
    guide: "Guide",
    read: "Read",
    minutes: (m: number) => `${m} min read`,
    empty: "No articles published yet.",
    emptySub: "The board is live meanwhile.",
    toolsTitle: "The arithmetic, done for you",
    toolsBody: "Implied probability, margin, EV and Kelly: eleven free calculators.",
    toolsLink: "Open the tools",
    back: "All articles",
    crumb: "News",
    published: "Published",
    responsible: "18+. Probabilities are estimates and no outcome is certain. If gambling stops being fun, help is at",
  },
  books: {
    tab: "Books · partners",
    title: "Every partner, on equal footing",
    metaStrong: (n: number) => (n === 1 ? "1 partner" : `${n} partners`),
    metaRest: "listed A–Z · prices only from connected books",
    filterLabel: "Filter partners",
    all: "All",
    sportsbooks: "Sportsbooks",
    casinos: "Casinos",
    search: "Search by name",
    none: "No partner matches that name.",
    shown: (n: number, total: number) => `${n} of ${total} shown`,
    order: "Alphabetical order. Same card, same button for every partner.",
    typeSportsbook: "Sportsbook",
    typeCasino: "Casino and more",
    pricesLab: "Prices",
    live: "Live prices on the board",
    siteOdds: "Odds on partner site",
    where: "Where",
    everywhere: "Every country where we show partners",
    onlyIn: (list: string) => `Only in ${list}`,
    localLink: (list: string) => `Local sign-up link in ${list}`,
    goTo: (name: string) => `Go to ${name}`,
    affiliate: "Affiliate link",
    compareTitle: "Today’s prices, side by side",
    compareSub: "Lead outcome of each match, connected books only, margin included.",
    compareMatch: "Match · outcome",
    compareBest: "Best",
    compareChecked: (t: string) => `Checked ${t}. Prices move; the book’s price at click is what counts.`,
    compareNone: "No connected prices right now. The board shows them as soon as a book has one.",
    respTitle: "If you bet, set your limits first.",
    respBody: "Set a deposit limit at the book before your first bet. Free, confidential help:",
    blockedTitle: "Not available in your region",
    blockedBody: "Partner books aren’t shown from your location. The board and the tools work as usual.",
    blockedBack: "Back to the board",
    fine: "18+. Partner links are commercial affiliates. BetRedge is not a bookmaker and takes no bets.",
  },
  method: {
    tab: "Method · one screen",
    title: "How we read a price",
    metaStrong: "Four ideas",
    metaRest: "every number on BetRedge rests on them",
    more: (what: string) => `More on ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "The blend 70 / 30",
        body: "Our football estimate is 70% the market’s price and 30% our model. The market leads; the model nudges.",
        detail: "Tennis differs: no estimate of ours there, only the market price with the margin removed.",
        market: "market",
        model: "model",
      },
      seal: {
        k: "02",
        title: "The seal",
        body: "Before kick-off each estimate is stored with its time. After that it cannot be edited.",
        detail: "The record reads only sealed rows. Wins and losses both stay; nothing is removed after the result.",
        label: "sealed",
      },
      gap: {
        k: "03",
        title: "The gap",
        body: "Gap = our estimate minus the market’s, in points. We show negative gaps too.",
        detail: "Under 1.5 points we write “in line”. A gap is a disagreement, not a promise of profit.",
        market: "market",
        estimate: "estimate",
        gap: "gap",
      },
      not: {
        k: "04",
        title: "What we don’t say",
        body: "No claims of outguessing the market, no profit figures, no picks.",
        line: "A 48% estimate expects to be wrong 52 times in 100.",
        detail: "Analysis, not advice. BetRedge is not a bookmaker and takes no bets. 18+.",
      },
    },
    board: "See today’s board",
    record: "Open the record",
    tools: "Try the tools",
  },
};

export type PagesCopy = typeof EN;

const IT: PagesCopy = {
  pricing: {
    tab: "Piani · due, senza trucchi",
    title: "Free mostra il gap. Pro spiega perché.",
    metaStrong: (monthly: string) => `Pro ${monthly} al mese`,
    metaRest: "Prezzi in USD. L’abbonamento con carta si disdice dal tuo account.",
    freeName: "Free",
    freeLede: "La lettura intera, gratis.",
    proName: "Pro",
    proLede: "Il perché dietro il numero, e più profondità.",
    perMonth: "/ mese",
    perYear: (annual: string) => `· ${annual} l’anno`,
    included: "Incluso",
    pro: "Pro",
    notLive: "Non ancora attivo",
    free: [
      ["La board di oggi", "ogni partita: mercato, stima e gap con segno"],
      ["Il registro", "ogni stima sigillata, vinte e perse"],
      ["Price check e 11 tool", "senza account"],
      ["Watchlist", "le partite che segui, salvate su questo dispositivo"],
    ],
    freeSoon: ["Alert e tracker delle giocate", "previsti in Free; non ancora attivi"],
    proItems: [
      ["Perché il modello non è d’accordo", "ogni fattore dietro la stima: forma, campo, gol"],
      ["Movimento di quota completo", "ogni prezzo salvato dall’apertura del mercato"],
      ["Probabilità live", "la stima si aggiorna durante la partita"],
      ["Probability view", "combina mercati su una partita, modello contro mercato"],
      ["Weekly Model Case", "un esempio di come il modello legge una settimana; non una giocata"],
    ],
    everythingFree: "Tutto quello che c’è in Free",
    freeCta: "Crea un account gratuito",
    proCta: "Passa a Pro",
    railCard: "Carta: abbonamento che si rinnova ogni mese; lo disdici dal tuo account.",
    railCardAnnual: "Annuale con carta: si rinnova ogni 12 mesi.",
    railCrypto: "Crypto: un pagamento per 30 giorni, senza rinnovo.",
    railPaypal: "PayPal: disponibile al checkout.",
    railUsdt: "Bonifico USDT (TRC20): un pagamento, verificato a mano.",
    withdrawal: "Prima di pagare confermi che Pro parte subito, cosa che fa cadere il recesso di 14 giorni.",
    promo: (until: string) => `Offerta di lancio: il primo acquisto è a metà prezzo fino al ${until}. Si applica al checkout.`,
    sameStrong: "Uguale in entrambi:",
    same: "ogni prezzo, stima, gap e l’intero registro. Pro non nasconde nessun numero che Free mostra; aggiunge il perché.",
    anatomyTitle: "Cosa apre Pro su una partita",
    anatomyLede: "I titoli dei fattori li vedono tutti. Il primo è spiegato in Free; gli altri si aprono con Pro.",
    anatomyNever: "Mai mostrato quando stima e mercato coincidono (gap sotto 1,5 punti).",
    fine: "Analisi, non consigli. 18+. BetRedge non è un bookmaker e non accetta scommesse.",
  },
  paywall: {
    lab: "Pro · il perché",
    title: "Scopri perché il modello non è d’accordo",
    lede: "Vedi i fattori che allontanano la nostra stima dal prezzo di mercato su questa partita. Solo analisi, non consigli. 18+.",
    blend: "Nel calcio la stima parte dal mercato (70%); il modello la sposta (30%).",
    open: "Aperto in Free",
    closed: "Si apre con Pro",
    cta: (price: string) => `Vedi Pro · ${price}/mese`,
    cancel: "L’abbonamento con carta si disdice quando vuoi dal tuo account.",
    factorKinds: [
      ["Forma", "I risultati recenti delle due squadre, contati, non pesati a sensazione."],
      ["Campo", "Rendimento in casa e in trasferta in stagione, e quanto distano."],
      ["Gol", "Gol attesi fatti e subiti, dove il dato esiste."],
    ],
    example: "Esempio di impaginazione: solo titoli, nessun dato di partita.",
  },
  news: {
    tab: "News · guide e note partita",
    tabOff: "News · guide",
    title: "Cosa muove un prezzo",
    metaStrong: (n: number) => (n === 1 ? "1 articolo" : `${n} articoli`),
    metaRest: "scritti da noi; numeri spiegati, niente pronostici",
    guide: "Guida",
    read: "Leggi",
    minutes: (m: number) => `${m} min di lettura`,
    empty: "Nessun articolo pubblicato per ora.",
    emptySub: "Intanto la board è live.",
    toolsTitle: "I conti, fatti per te",
    toolsBody: "Probabilità implicita, margine, EV e Kelly: undici calcolatori gratuiti.",
    toolsLink: "Apri i tool",
    back: "Tutti gli articoli",
    crumb: "News",
    published: "Pubblicato",
    responsible: "18+. Le probabilità sono stime e nessun esito è certo. Se il gioco smette di divertire, aiuto su",
  },
  books: {
    tab: "Book · partner",
    title: "Tutti i partner, alla pari",
    metaStrong: (n: number) => (n === 1 ? "1 partner" : `${n} partner`),
    metaRest: "in ordine A–Z · prezzi solo dai book connessi",
    filterLabel: "Filtra i partner",
    all: "Tutti",
    sportsbooks: "Sportsbook",
    casinos: "Casinò",
    search: "Cerca per nome",
    none: "Nessun partner con questo nome.",
    shown: (n: number, total: number) => `${n} di ${total} mostrati`,
    order: "Ordine alfabetico. Stessa scheda, stesso bottone per ogni partner.",
    typeSportsbook: "Sportsbook",
    typeCasino: "Casinò e altro",
    pricesLab: "Prezzi",
    live: "Prezzi live sulla board",
    siteOdds: "Quote sul sito del partner",
    where: "Dove",
    everywhere: "Ogni paese in cui mostriamo i partner",
    onlyIn: (list: string) => `Solo in ${list}`,
    localLink: (list: string) => `Link di registrazione locale in ${list}`,
    goTo: (name: string) => `Vai su ${name}`,
    affiliate: "Link affiliato",
    compareTitle: "I prezzi di oggi, fianco a fianco",
    compareSub: "Esito guida di ogni partita, solo book collegati, margine incluso.",
    compareMatch: "Partita · esito",
    compareBest: "Migliore",
    compareChecked: (t: string) => `Controllato alle ${t}. I prezzi si muovono; conta quello del book al clic.`,
    compareNone: "Nessun prezzo collegato ora. La board li mostra appena un book ne ha uno.",
    respTitle: "Se scommetti, fissa prima i tuoi limiti.",
    respBody: "Imposta un limite di deposito sul book prima della prima giocata. Aiuto gratuito e riservato:",
    blockedTitle: "Non disponibile nella tua area",
    blockedBody: "I book partner non sono mostrati dalla tua posizione. Board e tool funzionano come sempre.",
    blockedBack: "Torna alla board",
    fine: "18+. I link ai partner sono affiliazioni commerciali. BetRedge non è un bookmaker e non accetta scommesse.",
  },
  method: {
    tab: "Metodo · una schermata",
    title: "Come leggiamo un prezzo",
    metaStrong: "Quattro idee",
    metaRest: "ogni numero di BetRedge poggia su queste",
    more: (what: string) => `Di più su ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "Il blend 70 / 30",
        body: "La nostra stima nel calcio è 70% prezzo di mercato e 30% modello. Il mercato guida; il modello sposta.",
        detail: "Nel tennis è diverso: nessuna nostra stima, solo il prezzo di mercato senza margine.",
        market: "mercato",
        model: "modello",
      },
      seal: {
        k: "02",
        title: "Il sigillo",
        body: "Prima del calcio d’inizio ogni stima è salvata con la sua ora. Da lì non si può più modificare.",
        detail: "Il registro legge solo righe sigillate. Vinte e perse restano; dopo il risultato non si toglie nulla.",
        label: "sigillata",
      },
      gap: {
        k: "03",
        title: "Il gap",
        body: "Gap = nostra stima meno quella del mercato, in punti. Mostriamo anche i gap negativi.",
        detail: "Sotto 1,5 punti scriviamo «in linea». Un gap è un disaccordo, non una promessa di guadagno.",
        market: "mercato",
        estimate: "stima",
        gap: "gap",
      },
      not: {
        k: "04",
        title: "Cosa non diciamo",
        body: "Nessuna pretesa di saperne più del mercato, nessuna cifra di guadagno, nessun pronostico.",
        line: "Una stima al 48% si aspetta di sbagliare 52 volte su 100.",
        detail: "Analisi, non consigli. BetRedge non è un bookmaker e non accetta scommesse. 18+.",
      },
    },
    board: "Vedi la board di oggi",
    record: "Apri il registro",
    tools: "Prova i tool",
  },
};

const DE: PagesCopy = {
  pricing: {
    tab: "Pläne · zwei, ohne Test-Tricks", // REVIEW-NATIVE
    title: "Free zeigt den Abstand. Pro zeigt das Warum.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} pro Monat`, // REVIEW-NATIVE
    metaRest: "Preise in USD. Das Kartenabo kündigst du in deinem Konto.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "Die ganze Analyse, kostenlos.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Das Warum hinter der Zahl, und mehr Tiefe.", // REVIEW-NATIVE
    perMonth: "/ Monat", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} pro Jahr`, // REVIEW-NATIVE
    included: "Enthalten", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Noch nicht verfügbar", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Das Board von heute", "jedes Spiel: Markt, Schätzung und der Abstand mit Vorzeichen"],
      ["Das Register", "jede versiegelte Schätzung, gewonnen und verloren"],
      ["Quoten-Check und 11 Tools", "kein Konto nötig"],
      ["Merkliste", "die Spiele, denen du folgst, auf diesem Gerät gespeichert"],
    ] as [string, string][],
    freeSoon: ["Alerts und Wett-Tracker", "für Free geplant; noch nicht verfügbar"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Warum das Modell abweicht", "jeder Faktor hinter der Schätzung: Form, Spielort, Tore"],
      ["Voller Quotenverlauf", "jede gespeicherte Quote seit Marktöffnung"],
      ["Live-Wahrscheinlichkeiten", "die Schätzung aktualisiert sich während des Spiels"],
      ["Wahrscheinlichkeitsansicht", "Märkte eines Spiels kombinieren, Modell gegen Markt"],
      ["Weekly Model Case", "ein durchgerechnetes Beispiel, wie das Modell eine Woche liest; keine Wettempfehlung"],
    ] as [string, string][],
    everythingFree: "Alles aus Free", // REVIEW-NATIVE
    freeCta: "Kostenloses Konto erstellen", // REVIEW-NATIVE
    proCta: "Pro holen", // REVIEW-NATIVE
    railCard: "Karte: ein Abo, das sich monatlich verlängert; kündbar in deinem Konto.", // REVIEW-NATIVE
    railCardAnnual: "Jährlich per Karte: verlängert sich alle 12 Monate.", // REVIEW-NATIVE
    railCrypto: "Krypto: eine Zahlung für 30 Tage, keine Verlängerung.", // REVIEW-NATIVE
    railPaypal: "PayPal: an der Kasse verfügbar.", // REVIEW-NATIVE
    railUsdt: "USDT-Überweisung (TRC20): eine Zahlung, manuell geprüft.", // REVIEW-NATIVE
    withdrawal: "Vor der Zahlung bestätigst du, dass Pro sofort startet; damit erlischt das 14-tägige Widerrufsrecht.", // REVIEW-NATIVE
    promo: (until: string) => `Startangebot: Der erste Kauf kostet bis ${until} die Hälfte. Gilt an der Kasse.`, // REVIEW-NATIVE
    sameStrong: "In beiden gleich:", // REVIEW-NATIVE
    same: "jede Quote, Schätzung, jeder Abstand und das ganze Register. Pro versteckt keine Zahl, die Free zeigt; es ergänzt das Warum.", // REVIEW-NATIVE
    anatomyTitle: "Was Pro bei einem Spiel öffnet", // REVIEW-NATIVE
    anatomyLede: "Die Faktortitel sieht jeder. Der erste wird in Free erklärt; die anderen öffnen sich mit Pro.", // REVIEW-NATIVE
    anatomyNever: "Nie angezeigt, wenn Schätzung und Markt übereinstimmen (Abstand unter 1.5 Punkten).", // REVIEW-NATIVE
    fine: "Analyse, keine Beratung. 18+. BetRedge ist kein Buchmacher und nimmt keine Wetten an.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · das Warum", // REVIEW-NATIVE
    title: "Sieh, warum das Modell abweicht", // REVIEW-NATIVE
    lede: "Sieh die Faktoren, die unsere Schätzung bei diesem Spiel von der Marktquote wegbewegen. Nur Analyse, keine Beratung. 18+.", // REVIEW-NATIVE
    blend: "Fußball-Schätzungen starten beim Markt (70%); das Modell verschiebt sie (30%).", // REVIEW-NATIVE
    open: "Offen in Free", // REVIEW-NATIVE
    closed: "Öffnet mit Pro", // REVIEW-NATIVE
    cta: (price: string) => `Pro ansehen · ${price}/Monat`, // REVIEW-NATIVE
    cancel: "Das Kartenabo kannst du jederzeit in deinem Konto kündigen.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Form", "Letzte Ergebnisse beider Teams, gezählt, nicht nach Gefühl gewichtet."],
      ["Spielort", "Heim- und Auswärtsbilanz dieser Saison, und wie weit sie auseinanderliegen."],
      ["Tore", "Erwartete Tore für und gegen, wo es Daten gibt."],
    ] as [string, string][],
    example: "Layout-Beispiel: nur Titel, keine Spieldaten.", // REVIEW-NATIVE
  },
  news: {
    tab: "News · Guides und Spielnotizen",
    tabOff: "News · Guides",
    title: "Was eine Quote bewegt",
    metaStrong: (n: number) => (n === 1 ? "1 Artikel" : `${n} Artikel`),
    metaRest: "von uns geschrieben; Zahlen erklärt, keine Tipps",
    guide: "Guide",
    read: "Lesen",
    minutes: (m: number) => `${m} Min. Lesezeit`,
    empty: "Noch keine Artikel veröffentlicht.",
    emptySub: "Das Board ist inzwischen live.",
    toolsTitle: "Die Rechnerei, für dich erledigt",
    toolsBody: "Implizite Wahrscheinlichkeit, Marge, EV und Kelly: elf kostenlose Rechner.",
    toolsLink: "Tools öffnen",
    back: "Alle Artikel",
    crumb: "News",
    published: "Veröffentlicht",
    responsible: "18+. Wahrscheinlichkeiten sind Schätzungen, kein Ausgang ist sicher. Wenn Spielen keinen Spaß mehr macht, Hilfe gibt es bei", // REVIEW-NATIVE
  },
  books: {
    tab: "Buchmacher · Partner",
    title: "Alle Partner, gleichberechtigt",
    metaStrong: (n: number) => `${n} Partner`,
    metaRest: "von A bis Z · Quoten nur von verbundenen Buchmachern",
    filterLabel: "Partner filtern",
    all: "Alle",
    sportsbooks: "Sportwetten",
    casinos: "Casinos",
    search: "Nach Namen suchen",
    none: "Kein Partner mit diesem Namen.",
    shown: (n: number, total: number) => `${n} von ${total} angezeigt`,
    order: "Alphabetische Reihenfolge. Gleiche Karte, gleicher Button für jeden Partner.",
    typeSportsbook: "Sportwetten",
    typeCasino: "Casino und mehr",
    pricesLab: "Quoten",
    live: "Live-Quoten auf dem Board",
    siteOdds: "Quoten auf der Partnerseite",
    where: "Wo",
    everywhere: "Jedes Land, in dem wir Partner zeigen",
    onlyIn: (list: string) => `Nur in ${list}`,
    localLink: (list: string) => `Lokaler Anmeldelink in ${list}`,
    goTo: (name: string) => `Zu ${name}`,
    affiliate: "Affiliate-Link", // REVIEW-NATIVE
    compareTitle: "Die Quoten von heute, nebeneinander",
    compareSub: "Hauptausgang jedes Spiels, nur verbundene Buchmacher, Marge inklusive.",
    compareMatch: "Spiel · Ausgang",
    compareBest: "Beste",
    compareChecked: (t: string) => `Geprüft ${t}. Quoten bewegen sich; es zählt die Quote des Buchmachers beim Klick.`,
    compareNone: "Gerade keine verbundenen Quoten. Das Board zeigt sie, sobald ein Buchmacher eine hat.",
    respTitle: "Wenn du wettest, setz zuerst deine Limits.", // REVIEW-NATIVE
    respBody: "Setz vor deiner ersten Wette ein Einzahlungslimit beim Buchmacher. Kostenlose, vertrauliche Hilfe:", // REVIEW-NATIVE
    blockedTitle: "In deiner Region nicht verfügbar", // REVIEW-NATIVE
    blockedBody: "Partner-Buchmacher werden an deinem Standort nicht angezeigt. Board und Tools funktionieren wie gewohnt.", // REVIEW-NATIVE
    blockedBack: "Zurück zum Board",
    fine: "18+. Partnerlinks sind kommerzielle Affiliate-Links. BetRedge ist kein Buchmacher und nimmt keine Wetten an.", // REVIEW-NATIVE
  },
  method: {
    tab: "Methode · ein Bildschirm",
    title: "Wie wir eine Quote lesen",
    metaStrong: "Vier Ideen",
    metaRest: "jede Zahl auf BetRedge beruht auf ihnen",
    more: (what: string) => `Mehr zu ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "Der Mix 70 / 30",
        body: "Unsere Fußball-Schätzung ist zu 70% die Marktquote und zu 30% unser Modell. Der Markt führt; das Modell korrigiert.",
        detail: "Tennis ist anders: dort keine eigene Schätzung, nur die Marktquote ohne Marge.",
        market: "Markt",
        model: "Modell",
      },
      seal: {
        k: "02",
        title: "Das Siegel",
        body: "Vor dem Anstoß wird jede Schätzung mit ihrer Uhrzeit gespeichert. Danach lässt sie sich nicht mehr ändern.",
        detail: "Das Register liest nur versiegelte Zeilen. Gewinne und Verluste bleiben; nach dem Ergebnis wird nichts entfernt.",
        label: "versiegelt",
      },
      gap: {
        k: "03",
        title: "Der Abstand",
        body: "Abstand = unsere Schätzung minus die des Markts, in Punkten. Wir zeigen auch negative Abstände.",
        detail: "Unter 1.5 Punkten schreiben wir „im Einklang“. Ein Abstand ist eine Meinungsverschiedenheit, kein Gewinnversprechen.",
        market: "Markt",
        estimate: "Schätzung",
        gap: "Abstand",
      },
      not: {
        k: "04",
        title: "Was wir nicht sagen",
        body: "Keine Behauptung, den Markt zu überlisten, keine Gewinnzahlen, keine Tipps.",
        line: "Eine Schätzung von 48% rechnet damit, 52 von 100 Mal falsch zu liegen.",
        detail: "Analyse, keine Beratung. BetRedge ist kein Buchmacher und nimmt keine Wetten an. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Board von heute ansehen",
    record: "Register öffnen",
    tools: "Tools ausprobieren",
  },
};

const ES: PagesCopy = {
  pricing: {
    tab: "Planes · dos, sin trucos de prueba", // REVIEW-NATIVE
    title: "Free te enseña la diferencia. Pro te explica por qué.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} al mes`, // REVIEW-NATIVE
    metaRest: "Precios en USD. La suscripción con tarjeta se cancela desde tu cuenta.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "La lectura completa, gratis.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "El porqué detrás del número, y más profundidad.", // REVIEW-NATIVE
    perMonth: "/ mes", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} al año`, // REVIEW-NATIVE
    included: "Incluido", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Aún no disponible", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["El tablero de hoy", "cada partido: mercado, estimación y la diferencia con signo"],
      ["El registro", "cada estimación sellada, acertada o fallada"],
      ["Comprobar cuota y 11 herramientas", "sin necesidad de cuenta"],
      ["Lista de seguimiento", "los partidos que sigues, guardados en este dispositivo"],
    ] as [string, string][],
    freeSoon: ["Alertas y registro de apuestas", "previstos para Free; aún no disponibles"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Por qué el modelo discrepa", "cada factor detrás de la estimación: forma, campo, goles"],
      ["Movimiento de cuotas completo", "cada cuota guardada desde que abrió el mercado"],
      ["Probabilidades en directo", "la estimación se actualiza durante el partido"],
      ["Vista de probabilidad", "combina mercados de un partido, modelo frente a mercado"],
      ["Caso semanal del modelo", "un ejemplo práctico de cómo el modelo lee una semana; no es una apuesta a realizar"],
    ] as [string, string][],
    everythingFree: "Todo lo de Free", // REVIEW-NATIVE
    freeCta: "Crea una cuenta gratis", // REVIEW-NATIVE
    proCta: "Hazte Pro", // REVIEW-NATIVE
    railCard: "Tarjeta: una suscripción que se renueva cada mes; cancélala desde tu cuenta.", // REVIEW-NATIVE
    railCardAnnual: "Anual con tarjeta: se renueva cada 12 meses.", // REVIEW-NATIVE
    railCrypto: "Cripto: un único pago por 30 días, sin renovación.", // REVIEW-NATIVE
    railPaypal: "PayPal: disponible al pagar.", // REVIEW-NATIVE
    railUsdt: "Transferencia USDT (TRC20): un único pago, verificado a mano.", // REVIEW-NATIVE
    withdrawal: "Antes de pagar confirmas que Pro empieza de inmediato, lo que pone fin al derecho de desistimiento de 14 días.", // REVIEW-NATIVE
    promo: (until: string) => `Oferta de lanzamiento: la primera compra a mitad de precio hasta el ${until}. Se aplica al pagar.`, // REVIEW-NATIVE
    sameStrong: "Igual en los dos:", // REVIEW-NATIVE
    same: "cada cuota, estimación, diferencia y el registro entero. Pro nunca oculta un número que Free muestra; añade el porqué.", // REVIEW-NATIVE
    anatomyTitle: "Lo que Pro abre en un partido", // REVIEW-NATIVE
    anatomyLede: "Los títulos de los factores los ve todo el mundo. El primero se explica en Free; el resto se abre con Pro.", // REVIEW-NATIVE
    anatomyNever: "Nunca se muestra si estimación y mercado coinciden (diferencia inferior a 1,5 puntos).", // REVIEW-NATIVE
    fine: "Análisis, no consejos. 18+. BetRedge no es una casa de apuestas y no acepta apuestas.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · el porqué", // REVIEW-NATIVE
    title: "Descubre por qué el modelo discrepa", // REVIEW-NATIVE
    lede: "Mira los factores que alejan nuestra estimación de la cuota del mercado en este partido. Solo análisis, no consejos. 18+.", // REVIEW-NATIVE
    blend: "Las estimaciones de fútbol parten del mercado (70%); el modelo las mueve (30%).", // REVIEW-NATIVE
    open: "Abierto en Free", // REVIEW-NATIVE
    closed: "Se abre con Pro", // REVIEW-NATIVE
    cta: (price: string) => `Ver Pro · ${price}/mes`, // REVIEW-NATIVE
    cancel: "Cancela la suscripción con tarjeta cuando quieras desde tu cuenta.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Forma", "Resultados recientes de ambos equipos, contados, no ponderados a ojo."],
      ["Campo", "Rendimiento en casa y fuera esta temporada, y cuánto se separan."],
      ["Goles", "Goles esperados a favor y en contra, donde existen los datos."],
    ] as [string, string][],
    example: "Ejemplo de diseño: solo títulos, sin datos del partido.", // REVIEW-NATIVE
  },
  news: {
    tab: "Noticias · guías y notas de partido",
    tabOff: "Noticias · guías",
    title: "Qué mueve una cuota",
    metaStrong: (n: number) => (n === 1 ? "1 artículo" : `${n} artículos`),
    metaRest: "escritos por nosotros; números explicados, sin pronósticos",
    guide: "Guía",
    read: "Leer",
    minutes: (m: number) => `${m} min de lectura`,
    empty: "Aún no hay artículos publicados.",
    emptySub: "Mientras tanto, el tablero está activo.",
    toolsTitle: "La aritmética, hecha por ti",
    toolsBody: "Probabilidad implícita, margen, EV y Kelly: once calculadoras gratuitas.",
    toolsLink: "Abrir las herramientas",
    back: "Todos los artículos",
    crumb: "Noticias",
    published: "Publicado",
    responsible: "18+. Las probabilidades son estimaciones y ningún resultado es seguro. Si apostar deja de ser divertido, hay ayuda en", // REVIEW-NATIVE
  },
  books: {
    tab: "Casas · socios",
    title: "Todos los partners, en pie de igualdad",
    metaStrong: (n: number) => (n === 1 ? "1 partner" : `${n} partners`),
    metaRest: "de la A a la Z · cuotas solo de casas conectadas",
    filterLabel: "Filtrar partners",
    all: "Todos",
    sportsbooks: "Casas de apuestas",
    casinos: "Casinos",
    search: "Buscar por nombre",
    none: "Ningún partner con ese nombre.",
    shown: (n: number, total: number) => `${n} de ${total} mostrados`,
    order: "Orden alfabético. Misma ficha y mismo botón para cada partner.",
    typeSportsbook: "Casa de apuestas",
    typeCasino: "Casino y más",
    pricesLab: "Cuotas",
    live: "Cuotas en directo en el tablero",
    siteOdds: "Cuotas en la web del socio",
    where: "Dónde",
    everywhere: "Todos los países donde mostramos socios",
    onlyIn: (list: string) => `Solo en ${list}`,
    localLink: (list: string) => `Enlace de registro local en ${list}`,
    goTo: (name: string) => `Ir a ${name}`,
    affiliate: "Enlace de afiliado", // REVIEW-NATIVE
    compareTitle: "Las cuotas de hoy, lado a lado",
    compareSub: "Resultado principal de cada partido, solo casas conectadas, margen incluido.",
    compareMatch: "Partido · resultado",
    compareBest: "Mejor",
    compareChecked: (t: string) => `Comprobado a las ${t}. Las cuotas se mueven; cuenta la cuota de la casa al hacer clic.`,
    compareNone: "Ahora no hay cuotas conectadas. El tablero las muestra en cuanto una casa tenga una.",
    respTitle: "Si apuestas, fija primero tus límites.", // REVIEW-NATIVE
    respBody: "Fija un límite de depósito en la casa antes de tu primera apuesta. Ayuda gratuita y confidencial:", // REVIEW-NATIVE
    blockedTitle: "No disponible en tu región", // REVIEW-NATIVE
    blockedBody: "Desde tu ubicación no se muestran las casas asociadas. El tablero y las herramientas funcionan con normalidad.", // REVIEW-NATIVE
    blockedBack: "Volver al tablero",
    fine: "18+. Los enlaces de socios son afiliaciones comerciales. BetRedge no es una casa de apuestas y no acepta apuestas.", // REVIEW-NATIVE
  },
  method: {
    tab: "Método · una pantalla",
    title: "Cómo leemos una cuota",
    metaStrong: "Cuatro ideas",
    metaRest: "cada número de BetRedge se apoya en ellas",
    more: (what: string) => `Más sobre ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "La mezcla 70 / 30",
        body: "Nuestra estimación de fútbol es un 70% la cuota del mercado y un 30% nuestro modelo. El mercado manda; el modelo matiza.",
        detail: "El tenis es distinto: allí no hay estimación propia, solo la cuota del mercado sin margen.",
        market: "mercado",
        model: "modelo",
      },
      seal: {
        k: "02",
        title: "El sello",
        body: "Antes del inicio, cada estimación se guarda con su hora. Después ya no se puede editar.",
        detail: "El registro solo lee filas selladas. Aciertos y fallos se quedan; nada se borra tras el resultado.",
        label: "sellado",
      },
      gap: {
        k: "03",
        title: "La diferencia",
        body: "Diferencia = nuestra estimación menos la del mercado, en puntos. También mostramos diferencias negativas.",
        detail: "Por debajo de 1,5 puntos escribimos «en línea». Una diferencia es un desacuerdo, no una promesa de beneficio.",
        market: "mercado",
        estimate: "estimación",
        gap: "diferencia",
      },
      not: {
        k: "04",
        title: "Lo que no decimos",
        body: "Nada de afirmar que adivinamos mejor que el mercado, ni cifras de beneficio, ni pronósticos.",
        line: "Una estimación del 48% cuenta con fallar 52 veces de cada 100.",
        detail: "Análisis, no consejos. BetRedge no es una casa de apuestas y no acepta apuestas. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Ver el tablero de hoy",
    record: "Abrir el registro",
    tools: "Probar las herramientas",
  },
};

const FR: PagesCopy = {
  pricing: {
    tab: "Formules · deux, sans piège d’essai", // REVIEW-NATIVE
    title: "Free montre l’écart. Pro montre pourquoi.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} par mois`, // REVIEW-NATIVE
    metaRest: "Prix en USD. L’abonnement par carte se résilie depuis votre compte.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "Toute la lecture, gratuitement.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Le pourquoi derrière le chiffre, et plus de profondeur.", // REVIEW-NATIVE
    perMonth: "/ mois", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} par an`, // REVIEW-NATIVE
    included: "Inclus", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Pas encore disponible", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Le tableau du jour", "chaque match : marché, estimation et écart signé"],
      ["Le registre", "chaque estimation scellée, gagnée ou perdue"],
      ["Vérifier la cote et 11 outils", "sans compte"],
      ["Liste de suivi", "les matchs que vous suivez, enregistrés sur cet appareil"],
    ] as [string, string][],
    freeSoon: ["Alertes et suivi des paris", "prévus pour Free ; pas encore disponibles"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Pourquoi le modèle n’est pas d’accord", "chaque facteur derrière l’estimation : forme, terrain, buts"],
      ["Mouvement des cotes complet", "chaque cote enregistrée depuis l’ouverture du marché"],
      ["Probabilités en direct", "l’estimation se met à jour pendant le match"],
      ["Vue des probabilités", "combinez les marchés d’un match, modèle contre marché"],
      ["Cas du modèle de la semaine", "un exemple détaillé de la lecture d’une semaine par le modèle ; pas un pari à placer"],
    ] as [string, string][],
    everythingFree: "Tout ce qu’offre Free", // REVIEW-NATIVE
    freeCta: "Créer un compte gratuit", // REVIEW-NATIVE
    proCta: "Passer à Pro", // REVIEW-NATIVE
    railCard: "Carte : un abonnement renouvelé chaque mois ; résiliez-le depuis votre compte.", // REVIEW-NATIVE
    railCardAnnual: "Annuel par carte : renouvelé tous les 12 mois.", // REVIEW-NATIVE
    railCrypto: "Crypto : un paiement pour 30 jours, sans renouvellement.", // REVIEW-NATIVE
    railPaypal: "PayPal : disponible au paiement.", // REVIEW-NATIVE
    railUsdt: "Virement USDT (TRC20) : un paiement, vérifié à la main.", // REVIEW-NATIVE
    withdrawal: "Avant de payer, vous confirmez que Pro démarre immédiatement, ce qui met fin au droit de rétractation de 14 jours.", // REVIEW-NATIVE
    promo: (until: string) => `Offre de lancement : le premier achat est à moitié prix jusqu’au ${until}. Elle s’applique au paiement.`, // REVIEW-NATIVE
    sameStrong: "Identique dans les deux :", // REVIEW-NATIVE
    same: "chaque cote, estimation, écart et tout le registre. Pro ne cache jamais un chiffre que Free montre ; il ajoute le pourquoi.", // REVIEW-NATIVE
    anatomyTitle: "Ce que Pro ouvre sur un match", // REVIEW-NATIVE
    anatomyLede: "Les titres des facteurs sont visibles par tous. Le premier est expliqué dans Free ; les autres s’ouvrent avec Pro.", // REVIEW-NATIVE
    anatomyNever: "Jamais affiché quand estimation et marché concordent (écart sous 1,5 point).", // REVIEW-NATIVE
    fine: "Analyse, pas des conseils. 18+. BetRedge n’est pas un bookmaker et ne prend aucun pari.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · le pourquoi", // REVIEW-NATIVE
    title: "Découvrez pourquoi le modèle n’est pas d’accord", // REVIEW-NATIVE
    lede: "Voyez les facteurs qui éloignent notre estimation de la cote du marché sur ce match. Analyse seulement, pas un conseil. 18+.", // REVIEW-NATIVE
    blend: "Les estimations football partent du marché (70 %) ; le modèle les ajuste (30 %).", // REVIEW-NATIVE
    open: "Ouvert dans Free", // REVIEW-NATIVE
    closed: "S’ouvre avec Pro", // REVIEW-NATIVE
    cta: (price: string) => `Voir Pro · ${price}/mois`, // REVIEW-NATIVE
    cancel: "Résiliez l’abonnement par carte à tout moment depuis votre compte.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Forme", "Résultats récents des deux équipes, comptés, pas pondérés au ressenti."],
      ["Terrain", "Bilans à domicile et à l’extérieur cette saison, et l’écart entre eux."],
      ["Buts", "Buts attendus pour et contre, là où les données existent."],
    ] as [string, string][],
    example: "Exemple de mise en page : titres seulement, aucune donnée de match.", // REVIEW-NATIVE
  },
  news: {
    tab: "Actus · guides et notes de match",
    tabOff: "Actus · guides",
    title: "Ce qui fait bouger une cote",
    metaStrong: (n: number) => (n === 1 ? "1 article" : `${n} articles`),
    metaRest: "écrits par nous ; chiffres expliqués, aucun pronostic",
    guide: "Guide",
    read: "Lire",
    minutes: (m: number) => `${m} min de lecture`,
    empty: "Aucun article publié pour l’instant.",
    emptySub: "Le tableau est en ligne en attendant.",
    toolsTitle: "Le calcul, fait pour vous",
    toolsBody: "Probabilité implicite, marge, EV et Kelly : onze calculateurs gratuits.",
    toolsLink: "Ouvrir les outils",
    back: "Tous les articles",
    crumb: "Actus",
    published: "Publié",
    responsible: "18+. Les probabilités sont des estimations et aucun résultat n’est certain. Si le jeu cesse d’être un plaisir, de l’aide existe :", // REVIEW-NATIVE
  },
  books: {
    tab: "Bookmakers · partenaires",
    title: "Tous les partenaires, sur un pied d’égalité",
    metaStrong: (n: number) => (n === 1 ? "1 partenaire" : `${n} partenaires`),
    metaRest: "de A à Z · des cotes seulement pour les bookmakers connectés",
    filterLabel: "Filtrer les partenaires",
    all: "Tous",
    sportsbooks: "Paris sportifs",
    casinos: "Casinos",
    search: "Rechercher par nom",
    none: "Aucun partenaire à ce nom.",
    shown: (n: number, total: number) => `${n} sur ${total} affichés`,
    order: "Ordre alphabétique. Même fiche, même bouton pour chaque partenaire.",
    typeSportsbook: "Paris sportifs",
    typeCasino: "Casino et plus",
    pricesLab: "Cotes",
    live: "Cotes en direct sur le tableau",
    siteOdds: "Cotes sur le site du partenaire",
    where: "Où",
    everywhere: "Tous les pays où nous affichons des partenaires",
    onlyIn: (list: string) => `Uniquement en ${list}`,
    localLink: (list: string) => `Lien d’inscription local en ${list}`,
    goTo: (name: string) => `Aller sur ${name}`,
    affiliate: "Lien affilié", // REVIEW-NATIVE
    compareTitle: "Les cotes du jour, côte à côte",
    compareSub: "Issue principale de chaque match, bookmakers connectés seulement, marge incluse.",
    compareMatch: "Match · issue",
    compareBest: "Meilleure",
    compareChecked: (t: string) => `Vérifié à ${t}. Les cotes bougent ; seule compte la cote du bookmaker au moment du clic.`,
    compareNone: "Aucune cote connectée pour le moment. Le tableau les affiche dès qu’un bookmaker en a une.",
    respTitle: "Si vous pariez, fixez d’abord vos limites.", // REVIEW-NATIVE
    respBody: "Fixez une limite de dépôt chez le bookmaker avant votre premier pari. Aide gratuite et confidentielle :", // REVIEW-NATIVE
    blockedTitle: "Non disponible dans votre région", // REVIEW-NATIVE
    blockedBody: "Les bookmakers partenaires ne sont pas affichés depuis votre localisation. Le tableau et les outils fonctionnent normalement.", // REVIEW-NATIVE
    blockedBack: "Retour au tableau",
    fine: "18+. Les liens partenaires sont des affiliations commerciales. BetRedge n’est pas un bookmaker et ne prend aucun pari.", // REVIEW-NATIVE
  },
  method: {
    tab: "Méthode · un écran",
    title: "Comment nous lisons une cote",
    metaStrong: "Quatre idées",
    metaRest: "chaque chiffre de BetRedge repose sur elles",
    more: (what: string) => `En savoir plus : ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "Le mélange 70 / 30",
        body: "Notre estimation football, c’est 70 % la cote du marché et 30 % notre modèle. Le marché mène ; le modèle ajuste.",
        detail: "Le tennis diffère : aucune estimation de notre part, seulement la cote du marché, marge retirée.",
        market: "marché",
        model: "modèle",
      },
      seal: {
        k: "02",
        title: "Le sceau",
        body: "Avant le coup d’envoi, chaque estimation est enregistrée avec son heure. Ensuite, elle ne peut plus être modifiée.",
        detail: "Le registre ne lit que les lignes scellées. Gains et pertes restent ; rien n’est retiré après le résultat.",
        label: "scellé",
      },
      gap: {
        k: "03",
        title: "L’écart",
        body: "Écart = notre estimation moins celle du marché, en points. Nous montrons aussi les écarts négatifs.",
        detail: "Sous 1,5 point, nous écrivons « en ligne ». Un écart est un désaccord, pas une promesse de profit.",
        market: "marché",
        estimate: "estimation",
        gap: "écart",
      },
      not: {
        k: "04",
        title: "Ce que nous ne disons pas",
        body: "Aucune prétention de deviner mieux que le marché, aucun chiffre de profit, aucun pronostic.",
        line: "Une estimation à 48 % s’attend à se tromper 52 fois sur 100.",
        detail: "Analyse, pas des conseils. BetRedge n’est pas un bookmaker et ne prend aucun pari. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Voir le tableau du jour",
    record: "Ouvrir le registre",
    tools: "Essayer les outils",
  },
};

const NL: PagesCopy = {
  pricing: {
    tab: "Abonnementen · twee, geen proeftrucs", // REVIEW-NATIVE
    title: "Free toont het verschil. Pro toont waarom.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} per maand`, // REVIEW-NATIVE
    metaRest: "Prijzen in USD. Het kaartabonnement zeg je op vanuit je account.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "De hele lezing, gratis.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Het waarom achter het getal, en meer diepgang.", // REVIEW-NATIVE
    perMonth: "/ maand", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} per jaar`, // REVIEW-NATIVE
    included: "Inbegrepen", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Nog niet live", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Het board van vandaag", "elke wedstrijd: markt, schatting en het verschil met teken"],
      ["Het register", "elke verzegelde schatting, gewonnen en verloren"],
      ["Odds-check en 11 tools", "geen account nodig"],
      ["Volglijst", "de wedstrijden die je volgt, bewaard op dit apparaat"],
    ] as [string, string][],
    freeSoon: ["Meldingen en wedtracker", "gepland voor Free; nog niet live"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Waarom het model het oneens is", "elke factor achter de schatting: vorm, thuis/uit, doelpunten"],
      ["Volledige oddsbeweging", "elke opgeslagen odd sinds de markt openging"],
      ["Live kansen", "de schatting wordt tijdens de wedstrijd bijgewerkt"],
      ["Kansweergave", "combineer markten binnen één wedstrijd, model tegenover markt"],
      ["Wekelijkse Model Case", "een uitgewerkt voorbeeld van hoe het model een week leest; geen wed om te plaatsen"],
    ] as [string, string][],
    everythingFree: "Alles uit Free", // REVIEW-NATIVE
    freeCta: "Maak een gratis account", // REVIEW-NATIVE
    proCta: "Neem Pro", // REVIEW-NATIVE
    railCard: "Kaart: een abonnement dat maandelijks verlengt; opzeggen doe je vanuit je account.", // REVIEW-NATIVE
    railCardAnnual: "Jaarlijks per kaart: verlengt elke 12 maanden.", // REVIEW-NATIVE
    railCrypto: "Crypto: één betaling voor 30 dagen, geen verlenging.", // REVIEW-NATIVE
    railPaypal: "PayPal: beschikbaar bij het afrekenen.", // REVIEW-NATIVE
    railUsdt: "USDT-overboeking (TRC20): één betaling, handmatig gecontroleerd.", // REVIEW-NATIVE
    withdrawal: "Voor het betalen bevestig je dat Pro direct start, waarmee het herroepingsrecht van 14 dagen vervalt.", // REVIEW-NATIVE
    promo: (until: string) => `Lanceringsaanbod: de eerste aankoop is half geprijsd tot ${until}. Wordt toegepast bij het afrekenen.`, // REVIEW-NATIVE
    sameStrong: "In beide hetzelfde:", // REVIEW-NATIVE
    same: "elke odd, schatting, elk verschil en het hele register. Pro verbergt nooit een getal dat Free toont; het voegt het waarom toe.", // REVIEW-NATIVE
    anatomyTitle: "Wat Pro opent bij een wedstrijd", // REVIEW-NATIVE
    anatomyLede: "De titels van de factoren ziet iedereen. De eerste wordt in Free uitgelegd; de rest opent met Pro.", // REVIEW-NATIVE
    anatomyNever: "Nooit getoond als schatting en markt overeenkomen (verschil onder 1,5 punten).", // REVIEW-NATIVE
    fine: "Analyse, geen advies. 18+. BetRedge is geen bookmaker en neemt geen weddenschappen aan.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · het waarom", // REVIEW-NATIVE
    title: "Ontgrendel waarom het model het oneens is", // REVIEW-NATIVE
    lede: "Zie de factoren die onze schatting bij deze wedstrijd van de marktodds wegtrekken. Alleen analyse, geen advies. 18+.", // REVIEW-NATIVE
    blend: "Voetbalschattingen beginnen bij de markt (70%); het model verschuift ze (30%).", // REVIEW-NATIVE
    open: "Opent in Free", // REVIEW-NATIVE
    closed: "Opent met Pro", // REVIEW-NATIVE
    cta: (price: string) => `Bekijk Pro · ${price}/maand`, // REVIEW-NATIVE
    cancel: "Zeg het kaartabonnement op elk moment op vanuit je account.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Vorm", "Recente resultaten van beide teams, geteld, niet op gevoel gewogen."],
      ["Thuis/uit", "Thuis- en uitresultaten dit seizoen, en hoe ver ze uiteenliggen."],
      ["Doelpunten", "Verwachte doelpunten voor en tegen, waar de data bestaat."],
    ] as [string, string][],
    example: "Voorbeeld van de opmaak: alleen titels, geen wedstrijddata.", // REVIEW-NATIVE
  },
  news: {
    tab: "Nieuws · gidsen en wedstrijdnotities",
    tabOff: "Nieuws · gidsen",
    title: "Wat een odd beweegt",
    metaStrong: (n: number) => (n === 1 ? "1 artikel" : `${n} artikelen`),
    metaRest: "door ons geschreven; getallen uitgelegd, geen picks",
    guide: "Gids",
    read: "Lezen",
    minutes: (m: number) => `${m} min lezen`,
    empty: "Nog geen artikelen gepubliceerd.",
    emptySub: "Het board is intussen live.",
    toolsTitle: "Het rekenwerk, voor je gedaan",
    toolsBody: "Impliciete kans, marge, EV en Kelly: elf gratis calculators.",
    toolsLink: "Open de tools",
    back: "Alle artikelen",
    crumb: "Nieuws",
    published: "Gepubliceerd",
    responsible: "18+. Kansen zijn schattingen en geen uitkomst is zeker. Is gokken niet leuk meer, dan vind je hulp bij", // REVIEW-NATIVE
  },
  books: {
    tab: "Bookmakers · partners", // REVIEW-NATIVE
    title: "Alle partners, op gelijke voet",
    metaStrong: (n: number) => (n === 1 ? "1 partner" : `${n} partners`),
    metaRest: "van A tot Z · odds alleen van gekoppelde bookmakers",
    filterLabel: "Partners filteren",
    all: "Alle",
    sportsbooks: "Bookmakers",
    casinos: "Casino’s",
    search: "Zoeken op naam",
    none: "Geen partner met die naam.",
    shown: (n: number, total: number) => `${n} van ${total} getoond`,
    order: "Alfabetische volgorde. Dezelfde kaart en dezelfde knop voor elke partner.",
    typeSportsbook: "Bookmaker",
    typeCasino: "Casino en meer",
    pricesLab: "Odds",
    live: "Live odds op het board",
    siteOdds: "Odds op de partnersite",
    where: "Waar",
    everywhere: "Elk land waar we partners tonen", // REVIEW-NATIVE
    onlyIn: (list: string) => `Alleen in ${list}`, // REVIEW-NATIVE
    localLink: (list: string) => `Lokale aanmeldlink in ${list}`, // REVIEW-NATIVE
    goTo: (name: string) => `Naar ${name}`,
    affiliate: "Affiliatelink", // REVIEW-NATIVE
    compareTitle: "De odds van vandaag, naast elkaar",
    compareSub: "Hoofduitkomst per wedstrijd, alleen gekoppelde bookmakers, marge inbegrepen.",
    compareMatch: "Wedstrijd · uitkomst",
    compareBest: "Beste",
    compareChecked: (t: string) => `Gecontroleerd ${t}. Odds bewegen; de odd bij de bookmaker op het moment van klikken telt.`,
    compareNone: "Nu geen gekoppelde odds. Het board toont ze zodra een bookmaker er een heeft.",
    respTitle: "Wed je, stel dan eerst je limieten in.", // REVIEW-NATIVE
    respBody: "Stel een stortingslimiet in bij de bookmaker vóór je eerste wed. Gratis, vertrouwelijke hulp:", // REVIEW-NATIVE
    blockedTitle: "Niet beschikbaar in jouw regio", // REVIEW-NATIVE
    blockedBody: "Partnerbookmakers worden vanaf jouw locatie niet getoond. Het board en de tools werken gewoon.", // REVIEW-NATIVE
    blockedBack: "Terug naar het board",
    fine: "18+. Partnerlinks zijn commerciële affiliates. BetRedge is geen bookmaker en neemt geen weddenschappen aan.", // REVIEW-NATIVE
  },
  method: {
    tab: "Methode · één scherm",
    title: "Hoe we een odd lezen",
    metaStrong: "Vier ideeën",
    metaRest: "elk getal op BetRedge rust erop",
    more: (what: string) => `Meer over ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "De mix 70 / 30",
        body: "Onze voetbalschatting is voor 70% de marktodd en voor 30% ons model. De markt leidt; het model duwt bij.",
        detail: "Tennis is anders: daar geen eigen schatting, alleen de marktodds zonder marge.",
        market: "markt",
        model: "model",
      },
      seal: {
        k: "02",
        title: "Het zegel",
        body: "Vóór de aftrap wordt elke schatting met haar tijdstip opgeslagen. Daarna kan ze niet meer worden gewijzigd.",
        detail: "Het register leest alleen verzegelde rijen. Winst en verlies blijven allebei staan; na de uitslag wordt niets verwijderd.",
        label: "verzegeld",
      },
      gap: {
        k: "03",
        title: "Het verschil",
        body: "Verschil = onze schatting min die van de markt, in punten. We tonen ook negatieve verschillen.",
        detail: "Onder 1,5 punten schrijven we „in lijn”. Een verschil is een meningsverschil, geen belofte van winst.",
        market: "markt",
        estimate: "schatting",
        gap: "verschil",
      },
      not: {
        k: "04",
        title: "Wat we niet zeggen",
        body: "Geen claims dat we de markt te slim af zijn, geen winstcijfers, geen picks.",
        line: "Een schatting van 48% verwacht 52 keer op 100 fout te zitten.",
        detail: "Analyse, geen advies. BetRedge is geen bookmaker en neemt geen weddenschappen aan. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Bekijk het board van vandaag",
    record: "Open het register",
    tools: "Probeer de tools",
  },
};

const PL: PagesCopy = {
  pricing: {
    tab: "Plany · dwa, bez sztuczek z próbą", // REVIEW-NATIVE
    title: "Free pokazuje różnicę. Pro pokazuje dlaczego.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} miesięcznie`, // REVIEW-NATIVE
    metaRest: "Ceny w USD. Subskrypcję kartą anulujesz na swoim koncie.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "Cała analiza, za darmo.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Dlaczego za liczbą, i więcej szczegółów.", // REVIEW-NATIVE
    perMonth: "/ miesiąc", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} rocznie`, // REVIEW-NATIVE
    included: "W cenie", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Jeszcze niedostępne", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Dzisiejsza tablica", "każdy mecz: rynek, szacunek i różnica ze znakiem"],
      ["Rejestr", "każdy zapieczętowany szacunek, trafiony i nietrafiony"],
      ["Sprawdź kurs i 11 narzędzi", "bez zakładania konta"],
      ["Obserwowane", "mecze, które śledzisz, zapisane na tym urządzeniu"],
    ] as [string, string][],
    freeSoon: ["Alerty i dziennik zakładów", "planowane w Free; jeszcze niedostępne"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Dlaczego model się nie zgadza", "każdy czynnik za szacunkiem: forma, miejsce, gole"],
      ["Pełny ruch kursów", "każdy zapisany kurs od otwarcia rynku"],
      ["Prawdopodobieństwa na żywo", "szacunek aktualizuje się w trakcie meczu"],
      ["Widok prawdopodobieństw", "łącz rynki jednego meczu, model kontra rynek"],
      ["Tygodniowy Model Case", "przykład, jak model czyta tydzień; to nie zakład do postawienia"],
    ] as [string, string][],
    everythingFree: "Wszystko z Free", // REVIEW-NATIVE
    freeCta: "Załóż darmowe konto", // REVIEW-NATIVE
    proCta: "Przejdź na Pro", // REVIEW-NATIVE
    railCard: "Karta: subskrypcja odnawiana co miesiąc; anulujesz ją na swoim koncie.", // REVIEW-NATIVE
    railCardAnnual: "Rocznie kartą: odnawia się co 12 miesięcy.", // REVIEW-NATIVE
    railCrypto: "Krypto: jedna płatność za 30 dni, bez odnowienia.", // REVIEW-NATIVE
    railPaypal: "PayPal: dostępny przy płatności.", // REVIEW-NATIVE
    railUsdt: "Przelew USDT (TRC20): jedna płatność, sprawdzana ręcznie.", // REVIEW-NATIVE
    withdrawal: "Przed płatnością potwierdzasz, że Pro startuje od razu, co kończy 14-dniowe prawo odstąpienia.", // REVIEW-NATIVE
    promo: (until: string) => `Oferta startowa: pierwszy zakup za pół ceny do ${until}. Zniżka naliczana przy płatności.`, // REVIEW-NATIVE
    sameStrong: "Tak samo w obu:", // REVIEW-NATIVE
    same: "każdy kurs, szacunek, różnica i cały rejestr. Pro nigdy nie ukrywa liczby z Free; dodaje dlaczego.", // REVIEW-NATIVE
    anatomyTitle: "Co Pro otwiera w meczu", // REVIEW-NATIVE
    anatomyLede: "Nazwy czynników widzi każdy. Pierwszy jest wyjaśniony w Free; reszta otwiera się z Pro.", // REVIEW-NATIVE
    anatomyNever: "Nie pokazujemy, gdy szacunek i rynek się zgadzają (różnica poniżej 1.5 pkt).", // REVIEW-NATIVE
    fine: "Analiza, nie porady. 18+. BetRedge nie jest bukmacherem i nie przyjmuje zakładów.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · dlaczego", // REVIEW-NATIVE
    title: "Odblokuj, dlaczego model się nie zgadza", // REVIEW-NATIVE
    lede: "Zobacz czynniki, które odsuwają nasz szacunek od kursu rynkowego w tym meczu. Tylko analiza, nie porady. 18+.", // REVIEW-NATIVE
    blend: "Szacunki piłkarskie startują od rynku (70%); model je przesuwa (30%).", // REVIEW-NATIVE
    open: "Otwarte w Free", // REVIEW-NATIVE
    closed: "Otwiera się z Pro", // REVIEW-NATIVE
    cta: (price: string) => `Zobacz Pro · ${price}/miesiąc`, // REVIEW-NATIVE
    cancel: "Subskrypcję kartą anulujesz w każdej chwili na swoim koncie.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Forma", "Ostatnie wyniki obu drużyn, policzone, nie ważone na wyczucie."],
      ["Miejsce", "Bilans u siebie i na wyjeździe w tym sezonie oraz różnica między nimi."],
      ["Gole", "Gole oczekiwane strzelone i stracone, tam gdzie są dane."],
    ] as [string, string][],
    example: "Przykład układu: tylko nazwy, bez danych meczu.", // REVIEW-NATIVE
  },
  news: {
    tab: "News · poradniki i notatki meczowe",
    tabOff: "News · poradniki",
    title: "Co porusza kursem",
    metaStrong: (n: number) => (n === 1 ? "1 artykuł" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} artykuły` : `${n} artykułów`),
    metaRest: "piszemy sami; liczby wyjaśnione, bez typów",
    guide: "Poradnik",
    read: "Czytaj",
    minutes: (m: number) => `${m} min czytania`,
    empty: "Nie opublikowaliśmy jeszcze artykułów.",
    emptySub: "Tablica działa w międzyczasie.",
    toolsTitle: "Arytmetyka, policzona za ciebie",
    toolsBody: "Prawdopodobieństwo implikowane, marża, EV i Kelly: jedenaście darmowych kalkulatorów.",
    toolsLink: "Otwórz narzędzia",
    back: "Wszystkie artykuły",
    crumb: "News",
    published: "Opublikowano",
    responsible: "18+. Prawdopodobieństwa to szacunki i żaden wynik nie jest pewny. Jeśli hazard przestaje bawić, pomoc znajdziesz tutaj:", // REVIEW-NATIVE
  },
  books: {
    tab: "Bukmacherzy · partnerzy",
    title: "Wszyscy partnerzy na równi",
    metaStrong: (n: number) => (n === 1 ? "1 partner" : `${n} partnerów`),
    metaRest: "od A do Z · kursy tylko od połączonych bukmacherów",
    filterLabel: "Filtruj partnerów",
    all: "Wszyscy",
    sportsbooks: "Bukmacherzy",
    casinos: "Kasyna",
    search: "Szukaj po nazwie",
    none: "Brak partnera o tej nazwie.",
    shown: (n: number, total: number) => `Pokazano ${n} z ${total}`,
    order: "Kolejność alfabetyczna. Ta sama karta i ten sam przycisk dla każdego partnera.",
    typeSportsbook: "Bukmacher",
    typeCasino: "Kasyno i więcej",
    pricesLab: "Kursy",
    live: "Kursy na żywo na tablicy",
    siteOdds: "Kursy na stronie partnera",
    where: "Gdzie",
    everywhere: "Każdy kraj, w którym pokazujemy partnerów", // REVIEW-NATIVE
    onlyIn: (list: string) => `Tylko w: ${list}`, // REVIEW-NATIVE
    localLink: (list: string) => `Lokalny link rejestracji w: ${list}`, // REVIEW-NATIVE
    goTo: (name: string) => `Przejdź do ${name}`,
    affiliate: "Link afiliacyjny", // REVIEW-NATIVE
    compareTitle: "Dzisiejsze kursy obok siebie",
    compareSub: "Główny wynik każdego meczu, tylko połączeni bukmacherzy, z marżą.",
    compareMatch: "Mecz · wynik",
    compareBest: "Najlepszy",
    compareChecked: (t: string) => `Sprawdzono ${t}. Kursy się ruszają; liczy się kurs bukmachera w chwili kliknięcia.`,
    compareNone: "Brak połączonych kursów w tej chwili. Tablica pokaże je, gdy tylko bukmacher je poda.",
    respTitle: "Jeśli obstawiasz, najpierw ustaw limity.", // REVIEW-NATIVE
    respBody: "Ustaw limit depozytu u bukmachera przed pierwszym zakładem. Darmowa, poufna pomoc:", // REVIEW-NATIVE
    blockedTitle: "Niedostępne w twoim regionie", // REVIEW-NATIVE
    blockedBody: "W twojej lokalizacji nie pokazujemy bukmacherów partnerskich. Tablica i narzędzia działają normalnie.", // REVIEW-NATIVE
    blockedBack: "Wróć do tablicy",
    fine: "18+. Linki partnerskie to komercyjne linki afiliacyjne. BetRedge nie jest bukmacherem i nie przyjmuje zakładów.", // REVIEW-NATIVE
  },
  method: {
    tab: "Metoda · jeden ekran",
    title: "Jak czytamy kurs",
    metaStrong: "Cztery idee",
    metaRest: "opiera się na nich każda liczba w BetRedge",
    more: (what: string) => `Więcej: ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "Mieszanka 70 / 30",
        body: "Nasz szacunek piłkarski to w 70% kurs rynku i w 30% nasz model. Rynek prowadzi; model koryguje.",
        detail: "Tenis jest inny: tam bez naszego szacunku, tylko kurs rynkowy bez marży.",
        market: "rynek",
        model: "model",
      },
      seal: {
        k: "02",
        title: "Pieczęć",
        body: "Przed początkiem meczu każdy szacunek zapisujemy z godziną. Potem nie można go edytować.",
        detail: "Rejestr czyta tylko zapieczętowane wiersze. Trafione i nietrafione zostają; po wyniku nic nie znika.",
        label: "zapieczętowany",
      },
      gap: {
        k: "03",
        title: "Różnica",
        body: "Różnica = nasz szacunek minus rynkowy, w punktach. Pokazujemy też różnice ujemne.",
        detail: "Poniżej 1.5 pkt piszemy „zgodnie”. Różnica to niezgoda, nie obietnica zysku.",
        market: "rynek",
        estimate: "szacunek",
        gap: "różnica",
      },
      not: {
        k: "04",
        title: "Czego nie mówimy",
        body: "Żadnych twierdzeń, że przechytrzamy rynek, żadnych liczb zysku, żadnych typów.",
        line: "Szacunek 48% zakłada pomyłkę 52 razy na 100.",
        detail: "Analiza, nie porady. BetRedge nie jest bukmacherem i nie przyjmuje zakładów. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Zobacz dzisiejszą tablicę",
    record: "Otwórz rejestr",
    tools: "Wypróbuj narzędzia",
  },
};

const PT: PagesCopy = {
  pricing: {
    tab: "Planos · dois, sem truques de teste", // REVIEW-NATIVE
    title: "O Free mostra a diferença. O Pro mostra o porquê.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} por mês`, // REVIEW-NATIVE
    metaRest: "Preços em USD. A subscrição por cartão cancela-se na tua conta.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "A leitura completa, grátis.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "O porquê por trás do número, e mais profundidade.", // REVIEW-NATIVE
    perMonth: "/ mês", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} por ano`, // REVIEW-NATIVE
    included: "Incluído", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Ainda não disponível", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["O board de hoje", "cada jogo: mercado, estimativa e a diferença com sinal"],
      ["O registo", "cada estimativa selada, ganha ou perdida"],
      ["Verificar odd e 11 ferramentas", "sem conta"],
      ["Lista de seguidos", "os jogos que segues, guardados neste dispositivo"],
    ] as [string, string][],
    freeSoon: ["Alertas e registo de apostas", "previstos para o Free; ainda não disponíveis"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Porque é que o modelo discorda", "cada fator por trás da estimativa: forma, campo, golos"],
      ["Movimento das odds completo", "cada odd guardada desde a abertura do mercado"],
      ["Probabilidades ao vivo", "a estimativa atualiza-se durante o jogo"],
      ["Vista de probabilidades", "combina mercados de um jogo, modelo contra mercado"],
      ["Caso semanal do modelo", "um exemplo prático de como o modelo lê uma semana; não é uma aposta a fazer"],
    ] as [string, string][],
    everythingFree: "Tudo o que está no Free", // REVIEW-NATIVE
    freeCta: "Criar uma conta grátis", // REVIEW-NATIVE
    proCta: "Passar a Pro", // REVIEW-NATIVE
    railCard: "Cartão: uma subscrição que se renova todos os meses; cancela-a na tua conta.", // REVIEW-NATIVE
    railCardAnnual: "Anual por cartão: renova-se a cada 12 meses.", // REVIEW-NATIVE
    railCrypto: "Cripto: um pagamento para 30 dias, sem renovação.", // REVIEW-NATIVE
    railPaypal: "PayPal: disponível no checkout.", // REVIEW-NATIVE
    railUsdt: "Transferência USDT (TRC20): um pagamento, verificado à mão.", // REVIEW-NATIVE
    withdrawal: "Antes de pagar confirmas que o Pro começa de imediato, o que extingue o direito de livre resolução de 14 dias.", // REVIEW-NATIVE
    promo: (until: string) => `Oferta de lançamento: a primeira compra custa metade até ${until}. Aplica-se no checkout.`, // REVIEW-NATIVE
    sameStrong: "Igual nos dois:", // REVIEW-NATIVE
    same: "cada odd, estimativa, diferença e o registo completo. O Pro nunca esconde um número que o Free mostra; acrescenta o porquê.", // REVIEW-NATIVE
    anatomyTitle: "O que o Pro abre num jogo", // REVIEW-NATIVE
    anatomyLede: "Os títulos dos fatores são visíveis para todos. O primeiro é explicado no Free; os outros abrem com o Pro.", // REVIEW-NATIVE
    anatomyNever: "Nunca aparece quando estimativa e mercado coincidem (diferença abaixo de 1,5 pontos).", // REVIEW-NATIVE
    fine: "Análise, não conselhos. 18+. A BetRedge não é uma casa de apostas e não aceita apostas.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · o porquê", // REVIEW-NATIVE
    title: "Desbloqueia porque é que o modelo discorda", // REVIEW-NATIVE
    lede: "Vê os fatores que afastam a nossa estimativa da odd de mercado neste jogo. Só análise, não conselhos. 18+.", // REVIEW-NATIVE
    blend: "No futebol, a estimativa parte do mercado (70%); o modelo ajusta-a (30%).", // REVIEW-NATIVE
    open: "Aberto no Free", // REVIEW-NATIVE
    closed: "Abre com o Pro", // REVIEW-NATIVE
    cta: (price: string) => `Ver o Pro · ${price}/mês`, // REVIEW-NATIVE
    cancel: "Cancela a subscrição por cartão quando quiseres, na tua conta.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Forma", "Resultados recentes das duas equipas, contados, não pesados a sentimento."],
      ["Campo", "Registos em casa e fora nesta época, e quão afastados estão."],
      ["Golos", "Golos esperados a favor e contra, onde existem dados."],
    ] as [string, string][],
    example: "Exemplo de layout: só títulos, sem dados do jogo.", // REVIEW-NATIVE
  },
  news: {
    tab: "Notícias · guias e notas de jogo",
    tabOff: "Notícias · guias",
    title: "O que move uma odd",
    metaStrong: (n: number) => (n === 1 ? "1 artigo" : `${n} artigos`),
    metaRest: "escritos por nós; números explicados, sem palpites",
    guide: "Guia",
    read: "Ler",
    minutes: (m: number) => `${m} min de leitura`,
    empty: "Ainda não há artigos publicados.",
    emptySub: "Entretanto, o board está ativo.",
    toolsTitle: "As contas, feitas por ti",
    toolsBody: "Probabilidade implícita, margem, EV e Kelly: onze calculadoras gratuitas.",
    toolsLink: "Abrir as ferramentas",
    back: "Todos os artigos",
    crumb: "Notícias",
    published: "Publicado",
    responsible: "18+. As probabilidades são estimativas e nenhum resultado é certo. Se apostar deixar de ser divertido, há ajuda em", // REVIEW-NATIVE
  },
  books: {
    tab: "Casas · parceiros",
    title: "Todos os parceiros, em pé de igualdade",
    metaStrong: (n: number) => (n === 1 ? "1 parceiro" : `${n} parceiros`),
    metaRest: "de A a Z · odds só das casas ligadas",
    filterLabel: "Filtrar parceiros",
    all: "Todos",
    sportsbooks: "Casas de apostas",
    casinos: "Casinos",
    search: "Pesquisar por nome",
    none: "Nenhum parceiro com esse nome.",
    shown: (n: number, total: number) => `${n} de ${total} mostrados`,
    order: "Ordem alfabética. O mesmo cartão e o mesmo botão para cada parceiro.",
    typeSportsbook: "Casa de apostas",
    typeCasino: "Casino e mais",
    pricesLab: "Odds",
    live: "Odds ao vivo no board",
    siteOdds: "Odds no site do parceiro",
    where: "Onde",
    everywhere: "Todos os países onde mostramos parceiros",
    onlyIn: (list: string) => `Só em ${list}`,
    localLink: (list: string) => `Link de registo local em ${list}`,
    goTo: (name: string) => `Ir para ${name}`,
    affiliate: "Link de afiliado", // REVIEW-NATIVE
    compareTitle: "As odds de hoje, lado a lado",
    compareSub: "Resultado principal de cada jogo, só casas ligadas, margem incluída.",
    compareMatch: "Jogo · resultado",
    compareBest: "Melhor",
    compareChecked: (t: string) => `Verificado às ${t}. As odds mudam; conta a odd da casa no momento do clique.`,
    compareNone: "Nenhuma odd ligada neste momento. O board mostra-as assim que uma casa tiver uma.",
    respTitle: "Se apostares, define primeiro os teus limites.", // REVIEW-NATIVE
    respBody: "Define um limite de depósito na casa antes da primeira aposta. Ajuda gratuita e confidencial:", // REVIEW-NATIVE
    blockedTitle: "Não disponível na tua região", // REVIEW-NATIVE
    blockedBody: "As casas parceiras não são mostradas a partir da tua localização. O board e as ferramentas funcionam como sempre.", // REVIEW-NATIVE
    blockedBack: "Voltar ao board",
    fine: "18+. Os links de parceiros são afiliados comerciais. A BetRedge não é uma casa de apostas e não aceita apostas.", // REVIEW-NATIVE
  },
  method: {
    tab: "Método · um ecrã",
    title: "Como lemos uma odd",
    metaStrong: "Quatro ideias",
    metaRest: "cada número da BetRedge assenta nelas",
    more: (what: string) => `Mais sobre ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "A combinação 70 / 30",
        body: "A nossa estimativa de futebol é 70% a odd do mercado e 30% o nosso modelo. O mercado lidera; o modelo ajusta.",
        detail: "O ténis é diferente: aí sem estimativa nossa, só a odd de mercado sem margem.",
        market: "mercado",
        model: "modelo",
      },
      seal: {
        k: "02",
        title: "O selo",
        body: "Antes do início, cada estimativa é guardada com a sua hora. Depois disso, não pode ser editada.",
        detail: "O registo só lê linhas seladas. Ganhas e perdidas ficam; nada é removido depois do resultado.",
        label: "selado",
      },
      gap: {
        k: "03",
        title: "A diferença",
        body: "Diferença = a nossa estimativa menos a do mercado, em pontos. Também mostramos diferenças negativas.",
        detail: "Abaixo de 1,5 pontos escrevemos “alinhado”. Uma diferença é um desacordo, não uma promessa de lucro.",
        market: "mercado",
        estimate: "estimativa",
        gap: "diferença",
      },
      not: {
        k: "04",
        title: "O que não dizemos",
        body: "Nenhuma pretensão de adivinhar melhor do que o mercado, nenhum número de lucro, nenhum palpite.",
        line: "Uma estimativa de 48% espera errar 52 vezes em 100.",
        detail: "Análise, não conselhos. A BetRedge não é uma casa de apostas e não aceita apostas. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Ver o board de hoje",
    record: "Abrir o registo",
    tools: "Experimentar as ferramentas",
  },
};

const RU: PagesCopy = {
  pricing: {
    tab: "Тарифы · два, без пробных уловок", // REVIEW-NATIVE
    title: "Free показывает разрыв. Pro показывает почему.", // REVIEW-NATIVE
    metaStrong: (monthly) => `Pro — ${monthly} в месяц`, // REVIEW-NATIVE
    metaRest: "Цены в USD. Подписку по карте вы отменяете в своём аккаунте.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "Весь анализ — бесплатно.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Почему число именно такое — и больше глубины.", // REVIEW-NATIVE
    perMonth: "/ месяц", // REVIEW-NATIVE
    perYear: (annual) => `· ${annual} в год`, // REVIEW-NATIVE
    included: "Включено", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Ещё не запущено", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Панель на сегодня", "каждый матч: рынок, оценка и разрыв со знаком"],
      ["Реестр", "каждая зафиксированная оценка — и выигрыши, и проигрыши"],
      ["Проверка коэффициента и 11 инструментов", "без аккаунта"],
      ["Избранное", "матчи, за которыми вы следите, сохраняются на этом устройстве"],
    ],
    freeSoon: ["Оповещения и трекер ставок", "запланировано для Free; пока не запущено"], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Почему модель не согласна", "каждый фактор за оценкой: форма, место проведения, голы"],
      ["Полное движение коэффициентов", "каждый сохранённый коэффициент с открытия рынка"],
      ["Вероятности в эфире", "оценка обновляется по ходу матча"],
      ["Вероятностный вид", "комбинируйте рынки одного матча, модель против рынка"],
      ["Разбор модели за неделю", "пример того, как модель читает неделю; это не ставка к исполнению"],
    ],
    everythingFree: "Всё, что есть во Free", // REVIEW-NATIVE
    freeCta: "Создать бесплатный аккаунт", // REVIEW-NATIVE
    proCta: "Перейти на Pro", // REVIEW-NATIVE
    railCard: "Карта: подписка с ежемесячным продлением; отмена — в вашем аккаунте.", // REVIEW-NATIVE
    railCardAnnual: "Годовая по карте: продлевается каждые 12 месяцев.", // REVIEW-NATIVE
    railCrypto: "Криптовалюта: один платёж за 30 дней, без продления.", // REVIEW-NATIVE
    railPaypal: "PayPal: доступен при оформлении заказа.", // REVIEW-NATIVE
    railUsdt: "Перевод USDT (TRC20): один платёж, проверяется вручную.", // REVIEW-NATIVE
    withdrawal: "Перед оплатой вы подтверждаете, что Pro начинает действовать сразу: это прекращает 14-дневное право на отказ.", // REVIEW-NATIVE
    promo: (until) => `Стартовое предложение: первая покупка за полцены до ${until}. Скидка применяется при оплате.`, // REVIEW-NATIVE
    sameStrong: "Одинаково в обоих:", // REVIEW-NATIVE
    same: "каждый коэффициент, оценка, разрыв и весь реестр. Pro никогда не скрывает число, которое показывает Free; он добавляет «почему».", // REVIEW-NATIVE
    anatomyTitle: "Что Pro открывает на странице матча", // REVIEW-NATIVE
    anatomyLede: "Названия факторов видны всем. Первый объяснён во Free; остальные открываются с Pro.", // REVIEW-NATIVE
    anatomyNever: "Не показывается, когда оценка и рынок совпадают (разрыв меньше 1.5 пункта).", // REVIEW-NATIVE
    fine: "Анализ, не советы. 18+. BetRedge — не букмекер и не принимает ставки.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · почему", // REVIEW-NATIVE
    title: "Узнайте, почему модель не согласна", // REVIEW-NATIVE
    lede: "Факторы, которые уводят нашу оценку от рыночного коэффициента на этом матче. Только анализ, не советы. 18+.", // REVIEW-NATIVE
    blend: "Оценки по футболу начинаются с рынка (70%); модель их сдвигает (30%).", // REVIEW-NATIVE
    open: "Открыто во Free", // REVIEW-NATIVE
    closed: "Открывается с Pro", // REVIEW-NATIVE
    cta: (price) => `Смотреть Pro · ${price}/месяц`, // REVIEW-NATIVE
    cancel: "Подписку по карте можно отменить в аккаунте в любой момент.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Форма", "Последние результаты обеих команд — посчитанные, а не взвешенные на глаз."],
      ["Место", "Результаты дома и в гостях в этом сезоне и разница между ними."],
      ["Голы", "Ожидаемые голы, забитые и пропущенные, там, где есть данные."],
    ],
    example: "Пример макета: только названия, без данных матча.", // REVIEW-NATIVE
  },
  news: {
    tab: "Новости · гайды и заметки о матчах",
    tabOff: "Новости · гайды",
    title: "Что двигает коэффициент",
    metaStrong: (n) => (n === 1 ? "1 статья" : `${n} ${n % 10 === 1 && n % 100 !== 11 ? "статья" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "статьи" : "статей"}`),
    metaRest: "написаны нами; числа объяснены, без прогнозов на ставку",
    guide: "Гайд",
    read: "Читать",
    minutes: (m) => `${m} мин чтения`,
    empty: "Статей пока нет.",
    emptySub: "А панель тем временем работает.",
    toolsTitle: "Арифметика — за вас",
    toolsBody: "Подразумеваемая вероятность, маржа, EV и Kelly: одиннадцать бесплатных калькуляторов.",
    toolsLink: "Открыть инструменты",
    back: "Все статьи",
    crumb: "Новости",
    published: "Опубликовано",
    responsible: "18+. Вероятности — это оценки, и ни один исход не предрешён. Если ставки перестали приносить удовольствие, помощь здесь:", // REVIEW-NATIVE
  },
  books: {
    tab: "Букмекеры · партнёры",
    title: "Все партнёры на равных",
    metaStrong: (n: number) => { const a = n % 10, b = n % 100; return `${n} ${a === 1 && b !== 11 ? "партнёр" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "партнёра" : "партнёров"}`; },
    metaRest: "по алфавиту · коэффициенты только от подключённых букмекеров",
    filterLabel: "Фильтр партнёров",
    all: "Все",
    sportsbooks: "Букмекеры",
    casinos: "Казино",
    search: "Поиск по названию",
    none: "Нет партнёра с таким названием.",
    shown: (n: number, total: number) => `Показано ${n} из ${total}`,
    order: "Алфавитный порядок. Одинаковая карточка и кнопка для каждого партнёра.",
    typeSportsbook: "Букмекер",
    typeCasino: "Казино и не только",
    pricesLab: "Коэффициенты",
    live: "Live-коэффициенты на панели",
    siteOdds: "Коэффициенты на сайте партнёра",
    where: "Где",
    everywhere: "Все страны, где мы показываем партнёров", // REVIEW-NATIVE
    onlyIn: (list) => `Только: ${list}`, // REVIEW-NATIVE
    localLink: (list) => `Местная ссылка для регистрации: ${list}`, // REVIEW-NATIVE
    goTo: (name) => `Перейти на ${name}`,
    affiliate: "Партнёрская ссылка", // REVIEW-NATIVE
    compareTitle: "Сегодняшние коэффициенты рядом",
    compareSub: "Главный исход каждого матча, только подключённые букмекеры, маржа включена.",
    compareMatch: "Матч · исход",
    compareBest: "Лучший",
    compareChecked: (t) => `Проверено ${t}. Коэффициенты меняются; в счёт идёт коэффициент букмекера в момент клика.`,
    compareNone: "Сейчас подключённых коэффициентов нет. Панель покажет их, как только у букмекера появится коэффициент.",
    respTitle: "Если делаете ставки, сначала задайте лимиты.", // REVIEW-NATIVE
    respBody: "Установите лимит депозита у букмекера до первой ставки. Бесплатная конфиденциальная помощь:", // REVIEW-NATIVE
    blockedTitle: "Недоступно в вашем регионе", // REVIEW-NATIVE
    blockedBody: "Из вашего местоположения букмекеры-партнёры не показываются. Панель и инструменты работают как обычно.", // REVIEW-NATIVE
    blockedBack: "Назад к панели",
    fine: "18+. Ссылки на партнёров — коммерческие партнёрские ссылки. BetRedge — не букмекер и не принимает ставки.", // REVIEW-NATIVE
  },
  method: {
    tab: "Метод · один экран",
    title: "Как мы читаем коэффициент",
    metaStrong: "Четыре идеи",
    metaRest: "на них держится каждое число BetRedge",
    more: (what) => `Подробнее: ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "Смесь 70 / 30",
        body: "Наша оценка по футболу — на 70% рыночный коэффициент и на 30% наша модель. Рынок ведёт; модель подталкивает.",
        detail: "С теннисом иначе: там нет нашей оценки, только рыночный коэффициент без маржи.",
        market: "рынок",
        model: "модель",
      },
      seal: {
        k: "02",
        title: "Печать",
        body: "До начала матча каждая оценка сохраняется вместе со временем. После этого её нельзя изменить.",
        detail: "Реестр читает только зафиксированные строки. Выигрыши и проигрыши остаются; после результата ничего не удаляется.",
        label: "зафиксировано",
      },
      gap: {
        k: "03",
        title: "Разрыв",
        body: "Разрыв = наша оценка минус рыночная, в пунктах. Отрицательные разрывы мы тоже показываем.",
        detail: "Меньше 1.5 пункта мы пишем «вровень». Разрыв — это несогласие, а не обещание прибыли.",
        market: "рынок",
        estimate: "оценка",
        gap: "разрыв",
      },
      not: {
        k: "04",
        title: "Чего мы не говорим",
        body: "Никаких заявлений, что мы переиграем рынок, никаких цифр прибыли, никаких подсказок на ставку.",
        line: "Оценка 48% предполагает ошибку 52 раза из 100.",
        detail: "Анализ, не советы. BetRedge — не букмекер и не принимает ставки. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Панель на сегодня",
    record: "Открыть реестр",
    tools: "Попробовать инструменты",
  },
};

const SV: PagesCopy = {
  pricing: {
    tab: "Abonnemang · två, inga provperiodsknep", // REVIEW-NATIVE
    title: "Free visar skillnaden. Pro visar varför.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro ${monthly} i månaden`, // REVIEW-NATIVE
    metaRest: "Priser i USD. Kortabonnemanget sägs upp från ditt konto.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "Hela läsningen, gratis.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Varför bakom siffran, och mer djup.", // REVIEW-NATIVE
    perMonth: "/ månad", // REVIEW-NATIVE
    perYear: (annual: string) => `· ${annual} per år`, // REVIEW-NATIVE
    included: "Ingår", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Inte live än", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Dagens board", "varje match: marknad, uppskattning och skillnaden med tecken"],
      ["Registret", "varje förseglad uppskattning, vunnen och förlorad"],
      ["Oddskoll och 11 verktyg", "inget konto behövs"],
      ["Bevakningslista", "matcherna du följer, sparade på den här enheten"],
    ] as [string, string][],
    freeSoon: ["Aviseringar och spelspårare", "planerat för Free; inte live än"] as [string, string], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Varför modellen inte håller med", "varje faktor bakom uppskattningen: form, plan, mål"],
      ["Hela oddsrörelsen", "varje sparat odds sedan marknaden öppnade"],
      ["Livesannolikheter", "uppskattningen uppdateras under matchen"],
      ["Sannolikhetsvy", "kombinera marknader i en match, modell mot marknad"],
      ["Veckans modellfall", "ett genomarbetat exempel på hur modellen läser en vecka; inget spel att lägga"],
    ] as [string, string][],
    everythingFree: "Allt i Free", // REVIEW-NATIVE
    freeCta: "Skapa ett gratis konto", // REVIEW-NATIVE
    proCta: "Skaffa Pro", // REVIEW-NATIVE
    railCard: "Kort: ett abonnemang som förnyas varje månad; säg upp det från ditt konto.", // REVIEW-NATIVE
    railCardAnnual: "Årsvis med kort: förnyas var 12:e månad.", // REVIEW-NATIVE
    railCrypto: "Krypto: en betalning för 30 dagar, ingen förnyelse.", // REVIEW-NATIVE
    railPaypal: "PayPal: tillgängligt i kassan.", // REVIEW-NATIVE
    railUsdt: "USDT-överföring (TRC20): en betalning, kontrolleras manuellt.", // REVIEW-NATIVE
    withdrawal: "Innan du betalar bekräftar du att Pro startar direkt, vilket avslutar den 14 dagar långa ångerrätten.", // REVIEW-NATIVE
    promo: (until: string) => `Lanseringserbjudande: första köpet till halva priset fram till ${until}. Det dras av i kassan.`, // REVIEW-NATIVE
    sameStrong: "Samma i båda:", // REVIEW-NATIVE
    same: "varje odds, uppskattning, skillnad och hela registret. Pro döljer aldrig en siffra som Free visar; det lägger till varför.", // REVIEW-NATIVE
    anatomyTitle: "Vad Pro öppnar i en match", // REVIEW-NATIVE
    anatomyLede: "Faktorernas rubriker syns för alla. Den första förklaras i Free; resten öppnas med Pro.", // REVIEW-NATIVE
    anatomyNever: "Visas aldrig när uppskattning och marknad är överens (skillnad under 1,5 punkter).", // REVIEW-NATIVE
    fine: "Analys, inga råd. 18+. BetRedge är inget spelbolag och tar inte emot spel.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · varför", // REVIEW-NATIVE
    title: "Lås upp varför modellen inte håller med", // REVIEW-NATIVE
    lede: "Se faktorerna som flyttar vår uppskattning bort från marknadens odds i den här matchen. Bara analys, inga råd. 18+.", // REVIEW-NATIVE
    blend: "Fotbollsuppskattningar utgår från marknaden (70 %); modellen flyttar dem (30 %).", // REVIEW-NATIVE
    open: "Öppen i Free", // REVIEW-NATIVE
    closed: "Öppnas med Pro", // REVIEW-NATIVE
    cta: (price: string) => `Se Pro · ${price}/månad`, // REVIEW-NATIVE
    cancel: "Säg upp kortabonnemanget när som helst från ditt konto.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Form", "Båda lagens senaste resultat, räknade, inte viktade efter känsla."],
      ["Plan", "Hemma- och bortaresultat den här säsongen, och hur långt isär de ligger."],
      ["Mål", "Förväntade mål för och emot, där data finns."],
    ] as [string, string][],
    example: "Layoutexempel: bara rubriker, ingen matchdata.", // REVIEW-NATIVE
  },
  news: {
    tab: "Nyheter · guider och matchanteckningar",
    tabOff: "Nyheter · guider",
    title: "Vad som flyttar ett odds",
    metaStrong: (n: number) => (n === 1 ? "1 artikel" : `${n} artiklar`),
    metaRest: "skrivna av oss; siffror förklarade, inga tips",
    guide: "Guide",
    read: "Läs",
    minutes: (m: number) => `${m} min läsning`,
    empty: "Inga artiklar publicerade än.",
    emptySub: "Boarden är live under tiden.",
    toolsTitle: "Räknandet, gjort åt dig",
    toolsBody: "Implicit sannolikhet, marginal, EV och Kelly: elva gratis kalkylatorer.",
    toolsLink: "Öppna verktygen",
    back: "Alla artiklar",
    crumb: "Nyheter",
    published: "Publicerad",
    responsible: "18+. Sannolikheter är uppskattningar och inget utfall är säkert. Om spelandet slutar vara roligt finns hjälp hos", // REVIEW-NATIVE
  },
  books: {
    tab: "Spelbolag · partner",
    title: "Alla partner, på lika fot",
    metaStrong: (n: number) => `${n} partner`,
    metaRest: "från A till Ö · odds bara från anslutna spelbolag",
    filterLabel: "Filtrera partner",
    all: "Alla",
    sportsbooks: "Spelbolag",
    casinos: "Kasinon",
    search: "Sök på namn",
    none: "Ingen partner med det namnet.",
    shown: (n: number, total: number) => `${n} av ${total} visas`,
    order: "Alfabetisk ordning. Samma kort och samma knapp för varje partner.",
    typeSportsbook: "Spelbolag",
    typeCasino: "Kasino med mera",
    pricesLab: "Odds",
    live: "Liveodds på boarden",
    siteOdds: "Odds på partnerns sajt",
    where: "Var",
    everywhere: "Alla länder där vi visar partner",
    onlyIn: (list: string) => `Bara i ${list}`,
    localLink: (list: string) => `Lokal registreringslänk i ${list}`,
    goTo: (name: string) => `Gå till ${name}`,
    affiliate: "Affiliatelänk", // REVIEW-NATIVE
    compareTitle: "Dagens odds, sida vid sida",
    compareSub: "Ledande utfall i varje match, bara anslutna spelbolag, marginal inräknad.",
    compareMatch: "Match · utfall",
    compareBest: "Bästa",
    compareChecked: (t: string) => `Kontrollerat ${t}. Odds rör sig; spelbolagets odds vid klicket är det som gäller.`,
    compareNone: "Inga anslutna odds just nu. Boarden visar dem så snart ett spelbolag har ett.",
    respTitle: "Om du spelar, sätt dina gränser först.", // REVIEW-NATIVE
    respBody: "Sätt en insättningsgräns hos spelbolaget före ditt första spel. Gratis, konfidentiell hjälp:", // REVIEW-NATIVE
    blockedTitle: "Inte tillgängligt i din region", // REVIEW-NATIVE
    blockedBody: "Partnerspelbolag visas inte från din plats. Boarden och verktygen fungerar som vanligt.", // REVIEW-NATIVE
    blockedBack: "Tillbaka till boarden",
    fine: "18+. Partnerlänkar är kommersiella affiliatelänkar. BetRedge är inget spelbolag och tar inte emot spel.", // REVIEW-NATIVE
  },
  method: {
    tab: "Metod · en skärm",
    title: "Hur vi läser ett odds",
    metaStrong: "Fyra idéer",
    metaRest: "varje siffra på BetRedge vilar på dem",
    more: (what: string) => `Mer om ${what}`,
    blocks: {
      blend: {
        k: "01",
        title: "Mixen 70 / 30",
        body: "Vår fotbollsuppskattning är 70 % marknadens odds och 30 % vår modell. Marknaden leder; modellen knuffar.",
        detail: "Tennis skiljer sig: där ingen egen uppskattning, bara marknadens odds utan marginal.",
        market: "marknad",
        model: "modell",
      },
      seal: {
        k: "02",
        title: "Sigillet",
        body: "Före avspark sparas varje uppskattning med sin tidpunkt. Därefter kan den inte ändras.",
        detail: "Registret läser bara förseglade rader. Vinster och förluster står kvar; inget tas bort efter resultatet.",
        label: "förseglad",
      },
      gap: {
        k: "03",
        title: "Skillnaden",
        body: "Skillnad = vår uppskattning minus marknadens, i punkter. Vi visar negativa skillnader också.",
        detail: "Under 1,5 punkter skriver vi ”i linje”. En skillnad är en oenighet, inget löfte om vinst.",
        market: "marknad",
        estimate: "uppskattning",
        gap: "skillnad",
      },
      not: {
        k: "04",
        title: "Vad vi inte säger",
        body: "Inga påståenden om att vi gissar bättre än marknaden, inga vinstsiffror, inga tips.",
        line: "En uppskattning på 48 % räknar med att ha fel 52 gånger av 100.",
        detail: "Analys, inga råd. BetRedge är inget spelbolag och tar inte emot spel. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Se dagens board",
    record: "Öppna registret",
    tools: "Prova verktygen",
  },
};

const TR: PagesCopy = {
  pricing: {
    tab: "Planlar · iki tane, deneme tuzağı yok", // REVIEW-NATIVE
    title: "Free farkı gösterir. Pro nedenini gösterir.", // REVIEW-NATIVE
    metaStrong: (monthly: string) => `Pro aylık ${monthly}`, // REVIEW-NATIVE
    metaRest: "Fiyatlar USD cinsindendir. Kart aboneliği hesabından iptal edilir.", // REVIEW-NATIVE
    freeName: "Free", // REVIEW-NATIVE
    freeLede: "Okumanın tamamı, ücretsiz.", // REVIEW-NATIVE
    proName: "Pro", // REVIEW-NATIVE
    proLede: "Sayının arkasındaki neden ve daha fazla derinlik.", // REVIEW-NATIVE
    perMonth: "/ ay", // REVIEW-NATIVE
    perYear: (annual: string) => `· yıllık ${annual}`, // REVIEW-NATIVE
    included: "Dahil", // REVIEW-NATIVE
    pro: "Pro", // REVIEW-NATIVE
    notLive: "Henüz yayında değil", // REVIEW-NATIVE
    free: [ // REVIEW-NATIVE
      ["Bugünün panosu", "her maç: piyasa, tahmin ve işaretli fark"],
      ["Kayıt defteri", "mühürlenen her tahmin, kazanan ve kaybeden"],
      ["Oran kontrolü ve 11 araç", "hesap gerekmez"],
      ["İzleme listesi", "takip ettiğin maçlar, bu cihazda kayıtlı"],
    ],
    freeSoon: ["Uyarılar ve bahis takibi", "Free için planlandı; henüz yayında değil"], // REVIEW-NATIVE
    proItems: [ // REVIEW-NATIVE
      ["Model neden farklı düşünüyor", "tahminin arkasındaki her etken: form, saha, goller"],
      ["Oran hareketinin tamamı", "piyasa açıldığından beri kaydedilen her oran"],
      ["Canlı olasılıklar", "tahmin maç sırasında güncellenir"],
      ["Olasılık görünümü", "bir maçta piyasaları birleştir, model ile piyasayı karşılaştır"],
      ["Haftalık Model Vakası", "modelin bir haftayı nasıl okuduğuna dair çözümlü örnek; oynanacak bir bahis değil"],
    ],
    everythingFree: "Free'deki her şey", // REVIEW-NATIVE
    freeCta: "Ücretsiz hesap oluştur", // REVIEW-NATIVE
    proCta: "Pro'ya geç", // REVIEW-NATIVE
    railCard: "Kart: her ay yenilenen bir abonelik; hesabından iptal edebilirsin.", // REVIEW-NATIVE
    railCardAnnual: "Kartla yıllık: her 12 ayda bir yenilenir.", // REVIEW-NATIVE
    railCrypto: "Kripto: 30 gün için tek ödeme, yenileme yok.", // REVIEW-NATIVE
    railPaypal: "PayPal: ödeme adımında kullanılabilir.", // REVIEW-NATIVE
    railUsdt: "USDT (TRC20) transferi: tek ödeme, elle kontrol edilir.", // REVIEW-NATIVE
    withdrawal: "Ödemeden önce Pro'nun hemen başladığını onaylarsın; bu, 14 günlük cayma hakkını sona erdirir.", // REVIEW-NATIVE
    promo: (until: string) => `Lansman teklifi: ilk satın alma ${until} tarihine kadar yarı fiyatına. Ödeme adımında uygulanır.`, // REVIEW-NATIVE
    sameStrong: "İkisinde de aynı:", // REVIEW-NATIVE
    same: "her oran, tahmin, fark ve kayıt defterinin tamamı. Pro, Free'nin gösterdiği hiçbir sayıyı gizlemez; nedenini ekler.", // REVIEW-NATIVE
    anatomyTitle: "Pro bir maçta neyi açar", // REVIEW-NATIVE
    anatomyLede: "Etken başlıkları herkese görünür. İlki Free'de açıklanır; diğerleri Pro ile açılır.", // REVIEW-NATIVE
    anatomyNever: "Tahmin ile piyasa uyuştuğunda asla gösterilmez (fark 1,5 puanın altında).", // REVIEW-NATIVE
    fine: "Analiz, tavsiye değil. 18+. BetRedge bir bahis sitesi değildir ve bahis kabul etmez.", // REVIEW-NATIVE
  },
  paywall: {
    lab: "Pro · nedeni", // REVIEW-NATIVE
    title: "Modelin neden farklı düşündüğünü aç", // REVIEW-NATIVE
    lede: "Bu maçta tahminimizi piyasa oranından uzaklaştıran etkenleri gör. Yalnızca analiz, tavsiye değil. 18+.", // REVIEW-NATIVE
    blend: "Futbol tahminleri piyasadan başlar (%70); model onları kaydırır (%30).", // REVIEW-NATIVE
    open: "Free'de açık", // REVIEW-NATIVE
    closed: "Pro ile açılır", // REVIEW-NATIVE
    cta: (price: string) => `Pro'yu gör · ${price}/ay`, // REVIEW-NATIVE
    cancel: "Kart aboneliğini istediğin zaman hesabından iptal et.", // REVIEW-NATIVE
    factorKinds: [ // REVIEW-NATIVE
      ["Form", "İki tarafın son sonuçları; hisle değil, sayılarak."],
      ["Saha", "Bu sezonki iç saha ve deplasman karnesi ve aralarındaki fark."],
      ["Goller", "Verinin olduğu yerde beklenen atılan ve yenen goller."],
    ],
    example: "Düzen örneği: yalnızca başlıklar, maç verisi yok.", // REVIEW-NATIVE
  },
  news: {
    tab: "Haberler · rehberler ve maç notları",
    tabOff: "Haberler · rehberler",
    title: "Bir oranı ne hareket ettirir",
    metaStrong: (n: number) => (n === 1 ? "1 makale" : `${n} makale`),
    metaRest: "bizim yazdığımız; sayılar açıklanmış, seçim yok",
    guide: "Rehber",
    read: "Oku",
    minutes: (m: number) => `${m} dk okuma`,
    empty: "Henüz yayınlanmış makale yok.",
    emptySub: "Bu arada pano yayında.",
    toolsTitle: "Hesap, senin yerine yapıldı",
    toolsBody: "Zımni olasılık, marj, EV ve Kelly: on bir ücretsiz hesaplayıcı.",
    toolsLink: "Araçları aç",
    back: "Tüm makaleler",
    crumb: "Haberler",
    published: "Yayınlandı",
    responsible: "18+. Olasılıklar tahmindir ve hiçbir sonuç kesin değildir. Bahis eğlenceli olmaktan çıkarsa yardım burada:", // REVIEW-NATIVE
  },
  books: {
    tab: "Bahis siteleri · ortaklar",
    title: "Tüm partnerler eşit şekilde",
    metaStrong: (n: number) => `${n} partner`,
    metaRest: "A’dan Z’ye · oranlar yalnızca bağlı bahis sitelerinden",
    filterLabel: "Partnerleri filtrele",
    all: "Tümü",
    sportsbooks: "Bahis siteleri",
    casinos: "Casinolar",
    search: "Ada göre ara",
    none: "Bu adda partner yok.",
    shown: (n: number, total: number) => `${total} partnerden ${n} gösteriliyor`,
    order: "Alfabetik sıra. Her partner için aynı kart, aynı düğme.",
    typeSportsbook: "Bahis sitesi",
    typeCasino: "Casino ve fazlası",
    pricesLab: "Oranlar",
    live: "Panoda canlı oranlar",
    siteOdds: "Oranlar ortağın sitesinde",
    where: "Nerede",
    everywhere: "Ortak gösterdiğimiz her ülke",
    onlyIn: (list: string) => `Yalnızca ${list}`,
    localLink: (list: string) => `Yerel kayıt bağlantısı: ${list}`,
    goTo: (name: string) => `${name} sitesine git`,
    affiliate: "Ortaklık bağlantısı", // REVIEW-NATIVE
    compareTitle: "Bugünün oranları, yan yana",
    compareSub: "Her maçın ana sonucu, yalnızca bağlı bahis siteleri, marj dahil.",
    compareMatch: "Maç · sonuç",
    compareBest: "En iyi",
    compareChecked: (t: string) => `${t} kontrol edildi. Oranlar değişir; geçerli olan, tıkladığın andaki sitedeki orandır.`,
    compareNone: "Şu an bağlı oran yok. Bir bahis sitesinde oran çıkınca pano hemen gösterir.",
    respTitle: "Bahis oynayacaksan önce limitlerini belirle.", // REVIEW-NATIVE
    respBody: "İlk bahsinden önce bahis sitesinde bir yatırma limiti koy. Ücretsiz, gizli yardım:", // REVIEW-NATIVE
    blockedTitle: "Bölgende kullanılamıyor", // REVIEW-NATIVE
    blockedBody: "Bulunduğun yerden ortak bahis siteleri gösterilmez. Pano ve araçlar her zamanki gibi çalışır.", // REVIEW-NATIVE
    blockedBack: "Panoya dön",
    fine: "18+. Ortak bağlantıları ticari ortaklık bağlantılarıdır. BetRedge bir bahis sitesi değildir ve bahis kabul etmez.", // REVIEW-NATIVE
  },
  method: {
    tab: "Yöntem · tek ekran",
    title: "Bir oranı nasıl okuyoruz",
    metaStrong: "Dört fikir",
    metaRest: "BetRedge'deki her sayı bunlara dayanır",
    more: (what: string) => `${what} hakkında daha fazlası`,
    blocks: {
      blend: {
        k: "01",
        title: "70 / 30 karışım",
        body: "Futbol tahminimiz %70 piyasa oranı, %30 modelimizdir. Piyasa yön verir; model hafifçe kaydırır.",
        detail: "Tenis farklı: orada kendi tahminimiz yok, yalnızca marj hariç piyasa oranı.",
        market: "piyasa",
        model: "model",
      },
      seal: {
        k: "02",
        title: "Mühür",
        body: "Başlamadan önce her tahmin saatiyle birlikte kaydedilir. Ondan sonra düzenlenemez.",
        detail: "Kayıt defteri yalnızca mühürlü satırları okur. Kazançlar da kayıplar da kalır; sonuçtan sonra hiçbir şey silinmez.",
        label: "mühürlü",
      },
      gap: {
        k: "03",
        title: "Fark",
        body: "Fark = tahminimiz eksi piyasanınki, puan olarak. Negatif farkları da gösteriyoruz.",
        detail: "1,5 puanın altında “uyumlu” yazarız. Fark bir görüş ayrılığıdır, kâr vaadi değil.",
        market: "piyasa",
        estimate: "tahmin",
        gap: "fark",
      },
      not: {
        k: "04",
        title: "Söylemediklerimiz",
        body: "Piyasayı alt ettiğimize dair iddia yok, kâr rakamı yok, seçim yok.",
        line: "%48'lik bir tahmin, 100'de 52 kez yanılmayı bekler.",
        detail: "Analiz, tavsiye değil. BetRedge bir bahis sitesi değildir ve bahis kabul etmez. 18+.", // REVIEW-NATIVE
      },
    },
    board: "Bugünün panosunu gör",
    record: "Kayıt defterini aç",
    tools: "Araçları dene",
  },
};

export const PAGES_COPY: Record<PagesLang, PagesCopy> = { en: EN, it: IT, de: DE, es: ES, fr: FR, nl: NL, pl: PL, pt: PT, ru: RU, sv: SV, tr: TR };

export function pagesCopyFor(lang: string | null | undefined): PagesCopy {
  return PAGES_COPY[v3cLang(lang)];
}
