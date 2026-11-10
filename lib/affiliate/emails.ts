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
  coin?: "USDT" | "USDC";
  network?: "polygon" | "tron";
}): Mail {
  const lang = resolveMailLang(opts.lang);
  const t = WALLET[lang];
  const parts = [
    opts.removed
      ? t.removed
      : t.changed(opts.addressMasked ?? "—", opts.usableAfterISO ? fmtDate(opts.usableAfterISO, lang) : "—").replaceAll("USDT", opts.coin ?? "USDT").replaceAll("Polygon", opts.network === "tron" ? "Tron" : "Polygon"),
  ];
  if (opts.payoutCancelled) parts.push(t.payoutCancelled);
  parts.push(t.notYou(ACCOUNT_CONTACT_EMAIL));
  return build(lang, opts.removed ? t.subjRemoved : t.subjChanged, parts);
}

// ── Pagamento inviato / payout annullato (PR-9) ──────────────────────────────

function fmtUsd(n: number, lang: MailLang): string {
  return new Intl.NumberFormat(LOCALE[lang], { style: "currency", currency: "USD" }).format(n);
}

const PAYOUT: Record<
  MailLang,
  {
    subjPaid: string;
    paid: (usd: string, coin: string) => string;
    link: (url: string) => string;
    subjCancelled: string;
    cancelled: (usd: string) => string;
    contact: (m: string) => string;
  }
> = {
  it: {
    subjPaid: "Pagamento inviato",
    paid: (u, c) => `Ti abbiamo inviato ${u}: sono arrivati ${c} sul wallet che hai registrato, verificati sulla rete.`,
    link: (url) => `Puoi controllare la transazione da te sull'explorer: ${url}`,
    subjCancelled: "Pagamento annullato prima dell'invio",
    cancelled: (u) =>
      `Il pagamento di ${u} che era in preparazione è stato annullato da noi prima dell'invio. Nessun importo è partito: è tornato tra le commissioni maturate e ripartirà con il prossimo pagamento.`,
    contact: (m) => `Per qualsiasi domanda scrivici a ${m}.`,
  },
  en: {
    subjPaid: "Payout sent",
    paid: (u, c) => `We've sent you ${u}: ${c} arrived on the wallet you registered, verified on the network.`,
    link: (url) => `You can check the transaction yourself on the explorer: ${url}`,
    subjCancelled: "Payout cancelled before sending",
    cancelled: (u) =>
      `The ${u} payout that was in preparation was cancelled by us before sending. Nothing was sent: the amount went back to your earned commissions and will go out with the next payout.`,
    contact: (m) => `For any question, write to us at ${m}.`,
  },
  es: {
    subjPaid: "Pago enviado",
    paid: (u, c) => `Te hemos enviado ${u}: han llegado ${c} al wallet que registraste, verificados en la red.`,
    link: (url) => `Puedes comprobar la transacción tú mismo en el explorador: ${url}`,
    subjCancelled: "Pago cancelado antes del envío",
    cancelled: (u) =>
      `El pago de ${u} que estaba en preparación lo cancelamos antes del envío. No se ha enviado nada: el importe ha vuelto a tus comisiones disponibles y saldrá con el próximo pago.`,
    contact: (m) => `Para cualquier duda, escríbenos a ${m}.`,
  },
  fr: {
    subjPaid: "Paiement envoyé",
    paid: (u, c) => `Nous vous avons envoyé ${u} : ${c} sont arrivés sur le wallet que vous avez enregistré, vérifiés sur le réseau.`,
    link: (url) => `Vous pouvez vérifier la transaction vous-même sur l'explorateur : ${url}`,
    subjCancelled: "Paiement annulé avant l'envoi",
    cancelled: (u) =>
      `Le paiement de ${u} en préparation a été annulé par nos soins avant l'envoi. Rien n'a été envoyé : le montant est revenu dans vos commissions acquises et partira avec le prochain paiement.`,
    contact: (m) => `Pour toute question, écrivez-nous à ${m}.`,
  },
  ru: {
    subjPaid: "Выплата отправлена",
    paid: (u, c) => `Мы отправили вам ${u}: ${c} поступили на зарегистрированный вами кошелёк, подтверждено в сети.`,
    link: (url) => `Проверить транзакцию можно самостоятельно в обозревателе: ${url}`,
    subjCancelled: "Выплата отменена до отправки",
    cancelled: (u) =>
      `Выплата ${u}, которая готовилась, отменена нами до отправки. Ничего не отправлено: сумма вернулась в начисленные комиссии и уйдёт со следующей выплатой.`,
    contact: (m) => `По любым вопросам пишите нам на ${m}.`,
  },
};

