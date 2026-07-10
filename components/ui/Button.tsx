import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  icon?: ReactNode;
};

export function Button({ variant = "ghost", icon, children, style, ...rest }: ButtonProps) {
  const base = {
    fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600,
    borderRadius: 11, padding: "11px 12px", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  } as const;
  const skin = variant === "primary"
    ? { background: "linear-gradient(145deg,var(--am-green),var(--am-coral-2))", border: "1px solid transparent", color: "#fff" }
    : { background: "var(--am-panel-2)", border: "1px solid var(--am-line)", color: "var(--am-text)" };
  return (
    <button data-variant={variant} style={{ ...base, ...skin, ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}
