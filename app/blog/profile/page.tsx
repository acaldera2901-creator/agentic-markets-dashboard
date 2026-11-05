import type { Metadata } from "next";
import { NewsProfile } from "@/components/news/NewsProfile";

export const metadata: Metadata = {
  title: "Your profile | BetRedge",
  robots: { index: false, follow: false },
};

export default function NewsProfilePage() {
  return <NewsProfile />;
}
