// Customer-frontend translations for the 9 non-base locales (#i18n-0617).
// English (BASE_TRANSLATIONS.en in app/app/page.tsx) is spread UNDER each of these,
// so any missing key falls back to English automatically. Brand/proper terms
// (BetRedge, Signal Desk Pro, Best Bets, +EV, USDT, TRC20, bet ID, etc.) are kept
// verbatim. One file per language under ./locales; assembled here.

import es from "./locales/es";
import fr from "./locales/fr";
import de from "./locales/de";
import pt from "./locales/pt";
import nl from "./locales/nl";
import pl from "./locales/pl";
import tr from "./locales/tr";
import sv from "./locales/sv";
import ru from "./locales/ru";

export type ExtraLocale = "es" | "fr" | "de" | "pt" | "nl" | "pl" | "tr" | "sv" | "ru";

export const EXTRA_LOCALES: Record<ExtraLocale, Record<string, string>> = {
  es, fr, de, pt, nl, pl, tr, sv, ru,
};
