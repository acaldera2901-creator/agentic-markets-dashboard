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
    pnl: number;
  };
  events_by_type: { type: string; count: number }[];
  by_country: { country: string; count: number }[];
  by_language: { language: string; count: number }[];
  by_plan: { plan: string; count: number }[];
  partner_clicks: { partner: string; clicks: number }[];
  recent_events: { event_type: string; country: string; language: string; plan: string; created_at: string }[];
  generated_at: string;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"overview" | "events" | "notifications">("overview");

  // Notification form
  const [nType, setNType] = useState<"telegram" | "in_app" | "email" | "push">("telegram");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nSending, setNSending] = useState(false);
  const [nResult, setNResult] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mRes, nRes] = await Promise.all([
        fetch("/api/admin/metrics"),
        fetch("/api/admin/notifications"),
      ]);
      if (mRes.status === 401 || nRes.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const [m, n] = await Promise.all([mRes.json(), nRes.json()]);
      setMetrics(m);
      setNotifications(n.notifications ?? []);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
            onClick={fetchData}
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
        {(["overview", "events", "notifications"] as const).map((s) => (
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatBox label="Bets Total" value={m.bets.total} />
              <StatBox label="Won" value={m.bets.wins} sub={`${hitRate}% hit rate`} />
              <StatBox label="Lost" value={m.bets.losses} />
              <StatBox label="Pending" value={m.bets.pending} />
              <StatBox
                label="System P&L"
                value={`${m.bets.pnl >= 0 ? "+" : ""}€${m.bets.pnl.toFixed(2)}`}
                sub={m.bets.pnl >= 0 ? "profit" : "loss"}
              />
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
