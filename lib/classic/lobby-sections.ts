// lib/classic/lobby-sections.ts — #CLASSIC-CARD-1008 / #CLASSIC-PARITY-1008
//
// Le sezioni della lobby a flag acceso (NEXT_PUBLIC_CLASSIC=1). «Top
// opportunities» e «High edge» diventano UNA fascia, «Where our estimate
// differs most»: dentro solo le righe che la protezione lascia passare
// (modello grezzo ≤ 15 pp dal mercato, lib/classic/card-view.ts), ordinate per
// |scarto|. `differsBy` torna |scarto| in pp, o null = fuori.
//
// Sta qui e non dentro buildLobbySections (lib/ui/lobby.ts) perché un
// parametro in più là cambiava il modulo anche a flag spento: il desk la
// chiama solo nel ramo classic, e a flag spento questo file non entra nel build.
import { LOBBY_ROW_CAP, startingSoonLabel, type BuildLobbyInput, type LobbyItem, type LobbySection } from "@/lib/ui/lobby";

function byKickoffAsc(a: LobbyItem, b: LobbyItem): number {
  return new Date(a.data.startsAt).getTime() - new Date(b.data.startsAt).getTime();
}

export function buildClassicLobbySections({ football, tennis, saved, now = Date.now(), fullSportLists = false, differsBy }: BuildLobbyInput & { differsBy: (it: LobbyItem) => number | null }): LobbySection[] {
  const all = [...football, ...tennis];
  const live = all.filter((it) => it.data.isLive).sort(byKickoffAsc);
  const scored = all
    .filter((it) => !it.data.isLive && new Date(it.data.startsAt).getTime() > now)
    .map((it) => ({ it, d: differsBy(it) }))
    .filter((x): x is { it: LobbyItem; d: number } => x.d != null)
    .sort((a, b) => b.d - a.d)
    .slice(0, LOBBY_ROW_CAP)
    .map((x) => x.it);
  const soon = all
    .filter((it) => !it.data.isLive && startingSoonLabel(it.data.startsAt, now) != null)
    .sort(byKickoffAsc)
    .slice(0, LOBBY_ROW_CAP);
  const watchlist = saved && saved.size > 0 ? all.filter((it) => saved.has(it.key)).sort(byKickoffAsc) : [];
  return ([
    { id: "top", items: scored },
    { id: "live", items: live },
    { id: "soon", items: soon },
    { id: "football", items: fullSportLists ? football : football.slice(0, LOBBY_ROW_CAP) },
    { id: "tennis", items: fullSportLists ? tennis : tennis.slice(0, LOBBY_ROW_CAP) },
    { id: "watchlist", items: watchlist },
  ] as LobbySection[]).filter((sec) => sec.items.length > 0);
}
