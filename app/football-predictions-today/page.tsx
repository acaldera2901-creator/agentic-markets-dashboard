import type { Metadata } from "next";
import { DailySportFixtures } from "@/components/seo/DailySportFixtures";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Football Fixtures Today & Match Probabilities | BetRedge",
  description: "Browse today’s football fixtures by competition with UTC kick-off times and available model probabilities. See how to read home win, draw and away win (1X2).",
  alternates: { canonical: "/football-predictions-today" },
};

export default function FootballPredictionsToday() {
  return <DailySportFixtures sport="football" />;
}
