"use client";
// La copy di /record nella lingua del visitatore (stesso schema di useV3cCopy).
import { recordCopyFor, type V3cRecordCopy } from "@/lib/v3c/copy-record";
import { useV3cLang } from "@/lib/v3c/lang.client";

export function useRecordCopy(): { t: V3cRecordCopy; locale: string; lang: string } {
  const lang = useV3cLang();
  return { t: recordCopyFor(lang), locale: lang === "it" ? "it-IT" : "en-GB", lang };
}
