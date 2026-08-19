// lib/crm-content.ts
// Touchpoint email del CRM (#CRM-LIFECYCLE). Copy nelle 5 lingue del sito (it/en/es/fr/ru), tono doc.
import type { Touchpoint } from "./crm";
import { unsubToken } from "./crm-unsub";
import { brandedShell, brandCta } from "./email";
import { impressumLine } from "./legal-entity";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://betredge.com").replace(/\/$/, "");

export type CrmLang = "it" | "en" | "es" | "fr" | "ru";
export const CRM_LANGS: readonly CrmLang[] = ["it", "en", "es", "fr", "ru"] as const;

// Normalizza profiles.language ("en-US", "ES", null, …) sulla lingua CRM; fallback it (default sito).
export function resolveCrmLang(raw: string | null | undefined): CrmLang {
  const two = (raw || "").trim().toLowerCase().slice(0, 2);
  return (CRM_LANGS as readonly string[]).includes(two) ? (two as CrmLang) : "it";
}

type L10n = Record<CrmLang, string>;

const UNSUB_LABEL: L10n = {
  it: "Disiscriviti", en: "Unsubscribe", es: "Cancelar suscripción", fr: "Se désinscrire", ru: "Отписаться",
};
const OPEN_LABEL: L10n = {
  it: "Apri BetRedge", en: "Open BetRedge", es: "Abrir BetRedge", fr: "Ouvrir BetRedge", ru: "Открыть BetRedge",
};
const DISCLAIMER: L10n = {
  it: "BetRedge è un servizio di analisi statistica e informativa sportiva, non un operatore di gioco. Contenuto 18+. Il gioco può causare dipendenza. Gioca responsabilmente.",
  en: "BetRedge is a statistical analysis and sports information service, not a gambling operator. 18+. Gambling can be addictive. Play responsibly.",
  es: "BetRedge es un servicio de análisis estadístico e información deportiva, no un operador de juego. Contenido 18+. El juego puede causar adicción. Juega con responsabilidad.",
  fr: "BetRedge est un service d'analyse statistique et d'information sportive, pas un opérateur de jeux d'argent. Contenu 18+. Le jeu peut engendrer une dépendance. Jouez de manière responsable.",
  ru: "BetRedge — сервис статистического анализа и спортивной информации, а не оператор азартных игр. Контент 18+. Азартные игры могут вызывать зависимость. Играйте ответственно.",
};

// Footer legale conforme (legale-compliance 2026-06-28): mittente identificabile
// (dati Maven via env, [DA COMPILARE] finché non impostati), disclaimer +18 /
// non-gambling, link di disiscrizione one-click. Niente affiliate bookmaker.
function footer(identifier: string, lang: CrmLang): string {
  const contact = process.env.COMPANY_CONTACT_EMAIL || "info@betredge.com";
  const unsub = `${SITE}/api/crm/unsubscribe?t=${unsubToken(identifier)}`;
  // L'identità dell'operatore NON viene più dalle env: le COMPANY_LEGAL_NAME/
  // _ADDRESS/_VAT in prod erano state settate a "Betredge" + l'indirizzo di
  // corrispondenza di Londra, mentre /terms, /privacy e il footer del sito
  // dichiarano Maven Agency AG — due entità diverse nello stesso prodotto. Ora la
  // riga arriva da lib/legal-entity.ts, la stessa fonte del sito. Quelle env
  // restano in prod ma sono inerti (rimuoverle è sicuro).
  const idline = impressumLine();
  // Footer legale renderizzato nell'area footer scura del brandedShell.
  return `<p style="font-size:11px;color:#8b98a4;line-height:1.5;margin:0">${idline}<br>${contact} · <a href="${unsub}" style="color:#8b98a4;text-decoration:underline">${UNSUB_LABEL[lang]}</a><br>${DISCLAIMER[lang]}</p>`;
}

// #CRM-WEEKLY-PICK-0729 — etichetta del bottone quando il touchpoint porta alla
// Weekly Pick invece che ai piani. "Weekly Pick" resta invariato in tutte e 5 le
// lingue perché è il nome proprio del prodotto: è così che lo scrive la pagina
// (`unlockTitle` in app/weekly-pick/page.tsx) in it/en/es/fr/ru. Il nome
// descrittivo, invece, è tradotto ovunque — multipla della casa / house
// accumulator / combinada de la casa / combiné de la maison / экспресс — e nei
// body qui sotto si usa quello, così l'email parla la stessa lingua della pagina
// su cui atterra.
const WEEKLY_PICK_CTA: L10n = {
  it: "Vedi la Weekly Pick", en: "See the Weekly Pick", es: "Ver la Weekly Pick",
  fr: "Voir la Weekly Pick", ru: "Открыть Weekly Pick",
};

