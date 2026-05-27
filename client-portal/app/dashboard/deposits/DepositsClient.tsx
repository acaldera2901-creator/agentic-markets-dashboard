"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Deposit } from "@/lib/types";
import DepositModal from "@/components/DepositModal";

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bonifico Bancario",
  usdt: "USDT",
  cash: "Contanti",
};

interface Props {
  deposits: Deposit[];
  currentBalance: number;
  confirmedTotal: number;
  pendingTotal: number;
}

function fmt(n: number) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DepositsClient({
  deposits,
  currentBalance,
  confirmedTotal,
  pendingTotal,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const summaryCards = [
    {
      label: "Saldo Disponibile",
      value: `€${fmt(currentBalance)}`,
      color: "var(--am-green)",
      border: "rgba(0,255,136,0.2)",
      bg: "rgba(0,255,136,0.05)",
    },
    {
      label: "Capitale Depositato",
      value: `€${fmt(confirmedTotal)}`,
      color: "var(--am-text)",
      border: "var(--am-line-2)",
      bg: "var(--am-panel-2)",
    },
    {
      label: "In Attesa Approvazione",
      value: `€${fmt(pendingTotal)}`,
      color: pendingTotal > 0 ? "var(--am-amber)" : "var(--am-muted)",
      border: pendingTotal > 0 ? "rgba(255,179,0,0.25)" : "var(--am-line)",
      bg: pendingTotal > 0 ? "rgba(255,179,0,0.06)" : "var(--am-panel-2)",
    },
  ];

  return (
    <div className="animate-slide-up flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ color: "var(--am-text)", fontWeight: 800, fontSize: "1.6rem", margin: 0 }}>
            Depositi
          </h1>
          <p style={{ color: "var(--am-muted)", fontSize: 13, margin: "5px 0 0" }}>
            Gestisci i tuoi depositi e richiedi nuovi accrediti.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            background: "var(--am-green)",
            color: "#0a0a0a",
            fontWeight: 800,
            fontSize: 13,
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "transform 0.12s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          + Nuovo Deposito
        </button>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {summaryCards.map((card) => (
          <div
            key={card.label}
            style={{
              background: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: 10,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                color: "var(--am-muted-2)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "monospace",
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                color: card.color,
                fontSize: "clamp(1.3rem, 2.5vw, 1.65rem)",
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Deposits table */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--am-line)",
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--am-line)" }}>
          <div
            style={{
              color: "var(--am-muted-2)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}
          >
            Storico Depositi
          </div>
        </div>

        {deposits.length === 0 ? (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--am-muted)",
              fontSize: 13,
            }}
          >
            Nessun deposito ancora registrato.{" "}
            <button
              onClick={() => setModalOpen(true)}
              style={{ color: "var(--am-green)", background: "none", border: "none", fontWeight: 600, cursor: "pointer" }}
            >
              Fai il primo deposito →
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--am-line)" }}>
                  {["Data", "Importo", "Metodo", "Note", "Status", "Confermato il"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "9px 14px",
                        textAlign: "left",
                        color: "var(--am-muted-2)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deposits.map((deposit) => (
                  <tr
                    key={deposit.id}
                    style={{
                      borderBottom: "1px solid var(--am-line)",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    <td style={{ padding: "11px 14px", color: "var(--am-muted)", whiteSpace: "nowrap" }}>
                      {new Date(deposit.created_at).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        color: "var(--am-text)",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      €{fmt(deposit.amount)}
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--am-muted)" }}>
                      {METHOD_LABEL[deposit.method] ?? deposit.method}
                    </td>
                    <td
                      style={{
                        padding: "11px 14px",
                        color: "var(--am-muted)",
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {deposit.notes || "—"}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span className={`status-pill ${deposit.status}`}>{deposit.status}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--am-muted)", whiteSpace: "nowrap" }}>
                      {deposit.confirmed_at
                        ? new Date(deposit.confirmed_at).toLocaleDateString("it-IT")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DepositModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
