"use client";
// lib/redesign-flag.client.ts (#REDESIGN-V3C F0)
// Lettura del flag lato client. La variabile NEXT_PUBLIC_* è inlinata a build;
// il cookie si legge da document.cookie. Attenzione all'idratazione: il
// server conosce il cookie, il primo render client no → `useSyncExternalStore`
// usa la variabile come snapshot server e passa al valore vero dopo il mount.
// Per decidere COSA renderizzare, passare il flag come prop da un Server
// Component (isRedesignEnabled) è la via senza mismatch; questo hook serve ai
// contesti solo-client (analytics, toggle, debug).
import { useSyncExternalStore } from "react";
import { REDESIGN_COOKIE, envFlagOn, readCookieValue, resolveRedesign } from "./redesign-flag";

const ENV_VALUE = process.env.NEXT_PUBLIC_REDESIGN;

function subscribe(): () => void {
  return () => {};
}
function getSnapshot(): boolean {
  return resolveRedesign(ENV_VALUE, readCookieValue(document.cookie, REDESIGN_COOKIE));
}
function getServerSnapshot(): boolean {
  return envFlagOn(ENV_VALUE);
}

export function useRedesignEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
