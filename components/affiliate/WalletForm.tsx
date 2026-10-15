"use client";
// components/affiliate/WalletForm.tsx — #AFFILIATE-V2-UI-1015
// Registra / cambia wallet in DUE passi, mai uno (SPEC-ui §3.3, §3.4):
//   1 · Dati e indirizzo  →  2 · Controlla e conferma (indirizzo intero, a gruppi).
// Il client controlla solo ciò che può (forma, ultime 6 cifre, spunte); il server è
// l'arbitro (EIP-55, screening, rail accesi) e i suoi errori {error, field} si
// mappano 1:1 sulla tabella di errors.ts. Un errore di campo riporta al passo 1.
// Errori: riepilogo in cima (role=alert, link ai campi) + messaggio sotto il campo
// + aria-invalid; mai toast. L'indirizzo NON si precompila mai e il paste è permesso.
import { useId, useMemo, useRef, useState } from "react";
import type { AffCopy } from "./copy";
import { fill } from "./copy";
import { api } from "./api";
import { countryOptions } from "./countries";
import { checkAddressLocal, last6Matches, mapWalletError, type WalletErrKey, type WalletFieldId } from "./errors";
import { addressGroups, dateTime } from "./format";
import type { AffLang } from "./copy";

export type WalletFormProps = {
  c: AffCopy;
  lang: AffLang;
  mode: "add" | "change";
  /** Wallet attuale (mascherato), solo in modalità cambio. */
  current?: { masked: string; coin: string | null; network: string | null } | null;
  initial: { name: string; country: string };
  rails: { coins: string[]; networks: string[] };
  onCancel: () => void;
  onSaved: (r: { cancelledPayouts: number }) => void;
  onRemove?: () => void;
};

const NETWORK_LABEL: Record<string, string> = { polygon: "Polygon (PoS)", tron: "Tron" };

type Errors = Partial<Record<WalletFieldId, WalletErrKey>>;
const ORDER: WalletFieldId[] = ["name", "country", "addr", "last6", "netack", "sanc", "tax"];
const FIELD_LABEL = (c: AffCopy, f: WalletFieldId): string =>
  ({ name: c.wallet.fName, country: c.wallet.fCountry, addr: c.wallet.fAddr, last6: c.wallet.fLast6, netack: c.wallet.cNet, sanc: c.wallet.cSanc, tax: c.wallet.cTax })[f].replace(/\.$/, "");

function FieldErr({ id, text }: { id: string; text: string | null }) {
  return text ? (
    <p className="aff-err" id={id}>
      {text}
    </p>
  ) : null;
}

