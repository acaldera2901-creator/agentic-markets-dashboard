import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Partner — BetRedge",
  description: "I partner di BetRedge.",
};

export default function PartnersLayout({ children }: { children: ReactNode }) {
  return children;
}