export function payoutPaidEmail(opts: {
  lang: string | null | undefined;
  amountUsd: number;
  amountCoin: string;
  coin: string;
  explorerUrl: string;
}): Mail {
  const lang = resolveMailLang(opts.lang);
  const t = PAYOUT[lang];
  const coin = `${Number(opts.amountCoin).toFixed(2)} ${opts.coin}`;
  return build(lang, t.subjPaid, [
    t.paid(fmtUsd(opts.amountUsd, lang), coin),
    t.link(opts.explorerUrl),
    t.contact(ACCOUNT_CONTACT_EMAIL),
  ]);
}

/** Il testo è generico di proposito: il motivo libero dell'admin non esce mai. */
export function payoutCancelledEmail(opts: { lang: string | null | undefined; amountUsd: number }): Mail {
  const lang = resolveMailLang(opts.lang);
  const t = PAYOUT[lang];
  return build(lang, t.subjCancelled, [t.cancelled(fmtUsd(opts.amountUsd, lang)), t.contact(ACCOUNT_CONTACT_EMAIL)]);
}

// ── Avviso operatori: wallet inserito / cambiato / rimosso (#AFF-WALLET-ALERT) ──
// Interno, solo in italiano. Indirizzo SEMPRE mascherato: l'intero si legge
// (owner) nella scheda del backoffice linkata.

export type WalletOpsAction = "added" | "changed" | "removed";

const OPS_ACTION: Record<WalletOpsAction, string> = {
  added: "ha inserito un wallet",
  changed: "ha cambiato il wallet",
  removed: "ha rimosso il wallet",
};

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function walletOpsAlertEmail(opts: {
  affiliateId: number;
  code: string;
  action: WalletOpsAction;
  addressMasked: string | null;
  coin?: string;
  network?: string;
  usableAfterISO: string | null;
  cancelledPayouts: number;
  boUrl: string;
}): Mail {
  const link = `${opts.boUrl}/affiliate-program/${opts.affiliateId}`;
  const subject = `[Affiliati] ${opts.code} ${OPS_ACTION[opts.action]}`;
  const lines = [`L'affiliato ${opts.code} (id ${opts.affiliateId}) ${OPS_ACTION[opts.action]}.`];
  if (opts.action !== "removed") {
    lines.push(`Wallet: ${opts.addressMasked ?? "—"} · ${opts.coin ?? "—"} · ${opts.network ?? "—"}.`);
    lines.push(`Utilizzabile dal ${opts.usableAfterISO ? fmtDate(opts.usableAfterISO, "it") : "—"}. Screening da fare dal backoffice.`);
  }
  if (opts.cancelledPayouts > 0) lines.push(`Payout in preparazione annullati: ${opts.cancelledPayouts}.`);
  lines.push(`Scheda nel backoffice: ${link}`);
  const html = brandedShell(
    brandHeading(escHtml(subject)) + lines.map((l) => brandText(escHtml(l))).join(""),
    { lang: "it" },
  );
  return { subject, html, text: lines.join("\n\n"), replyTo: ACCOUNT_CONTACT_EMAIL };
}
