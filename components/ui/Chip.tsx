import type { ReactNode } from "react";

export type ChipVariant = "high" | "mid" | "low" | "pro" | "neutral";

const STYLE: Record<ChipVariant, { color: string; bg: string; border: string }> = {
  high:    { color: "var(--am-coral)",  bg: "var(--am-coral-dim)",  border: "var(--am-coral-b)" },
  pro:     { color: "var(--am-coral)",  bg: "var(--am-coral-dim)",  border: "var(--am-coral-b)" },
  mid:     { color: "var(--am-amber)",  bg: "rgba(251,191,36,.14)", border: "rgba(251,191,36,.3)" },
  low:     { color: "var(--am-muted)",  bg: "var(--am-hi)",         border: "var(--am-line)" },
  neutral: { color: "var(--am-muted)",  bg: "var(--am-hi)",         border: "var(--am-line)" },
};

export function Chip({ variant, children, className }: { variant: ChipVariant; children: ReactNode; className?: string }) {
  const s = STYLE[variant];
  return (
    <span
      data-variant={variant}
      className={className}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
