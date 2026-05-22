"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Account created! Check your email to confirm.");
    router.push("/login");
  }

  const inputStyle = {
    background: "var(--am-panel-2)",
    border: "1px solid var(--am-line-2)",
    borderRadius: 8,
    color: "var(--am-text)",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.15s",
    width: "100%",
  } as React.CSSProperties;

  const labelStyle = {
    color: "var(--am-muted)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  };

  return (
    <div
      style={{ background: "var(--am-bg)" }}
      className="min-h-screen flex items-center justify-center px-4"
    >
      <div
        style={{
          background: "var(--am-panel)",
          border: "1px solid var(--am-line-2)",
          borderRadius: 12,
        }}
        className="w-full max-w-sm p-8 animate-slide-up"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div
              style={{
                width: 32,
                height: 32,
                background: "var(--am-green)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L16 6.5V11.5L9 16L2 11.5V6.5L9 2Z" fill="#0a0a0a" />
              </svg>
            </div>
            <span style={{ color: "var(--am-text)", fontWeight: 800, fontSize: 18 }}>
              Agentic Markets
            </span>
          </div>
          <p style={{ color: "var(--am-muted)", fontSize: 13 }}>Client Portal</p>
        </div>

        <h1 style={{ color: "var(--am-text)", fontWeight: 700, fontSize: 20, marginBottom: 24 }}>
          Create your account
        </h1>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mario Rossi"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "rgba(0,255,136,0.4)" : "var(--am-green)",
              color: "#0a0a0a",
              fontWeight: 800,
              fontSize: 14,
              border: "none",
              borderRadius: 8,
              padding: "11px",
              marginTop: 4,
              transition: "opacity 0.15s, transform 0.12s",
              letterSpacing: "0.04em",
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p style={{ color: "var(--am-muted)", fontSize: 13, textAlign: "center", marginTop: 20 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--am-green)", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
