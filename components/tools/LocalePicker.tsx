// components/tools/LocalePicker.tsx (#TOOLS-HUB-0805)
// Selettore lingua fatto di <a>, non di stato: naviga alle URL sorelle, che sono
// esattamente quelle dichiarate negli hreflang. Nessun redirect automatico da
// localStorage — un crawler non ha localStorage, e chi arriva da Google su una
// pagina inglese non va portato altrove senza averlo chiesto.

import Link from "next/link";
import {
  LOCALE_NAMES,
  TOOL_LOCALES,
  hubPath,
  toolPath,
  type ToolLocale,
  type ToolSlug,
} from "@/lib/tools/registry";

export function LocalePicker({
  slug,
  locale,
  label,
}: {
  /** Assente sull'hub: il selettore punta agli hub tradotti. */
  slug?: ToolSlug;
  locale: ToolLocale;
  label: string;
}) {
  return (
    <nav className="tl-langs" aria-label={label}>
      {TOOL_LOCALES.map((l) => {
        const href = slug ? toolPath(slug, l) : hubPath(l);
        const current = l === locale;
        return (
          <Link
            key={l}
            href={href}
            hrefLang={l}
            aria-current={current ? "true" : undefined}
            prefetch={false}
          >
            {LOCALE_NAMES[l]}
          </Link>
        );
      })}
    </nav>
  );
}