// `cta` è OPZIONALE: senza, il touchpoint si comporta esattamente come prima
// (bottone "Apri BetRedge" → /plans). Serve perché un'email che parla
// della Weekly Pick non può mandare alla pagina dei piani: il prodotto si compra
// dalla sua pagina, e chiedere all'utente di ritrovarsela da solo è il modo più
// semplice di perdere l'acquisto.
type CrmCta = { path: string; label: L10n };
// #CRM-FAKE-OFFERS-0805: `requiresLaunchPromo` marca i touchpoint che PARLANO di
// uno sconto. Il cron non li invia se la promo di lancio non è attiva o se quell
// utente non ne ha diritto (ha già pagato) → un'email non può più promettere un
// prezzo che il checkout rifiuterebbe. Il corpo può usare il token {deadline},
// sostituito con la data REALE di fine campagna: mai un countdown per-utente,
// che è il dark pattern che il resto del prodotto evita di proposito.
type CrmTouchpoint = Touchpoint & {
  subject: L10n;
  body: L10n;
  cta?: CrmCta;
  requiresLaunchPromo?: true;
};

// Locale per la data di scadenza in email. In email un countdown NON ha senso
// (si legge dopo): va una data.
const DATE_LOCALE: Record<CrmLang, string> = {
  it: "it-IT", en: "en-GB", es: "es-ES", fr: "fr-FR", ru: "ru-RU",
};

