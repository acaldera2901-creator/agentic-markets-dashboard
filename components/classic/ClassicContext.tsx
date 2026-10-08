"use client";
// components/classic/ClassicContext.tsx — #CLASSIC-CARD-1008
//
// Quello che la scheda Slab legge e che il desk ha GIÀ in pagina: le quote
// partner (/api/fortuneplay-odds, una fetch sola, quella del desk), il blocco
// geo dei link (Decreto Dignità: /api/geo-books, fail-closed), il paese per i
// partner solo-landing, il fuso dell'utente, l'ora della risposta /api/tennis.
// Il desk lo monta una volta (app/app/page.tsx, solo a flag acceso); fuori dal
// provider il default è «nessuna quota, link bloccati»: la scheda non mostra
// mai un link affiliato che nessuno ha autorizzato.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { FpOddsEntry } from "@/lib/fortuneplay-board";
import { indicizzaPerGiorno } from "@/lib/fp-odds-join";

export type ClassicPrices = {
  fpOdds: Record<string, FpOddsEntry>;
  fpIndex: Map<string, FpOddsEntry[]>;
  booksBlocked: boolean;
  geoCountry: string;
  tz: string | undefined;
  tennisComputedAt: string | null;
};

const EMPTY: ClassicPrices = { fpOdds: {}, fpIndex: new Map(), booksBlocked: true, geoCountry: "", tz: undefined, tennisComputedAt: null };
const Ctx = createContext<ClassicPrices>(EMPTY);

export function useClassicPrices(): ClassicPrices {
  return useContext(Ctx);
}

export function ClassicPricesProvider({ fpOdds, booksBlocked, geoCountry, tz, tennisComputedAt, children }: Omit<ClassicPrices, "fpIndex"> & { children: ReactNode }) {
  const fpIndex = useMemo(() => indicizzaPerGiorno(fpOdds), [fpOdds]);
  const value = useMemo(() => ({ fpOdds, fpIndex, booksBlocked, geoCountry, tz, tennisComputedAt }), [fpOdds, fpIndex, booksBlocked, geoCountry, tz, tennisComputedAt]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Il punto di montaggio nel desk: a flag spento è un frammento (nessun nodo, nessun effetto). */
export function ClassicPricesScope(props: Omit<ClassicPrices, "fpIndex"> & { enabled: boolean; children: ReactNode }) {
  const { enabled, children, ...rest } = props;
  if (!enabled) return <>{children}</>;
  return <ClassicPricesProvider {...rest}>{children}</ClassicPricesProvider>;
}
