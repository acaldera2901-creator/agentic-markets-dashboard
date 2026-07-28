"use client";
// #CRYPTO-DIRECT-1 — pannello del pagamento crypto diretto: l'utente sceglie la
// moneta che possiede, riceve indirizzo dedicato e importo esatto, invia dal suo
// wallet. Nessun acquisto con carta: chi ha già USDT/USDC paga con quelli.
// Lo stato NON si deduce dal click: si chiede al server, che guarda la catena.
//
// #WEEKLY-CRYPTO-DIRECT-1 — estratto dal monolite app/app/page.tsx per essere LO
// STESSO componente sul checkout dei piani e su /weekly-pick: due copie avrebbero
// significato due comportamenti a divergere alla prima modifica. `lang` arriva come
// prop e non da un context perché /weekly-pick non vive dentro il LanguageCtx
// dell'app: tiene la lingua in stato locale letto da localStorage.

import { useCallback, useEffect, useState } from "react";

type Lang = "it" | "en" | "es" | "fr" | "ru";

// Copia dell'una-riga del monolite: preferita all'export dal monolite stesso per
// non accoppiare un componente condiviso a un file da 9k righe.
function pick5<T>(lang: Lang, v: { it: T; en: T; es: T; fr: T; ru: T }): T {
  return v[lang];
}

// COSA si sta comprando. Union: un piano ha tier+periodo, la Weekly Pick non ha
// né l'uno né l'altro — è l'acquisto della settimana corrente, che decide il server.
export type CryptoTarget =
  | { kind: "plan"; plan: "base" | "premium"; period: "monthly" | "annual" }
  | { kind: "weekly" };

type OpenOrder = {
  order: string;
  address: string;
  amount_coin: number;
  coin_label: string;
  // Dice a /api/crypto/status in quale tabella cercare: senza, il polling di un
  // ordine weekly interrogherebbe quella dei piani e farebbe 404 in loop.
  kind?: "plan" | "weekly";
};

