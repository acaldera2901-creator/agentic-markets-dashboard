"use client";
// La copy community nella lingua salvata dal sito (agentic-lang).
import { communityCopyFor, type CommunityCopy } from "@/lib/v3c/community-copy";
import { useV3cLang } from "@/lib/v3c/lang.client";

export function useCommunityCopy(): CommunityCopy {
  return communityCopyFor(useV3cLang());
}
