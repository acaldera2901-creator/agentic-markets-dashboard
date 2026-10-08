"use client";
// components/classic/ClassicTzNote.tsx — #CLASSIC-CARD-1008
// Un fuso in tutta la vista, dichiarato UNA volta (REGOLE-CLASSIC): gli orari
// delle schede sono nel fuso del browser (fmtKickoff con useTz) e qui se ne
// scrive la sigla. Prima del montaggio (server) non si conosce: si tace.
import { useEffect, useState } from "react";
import { classicCopy, fill } from "@/lib/classic/copy";
import { tzAbbr } from "@/lib/classic/guard";
import { useClassicPrices } from "@/components/classic/ClassicContext";

export function ClassicTzNote({ lang }: { lang: string }) {
  const { tz } = useClassicPrices();
  const [abbr, setAbbr] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- l'orologio del client esiste solo dopo il montaggio
  useEffect(() => setAbbr(tzAbbr(tz, "en-GB")), [tz]);
  if (!abbr) return null;
  return <p className="cl-tznote" data-testid="classic-tz">{fill(classicCopy(lang).tzNote, { tz: abbr })}</p>;
}