export function CryptoDirectPanel({
  lang,
  target,
  onPaid,
}: {
  lang: Lang;
  target: CryptoTarget;
  onPaid: () => void;
}) {
  const [coins, setCoins] = useState<Array<{ id: string; label: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<OpenOrder | null>(null);
  const [waiting, setWaiting] = useState<string>("");

  useEffect(() => {
    fetch("/api/crypto/checkout")
      .then((r) => r.json())
      .then((d: { coins?: Array<{ id: string; label: string }> }) => setCoins(d.coins ?? []))
      .catch(() => setCoins([]));
  }, []);

  // Polling: il server ri-verifica on-chain a ogni giro, quindi l'attivazione non
  // dipende dal callback di PayGate (che può perdersi).
  useEffect(() => {
    if (!order) return;
    let stop = false;
    const tick = async () => {
      try {
        const q =
          `/api/crypto/status?order=${encodeURIComponent(order.order)}` +
          (order.kind === "weekly" ? "&kind=weekly" : "");
        const r = await fetch(q, { credentials: "same-origin" });
        const d = (await r.json()) as { status?: string; granted?: boolean; awaiting_confirmations?: boolean; received?: number };
        if (stop) return;
        if (d.status === "paid") { onPaid(); return; }
        setWaiting(
          d.awaiting_confirmations
            ? pick5(lang, { it: "Pagamento ricevuto, attendo le conferme della rete…", en: "Payment received, waiting for network confirmations…", es: "Pago recibido, esperando confirmaciones…", fr: "Paiement reçu, en attente de confirmations…", ru: "Платёж получен, ждём подтверждений сети…" })
            : pick5(lang, { it: "In attesa del tuo invio…", en: "Waiting for your transfer…", es: "Esperando tu transferencia…", fr: "En attente de votre envoi…", ru: "Ожидаем ваш перевод…" })
        );
      } catch { /* rete: si ritenta al giro dopo */ }
    };
    tick();
    const iv = setInterval(tick, 12_000);
    return () => { stop = true; clearInterval(iv); };
  }, [order, lang, onPaid]);

  const start = useCallback(async (coinId: string) => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/crypto/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(
          target.kind === "weekly"
            ? { requested_plan: "weekly", coin: coinId }
            : { requested_plan: target.plan, period: target.period, coin: coinId }
        ),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(
          d?.error === "amount below coin minimum"
            ? pick5(lang, { it: `Importo troppo basso per ${d.coin}: minimo ${d.minimum}. Scegli un'altra moneta.`, en: `Amount too low for ${d.coin}: minimum ${d.minimum}. Pick another coin.`, es: `Importe demasiado bajo para ${d.coin}: mínimo ${d.minimum}.`, fr: `Montant trop bas pour ${d.coin} : minimum ${d.minimum}.`, ru: `Сумма слишком мала для ${d.coin}: минимум ${d.minimum}.` })
            : d?.error === "already purchased" || d?.error === "already included"
              ? pick5(lang, { it: "Hai già accesso a questa Weekly Pick.", en: "You already have access to this Weekly Pick.", es: "Ya tienes acceso a esta Weekly Pick.", fr: "Vous avez déjà accès à ce Weekly Pick.", ru: "У вас уже есть доступ к этому Weekly Pick." })
              : pick5(lang, { it: "Non riesco ad aprire il pagamento crypto. Riprova.", en: "Can't open the crypto payment. Please retry.", es: "No puedo abrir el pago crypto. Inténtalo de nuevo.", fr: "Impossible d'ouvrir le paiement crypto. Réessayez.", ru: "Не удалось открыть крипто-платёж. Повторите." })
        );
        return;
      }
      setOrder(d as OpenOrder);
    } catch {
      setError(pick5(lang, { it: "Errore di rete. Riprova.", en: "Network error. Please retry.", es: "Error de red.", fr: "Erreur réseau.", ru: "Ошибка сети." }));
    } finally {
      setBusy(false);
    }
  }, [lang, target]);

  if (coins.length === 0) return null;

  if (!order) {
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--am-line)" }}>
        <p style={{ fontSize: 12, opacity: 0.8, margin: "0 0 6px" }}>
          {pick5(lang, { it: "Hai già crypto? Scegli con cosa pagare:", en: "Already hold crypto? Pick what to pay with:", es: "¿Ya tienes crypto? Elige con qué pagar:", fr: "Vous avez déjà des cryptos ? Choisissez :", ru: "Уже есть крипто? Выберите, чем заплатить:" })}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {coins.map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => start(c.id)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--am-line)", background: "none", color: "var(--am-text)", cursor: busy ? "default" : "pointer", fontSize: 12 }}>
              {c.label}
            </button>
          ))}
        </div>
        {error && <p style={{ fontSize: 12, color: "var(--am-coral)", margin: "6px 0 0" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--am-line)", display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 12, margin: 0, opacity: 0.85 }}>
        {pick5(lang, { it: "Invia esattamente", en: "Send exactly", es: "Envía exactamente", fr: "Envoyez exactement", ru: "Отправьте точно" })}{" "}
        <strong>{order.amount_coin} {order.coin_label.split(" · ")[0]}</strong>{" "}
        {pick5(lang, { it: "sulla rete", en: "on the", es: "en la red", fr: "sur le réseau", ru: "в сети" })}{" "}
        <strong>{order.coin_label.split(" · ")[1]}</strong>
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--am-panel-2, #111827)", padding: "8px 10px", borderRadius: 6 }}>
        <code style={{ fontSize: 11, wordBreak: "break-all", flex: 1 }}>{order.address}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(order.address).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid var(--am-line)", background: "none", color: "var(--am-coral)", cursor: "pointer", fontSize: 11 }}>
          {copied ? pick5(lang, { it: "Copiato", en: "Copied", es: "Copiado", fr: "Copié", ru: "Скопировано" }) : pick5(lang, { it: "Copia", en: "Copy", es: "Copiar", fr: "Copier", ru: "Копировать" })}
        </button>
      </div>
      <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>
        {/* L'indirizzo è dedicato a QUESTO ordine: la rete sbagliata è l'errore che
            costa i soldi, quindi va ripetuta accanto all'importo. */}
        {pick5(lang, { it: "Indirizzo valido solo per questo ordine. Usa la rete indicata: un invio su un'altra rete può andare perso.", en: "Address valid for this order only. Use the network shown: sending on another network can be lost.", es: "Dirección válida solo para este pedido. Usa la red indicada.", fr: "Adresse valable uniquement pour cette commande. Utilisez le réseau indiqué.", ru: "Адрес только для этого заказа. Используйте указанную сеть." })}
      </p>
      <p style={{ fontSize: 12, margin: 0, color: "var(--am-coral)" }}>{waiting}</p>
    </div>
  );
}