// day: per onboarding/acquisition/winback = giorni dall'ancora; per retention = giorni ALLA scadenza.
export const CRM_TOUCHPOINTS: CrmTouchpoint[] = [
  { key: "onb_activate", flow: "onboarding", day: 2,
    subject: {
      it: "Attiva il tuo BetRedge", en: "Activate your BetRedge", es: "Activa tu BetRedge",
      fr: "Activez votre BetRedge", ru: "Активируйте ваш BetRedge" },
    body: {
      it: "Sei a un passo: accedi e guarda il primo pronostico del modello. È gratis e ti mostra subito come ragiona.",
      en: "You're one step away: log in and see the model's first pick. It's free and shows how it reasons.",
      es: "Estás a un paso: inicia sesión y mira el primer pronóstico del modelo. Es gratis y te enseña enseguida cómo razona.",
      fr: "Vous y êtes presque : connectez-vous et découvrez le premier pronostic du modèle. C'est gratuit et vous montre tout de suite comment il raisonne.",
      ru: "Остался один шаг: войдите и посмотрите первый прогноз модели. Это бесплатно и сразу показывает, как она рассуждает." } },
  // Scala acquisition unita (#CRM-MERGE-0727): i tre touchpoint di valore vengono
  // dai testi di Steve (Resend Templates, EN), tradotti; le tre offerte sono le
  // nostre. Le chiavi delle offerte NON cambiano nome: chi le ha già ricevute non
  // le riprende. Il giorno 0 non è qui — è la welcome transazionale su attivazione
  // (lib/email.ts::welcomeEmail), che è servizio e non richiede consenso marketing.
  { key: "acq_day2_tested", flow: "acquisition", day: 2,
    subject: {
      it: "Hai provato il Free. Pronto per più edge?", en: "You've tested Free. Ready for more edges?",
      es: "Has probado el Free. ¿Listo para más edge?", fr: "Vous avez essayé le Free. Prêt pour plus d'edge ?",
      ru: "Вы попробовали Free. Готовы к большему?" },
    body: {
      it: "Con BetRedge Base ricevi le top 5 di calcio e 5 di tennis ogni settimana, con edge %, stake suggerito e closing line value su ogni pick. Con Pro non c'è tetto settimanale.",
      en: "BetRedge Base gives you the top 5 football and 5 tennis predictions every week, with edge %, suggested stake and closing line value on every pick. Pro removes the weekly cap.",
      es: "Con BetRedge Base recibes las 5 mejores predicciones de fútbol y 5 de tenis cada semana, con edge %, stake sugerido y closing line value en cada pick. Pro elimina el límite semanal.",
      fr: "Avec BetRedge Base, vous recevez les 5 meilleurs pronostics football et 5 tennis chaque semaine, avec edge %, mise suggérée et closing line value sur chaque pick. Pro supprime le plafond hebdomadaire.",
      ru: "BetRedge Base даёт топ-5 прогнозов по футболу и 5 по теннису каждую неделю, с edge %, рекомендованной ставкой и closing line value по каждому пику. Pro снимает недельный лимит." } },
  { key: "acq_day5_picture", flow: "acquisition", day: 5,
    subject: {
      it: "Vuoi vedere il quadro completo?", en: "Ready to see the full picture?",
      es: "¿Quieres ver el cuadro completo?", fr: "Envie de voir le tableau complet ?",
      ru: "Хотите увидеть полную картину?" },
    body: {
      it: "Nel Free vedi 1 pick per sport a settimana. Base apre l'intero board con edge, stake e closing line value; Pro aggiunge la Deep Analysis su forma, infortuni e campo, più il Match Builder e la Weekly Pick. La Weekly Pick — la multipla della casa, una a settimana — puoi anche sbloccarla da sola, una tantum, senza abbonarti.",
      en: "Free shows 1 pick per sport each week. Base opens the full board with edge, stake and closing line value; Pro adds Deep Analysis on form, injuries and venue, plus Match Builder and the Weekly Pick. You can also unlock the Weekly Pick on its own — the house accumulator, one a week — as a one-off, without subscribing.",
      es: "En Free ves 1 pick por deporte a la semana. Base abre todo el board con edge, stake y closing line value; Pro añade el Deep Analysis de forma, lesiones y campo, más el Match Builder y la Weekly Pick. La Weekly Pick — la combinada de la casa, una por semana — también puedes desbloquearla por separado, una sola vez, sin suscribirte.",
      fr: "En Free, vous voyez 1 pick par sport chaque semaine. Base ouvre tout le board avec edge, mise et closing line value ; Pro ajoute la Deep Analysis (forme, blessures, terrain), le Match Builder et la Weekly Pick. La Weekly Pick — le combiné de la maison, un par semaine — peut aussi se débloquer seule, en une fois, sans abonnement.",
      ru: "В Free вы видите 1 пик по каждому виду спорта в неделю. Base открывает весь борд с edge, ставкой и closing line value; Pro добавляет Deep Analysis по форме, травмам и полю, а также Match Builder и Weekly Pick. Weekly Pick — экспресс от команды, один в неделю — можно открыть и отдельно, разовой покупкой, без подписки." } },
  // #CRM-FAKE-OFFERS-0805 — questo touchpoint prometteva "−20% per 72h" a un
  // countdown per-utente. Nel codice il −20% NON È MAI ESISTITO (l'unico sconto è
  // LAUNCH_PROMO_DISCOUNT = 50%, solo primo acquisto), quindi era una promessa che
  // il checkout avrebbe rifiutato — ed era già uscita a clienti reali. Ora dice
  // l'offerta VERA, con la data reale di fine campagna, e non parte affatto se la
  // promo è spenta o se chi la riceve non ne ha diritto.
  { key: "acq_day14_welcome_offer", flow: "acquisition", day: 10, requiresLaunchPromo: true,
    subject: {
      it: "Offerta di lancio: −50% sul primo acquisto", en: "Launch offer: −50% on your first purchase",
      es: "Oferta de lanzamiento: −50% en tu primera compra",
      fr: "Offre de lancement : −50% sur votre premier achat", ru: "Стартовое предложение: −50% на первую покупку" },
    body: {
      it: "Per il lancio, il primo acquisto è a metà prezzo — mensile o annuale, lo sconto si applica da solo al checkout. Probabilità calibrate e track record verificabile, tutto sbloccato. L'offerta vale fino al {deadline}.",
      en: "For launch, your first purchase is half price — monthly or annual, and the discount applies automatically at checkout. Calibrated probabilities and a verifiable track record, all unlocked. The offer runs until {deadline}.",
      es: "Por el lanzamiento, tu primera compra está a mitad de precio — mensual o anual, y el descuento se aplica solo al pagar. Probabilidades calibradas y track record verificable, todo desbloqueado. La oferta es válida hasta el {deadline}.",
      fr: "Pour le lancement, votre premier achat est à moitié prix — mensuel ou annuel, et la remise s'applique automatiquement au paiement. Probabilités calibrées et track record vérifiable, tout est débloqué. L'offre est valable jusqu'au {deadline}.",
      ru: "В честь запуска первая покупка — за полцены: месячная или годовая, скидка применяется автоматически при оплате. Откалиброванные вероятности и проверяемый трек-рекорд — всё открыто. Предложение действует до {deadline}." } },
  { key: "acq_day14_reminder", flow: "acquisition", day: 14,
    subject: {
      it: "Ultimo promemoria: l'upgrade ti aspetta", en: "Last reminder: your upgrade is waiting",
      es: "Último recordatorio: tu upgrade te espera", fr: "Dernier rappel : votre upgrade vous attend",
      ru: "Последнее напоминание: апгрейд ждёт вас" },
    body: {
      it: "È l'ultima nota sull'upgrade per ora. Il Free ti ha dato un assaggio del modello: Base e Pro ti danno il quadro intero, ogni settimana.",
      en: "This is the last note about upgrading for now. Free gave you a glimpse of the model — Base and Pro give you the full picture, every week.",
      es: "Es la última nota sobre el upgrade por ahora. El Free te dio una muestra del modelo: Base y Pro te dan el cuadro completo, cada semana.",
      fr: "C'est le dernier message sur l'upgrade pour l'instant. Le Free vous a donné un aperçu du modèle : Base et Pro vous donnent le tableau complet, chaque semaine.",
      ru: "Это пока последнее письмо об апгрейде. Free дал вам представление о модели — Base и Pro дают полную картину каждую неделю." } },
  // #CRM-FAKE-OFFERS-0805: prometteva "−30% per 48h", sconto mai esistito.
  { key: "acq_day21_last_chance", flow: "acquisition", day: 21, requiresLaunchPromo: true,
    subject: {
      it: "Ultima occasione — angolo nuovo", en: "Last chance — a fresh angle", es: "Última oportunidad — un ángulo nuevo",
      fr: "Dernière chance — un angle nouveau", ru: "Последний шанс — новый взгляд" },
    body: {
      it: "Non i soliti pronostici: una opinione sola, calibrata, misurata. Il board completo, e il primo acquisto è a metà prezzo fino al {deadline}.",
      en: "Not the usual tips: one calibrated, measured opinion. The full board — and your first purchase is half price until {deadline}.",
      es: "No los pronósticos de siempre: una sola opinión, calibrada y medida. El board completo, y tu primera compra a mitad de precio hasta el {deadline}.",
      fr: "Pas les pronostics habituels : une seule opinion, calibrée et mesurée. Le board complet, et votre premier achat à moitié prix jusqu'au {deadline}.",
      ru: "Не обычные прогнозы: одно мнение, откалиброванное и взвешенное. Полный борд — и первая покупка за полцены до {deadline}." } },
  // #CRM-FAKE-OFFERS-0805: prometteva "−30% + 3 giorni di prova Pro". Nel prodotto
  // NON esiste né il −30% né alcun meccanismo di trial (verificato: l'unico
  // "trialing" è lo stato di una subscription Stripe, che leggiamo, non concediamo).
  // Erano due promesse impossibili nella stessa email, e ne sono uscite 2 copie.
  { key: "acq_day28_final", flow: "acquisition", day: 28, requiresLaunchPromo: true,
    subject: {
      it: "Offerta di lancio: ultima chiamata", en: "Launch offer: final call", es: "Oferta de lanzamiento: última llamada",
      fr: "Offre de lancement : dernier appel", ru: "Стартовое предложение: последний шанс" },
    body: {
      it: "Ultima spinta: il primo acquisto è a metà prezzo fino al {deadline} — poi si torna a prezzo pieno. Se preferisci provare senza abbonarti, la Weekly Pick si sblocca da sola.",
      en: "Final push: your first purchase is half price until {deadline} — then it's back to full price. If you'd rather try without subscribing, the Weekly Pick unlocks on its own.",
      es: "Último empujón: tu primera compra está a mitad de precio hasta el {deadline} — después se vuelve al precio completo. Si prefieres probar sin suscribirte, la Weekly Pick se desbloquea por separado.",
      fr: "Dernier coup de pouce : votre premier achat est à moitié prix jusqu'au {deadline} — ensuite, retour au plein tarif. Si vous préférez essayer sans abonnement, la Weekly Pick se débloque seule.",
      ru: "Последний рывок: первая покупка за полцены до {deadline} — потом снова полная цена. Если хотите попробовать без подписки, Weekly Pick открывается отдельно." } },
  // Chiude la scala: dice "non ti scriviamo più", quindi deve stare DOPO le offerte.
  // Nella sequenza originale di Steve era al giorno 14, prima di due sconti.
  { key: "acq_day35_door_open", flow: "acquisition", day: 35,
    subject: {
      it: "Niente più promemoria, la porta resta aperta", en: "No more reminders — the door stays open",
      es: "No más recordatorios, la puerta sigue abierta", fr: "Plus de rappels — la porte reste ouverte",
      ru: "Больше никаких напоминаний — дверь открыта" },
    body: {
      it: "Non ti scriviamo più sull'upgrade. Il piano gratuito resta tuo: quando vorrai l'accesso completo a predizioni, edge, stake e analisi, Base e Pro sono lì.",
      en: "We won't write about upgrading again. Your free plan isn't going anywhere — whenever you want full access to predictions, edge, stake and analysis, Base and Pro will be here.",
      es: "No volveremos a escribirte sobre el upgrade. Tu plan gratuito sigue siendo tuyo: cuando quieras acceso completo a predicciones, edge, stake y análisis, Base y Pro estarán ahí.",
      fr: "Nous ne reviendrons plus sur l'upgrade. Votre plan gratuit reste le vôtre : quand vous voudrez l'accès complet aux pronostics, à l'edge, aux mises et aux analyses, Base et Pro seront là.",
      ru: "Мы больше не будем писать об апгрейде. Бесплатный план остаётся вашим: когда захотите полный доступ к прогнозам, edge, ставкам и анализу — Base и Pro на месте." } },
  { key: "ret_7d_before", flow: "retention", day: 7,
    subject: {
      it: "Il tuo accesso scade tra 7 giorni", en: "Your access expires in 7 days", es: "Tu acceso caduca en 7 días",
      fr: "Votre accès expire dans 7 jours", ru: "Ваш доступ истекает через 7 дней" },
    // #CRM-COPY-TRUTHFUL-0817: prometteva "il riepilogo del mese", che questa
    // email non contiene e che il prodotto non genera. Al suo posto la cosa vera
    // e concreta: alla scadenza si torna al Free, che è 1 pick per sport.
    // #CRM-RENEWAL-COND-0819: la frase sul rinnovo era FALSA per metà dei clienti.
    // Il 19/08 calde ha verificato nel sorgente che i selling plan Shopify hanno
    // `billingPolicy.recurring.interval` = MONTH/YEAR, quindi si rinnovano da soli;
    // solo gli SKU marcati `recurring:false` non lo fanno. Dire "l'accesso non si
    // rinnova da solo: paga di nuovo" a un abbonato carta è dirgli il contrario del
    // vero, e nella peggiore delle letture è invitarlo a pagare due volte. Ora la
    // clausola è il token {renewal}, risolto per rail di pagamento — e in assenza di
    // informazione NON dice nulla, invece di indovinare.
    body: {
      it: "Alla scadenza torni al piano Free: 1 pick per sport a settimana. {renewal}",
      en: "When it expires you go back to Free: 1 pick per sport each week. {renewal}",
      es: "Al caducar vuelves al plan Free: 1 pick por deporte a la semana. {renewal}",
      fr: "À l'échéance vous repassez au plan Free : 1 pronostic par sport et par semaine. {renewal}",
      ru: "После истечения вы вернётесь на тариф Free: 1 прогноз по каждому виду спорта в неделю. {renewal}" } },
  { key: "ret_3d_before", flow: "retention", day: 3,
    subject: {
      it: "Rinnova: 3 giorni alla scadenza", en: "Renew: 3 days to expiry", es: "Renueva: quedan 3 días",
      fr: "Renouvelez : 3 jours avant l'échéance", ru: "Продлите: осталось 3 дня" },
    body: {
      it: "Continua da dove sei. Rinnovo rapido, nessuna interruzione del board.",
      en: "Continue where you left off. Quick renewal, no break in the board.",
      es: "Continúa donde estás. Renovación rápida, sin interrupciones del board.",
      fr: "Reprenez là où vous êtes. Renouvellement rapide, aucune interruption du board.",
      ru: "Продолжайте с того же места. Быстрое продление, борд без перерывов." } },
  { key: "ret_1d_before", flow: "retention", day: 1,
    // #CRM-COPY-TRUTHFUL-0817: prometteva un "bonus fedeltà (early access)" e una
    // "streak" che NON esistono nel prodotto (grep: nessun early access, nessuna
    // streak, nessun programma fedeltà). Restano solo fatti verificabili: la data
    // di scadenza e il fatto che lo storico non si perde.
    subject: {
      it: "Ultimo promemoria: domani scade", en: "Final reminder: expires tomorrow", es: "Último recordatorio: caduca mañana",
      fr: "Dernier rappel : expire demain", ru: "Последнее напоминание: завтра истекает" },
    body: {
      it: "Domani scade. Rinnova ora per non interrompere l'accesso al board completo; il tuo storico resta salvato in ogni caso.",
      en: "Expires tomorrow. Renew now to keep the full board without a gap; your history stays saved either way.",
      es: "Mañana caduca. Renueva ahora para no interrumpir el acceso al board completo; tu historial queda guardado en cualquier caso.",
      fr: "Ça expire demain. Renouvelez maintenant pour garder le board complet sans interruption ; votre historique reste sauvegardé dans tous les cas.",
      ru: "Завтра доступ истекает. Продлите сейчас, чтобы не терять полный борд; ваша история сохраняется в любом случае." } },
  { key: "wb_day1_expired", flow: "winback", day: 1,
    subject: {
      it: "Il tuo accesso è scaduto", en: "Your access has expired", es: "Tu acceso ha caducado",
      fr: "Votre accès a expiré", ru: "Ваш доступ истёк" },
    body: {
      it: "Il tuo storico e i risultati sono salvati. Riattiva per riprendere da dove avevi lasciato.",
      en: "Your history and results are saved. Reactivate to pick up where you left off.",
      es: "Tu historial y tus resultados están guardados. Reactiva para retomar donde lo dejaste.",
      fr: "Votre historique et vos résultats sont sauvegardés. Réactivez pour reprendre là où vous en étiez.",
      ru: "Ваша история и результаты сохранены. Активируйте снова, чтобы продолжить с того же места." } },
  { key: "wb_day7_renew", flow: "winback", day: 7,
    subject: {
      it: "Riprendi da dove eri", en: "Continue from where you stopped", es: "Retoma donde lo dejaste",
      fr: "Reprenez là où vous en étiez", ru: "Вернитесь туда, где остановились" },
    body: {
      it: "Il board continua a girare. Rientra quando vuoi: i tuoi dati ti aspettano. Se preferisci ripartire in leggerezza, la Weekly Pick si sblocca da sola: la multipla della casa di questa settimana, senza abbonamento.",
      en: "The board keeps running. Come back anytime: your data is waiting. If you'd rather start light, the Weekly Pick unlocks on its own: this week's house accumulator, no subscription.",
      es: "El board sigue girando. Vuelve cuando quieras: tus datos te esperan. Si prefieres empezar ligero, la Weekly Pick se desbloquea por separado: la combinada de la casa de esta semana, sin suscripción.",
      fr: "Le board continue de tourner. Revenez quand vous voulez : vos données vous attendent. Si vous préférez reprendre en douceur, la Weekly Pick se débloque seule : le combiné de la maison de cette semaine, sans abonnement.",
      ru: "Борд продолжает работать. Возвращайтесь в любой момент: ваши данные вас ждут. Если хотите вернуться налегке, Weekly Pick открывается отдельно: экспресс от команды на эту неделю, без подписки." },
    // Questo è l'unico touchpoint che porta ALLA Weekly Pick invece che ai piani:
    // per un ex-pagante lo sblocco singolo è il rientro più leggero che esista, e
    // mandarlo alla pagina dei piani sarebbe chiedergli di nuovo un abbonamento.
    cta: { path: "/weekly-pick", label: WEEKLY_PICK_CTA } },
  // #CRM-COPY-TRUTHFUL-0817: prometteva "un'offerta riservata / private offer"
  // che non esiste — e NON era nemmeno promo-gated, quindi il CTA portava al
  // prezzo pieno. Nota: la promo di lancio vale sul PRIMO acquisto, quindi per un
  // ex-pagante non sarebbe applicabile comunque: qui non può esistere un'offerta,
  // e la chiave resta `wb_day14_offer` perché è la PK del dedup (rinominarla
  // rimanderebbe l'email a chi l'ha già ricevuta).
  { key: "wb_day14_offer", flow: "winback", day: 14,
    subject: {
      it: "Cosa resta chiuso sul piano Free", en: "What stays locked on Free", es: "Qué sigue cerrado en el plan Free",
      fr: "Ce qui reste fermé sur le plan Free", ru: "Что остаётся закрытым на тарифе Free" },
    body: {
      it: "Sul Free vedi 1 pick per sport a settimana: il board completo con edge, stake e closing line value resta chiuso. Riattiva quando vuoi — i tuoi dati e il tuo storico sono ancora al loro posto.",
      en: "On Free you see 1 pick per sport each week: the full board with edge, stake and closing line value stays locked. Reactivate whenever you want — your data and history are still in place.",
      es: "En Free ves 1 pick por deporte a la semana: el board completo con edge, stake y closing line value sigue cerrado. Reactiva cuando quieras — tus datos y tu historial siguen en su sitio.",
      fr: "En Free vous voyez 1 pronostic par sport et par semaine : le board complet avec edge, mise et closing line value reste fermé. Réactivez quand vous voulez — vos données et votre historique sont toujours en place.",
      ru: "На Free вы видите 1 прогноз по каждому виду спорта в неделю: полный борд с edge, размером ставки и closing line value остаётся закрыт. Возвращайтесь когда захотите — ваши данные и история на месте." } },
  { key: "wb_day21_final", flow: "winback", day: 21,
    subject: {
      it: "Ultimo promemoria", en: "Last reminder", es: "Último recordatorio",
      fr: "Dernier rappel", ru: "Последнее напоминание" },
    body: {
      it: "Ultimo richiamo prima di tornare al flusso Free. Riattiva per non perdere lo storico.",
      en: "Last call before returning to the Free flow. Reactivate to keep your history.",
      es: "Última llamada antes de volver al flujo Free. Reactiva para no perder tu historial.",
      fr: "Dernier rappel avant le retour au flux Free. Réactivez pour ne pas perdre votre historique.",
      ru: "Последний сигнал перед возвратом на тариф Free. Активируйте снова, чтобы не потерять историю." } },
];

