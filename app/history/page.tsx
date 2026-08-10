// #URL-PATHS-0810: path inglese della tab "history" del desk (ex /app?tab=history).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Record — BetRedge",
  alternates: { canonical: "/history" },
};

export { default } from "../app/page";
