import type { Metadata } from "next";
import { DailySportFixtures } from "@/components/seo/DailySportFixtures";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tennis Matches Today & Win Probabilities | BetRedge",
  description: "Browse today’s tennis matches by tournament with UTC start times and available win probabilities, labelled as market-derived or estimated.",
  alternates: { canonical: "/tennis-predictions-today" },
};

export default function TennisPredictionsToday() {
  return <DailySportFixtures sport="tennis" />;
}
