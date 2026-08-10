"use client";
// components/tools/ToolSaveScope.tsx — #TOOLS-SAVE-0810
// «Save calculations for logged-in users to drive registration» (deck, slide 02).
//
// Le pagine /tools sono statiche e pubbliche e restano tali: questo componente
// avvolge il calcolatore senza toccarlo e gli aggiunge UNA riga sotto.
//  · Anonimo: la riga è un link ("Save this calculation" → /app?auth=register).
//    ZERO richieste di rete, zero JS che fa qualcosa, nessun muro — il
//    calcolatore funziona identico. La riga È il motivo per registrarsi.
//  · Loggato: la stessa riga diventa un bottone che salva davvero, e sotto
//    compaiono i suoi ultimi cinque calcoli, ricaricabili con un clic.
//
// Come si riconosce un loggato senza una richiesta per ogni visita organica: il
// profilo in localStorage (`agentic-client-profile`, la stessa chiave di /app) è
// un INDIZIO gratuito. Nessun profilo → anonimo, e non si chiama niente. Se
// c'è, si chiama la rotta, che è l'AUTORITÀ: il cookie di sessione è httpOnly,
// quindi un 401 (profilo locale stantio) riporta la riga allo stato anonimo.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolSlug } from "@/lib/tools/registry";
import {
  applyGroups,
  applyInputs,
  captureState,
  groupsMatch,
  rowDelta,
  stepRows,
  summarizeCalc,
  type ToolSave,
  type ToolSaveState,
} from "@/lib/tools/save-state";

/** Stessa chiave di app/app/page.tsx: il profilo client è lì, non si duplica. */
const PROFILE_KEY = "agentic-client-profile";
/** Tetto ai passaggi del ripristino: 8 gambe al massimo, più i segmentati.
 *  È la garanzia che la macchina a stati termini sempre. */
const MAX_STEPS = 16;

export type ToolSaveCopy = {
  saveCta: string;
  saveHintAnon: string;
  saveHintUser: string;
  savedTitle: string;
  saveError: string;
};

export function ToolSaveScope({
  slug,
  copy,
  children,
}: {
  slug: ToolSlug;
  copy: ToolSaveCopy;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Parte SEMPRE da anonimo: è lo stato che finisce nell'HTML prerenderizzato,
  // quindi il primo render del client combacia e non c'è mismatch di hydration.
  const [signedIn, setSignedIn] = useState(false);
  const [saves, setSaves] = useState<ToolSave[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ripristino in corso + contatore dei passaggi: vedi l'effetto più sotto.
  const [pending, setPending] = useState<ToolSaveState | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let hasProfile = false;
    try {
      hasProfile = Boolean(window.localStorage.getItem(PROFILE_KEY));
    } catch {
      /* storage negato: si resta anonimi, il tool non ne soffre */
    }
    // Il caso normale di una pagina SEO: nessun profilo, nessuna rete.
    if (!hasProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/tools/saves?slug=${encodeURIComponent(slug)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (cancelled) return;
        // 401: profilo locale sopravvissuto al cookie scaduto → resta anonimo.
        if (r.status === 401) return;
        setSignedIn(true);
        if (!r.ok) return;
        const data = (await r.json()) as { saves?: ToolSave[] };
        if (!cancelled && Array.isArray(data.saves)) setSaves(data.saves);
      } catch {
        /* offline: resta il CTA, il calcolatore continua a funzionare */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Ripristino a passi, UNO per commit. Serve perché il calcolatore cambia
  // forma man mano: il segmentato di EV cambia il numero di campi, multipla e
  // margine hanno un numero variabile di gambe. Ogni passaggio legge il DOM
  // appena committato e ne programma il successivo — dentro un solo giro si
  // leggerebbe il markup vecchio e i valori finirebbero nel posto sbagliato.
  //   1. segmentati nella posizione salvata
  //   2. stesso numero di righe (bottoni +/− del calcolatore)
  //   3. valori dei campi
  useEffect(() => {
    if (!pending) return;
    const calc = rootRef.current?.querySelector(".tl-calc") ?? null;
    /* eslint-disable react-hooks/set-state-in-effect -- macchina a stati del ripristino: un passo per commit, sul DOM appena montato. */
    if (!calc) {
      setPending(null);
      return;
    }
    if (step >= MAX_STEPS) {
      setPending(null);
      setFailed(true);
      return;
    }
    if (!groupsMatch(calc, pending)) {
      applyGroups(calc, pending);
      setStep((s) => s + 1);
      return;
    }
    const delta = rowDelta(calc, pending);
    if (delta !== 0) {
      if (!stepRows(calc, delta)) {
        // Non si riesce a pareggiare le righe: meglio non ripristinare NIENTE
        // che riempire metà campi e mostrare un risultato sbagliato.
        setPending(null);
        setFailed(true);
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    if (!applyInputs(calc, pending)) setFailed(true);
    setPending(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pending, step]);

  const save = useCallback(async () => {
    const calc = rootRef.current?.querySelector(".tl-calc");
    if (!calc || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const r = await fetch("/api/tools/saves", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, state: captureState(calc), summary: summarizeCalc(calc) }),
      });
      if (!r.ok) {
        setFailed(true);
        return;
      }
      const data = (await r.json()) as { saves?: ToolSave[] };
      if (Array.isArray(data.saves)) setSaves(data.saves);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [busy, slug]);

  const restore = useCallback((state: ToolSaveState) => {
    setFailed(false);
    setStep(0);
    setPending(state);
  }, []);

  return (
    <div className="tl-save-scope" ref={rootRef}>
      {children}
      {/* La riga sta SOTTO il calcolatore e sopra la frase chiave. Tipografia e
          chip, non un box nuovo: il box-su-box è il tell #1 di AI-slop. */}
      <div className="tl-save">
        <div className="tl-save-row">
          {signedIn ? (
            <button
              type="button"
              className="tl-save-btn"
              onClick={save}
              disabled={busy}
              aria-busy={busy || undefined}
              data-testid="tool-save"
            >
              {copy.saveCta}
            </button>
          ) : (
            // prefetch={false}: una pagina statica non deve spendere una
            // richiesta di rete per un anonimo che non ha cliccato niente.
            <Link
              href="/app?auth=register"
              prefetch={false}
              className="tl-save-btn"
              data-testid="tool-save-cta"
            >
              {copy.saveCta}
            </Link>
          )}
          {/* Lo slot dell'aiuto è presente in ENTRAMBI gli stati: se comparisse
              solo per l'anonimo, il passaggio a loggato farebbe saltare la
              pagina di una riga a hydration avvenuta. */}
          <span className={`tl-save-hint ${failed ? "is-err" : ""}`} role={failed ? "alert" : undefined}>
            {failed ? copy.saveError : signedIn ? copy.saveHintUser : copy.saveHintAnon}
          </span>
        </div>
        {signedIn && saves.length > 0 ? (
          <div className="tl-save-list">
            <span className="tl-save-lab">{copy.savedTitle}</span>
            {saves.map((s) => (
              <button
                key={s.id}
                type="button"
                className="tl-save-chip"
                onClick={() => restore(s.state)}
              >
                {s.summary}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
