"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type AuthUser = { identifier: string; name: string | null };

export type AuthContextValue = {
  user: AuthUser | null;
  plan: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

// Real GET /api/auth shape (app/api/auth/route.ts, not the { profile } the brief
// assumed):
// - 200 OK  -> { identifier, plan, name }  (flat, no wrapper)
// - 401     -> { error: "not authenticated" }
type AuthOkResponse = { identifier: string; plan: string; name: string | null };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqId = useRef(0);

  const refresh = useCallback(async () => {
    const myId = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch("/api/auth", { credentials: "include" });
      if (myId !== reqId.current) return;
      if (!res.ok) {
        // 401 (no session) or any other non-OK status → treat as logged-out.
        setUser(null);
        setPlan(null);
        return;
      }
      const json = (await res.json()) as AuthOkResponse;
      setUser({ identifier: json.identifier, name: json.name ?? null });
      setPlan(json.plan);
    } catch {
      // Network error / fetch rejection → logged-out, never crash the tree.
      if (myId !== reqId.current) return;
      setUser(null);
      setPlan(null);
    } finally {
      if (myId === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, plan, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