export function WalletForm({ c, lang, mode, current, initial, rails, onCancel, onSaved, onRemove }: WalletFormProps) {
  const uid = useId();
  const id = (f: string) => `${uid}-${f}`;
  const w = c.wallet;
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(initial.name);
  const [country, setCountry] = useState(initial.country);
  const [addr, setAddr] = useState("");
  const [last6, setLast6] = useState("");
  const [coin, setCoin] = useState(rails.coins[0] ?? "USDT");
  const [network, setNetwork] = useState(rails.networks[0] ?? "polygon");
  const [netack, setNetack] = useState(false);
  const [sanc, setSanc] = useState(false);
  const [tax, setTax] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formErr, setFormErr] = useState<WalletErrKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [usableAt, setUsableAt] = useState<string>("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const options = useMemo(() => countryOptions(lang === "it" ? "it" : "en"), [lang]);

  const errList = ORDER.filter((f) => errors[f]);

  const showErrors = (e: Errors) => {
    setErrors(e);
    // il riepilogo prende il focus: chi usa uno screen reader lo sente subito
    setTimeout(() => summaryRef.current?.focus(), 0);
  };

  const validateLocal = (): Errors => {
    const e: Errors = {};
    const n = name.trim().replace(/\s+/g, " ");
    if (n.length < 2 || n.length > 200) e.name = "invalid_legal_name";
    if (!country) e.country = "invalid_country";
    const a = checkAddressLocal(addr);
    if (a) e.addr = a;
    else if (!last6Matches(addr, last6)) e.last6 = "last6_mismatch";
    if (!netack) e.netack = "network_ack_required";
    if (!sanc) e.sanc = "declaration_sanctions";
    if (!tax) e.tax = "declaration_tax";
    return e;
  };

  const goConfirm = () => {
    const e = validateLocal();
    if (Object.keys(e).length) {
      showErrors(e);
      return;
    }
    setErrors({});
    setFormErr(null);
    setUsableAt(new Date(Date.now() + 72 * 3_600_000).toISOString());
    setStep(2);
    setTimeout(() => headRef.current?.focus(), 0);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFormErr(null);
    const res = await api<{ ok?: boolean; error?: string; field?: string; cancelled_payouts?: number }>("/api/affiliate/wallet", {
      method: "PUT",
      body: JSON.stringify({
        ...(rails.coins.length > 1 ? { coin } : {}),
        ...(rails.networks.length > 1 ? { network } : {}),
        address: addr.trim(),
        last6: last6.trim(),
        payee_legal_name: name.trim(),
        payee_country: country,
        declarations: { sanctions: sanc, tax },
        network_ack: netack,
      }),
    });
    setBusy(false);
    if (res.ok && res.data?.ok) {
      onSaved({ cancelledPayouts: Number(res.data.cancelled_payouts) || 0 });
      return;
    }
    const m = mapWalletError(res.data?.error, res.data?.field);
    if (m.field) {
      // errore di campo: si torna ai dati, col messaggio sotto il campo giusto
      setStep(1);
      showErrors({ [m.field]: m.key });
    } else {
      setFormErr(m.key);
    }
  };

  const err = (f: WalletFieldId) => (errors[f] ? c.walletErr[errors[f] as WalletErrKey] : null);
  const inv = (f: WalletFieldId) => (errors[f] ? { "aria-invalid": true as const, "aria-describedby": id(`e-${f}`) } : {});
  const rail = (
    <div className="aff-fld">
      <span className="aff-label">{w.rail}</span>
      {rails.coins.length > 1 || rails.networks.length > 1 ? (
        <div className="aff-wline">
          <select className="aff-input" aria-label={w.rail} value={coin} onChange={(e) => setCoin(e.target.value)} style={{ maxWidth: 160 }}>
            {rails.coins.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select className="aff-input" aria-label={w.rail} value={network} onChange={(e) => setNetwork(e.target.value)} style={{ maxWidth: 220 }}>
            {rails.networks.map((k) => (
              <option key={k} value={k}>
                {NETWORK_LABEL[k] ?? k}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="aff-wline">
          <span className="aff-chip">{rails.coins[0] ?? w.railUsdt}</span>
          <span className="aff-chip aff-net">{NETWORK_LABEL[rails.networks[0] ?? "polygon"] ?? w.railNet}</span>
        </div>
      )}
      <p className="aff-muted aff-small">{w.railHint}</p>
    </div>
  );

  if (step === 2) {
    const groups = addressGroups(addr);
    const countryName = options.find((o) => o.code === country)?.name ?? country;
    return (
      <section className="aff-pair aff-w75" aria-label={w.step2}>
        <div className="aff-link">
          <p className="aff-steps-ind">{w.step2}</p>
          <h2 className="aff-h" tabIndex={-1} ref={headRef}>
            {w.confirmTitle}
          </h2>
          <p className="aff-muted">{w.confirmLead}</p>
          <div className="aff-big-addr" role="group" aria-label={w.confirmAddrAria} data-testid="confirm-address">
            {groups.map((g, i) => (
              <span key={i}>
                {g.map((p, j) => (p.hl ? <b key={j}>{p.text}</b> : <span key={j} className="aff-plain">{p.text}</span>))}
              </span>
            ))}
          </div>
          <p className="aff-muted aff-small">{w.confirmHl}</p>
          <dl className="aff-recap">
            <div>
              <dt>{w.rRail}</dt>
              <dd>
                {rails.coins.length > 1 ? coin : (rails.coins[0] ?? "USDT")} · {NETWORK_LABEL[rails.networks.length > 1 ? network : (rails.networks[0] ?? "polygon")] ?? network}
              </dd>
            </div>
            <div>
              <dt>{w.rName}</dt>
              <dd>{name.trim()}</dd>
            </div>
            <div>
              <dt>{w.rCountry}</dt>
              <dd>{countryName}</dd>
            </div>
            <div>
              <dt>{w.rDecl}</dt>
              <dd style={{ fontWeight: 400, fontSize: 14.5 }}>{w.rDeclV}</dd>
            </div>
          </dl>
          <p className="aff-warn">{fill(w.confirmWarn, { date: dateTime(usableAt, lang) })}</p>
          {formErr && (
            <p className="aff-err" role="alert">
              {c.walletErr[formErr]}
            </p>
          )}
          <div className="aff-actions">
            <button type="button" className="aff-cta" onClick={save} disabled={busy}>
              {busy ? w.saving : w.save}
            </button>
            <button type="button" className="aff-cta aff-cta--ghost" onClick={() => { setStep(1); setFormErr(null); }} disabled={busy}>
              {w.back}
            </button>
          </div>
          <p className="aff-muted aff-small">{w.confirmFoot}</p>
        </div>
        <aside className="aff-block">
          <h2 className="aff-h">{w.afterTitle}</h2>
          <ul className="aff-fine">
            <li><strong>{w.a1t}</strong><span>{w.a1b}</span></li>
            <li><strong>{w.a2t}</strong><span>{w.a2b}</span></li>
            <li><strong>{w.a3t}</strong><span>{w.a3b}</span></li>
          </ul>
        </aside>
      </section>
    );
  }

  return (
    <section className="aff-pair aff-w75" aria-label={mode === "change" ? w.changeTitle : w.formTitle}>
      <form
        className="aff-link"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          goConfirm();
        }}
      >
        <p className="aff-steps-ind">{w.step1}</p>
        <h2 className="aff-h" tabIndex={-1} ref={headRef}>
          {mode === "change" ? w.changeTitle : w.formTitle}
        </h2>

        {mode === "change" && current && (
          <>
            <div className="aff-wstate" data-s="active">
              <span className="aff-label">{w.current}</span>
              <div className="aff-wline">
                <span className="aff-addr">{current.masked}</span>
                {current.network && <span className="aff-chip aff-net">{NETWORK_LABEL[current.network] ?? current.network}</span>}
                {current.coin && <span className="aff-chip">{current.coin}</span>}
              </div>
            </div>
            <p className="aff-warn">
              <strong>{w.changeWarnT}</strong> {w.changeWarnB}
            </p>
          </>
        )}

        {errList.length > 0 && (
          <div className="aff-errsum" role="alert" tabIndex={-1} ref={summaryRef}>
            <p>{errList.length === 1 ? w.summaryOne : fill(w.summaryMany, { n: errList.length })}</p>
            <ul>
              {errList.map((f) => (
                <li key={f}>
                  <a
                    href={`#${id(f)}`}
                    onClick={(ev) => {
                      ev.preventDefault();
                      document.getElementById(id(f))?.focus();
                    }}
                  >
                    {FIELD_LABEL(c, f)}: {err(f)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rail}

        <div className="aff-fld">
          <label className="aff-label" htmlFor={id("name")}>{w.fName}</label>
          <input id={id("name")} className="aff-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={w.fNamePh} autoComplete="name" maxLength={200} {...inv("name")} />
          <FieldErr id={id(`e-name`)} text={err("name")} />
        </div>

        <div className="aff-fld">
          <label className="aff-label" htmlFor={id("country")}>{w.fCountry}</label>
          <select id={id("country")} className="aff-input" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country" {...inv("country")}>
            <option value="">{w.fCountryPh}</option>
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
          <FieldErr id={id(`e-country`)} text={err("country")} />
        </div>

        <div className="aff-fld">
          <label className="aff-label" htmlFor={id("addr")}>{mode === "change" ? w.fAddrNew : w.fAddr}</label>
          <input
            id={id("addr")}
            className="aff-input aff-addr"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            {...(errors.addr ? { "aria-invalid": true, "aria-describedby": `${id("e-addr")}` } : { "aria-describedby": id("h-addr") })}
          />
          <p className="aff-muted aff-small" id={id("h-addr")}>{w.fAddrHint}</p>
          <FieldErr id={id(`e-addr`)} text={err("addr")} />
        </div>

        <div className="aff-fld">
          <label className="aff-label" htmlFor={id("last6")}>{w.fLast6}</label>
          <input
            id={id("last6")}
            className="aff-input aff-addr"
            value={last6}
            onChange={(e) => setLast6(e.target.value)}
            placeholder={w.fLast6Ph}
            maxLength={6}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ maxWidth: 220 }}
            {...inv("last6")}
          />
          <FieldErr id={id(`e-last6`)} text={err("last6")} />
        </div>

        <div className="aff-fld" style={{ gap: "var(--am-s-3)" }}>
          <label className="aff-chk" data-bad={errors.netack ? "1" : "0"}>
            <input id={id("netack")} type="checkbox" checked={netack} onChange={(e) => setNetack(e.target.checked)} {...inv("netack")} />
            <span className="aff-tx">
              {w.cNet} <span className="aff-req">{w.cNetReq}</span>
            </span>
          </label>
          <FieldErr id={id(`e-netack`)} text={err("netack")} />
          <label className="aff-chk" data-bad={errors.sanc ? "1" : "0"}>
            <input id={id("sanc")} type="checkbox" checked={sanc} onChange={(e) => setSanc(e.target.checked)} {...inv("sanc")} />
            <span className="aff-tx">
              {w.cSanc} <span className="aff-req">{c.enroll.required}</span>
            </span>
          </label>
          <FieldErr id={id(`e-sanc`)} text={err("sanc")} />
          <label className="aff-chk" data-bad={errors.tax ? "1" : "0"}>
            <input id={id("tax")} type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} {...inv("tax")} />
            <span className="aff-tx">
              {w.cTax} <span className="aff-req">{w.cTaxReq}</span>
            </span>
          </label>
          <FieldErr id={id(`e-tax`)} text={err("tax")} />
        </div>

        <div className="aff-actions">
          <button type="submit" className="aff-cta">{w.cont}</button>
          <button type="button" className="aff-cta aff-cta--text" onClick={onCancel}>{w.cancel}</button>
        </div>
        {mode === "change" && onRemove && (
          <p className="aff-muted aff-small">
            <button type="button" className="aff-linkbtn" onClick={onRemove}>{w.remove}</button> {w.removeHint}
          </p>
        )}
      </form>

      <aside className="aff-block" aria-labelledby={id("know")}>
        <h2 className="aff-h" id={id("know")}>{w.knowTitle}</h2>
        <ul className="aff-fine">
          <li><strong>{w.k1t}</strong><span>{w.k1b}</span></li>
          <li><strong>{w.k2t}</strong><span>{w.k2b}</span></li>
          <li><strong>{w.k3t}</strong><span>{w.k3b}</span></li>
          <li><strong>{w.k4t}</strong><span>{w.k4b}</span></li>
          <li><strong>{w.k5t}</strong><span>{w.k5b}</span></li>
          <li><strong>{w.k6t}</strong><span>{w.k6b}</span></li>
        </ul>
      </aside>
    </section>
  );
}
