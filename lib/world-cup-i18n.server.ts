// Server-only helper for World Cup i18n.
// Import this ONLY in server components (no "use client" directive).
// Client components receive `lang` as a prop instead of calling this.
import { cookies, headers } from "next/headers";
import { normalizeWcLang, type WcLang } from "./world-cup-i18n";

/**
 * Resolves the UI language for a server-rendered World Cup page.
 * 1) the agentic-lang cookie (set by the main app's switcher) wins;
 * 2) on first touch (no cookie — e.g. a user landing straight on /world-cup
 *    from search), fall back to the browser's Accept-Language so an English
 *    visitor never gets an Italian page;
 * 3) default "it" (the app default) otherwise.
 * cookies()/headers() are async in Next 16 (matches client-portal/lib/supabase/server.ts).
 */
export async function wcLangFromCookie(): Promise<WcLang> {
  const store = await cookies();
  const cookieVal = store.get("agentic-lang")?.value;
  if (cookieVal === "en" || cookieVal === "it") return cookieVal;

  // No explicit choice yet: honour the browser's preferred language.
  const accept = (await headers()).get("accept-language")?.toLowerCase() ?? "";
  if (/\ben\b|^en|,en|en-/.test(accept) && !accept.startsWith("it")) return "en";
  return normalizeWcLang(cookieVal);
}
