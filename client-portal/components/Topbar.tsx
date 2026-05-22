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
  ChevronDown,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/history", label: "Storico", icon: History },
  { href: "/dashboard/deposits", label: "Depositi", icon: ArrowDownCircle },
  { href: "/dashboard/settings", label: "Impostazioni", icon: Settings },
];

interface TopbarProps {
  userName?: string | null;
  userEmail?: string | null;
}

export default function Topbar({ userName, userEmail }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = (userName || userEmail || "?")[0].toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 52,
          background: "rgba(6,7,15,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--am-line)",
          display: "flex",
          alignItems: "center",
          paddingInline: 20,
          gap: 0,
        }}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            marginRight: 32,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              background: "var(--am-green)",
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={12} color="#06070F" strokeWidth={2.8} />
          </div>
          <span
            style={{
              color: "var(--am-text)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "-0.01em",
            }}
          >
            Agentic Markets
          </span>
        </Link>

        {/* Nav links — desktop */}
        <nav
          className="hidden md:flex"
          style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 11px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                  color: isActive ? "var(--am-text)" : "var(--am-muted)",
                  background: isActive ? "rgba(34,197,94,0.07)" : "transparent",
                  borderBottom: isActive
                    ? "1.5px solid var(--am-green)"
                    : "1.5px solid transparent",
                  transition: "color 0.12s, background 0.12s",
                }}
              >
                <Icon size={13} strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right — user menu */}
        <div
          ref={menuRef}
          style={{ marginLeft: "auto", position: "relative" }}
        >
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: menuOpen
                ? "rgba(140,145,255,0.08)"
                : "rgba(140,145,255,0.04)",
              border: "1px solid var(--am-line-2)",
              borderRadius: 7,
              padding: "4px 10px 4px 6px",
              cursor: "pointer",
              transition: "background 0.12s",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--am-green)",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  color: "var(--am-text)",
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  maxWidth: 110,
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
                  fontSize: 9.5,
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.02em",
                  maxWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userEmail}
              </div>
            </div>
            <ChevronDown
              size={12}
              color="var(--am-muted)"
              style={{
                transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s",
              }}
            />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 160,
                background: "rgba(13,16,32,0.96)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid var(--am-line-2)",
                borderRadius: 8,
                padding: 4,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                zIndex: 100,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--am-muted)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "color 0.1s, background 0.1s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--am-red)";
                  e.currentTarget.style.background = "rgba(239,68,68,0.07)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--am-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
        style={{
          background: "rgba(6,7,15,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
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