// Le chiavi dei touchpoint che parlano di sconto. Derivata dai dati, non scritta
// a mano: aggiungere un'offerta senza gatarla diventa impossibile per distrazione.
export function promoGatedKeys(): Set<string> {
  return new Set(CRM_TOUCHPOINTS.filter((t) => t.requiresLaunchPromo).map((t) => t.key));
}

// #CRM-FAKE-OFFERS-0805 — la data di fine campagna, localizzata. Legge la stessa
// env che governa lo sconto server-side, così l'email non può annunciare una
// scadenza diversa da quella che il checkout applica.
export function launchDeadlineLabel(lang: CrmLang, iso?: string | null): string | null {
  const raw = iso ?? process.env.LAUNCH_PROMO_DEADLINE;
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  try {
    // timeZone UTC NON è un dettaglio: launchPromoActive() confronta `now < deadline`
    // in UTC, mentre toLocaleDateString userebbe il fuso del server. Con una
    // deadline a 23:59Z e un server in Europa l'email avrebbe annunciato il GIORNO
    // DOPO la scadenza reale — cioè un'altra promessa che il checkout rifiuta.
    // Meglio la data che il server applica davvero.
    return d.toLocaleDateString(DATE_LOCALE[lang], {
      day: "numeric", month: "long", timeZone: "UTC",
    });
  } catch {
    return d.toISOString().slice(0, 10); // fallback: mai un token grezzo in un'email
  }
}

