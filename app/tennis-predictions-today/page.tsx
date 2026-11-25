import type { Metadata } from "next";
import { DailySportFixtures } from "@/components/seo/DailySportFixtures";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tennis Predictions Today: Fixtures & Win Probabilities | BetRedge",
  description: "Browse today’s tennis fixtures and tournament start times. Find available player win probabilities and see how market readings and Elo estimates differ.",
  alternates: { canonical: "/tennis-predictions-today" },
};

export default function TennisPredictionsToday() {
  return <DailySportFixtures sport="tennis" />;
}
