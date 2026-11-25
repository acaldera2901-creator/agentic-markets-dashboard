import type { Metadata } from "next";
import { DailySportFixtures } from "@/components/seo/DailySportFixtures";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Football Predictions Today: Fixtures & Match Probabilities | BetRedge",
  description: "See today’s football fixtures and UTC kick-off times. Find available home-win, draw and away-win readings and learn to compare them with market probabilities.",
  alternates: { canonical: "/football-predictions-today" },
};

export default function FootballPredictionsToday() {
  return <DailySportFixtures sport="football" />;
}
