"use client";

import { useState, useMemo } from "react";
import type { BetRecord } from "@/lib/types";
import BetTable from "@/components/BetTable";

const PAGE_SIZE = 15;

interface Props {
  bets: BetRecord[];
}

export default function HistoryClient({ bets }: Props) {
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (sportFilter !== "all" && b.sport !== sportFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (dateFrom && new Date(b.placed_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(b.placed_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [bets, sportFilter, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pagePnL = paginated.reduce((sum, b) => sum + (b.profit_loss ?? 0), 0);
  const totalPnL = filtered.reduce((sum, b) => sum + (b.profit_loss ?? 0), 0);

  function exportCsv() {
    const header = ["Data", "Sport", "Match", "Selezione", "Quota", "Stake", "Esito", "P&L"];
    const rows = filtered.map((b) => [
      new Date(b.placed_at).toLocaleDateString("it-IT"),
      b.sport,
      `"${b.match_name}"`,
      `"${b.selection}"`,
      b.odds ?? "",
      b.stake ?? "",
      b.status,
      b.profit_loss ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agentic-markets-bets.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectStyle = {
    background: "var(--am-panel-2)",
    border: "1px solid var(--am-line-2)",
    borderRadius: 7,
    color: "var(--am-text)",
    padding: "7px 10px",
    fontSize: 12,
    outline: "none",
    cursor: "pointer",
    height: 34,
  } as React.CSSProperties;

  const inputStyle = {
    ...selectStyle,
    cursor: "text",
  } as React.CSSProperties;

  return (
    <div className="animate-slide-up flex flex-col gap-5">
      <div>
        <h1 style={{ color: "var(--am-text)", fontWeight: 800, fontSize: "1.6rem", margin: 0 }}>
          Storico Scommesse
        </h1>
        <p style={{ color: "var(--am-muted)", fontSize: 13, margin: "5px 0 0" }}>
          {filtered.length} bet {filtered.length !== bets.length ? `(filtrate da ${bets.length})` : "totali"}
        </p>
      </div>

      {/* Filters + Export */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--am-line)",
          borderRadius: 10,
          padding: "14px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <select
          value={sportFilter}
          onChange={(e) => { setSportFilter(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="all">Tutti gli sport</option>
          <option value="football">Football</option>
          <option value="tennis">Tennis</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="all">Tutti gli esiti</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="pending">Pending</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          style={inputStyle}
          placeholder="Da"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          style={inputStyle}
          placeholder="A"
        />

        {(sportFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo) && (
          <button
            onClick={() => { setSportFilter("all"); setStatusFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
            style={{
              background: "rgba(255,68,68,0.08)",
              border: "1px solid rgba(255,68,68,0.2)",
              borderRadius: 7,
              color: "var(--am-red)",
              padding: "7px 12px",
              fontSize: 12,
              fontWeight: 600,
              height: 34,
            }}
          >
            Reset filtri
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={exportCsv}
          style={{
            background: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 7,
            color: "var(--am-green)",
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 34,
          }}
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
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
        <BetTable bets={paginated} />

        {/* P&L footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--am-line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ color: "var(--am-muted)", fontSize: 12 }}>
            P&L questa pagina:{" "}
            <strong style={{ color: pagePnL >= 0 ? "var(--am-green)" : "var(--am-red)", fontFamily: "monospace" }}>
              {pagePnL >= 0 ? "+" : ""}€{pagePnL.toFixed(2)}
            </strong>
            {" · "}P&L totale filtri:{" "}
            <strong style={{ color: totalPnL >= 0 ? "var(--am-green)" : "var(--am-red)", fontFamily: "monospace" }}>
              {totalPnL >= 0 ? "+" : ""}€{totalPnL.toFixed(2)}
            </strong>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                background: "var(--am-panel-2)",
                border: "1px solid var(--am-line)",
                borderRadius: 6,
                color: "var(--am-muted)",
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ← Prec
            </button>
            <span style={{ color: "var(--am-muted)", fontSize: 12, fontFamily: "monospace" }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                background: "var(--am-panel-2)",
                border: "1px solid var(--am-line)",
                borderRadius: 6,
                color: "var(--am-muted)",
                padding: "5px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Succ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
