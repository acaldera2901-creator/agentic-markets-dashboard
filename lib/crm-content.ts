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
// (bottone "Apri BetRedge" → /app?tab=plans). Serve perché un'email che parla
// della Weekly Pick non può mandare alla pagina dei piani: il prodotto si compra
// dalla sua pagina, e chiedere all'utente di ritrovarsela da solo è il modo più
// semplice di perdere l'acquisto.
type CrmCta = { path: string; label: L10n };
type CrmTouchpoint = Touchpoint & { subject: L10n; body: L10n; cta?: CrmCta };

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
  { key: "acq_day14_welcome_offer", flow: "acquisition", day: 10,
    subject: {
      it: "Offerta benvenuto: −20% per 72h", en: "Welcome offer: −20% for 72h", es: "Oferta de bienvenida: −20% por 72h",
      fr: "Offre de bienvenue : −20% pendant 72h", ru: "Приветственное предложение: −20% на 72 часа" },
    body: {
      it: "Solo per te, 72 ore: BetRedge Base a −20%. Probabilità calibrate e track record verificabile, tutto sbloccato.",
      en: "Just for you, 72 hours: BetRedge Base at −20%. Calibrated probabilities and verifiable track record, all unlocked.",
      es: "Solo para ti, 72 horas: BetRedge Base con −20%. Probabilidades calibradas y track record verificable, todo desbloqueado.",
      fr: "Rien que pour vous, 72 heures : BetRedge Base à −20%. Probabilités calibrées et track record vérifiable, tout est débloqué.",
      ru: "Только для вас, 72 часа: BetRedge Base со скидкой 20%. Откалиброванные вероятности и проверяемый трек-рекорд — всё открыто." } },
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
  { key: "acq_day21_last_chance", flow: "acquisition", day: 21,
    subject: {
      it: "Ultima occasione — angolo nuovo", en: "Last chance — a fresh angle", es: "Última oportunidad — un ángulo nuevo",
      fr: "Dernière chance — un angle nouveau", ru: "Последний шанс — новый взгляд" },
    body: {
      it: "Non i soliti pronostici: una opinione sola, calibrata, misurata. Sblocca il board completo a −30% per 48h.",
      en: "Not the usual tips: one calibrated, measured opinion. Unlock the full board at −30% for 48h.",
      es: "No los pronósticos de siempre: una sola opinión, calibrada y medida. Desbloquea el board completo con −30% por 48h.",
      fr: "Pas les pronostics habituels : une seule opinion, calibrée et mesurée. Débloquez le board complet à −30% pendant 48h.",
      ru: "Не обычные прогнозы: одно мнение, откалиброванное и взвешенное. Откройте полный борд со скидкой 30% на 48 часов." } },
  { key: "acq_day28_final", flow: "acquisition", day: 28,
    subject: {
      it: "Offerta finale + 3 giorni Pro", en: "Final offer + 3-day Pro", es: "Oferta final + 3 días Pro",
      fr: "Offre finale + 3 jours Pro", ru: "Финальное предложение + 3 дня Pro" },
    body: {
      it: "Ultima spinta: BetRedge Base a −30% con 3 giorni di prova BetRedge Pro (analisi più profonda). Poi si torna a prezzo pieno.",
      en: "Final push: BetRedge Base at −30% with a 3-day BetRedge Pro trial (deeper analysis). Then back to full price.",
      es: "Último empujón: BetRedge Base con −30% y 3 días de prueba de BetRedge Pro (análisis más profundo). Después se vuelve al precio completo.",
      fr: "Dernier coup de pouce : BetRedge Base à −30% avec 3 jours d'essai BetRedge Pro (analyse plus poussée). Ensuite, retour au plein tarif.",
      ru: "Последний рывок: BetRedge Base со скидкой 30% и 3 дня пробного BetRedge Pro (более глубокий анализ). Потом снова полная цена." } },
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
    body: {
      it: "Riepilogo del mese e cosa stai per perdere. L'accesso non si rinnova da solo: paga di nuovo per continuare.",
      en: "Your monthly recap and what you'd lose. Access doesn't auto-renew: pay again to continue.",
      es: "Resumen del mes y lo que estás a punto de perder. El acceso no se renueva solo: vuelve a pagar para continuar.",
      fr: "Le récap du mois et ce que vous êtes sur le point de perdre. L'accès ne se renouvelle pas tout seul : payez à nouveau pour continuer.",
      ru: "Итоги месяца и то, что вы можете потерять. Доступ не продлевается сам: оплатите снова, чтобы продолжить." } },
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
    subject: {
      it: "Ultimo promemoria + bonus fedeltà", en: "Final reminder + loyalty bonus", es: "Último recordatorio + bonus de fidelidad",
      fr: "Dernier rappel + bonus fidélité", ru: "Последнее напоминание + бонус за лояльность" },
    body: {
      it: "Domani scade. Rinnova ora e mantieni la streak: bonus fedeltà (early access), non sconti.",
      en: "Expires tomorrow. Renew now and keep your streak: loyalty bonus (early access), not discounts.",
      es: "Mañana caduca. Renueva ahora y mantén la racha: bonus de fidelidad (early access), no descuentos.",
      fr: "Ça expire demain. Renouvelez maintenant et gardez votre série : bonus fidélité (accès anticipé), pas de remises.",
      ru: "Завтра доступ истекает. Продлите сейчас и сохраните серию: бонус за лояльность (ранний доступ), а не скидки." } },
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
  { key: "wb_day14_offer", flow: "winback", day: 14,
    subject: {
      it: "Offerta di riattivazione privata", en: "Private reactivation offer", es: "Oferta privada de reactivación",
      fr: "Offre privée de réactivation", ru: "Личное предложение о возвращении" },
    body: {
      it: "Un'offerta riservata per tornare. Mai migliore degli sconti di ingresso — ma pensata per te.",
      en: "A private offer to return. Never better than joining offers — but made for you.",
      es: "Una oferta reservada para volver. Nunca mejor que las ofertas de entrada — pero pensada para ti.",
      fr: "Une offre réservée pour revenir. Jamais meilleure que les offres d'entrée — mais pensée pour vous.",
      ru: "Закрытое предложение для возвращения. Не выгоднее стартовых скидок — но составлено для вас." } },
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

export function renderCrm(key: string, lang: CrmLang, identifier: string): { subject: string; html: string; text: string; unsubUrl: string } | null {
  const t = CRM_TOUCHPOINTS.find((x) => x.key === key);
  if (!t) return null;
  // Destinazione: i piani per default, la pagina del prodotto se il touchpoint ne
  // dichiara una. Il parametro `crm=<key>` resta su ENTRAMBE le strade — è quello
  // che permette di attribuire una conversione all'email che l'ha generata, e
  // perderlo sul percorso nuovo renderebbe la Weekly Pick l'unica cosa non
  // misurabile del CRM.
  const path = t.cta?.path ?? "/app?tab=plans";
  const sep = path.includes("?") ? "&" : "?";
  const href = `${SITE}${path}${sep}crm=${encodeURIComponent(t.key)}`;
  const label = t.cta?.label[lang] ?? OPEN_LABEL[lang];
  const body = t.body[lang];
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
