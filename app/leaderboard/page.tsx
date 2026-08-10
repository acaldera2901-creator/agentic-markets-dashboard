// #URL-PATHS-0810: path inglese della tab "leaderboard" (ex /app?tab=leaderboard).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard — BetRedge",
  alternates: { canonical: "/leaderboard" },
};

export { default } from "../app/page";
