interface BorderBeamProps {
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  borderRadius?: number | string;
}

export function BorderBeam({
  duration = 4,
  colorFrom = "#00ff88",
  colorTo = "#00d4ff",
  borderWidth = 1.5,
  borderRadius = 10,
}: BorderBeamProps) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius,
        padding: borderWidth,
        background: `conic-gradient(from var(--border-beam-angle), transparent 0%, ${colorFrom} 20%, ${colorTo} 40%, transparent 60%)`,
        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        animation: `border-beam ${duration}s linear infinite`,
        pointerEvents: "none",
      }}
    />
  );
}
