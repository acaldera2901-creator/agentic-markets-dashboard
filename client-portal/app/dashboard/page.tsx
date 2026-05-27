import { createClient } from "@/lib/supabase/server";
import type { EquitySnapshot, BetRecord } from "@/lib/types";
import { getRealPortfolio } from "@/lib/agentic-data";
import DashboardClient from "./DashboardClient";
import Link from "next/link";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "acaldera2901@gmail.com";

function EmptyPortfolioState({
  userName,
  hasPendingDeposit,
}: {
  userName: string;
  hasPendingDeposit: boolean;
}) {
  return (
    <div className="animate-slide-up flex flex-col gap-6">
      <div>
        <div
          style={{
            color: "var(--am-muted-2)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          Portafoglio
        </div>
        <h1
          style={{
            color: "var(--am-text)",
            fontWeight: 800,
            fontSize: "clamp(1.7rem,3.5vw,2.4rem)",
            margin: "5px 0 0",
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          {userName}
        </h1>
      </div>

      <div
        style={{
          background: "rgba(140,145,255,0.03)",
          border: "1px solid var(--am-line)",
          borderRadius: 14,
          padding: "48px 32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(140,145,255,0.08)",
            border: "1px solid var(--am-line-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          {hasPendingDeposit ? "⏳" : "📂"}
        </div>

        <div>
          <div
            style={{
              color: "var(--am-text)",
              fontWeight: 700,
              fontSize: 16,
              marginBottom: 6,
            }}
          >
            {hasPendingDeposit
              ? "Deposito in attesa di approvazione"
              : "Il tuo portafoglio non è ancora attivo"}
          </div>
          <div
            style={{
              color: "var(--am-muted)",
              fontSize: 13,
              maxWidth: 380,
              lineHeight: 1.6,
            }}
          >
            {hasPendingDeposit
              ? "Il tuo deposito è stato ricevuto e sarà confermato entro 24–48 ore. Il portafoglio sarà attivato non appena il capitale sarà accreditato."
              : "Effettua un deposito per attivare il tuo portafoglio. Il team di Agentic Markets lo attiverà entro 24–48 ore dalla conferma del pagamento."}
          </div>
        </div>

        {!hasPendingDeposit && (
          <Link
            href="/dashboard/deposits"
            style={{
              background: "var(--am-green)",
              color: "#0a0a0a",
              fontWeight: 800,
              fontSize: 13,
              borderRadius: 8,
              padding: "10px 22px",
              textDecoration: "none",
              display: "inline-block",
              marginTop: 4,
            }}
          >
            + Effettua un Deposito
          </Link>
        )}

        {hasPendingDeposit && (
          <Link
            href="/dashboard/deposits"
            style={{
              color: "var(--am-green)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Visualizza i tuoi depositi →
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profileRes = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const userName =
    profileRes.data?.full_name || user.email?.split("@")[0] || "User";

  // Only the fund admin sees the live trading desk data.
  if (user.email === ADMIN_EMAIL) {
    const realPortfolio = await getRealPortfolio(user.id).catch(() => null);
    if (realPortfolio) {
      return (
        <DashboardClient
          userName={userName}
          stats={realPortfolio.stats}
          equity={realPortfolio.equity}
          recentBets={realPortfolio.bets.slice(0, 5)}
          allocation={realPortfolio.allocation}
        />
      );
    }
  }

  // Per-user Supabase data for regular clients.
  const [equityRes, betsRes, allBetsRes, depositsRes] = await Promise.all([
    supabase
      .from("equity_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true })
      .limit(90),
    supabase
      .from("bet_records")
      .select("*")
      .eq("user_id", user.id)
      .order("placed_at", { ascending: false })
      .limit(5),
    supabase
      .from("bet_records")
      .select("status, sport")
      .eq("user_id", user.id),
    supabase
      .from("deposits")
      .select("status, amount")
      .eq("user_id", user.id),
  ]);

  const equity = (equityRes.data ?? []) as EquitySnapshot[];
  const recentBets = (betsRes.data ?? []) as BetRecord[];
  const allBets = allBetsRes.data ?? [];
  const deposits = depositsRes.data ?? [];

  const hasPortfolioData = equity.length > 0 || allBets.length > 0;
  const hasPendingDeposit = deposits.some((d) => d.status === "pending");

  if (!hasPortfolioData) {
    return (
      <EmptyPortfolioState
        userName={userName}
        hasPendingDeposit={hasPendingDeposit}
      />
    );
  }

  // Compute stats from per-user data.
  const currentBalance = equity.length ? equity[equity.length - 1].balance : 0;
  const startingBalance = equity.length ? equity[0].balance : 0;
  const totalPnL = currentBalance - startingBalance;
  const totalPnLPct = startingBalance > 0 ? (totalPnL / startingBalance) * 100 : 0;

  const allSettled = allBets.filter((b) => b.status !== "pending");
  const allWon = allSettled.filter((b) => b.status === "won");
  const globalWinRate =
    allSettled.length > 0 ? (allWon.length / allSettled.length) * 100 : 0;
  const globalActiveBets = allBets.filter((b) => b.status === "pending").length;

  const footballBets = allBets.filter((b) => b.sport === "football").length;
  const tennisBets = allBets.filter((b) => b.sport === "tennis").length;
  const total = footballBets + tennisBets || 1;
  const allocation = [
    { name: "Football", value: (footballBets / total) * 100, color: "#22C55E" },
    { name: "Tennis", value: (tennisBets / total) * 100, color: "#818CF8" },
  ];

  return (
    <DashboardClient
      userName={userName}
      stats={{
        currentBalance,
        totalPnL,
        totalPnLPct,
        winRate: globalWinRate,
        activeBets: globalActiveBets,
        startingBalance,
      }}
      equity={equity}
      recentBets={recentBets}
      allocation={allocation}
    />
  );
}
