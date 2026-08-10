// #URL-PATHS-0810: path inglese della tab "plans" (ex /app?tab=plans e l'alias
// legacy ?tab=account, che dal dropdown #UI-ACCOUNT-DROPDOWN-0623 atterra qui).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans & Pricing — BetRedge",
  alternates: { canonical: "/plans" },
};

export { default } from "../app/page";
