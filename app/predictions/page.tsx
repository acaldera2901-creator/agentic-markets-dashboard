// #URL-PATHS-0810: path inglese della tab "bets" del desk (ex /app?tab=bets).
// La Dashboard risolve la tab dal pathname; il metadata dà title/canonical propri.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Predictions — BetRedge",
  alternates: { canonical: "/predictions" },
};

export { default } from "../app/page";