// #CRM-RENEWAL-COND-0819 — la clausola sul rinnovo, per rail di pagamento.
// Tre casi e non due, perché `plan_source` non basta a decidere in un caso:
//   - rail one-off (PayGate/crypto, PayPal): il pagamento è singolo → la frase
//     originale è VERA e resta;
//   - Shopify: i selling plan sono ricorrenti (MONTH/YEAR) MA esiste anche uno SKU
//     one-off a 30 giorni, e sul profilo non c'è nulla che distingua i due. Quindi
//     non si afferma né l'uno né l'altro: si dice che dipende dal piano, che è vero
//     in ogni caso e non manda nessuno a pagare due volte;
//   - tutto il resto (referral, manuale, admin, sorgente assente): NESSUNA clausola.
//     Chi non ha pagato non deve leggere "paga di nuovo", e su un dato mancante il
//     silenzio è l'unica cosa che non può essere falsa.
const RENEWAL_CLAUSE: Record<"oneoff" | "shopify", L10n> = {
  oneoff: {
    it: "L'accesso non si rinnova da solo: per continuare serve un nuovo pagamento.",
    en: "Access doesn't auto-renew: continuing takes a new payment.",
    es: "El acceso no se renueva solo: para continuar hace falta un nuevo pago.",
    fr: "L'accès ne se renouvelle pas tout seul : continuer demande un nouveau paiement.",
    ru: "Доступ не продлевается сам: чтобы продолжить, нужен новый платёж.",
  },
  shopify: {
    it: "Se il tuo piano è a rinnovo automatico non devi fare nulla; se non lo è, per continuare serve un nuovo pagamento.",
    en: "If your plan renews automatically there's nothing to do; if it doesn't, continuing takes a new payment.",
    es: "Si tu plan se renueva automáticamente no tienes que hacer nada; si no, para continuar hace falta un nuevo pago.",
    fr: "Si votre plan se renouvelle automatiquement, rien à faire ; sinon, continuer demande un nouveau paiement.",
    ru: "Если ваш тариф продлевается автоматически, делать ничего не нужно; если нет — нужен новый платёж.",
  },
};

