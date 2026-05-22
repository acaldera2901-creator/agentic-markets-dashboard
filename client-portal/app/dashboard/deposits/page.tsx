import { createClient } from "@/lib/supabase/server";
import type { Deposit } from "@/lib/types";
import DepositsClient from "./DepositsClient";

export default async function DepositsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("deposits")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const deposits = (data ?? []) as Deposit[];

  const confirmedTotal = deposits
    .filter((d) => d.status === "confirmed")
    .reduce((s, d) => s + d.amount, 0);

  const pendingTotal = deposits
    .filter((d) => d.status === "pending")
    .reduce((s, d) => s + d.amount, 0);

  // Get current balance from equity
  const { data: equity } = await supabase
    .from("equity_snapshots")
    .select("balance")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const currentBalance = equity?.balance ?? 0;

  return (
    <DepositsClient
      deposits={deposits}
      currentBalance={currentBalance}
      confirmedTotal={confirmedTotal}
      pendingTotal={pendingTotal}
    />
  );
}
