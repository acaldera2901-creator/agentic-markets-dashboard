// lib/crm-content.ts
// Touchpoint email del CRM (#CRM-LIFECYCLE). Copy nelle 5 lingue del sito (it/en/es/fr/ru), tono doc.
import type { Touchpoint } from "./crm";
import { unsubToken } from "./crm-unsub";
import { brandedShell, brandCta } from "./email";

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
  const co = process.env.COMPANY_LEGAL_NAME || "Maven Agency";
  const addr = process.env.COMPANY_ADDRESS || "";
  const vat = process.env.COMPANY_VAT || "";
  const contact = process.env.COMPANY_CONTACT_EMAIL || "info@betredge.com";
  const unsub = `${SITE}/api/crm/unsubscribe?t=${unsubToken(identifier)}`;
  const idline = [co, addr, vat ? `P.IVA ${vat}` : ""].filter(Boolean).join(" · ");
  // Footer legale renderizzato nell'area footer scura del brandedShell.
  return `<p style="font-size:11px;color:#8b98a4;line-height:1.5;margin:0">${idline}<br>${contact} · <a href="${unsub}" style="color:#8b98a4;text-decoration:underline">${UNSUB_LABEL[lang]}</a><br>${DISCLAIMER[lang]}</p>`;
}

type CrmTouchpoint = Touchpoint & { subject: L10n; body: L10n };

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
  { key: "acq_day7_offer", flow: "acquisition", day: 7,
    subject: {
      it: "Il tuo primo upgrade BetRedge", en: "Your first BetRedge upgrade", es: "Tu primer upgrade de BetRedge",
      fr: "Votre premier upgrade BetRedge", ru: "Ваш первый апгрейд BetRedge" },
    body: {
      it: "Nel Free vedi 2 pick a settimana. Con Plus sblocchi l'intero board, edge e spiegazioni. Da 14,99 USD/mese.",
      en: "Free shows 2 picks/week. Plus unlocks the full board, edge and explanations. From $14.99/mo.",
      es: "En Free ves 2 picks por semana. Con Plus desbloqueas todo el board, el edge y las explicaciones. Desde 14,99 USD/mes.",
      fr: "En Free, vous voyez 2 picks par semaine. Avec Plus, débloquez tout le board, l'edge et les explications. À partir de 14,99 USD/mois.",
      ru: "В Free вы видите 2 пика в неделю. С Plus открывается весь борд, edge и объяснения. От 14,99 USD в месяц." } },
  { key: "acq_day14_welcome_offer", flow: "acquisition", day: 14,
    subject: {
      it: "Offerta benvenuto: −20% per 72h", en: "Welcome offer: −20% for 72h", es: "Oferta de bienvenida: −20% por 72h",
      fr: "Offre de bienvenue : −20% pendant 72h", ru: "Приветственное предложение: −20% на 72 часа" },
    body: {
      it: "Solo per te, 72 ore: Plus a −20%. Probabilità calibrate e track record verificabile, tutto sbloccato.",
      en: "Just for you, 72 hours: Plus at −20%. Calibrated probabilities and verifiable track record, all unlocked.",
      es: "Solo para ti, 72 horas: Plus con −20%. Probabilidades calibradas y track record verificable, todo desbloqueado.",
      fr: "Rien que pour vous, 72 heures : Plus à −20%. Probabilités calibrées et track record vérifiable, tout est débloqué.",
      ru: "Только для вас, 72 часа: Plus со скидкой 20%. Откалиброванные вероятности и проверяемый трек-рекорд — всё открыто." } },
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
      it: "Offerta finale + 3 giorni VIP", en: "Final offer + 3-day VIP", es: "Oferta final + 3 días VIP",
      fr: "Offre finale + 3 jours VIP", ru: "Финальное предложение + 3 дня VIP" },
    body: {
      it: "Ultima spinta: Plus a −30% con 3 giorni di prova VIP (analisi più profonda). Poi si torna a prezzo pieno.",
      en: "Final push: Plus at −30% with a 3-day VIP trial (deeper analysis). Then back to full price.",
      es: "Último empujón: Plus con −30% y 3 días de prueba VIP (análisis más profundo). Después se vuelve al precio completo.",
      fr: "Dernier coup de pouce : Plus à −30% avec 3 jours d'essai VIP (analyse plus poussée). Ensuite, retour au plein tarif.",
      ru: "Последний рывок: Plus со скидкой 30% и 3 дня пробного VIP (более глубокий анализ). Потом снова полная цена." } },
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
      it: "Il board continua a girare. Rientra quando vuoi: i tuoi dati ti aspettano.",
      en: "The board keeps running. Come back anytime: your data is waiting.",
      es: "El board sigue girando. Vuelve cuando quieras: tus datos te esperan.",
      fr: "Le board continue de tourner. Revenez quand vous voulez : vos données vous attendent.",
      ru: "Борд продолжает работать. Возвращайтесь в любой момент: ваши данные вас ждут." } },
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
  const href = `${SITE}/app?tab=plans&crm=${encodeURIComponent(t.key)}`;
  const label = OPEN_LABEL[lang];
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
