import type { Metadata } from "next";
import { loadWorkContent } from "@/ui/work/content";
import { WorkPage } from "@/ui/work/WorkPage";

export const metadata: Metadata = { title: "BetRedge Growth — Lavoro" };

// Auth is enforced in proxy.ts (every route). Content is read from the repo at
// build time: a commit to content/ is the only way to change this page.
export default function Page() {
  return <WorkPage content={loadWorkContent()} />;
}
