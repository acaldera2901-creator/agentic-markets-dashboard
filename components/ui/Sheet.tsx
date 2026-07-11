"use client";

import { useEffect, type ReactNode } from "react";

export function Sheet({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: ReactNode; title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      data-testid="sheet-backdrop"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,.55)" }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto",
          background: "var(--am-bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
          border: "1px solid var(--am-line)", boxShadow: "0 -20px 60px -20px rgba(0,0,0,.6)" }}
      >
        {children}
      </div>
    </div>
  );
}
