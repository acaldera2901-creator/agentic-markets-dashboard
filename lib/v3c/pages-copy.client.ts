"use client";
// lib/v3c/pages-copy.client.ts (#REDESIGN-V3C · filone pages) — la copy nella lingua salvata.
import { useV3cLang } from "./lang.client";
import { pagesCopyFor, type PagesCopy } from "./pages-copy";

export function usePagesCopy(): PagesCopy {
  return pagesCopyFor(useV3cLang());
}
