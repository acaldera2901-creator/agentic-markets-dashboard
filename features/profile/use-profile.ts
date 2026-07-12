"use client";

import { useEffect, useState } from "react";

export type Profile = {
  identifier: string;
  name: string | null;
  plan: string;
  planExpiresAt: string | null;
};

export type UseProfileResult = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  loggedIn: boolean;
  logout: () => Promise<void>;
};

type AuthResponse = {
  identifier: string;
  plan: string;
  name: string | null;
  plan_expires_at: string | null;
};

function toProfile(json: AuthResponse): Profile {
  return {
    identifier: json.identifier,
    name: json.name ?? null,
    plan: json.plan,
    planExpiresAt: json.plan_expires_at ?? null,
  };
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth", { credentials: "include" });
        if (res.status === 401) {
          if (!alive) return;
          setProfile(null);
          setLoggedIn(false);
          setError(null);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AuthResponse;
        if (!alive) return;
        setProfile(toProfile(json));
        setLoggedIn(true);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setProfile(null);
        setLoggedIn(false);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function logout(): Promise<void> {
    await fetch("/api/auth", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setProfile(null);
    setLoggedIn(false);
  }

  return { profile, loading, error, loggedIn, logout };
}
