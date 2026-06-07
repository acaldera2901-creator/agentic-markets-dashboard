"use client";
// /community — Creator Picks (#MB-2): schedine pubblicate da utenti/influencer
// col Match Builder. Pagina pubblica di discovery: i match sono visibili a
// tutti, pick e probabilità restano dietro la registrazione (stessa proiezione
// per-sessione del board — il lock È la CTA). Ogni card riapre la schedina
// originale via /?mb=...&ref=CODICE, quindi il traffico da qui mantiene
// l'attribution del creator.

import { useEffect, useState } from "react";
import Link from "next/link";

type SlipSelection = {
  label: string;
  sport: string;
  when: string;
  market: string | null;
  prob: number | null;
};

type Slip = {
  id: string;
  creator_code: string;
  mb_param: string;
  created_at: string;
  combined_prob: number | null;
  selections: SlipSelection[];
};

export default function CommunityPage() {
  const [slips, setSlips] = useState<Slip[] | null>(null);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/match-builder", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlips(Array.isArray(d?.slips) ? d.slips : []);
        setLocked(Boolean(d?.locked));
      })
      .catch(() => { if (alive) setSlips([]); });
    return () => { alive = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div>
          <Link href="/" className="text-xs font-mono text-gray-500 hover:text-gray-300">← Board</Link>
          <h1 className="text-2xl font-black mt-1">Creator Picks</h1>
          <p className="text-xs font-mono text-gray-500 max-w-xl">
            Schedine costruite dalla community col Match Builder, basate sulle probabilità del nostro modello.
            Nessuna quota, nessun edge promesso — solo predizioni AI selezionate dai creator.
          </p>
        </div>
        <Link
          href="/?tab=match-builder"
          className="text-xs font-mono px-4 py-2 rounded border border-amber-400/40 text-amber-400 bg-amber-400/5 hover:bg-amber-400/15 transition-colors shrink-0"
        >
          Crea la tua →
        </Link>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {slips === null && (
          <p className="text-center text-xs font-mono text-gray-600 py-16">Caricamento…</p>
        )}
        {slips !== null && slips.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-sm font-mono text-gray-500">Nessuna schedina pubblicata ancora.</p>
            <p className="text-xs font-mono text-gray-600">Sii il primo: costruiscila col Match Builder e condividila.</p>
          </div>
        )}
        {slips?.map((slip) => (
          <article key={slip.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-amber-400/40 text-amber-400">
                {slip.creator_code}
              </span>
              <div className="flex items-center gap-3">
                {slip.combined_prob != null && (
                  <span className="text-lg font-black font-mono text-amber-400">
                    {Math.round(slip.combined_prob * 100)}%
                  </span>
                )}
                <span className="text-[10px] font-mono text-gray-600">
                  {new Date(slip.created_at).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {slip.selections.map((sel, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono gap-3">
                  <div className="min-w-0">
                    <p className="text-gray-200 truncate">{sel.label}</p>
                    <p className="text-[10px] text-gray-600 truncate">{sel.sport}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sel.market != null ? (
                      <>
                        <span className="text-gray-500 truncate max-w-[120px]">{sel.market}</span>
                        {sel.prob != null && <span className="text-cyan-300">{Math.round(sel.prob * 100)}%</span>}
                      </>
                    ) : (
                      <span className="text-gray-600">🔒</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              {locked ? (
                <Link
                  href={`/?mb=${encodeURIComponent(slip.mb_param)}&ref=${encodeURIComponent(slip.creator_code)}`}
                  className="text-xs font-mono px-3 py-1.5 rounded border border-cyan-400/40 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/15 transition-colors"
                >
                  Registrati per vedere i pick →
                </Link>
              ) : (
                <Link
                  href={`/?mb=${encodeURIComponent(slip.mb_param)}&ref=${encodeURIComponent(slip.creator_code)}`}
                  className="text-xs font-mono px-3 py-1.5 rounded border border-white/15 text-gray-300 hover:bg-white/5 transition-colors"
                >
                  Apri schedina →
                </Link>
              )}
              <span className="text-[9px] font-mono text-gray-700">18+ · gioca responsabilmente</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
