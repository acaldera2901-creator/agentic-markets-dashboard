"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      style={{ background: "var(--am-bg)", minHeight: "100vh" }}
      className="flex"
    >
      {/* Left panel — brand */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: 440,
          flexShrink: 0,
          background: "linear-gradient(160deg, #0C0E22 0%, #07080F 60%, #0A0C1A 100%)",
          borderRight: "1px solid var(--am-line)",
          padding: "48px 44px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle background circles */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 60 }}>
            <div
              style={{
                width: 30,
                height: 30,
                background: "var(--am-green)",
                borderRadius: 7,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={16} color="#06070F" strokeWidth={2.8} />
            </div>
            <span
              style={{
                color: "var(--am-text)",
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "-0.01em",
              }}
            >
              Agentic Markets
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--am-muted-2)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono), monospace",
                marginBottom: 14,
              }}
            >
              Portale Clienti
            </div>
            <h2
              style={{
                color: "var(--am-text)",
                fontSize: "clamp(1.8rem, 2.5vw, 2.6rem)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              AI-powered
              <br />
              Sports Trading
            </h2>
            <p
              style={{
                color: "var(--am-muted)",
                fontSize: 14,
                lineHeight: 1.7,
                marginTop: 14,
                maxWidth: 300,
              }}
            >
              Monitora le performance del tuo portafoglio in tempo reale.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div
          style={{
            borderTop: "1px solid var(--am-line)",
            paddingTop: 28,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
          }}
        >
          {[
            { label: "Win Rate medio", value: "74%" },
            { label: "Modelli attivi", value: "15" },
            { label: "Rendimento YTD", value: "+63%" },
          ].map((s) => (
            <div key={s.label}>
              <div
                style={{
                  color: "var(--am-green)",
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  color: "var(--am-muted-2)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono), monospace",
                  letterSpacing: "0.06em",
                  marginTop: 2,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div
        className="flex-1 flex items-center justify-center px-6"
        style={{ minHeight: "100vh" }}
      >
        <div className="w-full animate-slide-up" style={{ maxWidth: 380 }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-10">
            <div
              style={{
                width: 26,
                height: 26,
                background: "var(--am-green)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrendingUp size={14} color="#06070F" strokeWidth={2.8} />
            </div>
            <span style={{ color: "var(--am-text)", fontWeight: 700, fontSize: 14 }}>
              Agentic Markets
            </span>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h1
              style={{
                color: "var(--am-text)",
                fontWeight: 800,
                fontSize: "clamp(1.6rem, 3vw, 2rem)",
                margin: "0 0 8px",
                letterSpacing: "-0.025em",
              }}
            >
              Accedi
            </h1>
            <p style={{ color: "var(--am-muted)", fontSize: 14, margin: 0 }}>
              Inserisci le tue credenziali per continuare.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label
                style={{
                  color: "var(--am-muted-2)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  background: "rgba(140,145,255,0.05)",
                  border: "1px solid var(--am-line-2)",
                  borderRadius: 8,
                  color: "var(--am-text)",
                  padding: "11px 14px",
                  fontSize: 14,
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  width: "100%",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(34,197,94,0.5)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--am-line-2)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                style={{
                  color: "var(--am-muted-2)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  background: "rgba(140,145,255,0.05)",
                  border: "1px solid var(--am-line-2)",
                  borderRadius: 8,
                  color: "var(--am-text)",
                  padding: "11px 14px",
                  fontSize: 14,
                  outline: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  width: "100%",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(34,197,94,0.5)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--am-line-2)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? "rgba(34,197,94,0.5)" : "var(--am-green)",
                color: "#06070F",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                borderRadius: 8,
                padding: "12px",
                marginTop: 2,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.02em",
                transition: "opacity 0.15s, transform 0.12s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) =>
                !loading && (e.currentTarget.style.transform = "translateY(-1px)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              {loading ? "Accesso in corso..." : "Accedi →"}
            </button>
          </form>

          <p
            style={{
              color: "var(--am-muted)",
              fontSize: 13,
              textAlign: "center",
              marginTop: 24,
            }}
          >
            Non hai un account?{" "}
            <Link
              href="/signup"
              style={{ color: "var(--am-green)", fontWeight: 600, textDecoration: "none" }}
            >
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
