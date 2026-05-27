import { createClient } from "@/lib/supabase/server";
import type { BetRecord } from "@/lib/types";
import { getRealPortfolio } from "@/lib/agentic-data";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const realPortfolio = await getRealPortfolio(user.id).catch(() => null);
  if (realPortfolio) {
    return <HistoryClient bets={realPortfolio.bets} />;
  }

  const { data } = await supabase
    .from("bet_records")
    .select("*")
    .eq("user_id", user.id)
    .order("placed_at", { ascending: false });

  return <HistoryClient bets={(data ?? []) as BetRecord[]} />;
}
