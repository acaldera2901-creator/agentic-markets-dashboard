// lib/classic/plans-copy.ts — #CLASSIC-PLANS-1014 · la pagina piani a flag acceso.
//
// Due piani soli, Free e Pro (Andrea, 14/10). Le cinque lingue del desk, le
// stesse di PlansTab (en it es fr ru). Parità e lessico vietato in
// plans-copy.test.ts. I FATTI vengono dal codice e da lib/home-faq.ts, non da
// qui: quote giornaliere in lib/access-projection.ts (showcaseAllowance: Free 3
// per sport, Pro tutto); prezzi in lib/commercial-plan.ts (mensile) e
// lib/paygate.ts PAYGATE_PRICES (annuale, 11 mensilità); carta = abbonamento
// che si rinnova e si disdice dall'account; crypto = pagamento singolo da 30
// giorni senza rinnovo (CheckoutModal, home-faq); punteggio live nella scheda
// coi piani a pagamento, stima NON ricalcolata durante il match
// (lib/classic/home-faq.ts); Weekly Model Case inclusa nel Pro, sblocco one-off
// per gli altri (app/weekly-model-case). Mai «battiamo il mercato», mai
// percentuali di successo, mai urgenza.
//
// Segnaposto: {m} prezzo mensile, {y} prezzo annuale, {d} data di scadenza.

export const PLANS_LANGS = ["en", "it", "es", "fr", "ru"] as const;
export type PlansLang = (typeof PLANS_LANGS)[number];

export type PlansCopy = {
  headline: string;
  lede: string;
  proName: string;
  proTag: string;
  perMonth: string;
  annualLine: string;
  /** le quattro righe che distinguono davvero Pro da Free, ciascuna col suo «Free:» */
  r1: string; f1: string;
  r2: string; f2: string;
  r3: string; f3: string;
  r4: string; f4: string;
  shared: string;
  ctaStart: string;
  ctaActivate: string;
  ctaUpgrade: string;
  ctaActive: string;
  ctaReview: string;
  nextStep: string;
  billing: string;
  proActive: string;
  accessUntil: string;
  manage: string;
  onBase: string;
  freeName: string;
  freePrice: string;
  freeForever: string;
  freeDesc: string;
  freeStart: string;
  freeActive: string;
  freeIncluded: string;
  seeBoard: string;
};

