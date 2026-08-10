// #URL-PATHS-0810: path inglese della tab "invita" (referral, ex /app?tab=invita).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invite Friends — BetRedge",
  alternates: { canonical: "/invite" },
};

export { default } from "../app/page";
