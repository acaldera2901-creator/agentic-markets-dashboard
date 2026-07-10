type Props = { sport: string; size?: number; className?: string };

export function SportIcon({ sport, size = 16, className }: Props) {
  const s = sport.toLowerCase();
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, className, "aria-hidden": true,
  };
  if (s.includes("tenn")) {
    return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M5 5c5 3 9 7 14 14M19 5C14 8 10 12 5 19" /></svg>);
  }
  if (s.includes("foot") || s.includes("calc") || s.includes("soccer")) {
    return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>);
  }
  return (<svg {...common}><circle cx="12" cy="12" r="9" /></svg>);
}
