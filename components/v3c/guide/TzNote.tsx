"use client";
// components/v3c/guide/TzNote.tsx (#REDESIGN-V3C fixui · QA M2) — la sola dichiarazione
// del fuso in una vista: «Times in your time zone (CEST)». Ogni ora della vista è
// scritta in quel fuso (lib/v3c/time-ui). Prima del mount il fuso non si conosce,
// le ore sono in UTC e la nota dice «UTC»: numero ed etichetta non divergono mai.
import { useLocalTimeZone, useV3cLang } from "@/lib/v3c/lang.client";
import { guideCopyFor } from "@/lib/v3c/guide-copy";
import { v3cLocale } from "@/lib/v3c/copy";
import { tzAbbr } from "@/lib/v3c/time-ui";

export function TzNote({ className, locale }: { className?: string; locale?: string }) {
  const saved = useV3cLang();
  const lang = locale ?? saved;
  const tz = useLocalTimeZone();
  return <span className={["v3c-tz", className].filter(Boolean).join(" ")}>{guideCopyFor(lang).tz(tzAbbr(tz, v3cLocale(lang)))}</span>;
}

/** Un'ora scritta dal server in UTC («15:00 UTC»), riscritta nel fuso del browser dopo il mount. */
export function LocalTime({ iso, fallback, format, locale }: { iso: string | null | undefined; fallback: string; format: "hm" | "day-hm"; locale?: string }) {
  const saved = useV3cLang();
  const loc = v3cLocale(locale ?? saved);
  const tz = useLocalTimeZone();
  if (!iso || !tz) return <>{fallback}</>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <>{fallback}</>;
  const hm = new Intl.DateTimeFormat(loc, { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  if (format === "hm") return <>{hm}</>;
  const day = new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "short" }).format(d);
  return (
    <>
      {hm} {day}
    </>
  );
}