export const PLANS_COPY: Record<PlansLang, PlansCopy> = {
  en: {
    headline: "Free reads three per sport a day. Pro reads the whole board.",
    lede: "Same model, same numbers, logged before kick-off. The only thing that changes is how much of today’s board you open.",
    proName: "BetRedge Pro",
    proTag: "The whole board",
    perMonth: "/ month",
    annualLine: "Or {y} a year: 11 months paid, one free. You pick monthly or annual at checkout.",
    r1: "Every match of the day, football and tennis",
    f1: "Free: up to 3 per sport",
    r2: "The full analysis: form, expected goals, Elo, serve and return, surface",
    f2: "Free: pick, probability and the reasoning in short",
    r3: "Score and minute on the card while the match is on",
    f3: "Free: kick-off time only",
    r4: "Weekly Model Case included",
    f4: "Free: one-off purchase",
    shared: "Both plans: every reading is logged before kick-off and settles in the public record.",
    ctaStart: "Start with Pro",
    ctaActivate: "Activate Pro",
    ctaUpgrade: "Upgrade to Pro",
    ctaActive: "Pro is active",
    ctaReview: "Payment under review",
    nextStep: "Account and payment at the next step.",
    billing: "Card: a subscription that renews every month (or every year) until you cancel it, any day, from your account. Nothing is charged after that. Crypto: one payment, 30 days, no renewal.",
    proActive: "Pro is active on this account.",
    accessUntil: "Access until {d}.",
    manage: "Manage it from your account menu.",
    onBase: "You’re on Base: up to 7 per sport a day. Pro opens the rest of the board and the full analysis.",
    freeName: "BetRedge Free",
    freePrice: "$0",
    freeForever: "forever",
    freeDesc: "Up to 3 readings per sport a day, open in full: pick, probability, reasoning. Profile and public record.",
    freeStart: "Start free",
    freeActive: "Free is active",
    freeIncluded: "Already in your plan.",
    seeBoard: "Not sure yet? Open today’s board first",
  },
  it: {
    headline: "Free legge tre partite per sport al giorno. Pro legge tutto il board.",
    lede: "Stesso modello, stessi numeri, registrati prima del fischio. Cambia una cosa sola: quanto del board di oggi apri.",
    proName: "BetRedge Pro",
    proTag: "Tutto il board",
    perMonth: "/ mese",
    annualLine: "Oppure {y} all’anno: paghi 11 mesi, uno è gratis. Mensile o annuale lo scegli al checkout.",
    r1: "Ogni partita del giorno, calcio e tennis",
    f1: "Free: fino a 3 per sport",
    r2: "L’analisi completa: forma, gol attesi, Elo, servizio e risposta, superficie",
    f2: "Free: pick, probabilità e il ragionamento in breve",
    r3: "Punteggio e minuto sulla scheda mentre la partita è in corso",
    f3: "Free: solo l’ora del calcio d’inizio",
    r4: "Weekly Model Case inclusa",
    f4: "Free: acquisto singolo",
    shared: "In entrambi i piani ogni lettura è registrata prima del fischio e si chiude nel registro pubblico.",
    ctaStart: "Inizia con Pro",
    ctaActivate: "Attiva Pro",
    ctaUpgrade: "Passa a Pro",
    ctaActive: "Pro è attivo",
    ctaReview: "Pagamento in verifica",
    nextStep: "Account e pagamento al passaggio successivo.",
    billing: "Carta: un abbonamento che si rinnova ogni mese (o ogni anno) finché non lo disdici, in qualsiasi giorno, dal tuo account. Da lì non addebitiamo più niente. Crypto: pagamento singolo, 30 giorni, nessun rinnovo.",
    proActive: "Pro è attivo su questo account.",
    accessUntil: "Accesso fino al {d}.",
    manage: "Lo gestisci dal menu del tuo account.",
    onBase: "Sei su Base: fino a 7 per sport al giorno. Pro apre il resto del board e l’analisi completa.",
    freeName: "BetRedge Free",
    freePrice: "$0",
    freeForever: "per sempre",
    freeDesc: "Fino a 3 letture per sport al giorno, aperte del tutto: pick, probabilità, ragionamento. Profilo e registro pubblico.",
    freeStart: "Inizia gratis",
    freeActive: "Free è attivo",
    freeIncluded: "Già nel tuo piano.",
    seeBoard: "Non sei convinto? Apri prima il board di oggi",
  },
  es: {
    headline: "Free lee tres partidos por deporte al día. Pro lee todo el board.",
    lede: "Mismo modelo, mismos números, registrados antes del inicio. Solo cambia cuánto del board de hoy abres.",
    proName: "BetRedge Pro",
    proTag: "Todo el board",
    perMonth: "/ mes",
    annualLine: "O {y} al año: pagas 11 meses, uno es gratis. Mensual o anual lo eliges al pagar.",
    r1: "Cada partido del día, fútbol y tenis",
    f1: "Free: hasta 3 por deporte",
    r2: "El análisis completo: forma, goles esperados, Elo, saque y resto, superficie",
    f2: "Free: pick, probabilidad y el razonamiento en breve",
    r3: "Marcador y minuto en la ficha mientras se juega el partido",
    f3: "Free: solo la hora de inicio",
    r4: "Weekly Model Case incluida",
    f4: "Free: compra única",
    shared: "En ambos planes cada lectura se registra antes del inicio y se cierra en el registro público.",
    ctaStart: "Empieza con Pro",
    ctaActivate: "Activar Pro",
    ctaUpgrade: "Pasar a Pro",
    ctaActive: "Pro está activo",
    ctaReview: "Pago en revisión",
    nextStep: "Cuenta y pago en el siguiente paso.",
    billing: "Tarjeta: una suscripción que se renueva cada mes (o cada año) hasta que la canceles, cualquier día, desde tu cuenta. Después no se cobra nada más. Crypto: pago único, 30 días, sin renovación.",
    proActive: "Pro está activo en esta cuenta.",
    accessUntil: "Acceso hasta el {d}.",
    manage: "Lo gestionas desde el menú de tu cuenta.",
    onBase: "Estás en Base: hasta 7 por deporte al día. Pro abre el resto del board y el análisis completo.",
    freeName: "BetRedge Free",
    freePrice: "$0",
    freeForever: "para siempre",
    freeDesc: "Hasta 3 lecturas por deporte al día, abiertas del todo: pick, probabilidad, razonamiento. Perfil y registro público.",
    freeStart: "Empieza gratis",
    freeActive: "Free está activo",
    freeIncluded: "Ya está en tu plan.",
    seeBoard: "¿Aún no lo ves claro? Abre primero el board de hoy",
  },
  fr: {
    headline: "Free lit trois matchs par sport et par jour. Pro lit tout le board.",
    lede: "Même modèle, mêmes chiffres, enregistrés avant le coup d’envoi. Une seule chose change : la part du board du jour que vous ouvrez.",
    proName: "BetRedge Pro",
    proTag: "Tout le board",
    perMonth: "/ mois",
    annualLine: "Ou {y} par an : 11 mois payés, un offert. Mensuel ou annuel, vous choisissez au paiement.",
    r1: "Chaque match du jour, football et tennis",
    f1: "Free : jusqu’à 3 par sport",
    r2: "L’analyse complète : forme, buts attendus, Elo, service et retour, surface",
    f2: "Free : choix, probabilité et le raisonnement en bref",
    r3: "Score et minute sur la fiche pendant le match",
    f3: "Free : l’heure du coup d’envoi seulement",
    r4: "Weekly Model Case inclus",
    f4: "Free : achat à l’unité",
    shared: "Dans les deux plans, chaque lecture est enregistrée avant le coup d’envoi et se clôture dans le registre public.",
    ctaStart: "Commencer avec Pro",
    ctaActivate: "Activer Pro",
    ctaUpgrade: "Passer à Pro",
    ctaActive: "Pro est actif",
    ctaReview: "Paiement en vérification",
    nextStep: "Compte et paiement à l’étape suivante.",
    billing: "Carte : un abonnement qui se renouvelle chaque mois (ou chaque année) jusqu’à ce que vous l’annuliez, n’importe quel jour, depuis votre compte. Rien n’est prélevé ensuite. Crypto : paiement unique, 30 jours, sans renouvellement.",
    proActive: "Pro est actif sur ce compte.",
    accessUntil: "Accès jusqu’au {d}.",
    manage: "Gérez-le depuis le menu de votre compte.",
    onBase: "Vous êtes sur Base : jusqu’à 7 par sport et par jour. Pro ouvre le reste du board et l’analyse complète.",
    freeName: "BetRedge Free",
    freePrice: "0 $",
    freeForever: "pour toujours",
    freeDesc: "Jusqu’à 3 lectures par sport et par jour, ouvertes en entier : choix, probabilité, raisonnement. Profil et registre public.",
    freeStart: "Commencer gratuitement",
    freeActive: "Free est actif",
    freeIncluded: "Déjà dans votre plan.",
    seeBoard: "Pas encore convaincu ? Ouvrez d’abord le board du jour",
  },
  ru: {
    headline: "Free читает три матча на вид спорта в день. Pro читает весь борд.",
    lede: "Та же модель, те же числа, записанные до стартового свистка. Меняется одно: какую часть сегодняшнего борда вы открываете.",
    proName: "BetRedge Pro",
    proTag: "Весь борд",
    perMonth: "/ месяц",
    annualLine: "Или {y} в год: платите за 11 месяцев, один бесплатно. Месяц или год выбираете при оплате.",
    r1: "Каждый матч дня, футбол и теннис",
    f1: "Free: до 3 на вид спорта",
    r2: "Полный разбор: форма, ожидаемые голы, Elo, подача и приём, покрытие",
    f2: "Free: выбор, вероятность и краткое обоснование",
    r3: "Счёт и минута на карточке по ходу матча",
    f3: "Free: только время начала",
    r4: "Weekly Model Case включён",
    f4: "Free: разовая покупка",
    shared: "В обоих планах каждое чтение записывается до начала матча и закрывается в публичном реестре.",
    ctaStart: "Начать с Pro",
    ctaActivate: "Активировать Pro",
    ctaUpgrade: "Перейти на Pro",
    ctaActive: "Pro активен",
    ctaReview: "Платёж на проверке",
    nextStep: "Аккаунт и оплата на следующем шаге.",
    billing: "Карта: подписка продлевается каждый месяц (или каждый год), пока вы её не отмените — в любой день, в своём аккаунте. После этого ничего не списывается. Крипто: разовый платёж, 30 дней, без продления.",
    proActive: "Pro активен на этом аккаунте.",
    accessUntil: "Доступ до {d}.",
    manage: "Управление — в меню аккаунта.",
    onBase: "У вас Base: до 7 на вид спорта в день. Pro открывает остальной борд и полный разбор.",
    freeName: "BetRedge Free",
    freePrice: "$0",
    freeForever: "навсегда",
    freeDesc: "До 3 чтений на вид спорта в день, открытых полностью: выбор, вероятность, обоснование. Профиль и публичный реестр.",
    freeStart: "Начать бесплатно",
    freeActive: "Free активен",
    freeIncluded: "Уже в вашем плане.",
    seeBoard: "Ещё сомневаетесь? Сначала откройте сегодняшний борд",
  },
};

/** Lingue senza traduzione propria → inglese (la stessa regola di classicCopy). */
export function plansCopy(lang: string): PlansCopy {
  const base = lang.toLowerCase().split(/[-_]/)[0];
  return (PLANS_LANGS as readonly string[]).includes(base) ? PLANS_COPY[base as PlansLang] : PLANS_COPY.en;
}

export function fillPlans(s: string, v: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in v ? String(v[k]) : `{${k}}`));
}

// #CLASSIC-PLANS-1014 — il prezzo annuale del Pro, in USD, come lo addebita
// PayGate: PAYGATE_PRICES.premium.annual in lib/paygate.ts (modulo server, non
// importabile qui). Specchio dichiarato, lo stesso di ANNUAL_PRICE nel
// CheckoutModal; plans-copy.test.ts lo confronta con la fonte.
export const PRO_ANNUAL_USD = 329.99;