/** Rail → clausola. Sorgente sconosciuta o non-pagante ⇒ stringa vuota (nessun claim). */
export function renewalClause(lang: CrmLang, planSource?: string | null): string {
  const s = (planSource ?? "").trim().toLowerCase();
  if (s === "shopify") return RENEWAL_CLAUSE.shopify[lang];
  if (s === "paygate" || s === "paypal" || s === "crypto") return RENEWAL_CLAUSE.oneoff[lang];
  return "";
}

export function renderCrm(
  key: string,
  lang: CrmLang,
  identifier: string,
  opts?: { launchDeadline?: string | null; planSource?: string | null }
): { subject: string; html: string; text: string; unsubUrl: string } | null {
  const t = CRM_TOUCHPOINTS.find((x) => x.key === key);
  if (!t) return null;
  // Destinazione: i piani per default, la pagina del prodotto se il touchpoint ne
  // dichiara una. Il parametro `crm=<key>` resta su ENTRAMBE le strade — è quello
  // che permette di attribuire una conversione all'email che l'ha generata, e
  // perderlo sul percorso nuovo renderebbe la Weekly Pick l'unica cosa non
  // misurabile del CRM.
  const path = t.cta?.path ?? "/plans";
  const sep = path.includes("?") ? "&" : "?";
  const href = `${SITE}${path}${sep}crm=${encodeURIComponent(t.key)}`;
  const label = t.cta?.label[lang] ?? OPEN_LABEL[lang];
  let body = t.body[lang];
  // Un token non sostituito finirebbe letteralmente nell'inbox ("fino al
  // {deadline}"), quindi senza una data VERA non si renderizza affatto: chi
  // chiama tratta il null come "niente da inviare". Fail-closed, come lo sconto.
  if (body.includes("{deadline}")) {
    const deadline = launchDeadlineLabel(lang, opts?.launchDeadline);
    if (!deadline) return null;
    body = body.replaceAll("{deadline}", deadline);
  }
  // {renewal}: a differenza di {deadline} NON è fail-closed, perché la stringa vuota
  // è un esito legittimo e desiderato (nessuna affermazione sul rinnovo). Va però
  // ripulita la spaziatura, altrimenti resta un doppio spazio prima del punto finale
  // — il tipo di dettaglio che fa sembrare l'email generata male.
  if (body.includes("{renewal}")) {
    body = body.replaceAll("{renewal}", renewalClause(lang, opts?.planSource))
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }
  const unsub = `${SITE}/api/crm/unsubscribe?t=${unsubToken(identifier)}`;
  const unl = UNSUB_LABEL[lang];
  const inner = `<p style="font-size:14px;line-height:1.6;margin:0;color:#cdd6dd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${body}</p>${brandCta(label, href)}`;
  return {
    subject: t.subject[lang],
    html: brandedShell(inner, { lang, footerHtml: footer(identifier, lang) }),
    text: `${body}\n\n${label}: ${href}\n\n— ${unl}: ${unsub}`,
    unsubUrl: unsub,
  };
}
