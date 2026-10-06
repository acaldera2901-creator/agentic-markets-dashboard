// /v3c/match/[id] — la pagina partita del redesign (#REDESIGN-V3C F4).
// NON è un URL pubblico: con NEXT_PUBLIC_REDESIGN acceso next.config.ts
// riscrive "/match/:id" qui (beforeFiles, l'URL nel browser resta
// /match/…). Spento, /match/… non ha nessuna rotta (404 di sempre) e questa
// risponde 404: il sito di oggi non cambia.
//
// Il 404 «partita non trovata» deve essere un 404 vero (non uno stato dentro
// una pagina 200): la partita si cerca PRIMA dello streaming con una query
// sola e indicizzata (fetchFixture); board e storico arrivano dopo.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { V3cMatchPage } from "@/components/v3c/match/MatchPage";
import { v3cProductOn } from "@/lib/v3c/board-data.server";
import { fetchFixture, type Fixture } from "@/lib/v3c/line-movement-service";
import { cleanMatchId, matchHref } from "@/lib/v3c/match-view";
import { parseMode } from "@/lib/v3c/mode";
import { v3cOgMetadata } from "@/lib/v3c/og-meta";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** undefined = la query è fallita (la pagina prova comunque con la board); null = partita sconosciuta. */
const lookup = cache(async (id: string): Promise<Fixture | null | undefined> => {
  try {
    return await fetchFixture(id);
  } catch (e) {
    console.error("[v3c/match fixture]", String(e));
    return undefined;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!v3cProductOn()) return {};
  const id = cleanMatchId((await params).id);
  const f = id ? await lookup(id) : null;
  if (!id || !f) return { title: "Match not found | BetRedge", robots: { index: false } };
  const title = `${f.home} – ${f.away}: market, estimate and best price | BetRedge`;
  const description = `${f.home} – ${f.away}: the market probability with the margin removed, our estimate next to it, the price history and the best price among connected books.`;
  return {
    title,
    description,
    alternates: { canonical: matchHref(id) },
    // og:image dall'URL pubblico /match/<id>/og.png (rewrite), mai /v3c/…
    ...v3cOgMetadata(matchHref(id), "BetRedge match: market price and our estimate", { title, description, url: matchHref(id) }),
    // Pagine per partita, effimere: fuori dall'indice finché F9 (SEO) non decide il contrario.
    robots: { index: false, follow: true },
  };
}

export default async function V3cMatch({ params, searchParams }: Props) {
  if (!v3cProductOn()) notFound();
  const id = cleanMatchId((await params).id);
  if (!id) notFound();
  await connection(); // per-richiesta: dati live
  const fixture = await lookup(id);
  if (fixture === null) notFound();
  const sp = await searchParams;
  return <V3cMatchPage id={id} fixture={fixture ?? null} mode={parseMode(sp.mode)} />;
}
