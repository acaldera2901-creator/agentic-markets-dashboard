import { notFound } from "next/navigation";
import { ResultsScreen } from "@/features/results/ResultsScreen";

export default function RisultatiPage() {
  if (process.env.NEXT_PUBLIC_UX_NEW !== "1") notFound();
  return <ResultsScreen />;
}
