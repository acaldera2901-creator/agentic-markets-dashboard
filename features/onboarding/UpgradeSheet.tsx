"use client";

import Link from "next/link";
import { Sheet } from "@/components/ui";
import { planPriceCopy, planLabel, PUBLIC_PLAN_KEYS } from "@/lib/commercial-plan";

const ctaLinkStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 11,
  padding: "11px 14px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  background: "linear-gradient(145deg,var(--am-coral),var(--am-coral-2))",
  border: "1px solid transparent",
  color: "#fff",
};

export function UpgradeSheet({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  reason?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Passa a Pro">
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, color: "var(--am-text)" }}>
          Passa a Pro
        </h2>

        <p style={{ margin: 0, fontSize: 14, color: "var(--am-text)" }}>
          Sblocca tutti i pick di oggi — big match, mercati soft, marcatori.
        </p>

        {reason && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--am-muted)" }}>{reason}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PUBLIC_PLAN_KEYS.map((key) => {
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "var(--am-panel-2)",
                  border: "1px solid var(--am-line)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--am-text)" }}>
                    {planLabel(key, "it")}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--am-muted)" }}>
                    {planPriceCopy(key, "it")}
                  </span>
                </div>
                {/* SHORTCUT (marcato): il checkout vive nel monolite (/app, PlansTab/CheckoutModal).
                    Qui instradiamo al flusso legacy — nessun pagamento gestito in questo
                    componente. Upgrade path: portare il checkout in features/ in SP7. */}
                <Link href="/app?tab=plans" style={ctaLinkStyle}>
                  Passa a {planLabel(key, "it")}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
