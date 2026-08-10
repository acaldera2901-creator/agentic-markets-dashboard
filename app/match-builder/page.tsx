// #URL-PATHS-0810: path inglese della tab "match-builder" (ex /app?tab=match-builder;
// copre anche il legacy ?tab=builder che la landing linkava senza che esistesse).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match Builder — BetRedge",
  alternates: { canonical: "/match-builder" },
};

export { default } from "../app/page";
