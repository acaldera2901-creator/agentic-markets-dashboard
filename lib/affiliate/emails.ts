// lib/affiliate/emails.ts — #AFFILIATE-V2-CRYPTO-1007
// Email transazionali del programma affiliati. Usano lo stesso guscio e lo
// stesso invio di tutte le altre (lib/email.ts: brandedShell + sendEmail via
// Resend): nessun meccanismo nuovo.
//
// Testi it/en scritti qui; es/fr/ru sono traduzioni di prodotto da far
// rivedere a un madrelingua prima del live (come gli altri testi del programma).
// Nessuna email contiene l'indirizzo intero: solo `maskAddress`.

import {
  ACCOUNT_CONTACT_EMAIL,
  brandHeading,
  brandText,
  brandedShell,
  resolveMailLang,
  type MailLang,
} from "@/lib/email";

export type Mail = { subject: string; html: string; text: string; replyTo: string };

const LOCALE: Record<MailLang, string> = { it: "it-IT", en: "en-GB", es: "es-ES", fr: "fr-FR", ru: "ru-RU" };

function fmtDate(iso: string, lang: MailLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d)} UTC`;
}

function build(lang: MailLang, subject: string, paragraphs: string[]): Mail {
  const html = brandedShell(
    brandHeading(subject) + paragraphs.map((p) => brandText(p)).join(""),
    { lang },
  );
  return { subject, html, text: paragraphs.join("\n\n"), replyTo: ACCOUNT_CONTACT_EMAIL };
}

// ── Wallet cambiato / rimosso (PR-5) ─────────────────────────────────────────

const WALLET: Record<
  MailLang,
  {
    subjChanged: string;
    subjRemoved: string;
    changed: (addr: string, date: string) => string;
    removed: string;
    payoutCancelled: string;
    notYou: (m: string) => string;
  }
> = {
  it: {
    subjChanged: "Il wallet per i pagamenti è cambiato",
    subjRemoved: "Il wallet per i pagamenti è stato rimosso",
    changed: (a, d) =>
      `Il wallet su cui ricevi i pagamenti del programma affiliati ora è ${a} (USDT su Polygon). Sarà utilizzabile dal ${d}: fino ad allora non possiamo pagarti su nessun wallet. Le commissioni maturano comunque.`,
    removed:
      "Il wallet su cui ricevi i pagamenti del programma affiliati è stato rimosso. I pagamenti restano fermi finché non registri un nuovo wallet; le commissioni maturano comunque.",
    payoutCancelled:
      "Il pagamento che era in preparazione è stato annullato prima dell'invio: l'importo è tornato tra le maturate.",
    notYou: (m) => `Se non sei stato tu, rispondi subito a questa email o scrivici a ${m}.`,
  },
  en: {
    subjChanged: "Your payout wallet has changed",
    subjRemoved: "Your payout wallet has been removed",
    changed: (a, d) =>
      `The wallet that receives your affiliate payouts is now ${a} (USDT on Polygon). It becomes usable on ${d}: until then we can't pay you to any wallet. Commissions keep accruing.`,
    removed:
      "The wallet that receives your affiliate payouts has been removed. Payouts are on hold until you register a new wallet; commissions keep accruing.",
    payoutCancelled: "The payout that was in preparation was cancelled before sending: the amount went back to earned.",
    notYou: (m) => `If this wasn't you, reply to this email right away or write to us at ${m}.`,
  },
  es: {
    subjChanged: "Tu wallet de pagos ha cambiado",
    subjRemoved: "Tu wallet de pagos ha sido eliminado",
    changed: (a, d) =>
      `El wallet en el que recibes los pagos del programa de afiliados ahora es ${a} (USDT en Polygon). Podrá usarse desde el ${d}: hasta entonces no podemos pagarte en ningún wallet. Las comisiones siguen acumulándose.`,
    removed:
      "El wallet en el que recibes los pagos del programa de afiliados ha sido eliminado. Los pagos quedan en pausa hasta que registres un nuevo wallet; las comisiones siguen acumulándose.",
    payoutCancelled:
      "El pago que estaba en preparación se canceló antes del envío: el importe ha vuelto a tus comisiones disponibles.",
    notYou: (m) => `Si no has sido tú, responde de inmediato a este correo o escríbenos a ${m}.`,
  },
  fr: {
    subjChanged: "Votre wallet de paiement a changé",
    subjRemoved: "Votre wallet de paiement a été supprimé",
    changed: (a, d) =>
      `Le wallet sur lequel vous recevez les paiements du programme d'affiliation est désormais ${a} (USDT sur Polygon). Il sera utilisable à partir du ${d} : d'ici là, nous ne pouvons vous payer sur aucun wallet. Les commissions continuent de s'accumuler.`,
    removed:
      "Le wallet sur lequel vous recevez les paiements du programme d'affiliation a été supprimé. Les paiements sont suspendus jusqu'à ce que vous enregistriez un nouveau wallet ; les commissions continuent de s'accumuler.",
    payoutCancelled:
      "Le paiement en préparation a été annulé avant l'envoi : le montant est revenu dans vos commissions acquises.",
    notYou: (m) => `Si ce n'était pas vous, répondez immédiatement à cet e-mail ou écrivez-nous à ${m}.`,
  },
  ru: {
    subjChanged: "Кошелёк для выплат изменён",
    subjRemoved: "Кошелёк для выплат удалён",
    changed: (a, d) =>
      `Кошелёк для выплат по партнёрской программе теперь ${a} (USDT в сети Polygon). Он станет доступен ${d}: до этого мы не можем выплачивать ни на один кошелёк. Комиссии продолжают начисляться.`,
    removed:
      "Кошелёк для выплат по партнёрской программе удалён. Выплаты приостановлены, пока вы не добавите новый кошелёк; комиссии продолжают начисляться.",
    payoutCancelled: "Выплата, которая готовилась, отменена до отправки: сумма вернулась в начисленные комиссии.",
    notYou: (m) => `Если это были не вы, сразу ответьте на это письмо или напишите нам на ${m}.`,
  },
};

export function walletChangedEmail(opts: {
  lang: string | null | undefined;
  removed: boolean;
  addressMasked: string | null;
  usableAfterISO: string | null;
  payoutCancelled: boolean;
}): Mail {
  const lang = resolveMailLang(opts.lang);
  const t = WALLET[lang];
  const parts = [
    opts.removed
      ? t.removed
      : t.changed(opts.addressMasked ?? "—", opts.usableAfterISO ? fmtDate(opts.usableAfterISO, lang) : "—"),
  ];
  if (opts.payoutCancelled) parts.push(t.payoutCancelled);
  parts.push(t.notYou(ACCOUNT_CONTACT_EMAIL));
  return build(lang, opts.removed ? t.subjRemoved : t.subjChanged, parts);
}
