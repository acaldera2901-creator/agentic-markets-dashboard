"use client";
// components/classic/ClassicLobbyInDesk.tsx — #CLASSIC-PARITY-1008
//
// La lobby classic come la monta il desk (app/app/page.tsx → HomeLobby). Il
// «board in volo» e la ricerca condivisa arrivano dal contesto classic, non
// dalle props di HomeLobby: due props in più là cambiavano il desk anche a
// flag spento.
import { ClassicLobby, type ClassicLobbyProps } from "@/components/classic/ClassicLobby";
import { useClassicPrices } from "@/components/classic/ClassicContext";

export function ClassicLobbyInDesk(props: Omit<ClassicLobbyProps, "loading" | "onQueryChange">) {
  const { boardLoading = false, onQueryChange } = useClassicPrices();
  const loading = boardLoading && props.football.length === 0 && props.tennis.length === 0;
  return <ClassicLobby {...props} loading={loading} onQueryChange={onQueryChange} />;
}
