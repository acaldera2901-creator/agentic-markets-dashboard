"use client";
// components/affiliate/AdminPayouts.tsx — #AFFILIATE-V2-UI-1015
// Pannello admin «Payout affiliati» (SPEC-ui §4): lista del mese + registrazione
// dell'hash. Montato in app/admin SOLO con NEXT_PUBLIC_AFFILIATE_V2=1.
//
// Principi: nessuna riga sparisce (chi non è pagabile ha il motivo in parole);
// il totale che l'admin vede è quello che il server ricalcola (expected_total, e su
// 409 si mostra la differenza); un hash sbagliato non si registra mai; l'invio è a
// mano dal wallet di uscita — il server non firma. `mode:"off"` (payout non attivi)
// è sempre visibile e spegne i pulsanti di scrittura.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { CREATE_ERROR_TEXT, createErrorText, nextMonth, prevMonth, reasonText, TX_REJECT_TEXT, txErrorText, txFailText } from "./admin-copy";
import { addressGroups, dateTime, monthLabel, shortDate, usd } from "./format";
import { AFF_COPY } from "./copy";
import { CheckIcon, ExplorerLink, StateChip, useCopy } from "./ui";
import { payoutChip } from "./status";
import type { AdminMonth, AdminPayout, AdminPayoutRow, TxOutcome } from "./types";
import "./affiliate.css";

const IT = AFF_COPY.it;
const money = (n: number) => usd(n, "it");
const cents = (n: number) => Math.round(n * 100);

