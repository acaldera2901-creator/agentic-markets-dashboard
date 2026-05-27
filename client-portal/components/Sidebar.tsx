"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  History,
  ArrowDownCircle,
  Settings,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/history", label: "Storico Bet", icon: History },
  { href: "/dashboard/deposits", label: "Depositi", icon: ArrowDownCircle },
  { href: "/dashboard/settings", label: "Impostazioni", icon: Settings },
];

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
}

export default function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const initial = (userName || userEmail || "?")[0].toUpperCase();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex"
        style={{
          background: "linear-gradient(180deg, #0C0E1E 0%, #080A14 100%)",
          borderRight: "1px solid var(--am-line)",
          width: 220,
          minHeight: "100vh",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 40,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "22px 18px 18px", borderBottom: "1px solid var(--am-line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 26,
                height: 26,
                background: "var(--am-green)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <TrendingUp size={13} color="#06070F" strokeWidth={2.8} />
            </div>
            <div>
              <div
                style={{
                  color: "var(--am-text)",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                Agentic Markets
              </div>
              <div
                style={{
                  color: "var(--am-muted-2)",
                  fontSize: 9,
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: 1,
                }}
              >
                Client Portal
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px" }}>
          <div
            style={{
              color: "var(--am-muted-2)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
              padding: "8px 8px 6px",
            }}
          >
            Navigazione
          </div>
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                  color: isActive ? "var(--am-text)" : "var(--am-muted)",
                  borderLeft: isActive
                    ? "2px solid var(--am-green)"
                    : "2px solid transparent",
                  marginBottom: 1,
                  transition: "color 0.1s, border-color 0.1s",
                  background: isActive ? "rgba(34,197,94,0.06)" : "transparent",
                }}
              >
                <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: "12px 10px 16px", borderTop: "1px solid var(--am-line)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(140,145,255,0.05)",
              border: "1px solid var(--am-line)",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--am-green)",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "var(--am-text)",
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName || "User"}
              </div>
              <div
                style={{
                  color: "var(--am-muted-2)",
                  fontSize: 10,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {userEmail}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--am-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--am-red)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--am-muted)")}
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background: "var(--am-bg-2)",
          borderTop: "1px solid var(--am-line)",
          padding: "6px 0 8px",
        }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1"
              style={{
                color: isActive ? "var(--am-green)" : "var(--am-muted)",
                textDecoration: "none",
                fontSize: 9,
                fontWeight: isActive ? 700 : 400,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
