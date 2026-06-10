"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Metrics {
  overview: {
    total_events: number;
    total_conversions: number;
    total_revenue_eur: number;
    leaderboard_users: number;
    partner_requests: number;
  };
  bets: {
    total: number;
    wins: number;
    losses: number;
    pending: number;
  };
  clients: {
    total: number;
    free: number;
    pending_payment: number;
    base: number;
    premium: number;
    paying: number;
    new_7d: number;
    new_30d: number;
  };
  pending_activations: { identifier: string; requested_plan: string; tx_hash: string; created_at: string }[];
  finance: {
    monthly_burn_eur: number;
    total_revenue_eur: number;
    net_eur: number;
    costs: { label: string; category: string; monthly_eur: number }[];
  };
  events_by_type: { type: string; count: number }[];
  by_country: { country: string; count: number }[];
  by_language: { language: string; count: number }[];
  by_plan: { plan: string; count: number }[];
  partner_clicks: { partner: string; clicks: number }[];
  recent_events: { event_type: string; country: string; language: string; plan: string; created_at: string }[];
  generated_at: string;
}

type Plan = "free" | "pending_payment" | "base" | "premium" | "admin_full";

interface AdminProfile {
  id: string;
  identifier: string;
  name: string | null;
  plan: Plan;
  requested_plan: "base" | "premium" | null;
  tx_hash: string | null;
  language: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

const CLIENT_PROFILE_KEY = "agentic-client-profile";
const CLIENT_PROFILES_KEY = "agentic-client-profiles";

function seedClientProfile(profile: AdminProfile) {
  const email = profile.identifier.trim().toLowerCase();
  const language = profile.language === "en" || profile.language === "it" ? profile.language : "it";
  const clientProfile = {
    name: profile.name ?? email.split("@")[0] ?? "Client",
    email,
    plan: profile.plan,
    language,
    timezone: profile.timezone ?? "Europe/Rome",
    risk: { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" },
    betfair: { status: "not_connected" },
    notifications: {
      valueBets: true,
      dailyReport: true,
      paymentUpdates: true,
      securityAlerts: true,
    },
    txHash: profile.tx_hash ?? undefined,
    requestedPlan: profile.requested_plan ?? undefined,
  };

  window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(clientProfile));
  const raw = window.localStorage.getItem(CLIENT_PROFILES_KEY);
  const profiles = raw ? JSON.parse(raw) as Array<{ email?: string }> : [];
  const nextProfiles = [
    clientProfile,
    ...profiles.filter((item) => item.email?.toLowerCase() !== email),
  ];
  window.localStorage.setItem(CLIENT_PROFILES_KEY, JSON.stringify(nextProfiles));
}

interface Notification {
  id: number;
  type: string;
  title: string | null;
  body: string;
  target: string;
  sent: boolean;
  created_at: string;
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-gray-500 text-xs mt-1">{sub}</div>}
    </Card>
  );
}