export function AdminPayouts() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<AdminMonth | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "unauthorized">("loading");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [txId, setTxId] = useState<number | null>(null);

  const load = useCallback(async (m: string | null) => {
    const res = await api<AdminMonth>(`/api/admin/affiliate/payouts${m ? `?month=${m}` : ""}`);
    if (res.status === 401) return setState("unauthorized");
    if (!res.ok || !res.data || !Array.isArray(res.data.rows)) return setState("error");
    const d = res.data;
    setData(d);
    setMonth(d.month);
    setPicked(new Set(d.rows.filter((r) => selectable(r, d)).map((r) => r.affiliate_id)));
    setState("ready");
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(null); });
  }, [load]);

  const go = (m: string) => {
    setState("loading");
    setMsg(null);
    void load(m);
  };

  const chosen = useMemo(() => (data ? data.rows.filter((r) => picked.has(r.affiliate_id)) : []), [data, picked]);
  const chosenCents = chosen.reduce((s, r) => s + cents(r.balance_usd), 0);

  const create = async () => {
    if (!data || busy || chosen.length === 0) return;
    setBusy(true);
    setMsg(null);
    const res = await api<{ ok?: boolean; error?: string; expected?: string; actual?: string }>("/api/admin/affiliate/payouts", {
      method: "POST",
      body: JSON.stringify({ month: data.month, ids: chosen.map((r) => r.affiliate_id), expected_total: (chosenCents / 100).toFixed(2) }),
    });
    setBusy(false);
    if (res.ok && res.data?.ok !== false) {
      setMsg({ kind: "ok", text: `Creati ${chosen.length} payout per ${money(chosenCents / 100)}. Ora vanno inviati a mano e registrati con l'hash.` });
    } else {
      setMsg({ kind: "err", text: res.status === 0 ? CREATE_ERROR_TEXT["create failed"] : createErrorText(res.data, money, (aid) => data.rows.find((r) => r.affiliate_id === aid)?.code) });
    }
    await load(data.month); // sempre rileggere: l'elenco che vedi deve essere quello del server
  };

  if (txId != null) {
    return (
      <div className="aff-cli">
        <TxPanel
          id={txId}
          off={data?.mode === "off"}
          onBack={() => { setTxId(null); if (month) void load(month); }}
        />
      </div>
    );
  }

  const off = data?.mode === "off";
  const isCurrent = data ? data.month === data.current_month : false;
  const canWrite = !!data && !off && isCurrent && !!data.payout_from;

  return (
    <div className="aff-cli" data-testid="admin-payouts">
      <header className="aff-head">
        <p className="aff-kicker">Admin · Payout affiliati</p>
        <h1 className="aff-headline aff-sm">Pagamenti del mese</h1>
      </header>

      {state === "unauthorized" && (
        <div className="aff-banner" role="alert"><p>Sessione admin scaduta. <Link href="/admin/login">Accedi di nuovo</Link>.</p></div>
      )}
      {state === "error" && (
        <div className="aff-banner" role="alert">
          <p>Non riesco a leggere i payout. Non è cambiato niente.{" "}
            <button type="button" className="aff-linkbtn" onClick={() => go(month ?? "")}>Riprova</button></p>
        </div>
      )}
      {state === "loading" && <div className="aff-block" aria-busy="true"><span className="aff-sk" style={{ width: "60%" }} /><span className="aff-sk" style={{ width: "40%" }} /></div>}

      {data && state === "ready" && (
        <section className="aff-block" aria-label="Payout del mese">
          {off && (
            <div className="aff-banner" role="status" data-testid="payouts-off">
              <p><strong>I payout non sono attivi</strong> (AFFILIATE_PAYOUTS=off). Si legge e si annulla; non si crea né si registra niente.</p>
            </div>
          )}
          {!data.payout_from && (
            <div className="aff-banner" role="status"><p><strong>Wallet di uscita non configurato.</strong> Senza, non si prepara niente da inviare.</p></div>
          )}
          {!isCurrent && <p className="aff-muted">Mese passato: sola lettura. I payout si creano solo per il mese corrente.</p>}

          <div className="aff-block__head">
            <div className="aff-month">
              <button type="button" className="aff-mini" aria-label="Mese precedente" onClick={() => go(prevMonth(data.month))}>‹</button>
              <span className="aff-cur">{monthLabel(`${data.month}-01`, IT.months)}</span>
              <button type="button" className="aff-mini" aria-label="Mese successivo" disabled={data.month >= data.current_month} onClick={() => go(nextMonth(data.month))}>›</button>
            </div>
          </div>

          <dl className="aff-adm-sum">
            <div><dd>{data.summary.eligible_count}</dd><dt>pagabili</dt><span className="aff-nn">{excluded(data.rows)}</span></div>
            <div><dd>{money(data.summary.eligible_total_usd)}</dd><dt>totale da inviare</dt><span className="aff-nn">in USDT, 1:1</span></div>
            <div><dd>{money(data.summary.to_fund_usd)}</dd><dt>da avere sul wallet di uscita</dt><span className="aff-nn">ricaricalo del solo importo del mese</span></div>
            <div><dd>{data.summary.prepared_count}</dd><dt>già preparati</dt><span className="aff-nn">in attesa dell&apos;hash</span></div>
          </dl>

          {data.payout_from && (
            <div className="aff-wstate" data-s="active">
              <p className="aff-small" style={{ margin: 0 }}>Wallet di uscita (dedicato ai payout, solo USDT su Polygon). Il saldo si controlla sul wallet, qui non lo leggiamo.</p>
              <p className="aff-addr" style={{ margin: 0 }}>{data.payout_from}</p>
            </div>
          )}

          <table className="aff-table">
            <thead>
              <tr>
                <th scope="col">Affiliato</th>
                <th scope="col" className="aff-num">Maturato</th>
                <th scope="col">Wallet</th>
                <th scope="col">Controlli</th>
                <th scope="col">Stato</th>
                <th scope="col">Azione</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <Row
                  key={r.affiliate_id}
                  r={r}
                  d={data}
                  canPick={canWrite && selectable(r, data)}
                  picked={picked.has(r.affiliate_id)}
                  onPick={(on) => setPicked((p) => { const n = new Set(p); if (on) n.add(r.affiliate_id); else n.delete(r.affiliate_id); return n; })}
                  onOpen={() => setTxId(r.payout!.id)}
                />
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <p className="aff-muted">Nessun affiliato iscritto.</p>}

          {msg && <p className={msg.kind === "err" ? "aff-err" : "aff-ok-line"} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</p>}

          <div className="aff-bar-sel">
            <p>
              <strong>{chosen.length} selezionat{chosen.length === 1 ? "o" : "i"} · {money(chosenCents / 100)}.</strong>{" "}
              Crea payout blocca questi importi nel registro e li prepara per l&apos;invio a mano. Si può annullare finché non c&apos;è un hash. Il server ricalcola il totale e non crea se è cambiato.
            </p>
            <button type="button" className="aff-cta" style={{ minHeight: 44 }} disabled={!canWrite || chosen.length === 0 || busy} onClick={create}>
              {busy ? "Creo…" : `Crea ${chosen.length} payout`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Una riga è selezionabile se il server la dice eleggibile (nessun motivo) e non ha già un payout. */
export function selectable(r: AdminPayoutRow, d: Pick<AdminMonth, "mode" | "current_month" | "month" | "payout_from">): boolean {
  return r.eligible && !r.payout && d.mode === "live" && d.month === d.current_month && !!d.payout_from;
}

function excluded(rows: AdminPayoutRow[]): string {
  const below = rows.filter((r) => !r.payout && r.reasons.includes("below_threshold")).length;
  const wait = rows.filter((r) => !r.payout && r.reasons.includes("wallet_cooldown")).length;
  const other = rows.filter((r) => !r.payout && !r.eligible && !r.reasons.includes("below_threshold") && !r.reasons.includes("wallet_cooldown")).length;
  const parts = [below && `${below} sotto soglia`, wait && `${wait} con wallet in attesa`, other && `${other} non pagabili per altri motivi`].filter(Boolean);
  return parts.length ? `più ${parts.join(", ")}` : "nessuna esclusione";
}

function Row({ r, d, canPick, picked, onPick, onOpen }: {
  r: AdminPayoutRow; d: AdminMonth; canPick: boolean; picked: boolean; onPick: (on: boolean) => void; onOpen: () => void;
}) {
  const name = r.payee.name ? `${r.payee.name}${r.payee.country ? ` · ${r.payee.country}` : ""}` : "dati mancanti";
  const dim = !r.eligible && !r.payout;
  const reasons = r.reasons.filter((x) => x !== "already_created");
  const p = r.payout;
  const ck = (ok: boolean, label: string) => (ok ? <span className="aff-ok"><CheckIcon /> {label}</span> : null);

  let stateCell: React.ReactNode;
  if (p && (p.status === "created" || p.status === "submitted" || p.status === "paid" || p.status === "cancelled")) {
    stateCell = <StateChip chip={payoutChip(p.status, IT)} />;
  } else if (r.eligible) stateCell = <span className="aff-st" data-state="none">Da preparare</span>;
  else if (r.reasons.includes("below_threshold")) stateCell = <span className="aff-st" data-state="none">Sotto {Number.isInteger(d.min_payout_usd) ? d.min_payout_usd : d.min_payout_usd.toFixed(2)} $</span>;
  else stateCell = <span className="aff-st" data-state="none">Non pagabile ora</span>;

  return (
    <tr data-state={p?.status ?? "none"} className={dim ? "aff-rowdim" : undefined}>
      <td data-k="who">
        {canPick ? (
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <input type="checkbox" checked={picked} onChange={(e) => onPick(e.target.checked)} style={{ accentColor: "var(--am-royal-t)", width: 18, height: 18, marginTop: 2 }} aria-label={`Seleziona ${r.code}`} />
            <span>{r.code}<span className="aff-sub">{name}</span></span>
          </label>
        ) : (
          <span style={{ paddingLeft: 28, display: "block" }}>{r.code}<span className="aff-sub">{name}</span></span>
        )}
      </td>
      <td data-k="amount" className="aff-num">
        <strong>{money(r.balance_usd)}</strong>
        <span className="aff-sub">pagato nell&apos;anno {money(r.paid_in_year_usd)}</span>
      </td>
      <td data-k="wallet">
        {r.wallet ? (
          <>
            <span className="aff-addr">{r.wallet.address_masked}</span>
            <span className="aff-sub">
              {r.reasons.includes("wallet_cooldown") ? `utilizzabile dal ${dateTime(r.wallet.usable_after, "it")}` : `attivo dal ${shortDate(r.wallet.usable_after, "it")}`}
            </span>
          </>
        ) : "—"}
      </td>
      <td data-k="chk">
        {r.eligible || p ? (
          <span className="aff-cks">
            {ck(r.checks.payee, "dati")}
            {ck(r.checks.screened, "indirizzo")}
            {ck(r.checks.declarations, "dichiarazioni")}
          </span>
        ) : (
          <span className="aff-cks"><span>{reasons.map(reasonText).join(" · ") || "non pagabile ora"}</span></span>
        )}
      </td>
      <td data-k="state">{stateCell}</td>
      <td data-k="act">
        {p && (p.status === "created" || p.status === "submitted") ? (
          <button type="button" className="aff-mini" onClick={onOpen}>{p.status === "created" ? "Invia e registra hash" : "Apri · riverifica"}</button>
        ) : p ? (
          <button type="button" className="aff-mini" onClick={onOpen}>Apri</button>
        ) : "—"}
      </td>
    </tr>
  );
}

// ── Registrazione dell'hash (SPEC §4.2) ──────────────────────────────────────

function TxPanel({ id, off, onBack }: { id: number; off: boolean; onBack: () => void }) {
  const [p, setP] = useState<AdminPayout | null>(null);
  // `overpaid` arriva solo nell'esito di /tx e /verify (non in GET): resta per la sessione del pannello
  const [overpaid, setOverpaid] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "paid" | "submitted" | "rejected" | "error"; text: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const amt = useCopy("Importo copiato.", "Copia non riuscita: seleziona e copia a mano.");
  const adr = useCopy("Indirizzo copiato.", "Copia non riuscita: seleziona e copia a mano.");

  const load = useCallback(async () => {
    const res = await api<{ payout: AdminPayout; payout_from: string | null }>(`/api/admin/affiliate/payouts/${id}`);
    if (!res.ok || !res.data?.payout) return setState("error");
    setP(res.data.payout);
    setConfirmed(false);
    setFrom(res.data.payout_from);
    setState("ready");
  }, [id]);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const outcome = (o: TxOutcome | { error?: string } | null, status: number) => {
    if (o && "outcome" in o) {
      if (o.outcome !== "rejected" && (o as { overpaid?: boolean }).overpaid) setOverpaid(true);
      if (o.outcome === "paid") {
        const conf = o.confirmations != null ? ` · ${o.confirmations} conferme` : "";
        setResult({ kind: "paid", text: `Verificato sulla rete: token, mittente = wallet di uscita, destinatario = indirizzo del payout${o.amount_coin && Number.isFinite(Number(o.amount_coin)) ? ` · ${Number(o.amount_coin).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDT` : ""}${conf}. Il payout è Pagato; l'affiliato riceve l'email con il link all'explorer.` });
      } else if (o.outcome === "submitted") {
        setResult({ kind: "submitted", text: `Transazione trovata con ${o.confirmations} conferme${o.required ? ` su ${o.required}` : ""}. Resta Inviato: usa «Riverifica» tra qualche minuto.` });
      } else {
        setResult({ kind: "rejected", text: `Hash rifiutato: ${TX_REJECT_TEXT[o.reason] ?? "motivo non riconosciuto"} Il payout resta com'era.` });
      }
    } else {
      setResult({ kind: "error", text: status === 0 ? txErrorText(null) : txFailText(o as { error?: unknown; dropped?: unknown } | null) });
    }
  };

  const register = async (isVerify: boolean) => {
    if (busy || !p) return;
    setBusy(true);
    setResult(null);
    // Rilettura prima di scrivere: un cambio wallet annulla il payout, ma l'admin può
    // aver già copiato l'indirizzo vecchio e inviato. Si registra solo se stato e
    // indirizzo sono ancora quelli che l'admin ha davanti.
    const fresh = await api<{ payout: AdminPayout }>(`/api/admin/affiliate/payouts/${id}`);
    const f = fresh.data?.payout;
    if (!fresh.ok || !f) {
      setBusy(false);
      return setResult({ kind: "error", text: "Non riesco a rileggere il payout: non registro niente. Riprova." });
    }
    if (!isVerify && (f.status !== p.status || f.to_address !== p.to_address || f.affiliate_status !== "active")) {
      setBusy(false);
      setP(f);
      setConfirmed(false);
      return setResult({ kind: "error", text: "Il payout è cambiato mentre lavoravi (stato, indirizzo o affiliato). Non ho registrato niente: ricontrolla i dati qui sotto prima di fare altro. Se hai già inviato dei fondi, gestiscili a mano." });
    }
    const res = await api<TxOutcome & { error?: string }>(`/api/admin/affiliate/payouts/${id}/${isVerify ? "verify" : "tx"}`, {
      method: "POST",
      body: isVerify ? undefined : JSON.stringify({ hash: hash.trim() }),
    });
    setBusy(false);
    outcome(res.data, res.status);
    await load();
  };

  const cancel = async () => {
    if (busy) return;
    if (reason.trim().length < 3) return setResult({ kind: "error", text: txErrorText("reason_required") });
    setBusy(true);
    const res = await api<{ ok?: boolean; error?: string; reason?: string }>(`/api/admin/affiliate/payouts/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) });
    setBusy(false);
    if (res.ok) {
      setCancelling(false);
      setResult({ kind: "error", text: p?.status === "submitted"
        ? "Payout annullato: il server ha verificato che la transazione non potrà più essere minata. Le commissioni sono tornate maturate; l'affiliato ha ricevuto un'email generica."
        : "Payout annullato. Le commissioni sono tornate maturate; l'affiliato ha ricevuto un'email generica." });
      await load();
    } else setResult({ kind: "error", text: txFailText(res.data) });
  };

  const back = <div><button type="button" className="aff-linkbtn" onClick={onBack}>← Torna al mese</button></div>;
  if (state === "loading") return <><header className="aff-head"><p className="aff-kicker">Admin · Payout affiliati</p></header>{back}<div className="aff-block" aria-busy="true"><span className="aff-sk" style={{ width: "50%" }} /></div></>;
  if (state === "error" || !p) return <>{back}<div className="aff-banner" role="alert"><p>Non riesco a leggere il payout. Non è cambiato niente.</p></div></>;

  const groups = addressGroups(p.to_address);
  const editable = p.status === "created";
  const affOk = p.affiliate_status === "active";
  const canSubmit = editable && !off && affOk && confirmed && hash.trim().length > 0 && !busy;
  const canCancel = editable || p.status === "submitted";
  return (
    <>
      <header className="aff-head">
        <p className="aff-kicker">Admin · Payout affiliati</p>
        <h1 className="aff-headline aff-sm">Pagamenti del mese</h1>
      </header>
      {back}
      <section className="aff-pair aff-w75" aria-label="Registra la transazione">
        <div className="aff-link aff-sendbox">
          <div className="aff-block__head">
            <h2 className="aff-h">Payout {p.affiliate_code} · {monthLabel(p.period_month, IT.months).toLowerCase()}</h2>
            <StateChip chip={payoutChip(p.status, IT)} />
          </div>
          {off && <div className="aff-banner" role="status"><p>I payout non sono attivi: qui si legge e si annulla, non si registra niente.</p></div>}
          <div className={affOk ? "aff-wstate" : "aff-banner"} data-s={affOk ? "active" : "blocked"} role={affOk ? undefined : "alert"} data-testid="affiliate-status">
            <p style={{ margin: 0 }}>
              <strong>Affiliato: {p.affiliate_status === "active" ? "attivo" : p.affiliate_status === "suspended" ? "SOSPESO" : p.affiliate_status === "terminated" ? "USCITO dal programma" : p.affiliate_status}</strong>
              {!affOk && (p.status === "submitted" ? " · l'invio è già partito: puoi riverificare la transazione per chiuderla come Pagata, ma non fare nuovi invii." : " · non inviare e non registrare: se i fondi sono già partiti, gestiscili a mano.")}
            </p>
          </div>
          {overpaid && (
            <div className="aff-banner" role="status" data-testid="overpaid"><p><strong>Importo ricevuto superiore al dovuto</strong> di oltre l&apos;1%. Nessuna azione automatica: verifica a mano sulla rete.</p></div>
          )}

          <div className="aff-kv">
            <span className="aff-k">1 · Importo da inviare (USDT, 2 decimali)</span>
            <div className="aff-row">
              <span className="aff-amt">{p.amount_usd.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <button type="button" className="aff-mini" onClick={() => amt.copy(p.amount_usd.toFixed(2))}>Copia importo</button>
            </div>
            <span className="aff-small">Si copia con il punto ({p.amount_usd.toFixed(2)}), come lo vogliono i wallet.</span>
            <span className="aff-small aff-live" role="status" aria-live="polite">{amt.msg}</span>
          </div>

          <div className="aff-kv">
            <span className="aff-k">2 · Indirizzo di destinazione, copiato al momento della creazione (rete Polygon)</span>
            <div className="aff-big-addr" role="group" aria-label="Indirizzo di destinazione" style={{ fontSize: 16 }}>
              {groups.map((g, i) => (
                <span key={i}>{g.map((x, j) => (x.hl ? <b key={j}>{x.text}</b> : <span key={j} className="aff-plain">{x.text}</span>))}</span>
              ))}
            </div>
            <div className="aff-row">
              <span className="aff-small">{p.payee.name ?? "—"}{p.payee.country ? ` · ${p.payee.country}` : ""}</span>
              <button type="button" className="aff-mini" onClick={() => adr.copy(p.to_address)}>Copia indirizzo</button>
            </div>
            <span className="aff-small aff-live" role="status" aria-live="polite">{adr.msg}</span>
          </div>

          <div className="aff-kv">
            <span className="aff-k">3 · Invia dal wallet di uscita</span>
            <span className="aff-addr">{from ?? "non configurato"}</span>
            <span className="aff-small">Il server non firma e non ha chiavi: invii tu, a mano.</span>
          </div>

          {p.tx_hash && p.explorer_url && (
            <div className="aff-kv">
              <span className="aff-k">Hash registrato</span>
              <ExplorerLink href={p.explorer_url} text={p.tx_hash} sr="apre l'explorer in una nuova scheda" />
              {p.status === "submitted" && p.tx_nonce != null && <span className="aff-small">Nonce registrato: {p.tx_nonce} (serve se devi sostituire la transazione dal wallet di uscita)</span>}
              {p.status === "paid" && p.paid_at && <span className="aff-small">Pagato il {dateTime(p.paid_at, "it")}{p.amount_coin != null ? ` · ricevuti ${p.amount_coin} USDT` : ""}</span>}
            </div>
          )}

          {p.status === "cancelled" && <p className="aff-muted">Annullato{p.cancel_code ? ` (${p.cancel_code})` : ""}{p.cancel_reason ? `: ${p.cancel_reason}` : ""}. Le commissioni sono tornate maturate.</p>}

          {editable && (
            <div className="aff-fld">
              <label className="aff-label" htmlFor="aff-txh">4 · Incolla l&apos;hash della transazione</label>
              <input id="aff-txh" className="aff-input aff-addr" style={{ fontSize: 13 }} placeholder="0x…" spellCheck={false} autoComplete="off" value={hash} onChange={(e) => setHash(e.target.value)} disabled={off || !affOk} />
            </div>
          )}
          {editable && (
            <label className="aff-chk" data-testid="tx-confirm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={off || !affOk} />
              <span className="aff-tx">Ho controllato: lo stato è ancora «In preparazione» e l&apos;indirizzo a cui ho inviato è identico a quello qui sopra. <span className="aff-req">Obbligatoria. Se hai cambiato qualcosa o hai dubbi, torna al mese e riapri il payout.</span></span>
            </label>
          )}

          {result && (
            <div className="aff-res" role={result.kind === "paid" || result.kind === "submitted" ? "status" : "alert"} data-testid="tx-result">
              <p className={result.kind === "paid" ? "aff-ok-line" : result.kind === "submitted" ? undefined : "aff-err"}>
                {result.kind === "paid" && <CheckIcon />} {result.text}
              </p>
            </div>
          )}

          {cancelling && canCancel && (
            <div className="aff-confirm">
              <label className="aff-label" htmlFor="aff-reason">Motivo dell&apos;annullo (obbligatorio, resta tra noi: l&apos;affiliato riceve un testo generico)</label>
              <textarea id="aff-reason" className="aff-input aff-ta" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-required="true" />
              <div className="aff-inline-actions">
                <button type="button" className="aff-cta aff-cta--ghost" onClick={cancel} disabled={busy}>Conferma annullo</button>
                <button type="button" className="aff-cta aff-cta--text" onClick={() => setCancelling(false)} disabled={busy}>Non annullare</button>
              </div>
            </div>
          )}

          <div className="aff-actions">
            {editable && <button type="button" className="aff-cta" onClick={() => register(false)} disabled={!canSubmit}>{busy ? "Verifico…" : "Registra e verifica"}</button>}
            {p.status === "submitted" && <button type="button" className="aff-cta" onClick={() => register(true)} disabled={busy || off}>{busy ? "Verifico…" : "Riverifica"}</button>}
            {canCancel && !cancelling && <button type="button" className="aff-cta aff-cta--text" onClick={() => setCancelling(true)}>{p.status === "submitted" ? "Annulla payout (il server controlla la rete)" : "Annulla payout"}</button>}
          </div>
          {(editable || p.status === "submitted") && <p className="aff-small" style={{ margin: 0 }}>«Annulla payout»: senza hash si annulla subito. Con un hash già registrato il server controlla la rete: annulla solo se la transazione è fallita o non potrà più essere minata (nonce già consumato e finalizzato) e sono passati almeno 30 minuti dalla registrazione. Se la transazione è bloccata, prima va sostituita dal wallet di uscita (stesso nonce) e va atteso che sia finalizzata. Altrimenti il payout resta com&apos;è. Richiede un motivo.</p>}
        </div>

        <aside className="aff-block">
          <h2 className="aff-h">Esiti possibili</h2>
          <ul className="aff-outc">
            <li><strong><StateChip chip={payoutChip("paid", IT)} /> Tutto coerente</strong><span>Token, mittente, destinatario, importo (almeno il 99% del dovuto) e conferme (30 su Polygon). L&apos;importo ricevuto è letto dalla rete.</span></li>
            <li><strong><StateChip chip={payoutChip("submitted", IT)} /> Poche conferme</strong><span>Transazione trovata ma con meno conferme del richiesto. Resta Inviato, con il pulsante «Riverifica».</span></li>
            <li><strong><StateChip chip={payoutChip("created", IT)} /> Hash rifiutato</strong><span>Con il motivo: destinatario diverso · token diverso · mittente diverso dal wallet di uscita · importo troppo basso · hash non trovato · hash già usato per questo destinatario · formato non valido. Un hash sbagliato non si registra mai.</span></li>
            <li><strong><StateChip chip={payoutChip("cancelled", IT)} /> Da «in preparazione», o da «Inviato» a certe condizioni</strong><span>Un payout Inviato si annulla solo se la transazione è fallita o non potrà più essere minata (nonce consumato e finalizzato), dopo almeno 30 minuti dalla registrazione. Con una transazione valida o ancora in attesa non si annulla.</span></li>
          </ul>
        </aside>
      </section>
    </>
  );
}
