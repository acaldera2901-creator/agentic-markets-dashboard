// lib/ui/lobby.ts — #RESTYLING-0921
//
// La lobby della Home: quali sezioni esistono, in che ordine, e con quali
// righe. Logica pura, fuori dal JSX, perché la regola che conta è negativa e
// va testata: UNA SEZIONE SENZA RIGHE NON SI RENDE.
//
// Il brief elenca Top Opportunities · Live Now · Starting Soon · High Edge ·
// Football · Tennis · Watchlist. Le righe sono sempre le STESSE predizioni già
// servite al board: la lobby le ordina e le raggruppa, non ne inventa.
//
// Cosa NON c'è qui, e perché: «Why the Model Disagrees» sarebbe High Edge con
// un altro nome (stesso predicato: model − market grande); «For You» e
// «Recently Viewed» richiedono uno storico per utente che il prodotto non
// raccoglie. Preferisco una lobby corta e vera a una lunga con tre sezioni
// finte.

import type { PredictionCardData } from "@/lib/ui/prediction-card";
import { EDGE_HIGH_PP } from "@/lib/ui/prediction-card";

export type LobbySectionId =
  | "top"
  | "live"
  | "soon"
  | "edge"
  | "football"
  | "tennis"
  | "watchlist";

export type LobbyItem = {
  data: PredictionCardData;
  /** Chiave stabile per React + per la watchlist (sport:id, gli id si
   *  sovrappongono fra calcio e tennis). */
  key: string;
};

export type LobbySection = {
  id: LobbySectionId;
  items: LobbyItem[];
};

/** Finestra di «Starting Soon»: tre ore. Più in là non è imminenza, è
 *  calendario — e il calendario è già la sezione dello sport. */
export const STARTING_SOON_MS = 3 * 60 * 60 * 1000;

/** Quante righe entrano in una fascia della lobby. Oltre, si scorre lo sport:
 *  una fascia è un assaggio, non un catalogo. */
export const LOBBY_ROW_CAP = 6;

export function lobbyKey(data: PredictionCardData): string {
  return `${data.sport}:${data.id}`;
}

/** «Starts in 40 min» / «Starts in 2h 10m» / null se fuori finestra o già
 *  iniziata. Il badge della card lo riceve già scritto: la card non formatta
 *  date (contratto di PredictionCard). */
export function startingSoonLabel(startsAt: string, now: number = Date.now()): string | null {
  const t = new Date(startsAt).getTime();
  if (!Number.isFinite(t)) return null;
  const delta = t - now;
  if (delta <= 0 || delta > STARTING_SOON_MS) return null;
  const minutes = Math.round(delta / 60000);
  if (minutes < 60) return `Starts in ${Math.max(1, minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `Starts in ${h}h` : `Starts in ${h}h ${m}m`;
}

function byEdgeDesc(a: LobbyItem, b: LobbyItem): number {
  return (b.data.edgePct ?? Number.NEGATIVE_INFINITY) - (a.data.edgePct ?? Number.NEGATIVE_INFINITY);
}

function byKickoffAsc(a: LobbyItem, b: LobbyItem): number {
  return new Date(a.data.startsAt).getTime() - new Date(b.data.startsAt).getTime();
}

/** Una riga entra in «Top Opportunities» / «High Edge» solo se ha un edge
 *  REALE: serve un prezzo di mercato. Senza, è una stima del modello — vera,
 *  ma non un'opportunità contro il mercato. E una riga chiusa non può stare in
 *  una fascia che si chiama «High Edge»: annuncerebbe il numero che nasconde. */
function hasRealEdge(it: LobbyItem): boolean {
  return it.data.marketPct != null && it.data.edgePct != null && !it.data.locked;
}

export type BuildLobbyInput = {
  football: LobbyItem[];
  tennis: LobbyItem[];
  /** Chiavi `lobbyKey` salvate in watchlist. */
  saved?: ReadonlySet<string>;
  now?: number;
};

/** Le sezioni della lobby, nell'ordine del brief, GIÀ private di quelle vuote. */
export function buildLobbySections({ football, tennis, saved, now = Date.now() }: BuildLobbyInput): LobbySection[] {
  const all = [...football, ...tennis];

  const live = all.filter((it) => it.data.isLive).sort(byKickoffAsc);

  const priced = all.filter(hasRealEdge);

  // Top Opportunities: il meglio per edge, ma solo roba non ancora iniziata —
  // «opportunità» su una partita al 70° è una promessa che non possiamo tenere.
  const top = priced
    .filter((it) => !it.data.isLive && new Date(it.data.startsAt).getTime() > now)
    .sort(byEdgeDesc)
    .slice(0, LOBBY_ROW_CAP);

  const soon = all
    .filter((it) => !it.data.isLive && startingSoonLabel(it.data.startsAt, now) != null)
    .sort(byKickoffAsc)
    .slice(0, LOBBY_ROW_CAP);

  // High Edge esclude ciò che è già in cima: due fasce identiche di fila sono
  // una fascia sola scritta due volte.
  const topKeys = new Set(top.map((it) => it.key));
  const edge = priced
    .filter((it) => !topKeys.has(it.key) && (it.data.edgePct ?? 0) >= EDGE_HIGH_PP)
    .sort(byEdgeDesc)
    .slice(0, LOBBY_ROW_CAP);

  const watchlist = saved && saved.size > 0 ? all.filter((it) => saved.has(it.key)).sort(byKickoffAsc) : [];

  const sections: LobbySection[] = [
    { id: "top", items: top },
    { id: "live", items: live },
    { id: "soon", items: soon },
    { id: "edge", items: edge },
    { id: "football", items: football.slice(0, LOBBY_ROW_CAP) },
    { id: "tennis", items: tennis.slice(0, LOBBY_ROW_CAP) },
    { id: "watchlist", items: watchlist },
  ];

  return sections.filter((s) => s.items.length > 0);
}
