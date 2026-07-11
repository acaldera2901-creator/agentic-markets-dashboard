"use client";

// #ITALIA-EU-PARERE (decisione Andrea 2026-07-10): visibilità client dei link-book
// (bet-now, schedina FortunePlay, CTA affiliato) governata dall'ALLOWLIST server-side
// via /api/geo-books. Default NASCOSTO finché il server non conferma la geo ammessa,
// e fail-closed su errore di rete: mai un link-book mostrato a una giurisdizione
// vietata per un fetch fallito. Fetch unico condiviso tra tutti i componenti
// (promise cachata a livello modulo).
import { useEffect, useState } from "react";

let cached: Promise<boolean> | null = null;
function fetchBlocked(): Promise<boolean> {
  if (!cached) {
    cached = fetch("/api/geo-books", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !!d?.blocked)
      .catch(() => true); // fail-closed
  }
  return cached;
}

export function useBooksBlocked(): boolean {
  const [blocked, setBlocked] = useState(true); // default nascosto
  useEffect(() => {
    let alive = true;
    fetchBlocked().then((b) => {
      if (alive) setBlocked(b);
    });
    return () => {
      alive = false;
    };
  }, []);
  return blocked;
}
