"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { UpgradeSheet } from "./UpgradeSheet";

export type PaywallContextValue = {
  openUpgrade: (reason?: string) => void;
};

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>(undefined);

  const openUpgrade = useCallback((r?: string) => {
    setReason(r);
    setOpen(true);
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openUpgrade }), [openUpgrade]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <UpgradeSheet open={open} onClose={onClose} reason={reason} />
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) throw new Error("usePaywall must be used within a PaywallProvider");
  return ctx;
}