function Badge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    telegram: "bg-blue-900 text-blue-300",
    in_app: "bg-purple-900 text-purple-300",
    email: "bg-yellow-900 text-yellow-300",
    push: "bg-green-900 text-green-300",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] ?? "bg-gray-800 text-gray-400"}`}>
      {type}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [adminIdentifier, setAdminIdentifier] = useState("acaldera2901@gmail.com");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"overview" | "profiles" | "events" | "notifications">("overview");
  const [activationBusy, setActivationBusy] = useState<string | null>(null);
  const [activationResult, setActivationResult] = useState("");
  const [profileBusy, setProfileBusy] = useState<string | null>(null);
  const [profileResult, setProfileResult] = useState("");

  // Notification form
  const [nType, setNType] = useState<"telegram" | "in_app" | "email" | "push">("telegram");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nSending, setNSending] = useState(false);
  const [nResult, setNResult] = useState("");

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const [mRes, nRes] = await Promise.all([
        fetch("/api/admin/metrics", { cache: "no-store" }),
        fetch("/api/admin/notifications", { cache: "no-store" }),
      ]);
      if (mRes.status === 401 || nRes.status === 401) {
        router.replace("/admin/login");
        return;
      }
      // A non-401 error response (rate limit, WAF) can still carry a JSON body
      // without the Metrics shape — rendering it would crash the page.
      if (!mRes.ok || !nRes.ok) {
        setError("Failed to load data.");
        return;
      }
      const [m, n] = await Promise.all([mRes.json(), nRes.json()]);
      if (!m?.overview) {
        setError("Failed to load data.");
        return;
      }
      setMetrics(m);
      setNotifications(n.notifications ?? []);
      const pRes = await fetch("/api/admin/profiles", { cache: "no-store" });
      if (pRes.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (pRes.ok) {
        const p = await pRes.json() as { profiles?: AdminProfile[]; admin_identifier?: string };
        setProfiles(p.profiles ?? []);
        setAdminIdentifier(p.admin_identifier ?? "acaldera2901@gmail.com");
      }
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => { void fetchData(); });
    // Keep the live admin in sync with the DB without a manual reload: poll
    // silently every 30s and refetch whenever the tab regains focus.
    const id = setInterval(() => { void fetchData({ silent: true }); }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchData({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
  }

  async function sendNotification(e: React.FormEvent) {
    e.preventDefault();
    if (!nBody.trim()) return;
    setNSending(true);
    setNResult("");
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nType, title: nTitle || undefined, body: nBody }),
      });
      const data = await res.json();
      setNResult(data.sent ? "Sent successfully." : "Saved (not delivered).");
      setNBody("");
      setNTitle("");
      fetchData();
    } catch {
      setNResult("Error sending.");
    } finally {
      setNSending(false);
    }
  }

  async function approveActivation(identifier: string) {
    const pending = profiles.find((profile) => profile.identifier === identifier);
    if (!pending?.requested_plan) {
      setActivationResult("Profilo non trovato o piano richiesto mancante.");
      return;
    }
    setActivationBusy(identifier);
    // Only claim success if the PATCH really succeeded: a green banner over a
    // failed activation leaves the client pending_payment while the admin
    // believes the USDT payment was approved.
    const ok = await updateProfilePlan(pending, pending.requested_plan);
    setActivationResult(ok
      ? `Profilo ${identifier} attivato come ${pending.requested_plan}.`
      : `Attivazione di ${identifier} FALLITA — vedi sezione profili per il dettaglio.`);
    setActivationBusy(null);
  }

  async function updateProfilePlan(profile: AdminProfile, plan: Plan): Promise<boolean> {
    setProfileBusy(profile.id);
    setProfileResult("");
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id, identifier: profile.identifier, plan }),
      });
      const data = await res.json() as { error?: string; profile?: AdminProfile };
      if (res.status === 401) {
        router.replace("/admin/login");
        return false;
      }
      if (!res.ok) {
        setProfileResult(data.error ?? "Plan update failed.");
        return false;
      }
      setProfileResult(`${profile.identifier} aggiornato a ${data.profile?.plan ?? plan}.`);
      await fetchData();
      return true;
    } catch {
      setProfileResult("Errore durante aggiornamento piano.");
      return false;
    } finally {
      setProfileBusy(null);
    }
  }

  async function switchToProfile(profile: AdminProfile) {
    setProfileBusy(profile.id);
    setProfileResult("");
    try {
      seedClientProfile(profile);
      const switchUrl = `/api/admin/profiles/switch?id=${encodeURIComponent(profile.id)}&identifier=${encodeURIComponent(profile.identifier)}`;
      window.location.assign(switchUrl);
    } catch {
      setProfileResult("Errore durante lo switch profilo.");
    } finally {
      setProfileBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  const m = metrics!;
  const hitRate = m.bets.total > 0 ? Math.round((m.bets.wins / m.bets.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">Agentic Markets</span>
          <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full font-medium">ADMIN</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-xs">
            Updated {new Date(m.generated_at).toLocaleTimeString()}
          </span>
          <button
            onClick={() => fetchData()}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-red-400 text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 flex gap-1">
        {(["overview", "profiles", "events", "notifications"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition-colors ${
              section === s
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {s}
          </button>
        ))}
      </nav>

      <main className="px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* ── OVERVIEW ── */}
        {section === "overview" && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatBox label="Total Events" value={m.overview.total_events.toLocaleString()} />
              <StatBox label="Conversions" value={m.overview.total_conversions} />
              <StatBox label="Revenue" value={`€${m.overview.total_revenue_eur.toFixed(2)}`} />
              <StatBox label="Leaderboard Users" value={m.overview.leaderboard_users} />
              <StatBox label="Partner Requests" value={m.overview.partner_requests} />
            </div>

            {/* Bets stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Bets Total" value={m.bets.total} />
              <StatBox label="Won" value={m.bets.wins} sub={`${hitRate}% hit rate`} />
              <StatBox label="Lost" value={m.bets.losses} />
              <StatBox label="Pending" value={m.bets.pending} />
            </div>

            {/* Clienti reali (profiles table) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatBox label="Clienti totali" value={m.clients.total} sub={`+${m.clients.new_7d} ultimi 7gg`} />
              <StatBox label="Paganti" value={m.clients.paying} sub={`${m.clients.base} base · ${m.clients.premium} premium`} />
              <StatBox label="In attesa pagamento" value={m.clients.pending_payment} sub="da attivare" />
              <StatBox label="Free" value={m.clients.free} />
              <StatBox label="Nuovi 30gg" value={m.clients.new_30d} />
              <StatBox label="Conversion" value={`${m.clients.total > 0 ? Math.round((m.clients.paying / m.clients.total) * 100) : 0}%`} sub="paganti/totali" />
            </div>

            {activationResult && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${
                activationResult.includes("Errore") || activationResult.includes("failed") || activationResult.includes("missing")
                  ? "border-red-800 bg-red-950/40 text-red-300"
                  : "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              }`}>
                {activationResult}
              </div>
            )}

            {/* Attivazioni in attesa — azionabili */}
            {m.pending_activations.length > 0 && (
              <Card>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">
                  Attivazioni in attesa ({m.pending_activations.length})
                </div>
                <div className="space-y-2">
                  {m.pending_activations.map((p) => (
                    <div key={p.identifier} className="grid grid-cols-1 gap-2 border-b border-gray-800 pb-3 text-sm md:grid-cols-[1fr_120px_1fr_120px] md:items-center">
                      <span className="text-gray-300">{p.identifier}</span>
                      <span className="text-gray-400 capitalize">{p.requested_plan}</span>
                      <span className="text-gray-500 font-mono text-xs truncate" title={p.tx_hash}>{p.tx_hash || "—"}</span>
                      <button
                        onClick={() => approveActivation(p.identifier)}
                        disabled={activationBusy === p.identifier}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500"
                      >
                        {activationBusy === p.identifier ? "Attivo..." : "Approva"}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Finanze — costi fissi + net vs revenue */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 grid grid-cols-3 gap-4">
                <StatBox label="Burn mensile" value={`€${m.finance.monthly_burn_eur.toFixed(2)}`} sub="costi fissi" />
                <StatBox label="Revenue" value={`€${m.finance.total_revenue_eur.toFixed(2)}`} />
                <StatBox
                  label="Net"
                  value={`${m.finance.net_eur >= 0 ? "+" : ""}€${m.finance.net_eur.toFixed(2)}`}
                  sub={m.finance.net_eur >= 0 ? "in attivo" : "in perdita"}
                />
              </div>
              <Card>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Costi mensili</div>
                <div className="space-y-2">
                  {m.finance.costs.map((c) => (
                    <div key={c.label} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">{c.label}</span>
                      <span className="text-white font-medium">€{c.monthly_eur.toFixed(2)}</span>
                    </div>
                  ))}
                  {m.finance.costs.length === 0 && (
                    <div className="text-gray-600 text-sm">Nessun costo configurato — modifica lib/operating-costs.ts</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Country + Language + Plan */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">By Country</div>
                <div className="space-y-2">
                  {m.by_country.slice(0, 8).map((r) => (
                    <div key={r.country} className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{r.country.toUpperCase()}</span>
                      <span className="text-sm font-medium text-white">{r.count}</span>
                    </div>
                  ))}
                  {m.by_country.length === 0 && <div className="text-gray-600 text-sm">No data yet</div>}
                </div>
              </Card>

              <Card>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">By Language</div>
                <div className="space-y-2">
                  {m.by_language.map((r) => (
                    <div key={r.language} className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{r.language.toUpperCase()}</span>
                      <span className="text-sm font-medium text-white">{r.count}</span>
                    </div>
                  ))}
                  {m.by_language.length === 0 && <div className="text-gray-600 text-sm">No data yet</div>}
                </div>
              </Card>

              <Card>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Plan Views</div>
                <div className="space-y-2">
                  {m.by_plan.map((r) => (
                    <div key={r.plan} className="flex justify-between items-center">
                      <span className="text-sm text-gray-300 capitalize">{r.plan}</span>
                      <span className="text-sm font-medium text-white">{r.count}</span>
                    </div>
                  ))}
                  {m.by_plan.length === 0 && <div className="text-gray-600 text-sm">No data yet</div>}
                </div>
              </Card>
            </div>

            {/* Partner clicks */}
            {m.partner_clicks.length > 0 && (
              <Card>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Partner Clicks</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {m.partner_clicks.map((r) => (
                    <div key={r.partner} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-300 text-sm truncate">{r.partner}</div>
                      <div className="text-white font-bold text-lg">{r.clicks}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Events breakdown */}
            <Card>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">Events by Type</div>
              <div className="flex flex-wrap gap-3">
                {m.events_by_type.map((r) => (
                  <div key={r.type} className="bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
                    <span className="text-gray-400 text-sm">{r.type}</span>
                    <span className="text-white font-semibold">{r.count}</span>
                  </div>
                ))}
                {m.events_by_type.length === 0 && <div className="text-gray-600 text-sm">No events tracked yet</div>}
              </div>
            </Card>
          </>
        )}

        {/* ── PROFILES ── */}
        {section === "profiles" && (
          <Card>
            <div className="flex flex-col gap-3 mb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider">Profile Control</div>
                <h2 className="text-xl font-bold text-white mt-1">Utenti, piani e switch sessione</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Admin canonico: <span className="font-mono text-emerald-300">{adminIdentifier}</span>. Puoi fare upgrade, downgrade e aprire il desk come qualsiasi profilo.
                </p>
              </div>
              <button
                onClick={() => fetchData()}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-emerald-500 hover:text-white"
              >
                Refresh profiles
              </button>
            </div>

            {profileResult && (
              <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                profileResult.includes("Errore") || profileResult.includes("failed") || profileResult.includes("not found")
                  ? "border-red-800 bg-red-950/40 text-red-300"
                  : "border-emerald-800 bg-emerald-950/40 text-emerald-300"
              }`}>
                {profileResult}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500">
                    <th className="text-left pb-2 font-medium">Profile</th>
                    <th className="text-left pb-2 font-medium">Plan</th>
                    <th className="text-left pb-2 font-medium">Requested</th>
                    <th className="text-left pb-2 font-medium">TX</th>
                    <th className="text-left pb-2 font-medium">Updated</th>
                    <th className="text-right pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => {
                    const isAdmin = profile.identifier === adminIdentifier;
                    const busy = profileBusy === profile.id;
                    return (
                      <tr key={profile.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3">
                          <div className="font-medium text-gray-200">{profile.name || "Senza nome"}</div>
                          <div className="font-mono text-xs text-gray-500">{profile.identifier}</div>
                          {isAdmin && <span className="mt-1 inline-block rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">ADMIN</span>}
                        </td>
                        <td className="py-3">
                          <select
                            value={profile.plan}
                            disabled={busy}
                            onChange={(event) => updateProfilePlan(profile, event.target.value as Plan)}
                            className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                          >
                            <option value="free">free</option>
                            <option value="pending_payment">pending_payment</option>
                            <option value="base">base</option>
                            <option value="premium">premium</option>
                            <option value="admin_full">admin_full</option>
                          </select>
                        </td>
                        <td className="py-3 text-gray-400">{profile.requested_plan ?? "—"}</td>
                        <td className="py-3">
                          <span className="block max-w-[180px] truncate font-mono text-xs text-gray-500" title={profile.tx_hash ?? ""}>
                            {profile.tx_hash || "—"}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-gray-500">
                          {new Date(profile.updated_at).toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {profile.plan === "pending_payment" && profile.requested_plan && (
                              <button
                                disabled={busy}
                                onClick={() => updateProfilePlan(profile, profile.requested_plan as Plan)}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500"
                              >
                                Approva
                              </button>
                            )}
                            <button
                              disabled={busy}
                              onClick={() => switchToProfile(profile)}
                              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50"
                            >
                              {busy ? "..." : "Switch"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-600">
                        Nessun profilo trovato.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── EVENTS ── */}
        {section === "events" && (
          <Card>
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-4">Recent Events (last 50)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-gray-800">
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-left pb-2 font-medium">Country</th>
                    <th className="text-left pb-2 font-medium">Language</th>
                    <th className="text-left pb-2 font-medium">Plan</th>
                    <th className="text-left pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {m.recent_events.map((ev, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 text-emerald-400 font-mono text-xs">{ev.event_type}</td>
                      <td className="py-2 text-gray-300">{ev.country ?? "—"}</td>
                      <td className="py-2 text-gray-300">{ev.language ?? "—"}</td>
                      <td className="py-2 text-gray-400">{ev.plan ?? "—"}</td>
                      <td className="py-2 text-gray-500 text-xs">
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {m.recent_events.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-600">
                        No events tracked yet. Events are recorded as users interact with the dashboard.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── NOTIFICATIONS ── */}
        {section === "notifications" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Send form */}
            <Card>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-4">Send Notification</div>
              <form onSubmit={sendNotification} className="space-y-4">
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Type</label>
                  <select
                    value={nType}
                    onChange={(e) => setNType(e.target.value as typeof nType)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="telegram">Telegram</option>
                    <option value="in_app">In-App</option>
                    <option value="email">Email</option>
                    <option value="push">Push</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Title (optional)</label>
                  <input
                    type="text"
                    value={nTitle}
                    onChange={(e) => setNTitle(e.target.value)}
                    placeholder="Notification title"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs block mb-1">Message</label>
                  <textarea
                    value={nBody}
                    onChange={(e) => setNBody(e.target.value)}
                    placeholder="Message body"
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
                {nResult && (
                  <div className={`text-sm ${nResult.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                    {nResult}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={nSending || !nBody.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {nSending ? "Sending..." : "Send"}
                </button>
              </form>
            </Card>

            {/* Notification history */}
            <Card>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-4">
                History ({notifications.length})
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge type={n.type} />
                      <span className="text-gray-500 text-xs">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    {n.title && <div className="text-white text-sm font-medium">{n.title}</div>}
                    <div className="text-gray-300 text-sm mt-0.5">{n.body}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs ${n.sent ? "text-emerald-400" : "text-gray-500"}`}>
                        {n.sent ? "Delivered" : "Saved"}
                      </span>
                      <span className="text-gray-600 text-xs">→ {n.target}</span>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="text-gray-600 text-sm text-center py-8">
                    No notifications yet.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}
