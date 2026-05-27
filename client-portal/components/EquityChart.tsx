"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { EquitySnapshot } from "@/lib/types";

interface Props {
  data: EquitySnapshot[];
  startingBalance: number;
}

// Custom tooltip
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div
      style={{
        background: "var(--am-panel-2)",
        border: "1px solid var(--am-line-2)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <div style={{ color: "var(--am-muted)", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "var(--am-green)", fontWeight: 700, fontSize: 15 }}>
        €{val.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

export default function EquityChart({ data, startingBalance }: Props) {
  if (!data.length) {
    return (
      <div
        style={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--am-muted)",
          fontSize: 13,
        }}
      >
        No equity data available
      </div>
    );
  }

  const currentBalance = data[data.length - 1]?.balance ?? startingBalance;
  const isPositive = currentBalance >= startingBalance;
  const strokeColor = isPositive ? "#22C55E" : "#EF4444";
  const fillId = isPositive ? "greenGrad" : "redGrad";

  const chartData = data.map((s) => ({
    date: new Date(s.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
    balance: s.balance,
  }));

  const minVal = Math.min(...data.map((s) => s.balance)) * 0.995;
  const maxVal = Math.max(...data.map((s) => s.balance)) * 1.005;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minVal, maxVal]}
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `€${(v as number).toFixed(0)}`}
          width={72}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="balance"
          stroke={strokeColor}
          strokeWidth={2}
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{ r: 4, fill: strokeColor, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
