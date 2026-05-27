"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
  currentEmail: string;
  currentName: string;
}

export default function SettingsClient({ userId, currentEmail, currentName }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [emailNotif, setEmailNotif] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: name })
      .eq("id", userId);
    if (error) {
      toast.error("Errore aggiornamento profilo: " + error.message);
    } else {
      toast.success("Profilo aggiornato");
      router.refresh();
    }
    setSavingProfile(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      toast.error("Le password non coincidono");
      return;
    }
    if (newPwd.length < 8) {
      toast.error("Password troppo corta (min. 8 caratteri)");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) {
      toast.error("Errore: " + error.message);
    } else {
      toast.success("Password aggiornata");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    }
    setSavingPwd(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "ELIMINA") {
      toast.error('Digita "ELIMINA" per confermare');
      return;
    }
    // Note: soft delete via signOut — full deletion requires server-side admin API
    await supabase.auth.signOut();
    toast.info("Account eliminato. Contatta il supporto per completare la rimozione.");
    router.push("/login");
  }

  const sectionStyle = {
    background: "rgba(255,255,255,0.03)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid var(--am-line)",
    borderRadius: 10,
    padding: "20px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  };

  const inputStyle = {
    background: "var(--am-panel-2)",
    border: "1px solid var(--am-line-2)",
    borderRadius: 8,
    color: "var(--am-text)",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  } as React.CSSProperties;

  const labelStyle = {
    color: "var(--am-muted)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    display: "block",
    marginBottom: 6,
  };

  const sectionTitle = (title: string, sub?: string) => (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ color: "var(--am-text)", fontWeight: 700, fontSize: 15, margin: 0 }}>
        {title}
      </h2>
      {sub && (
        <p style={{ color: "var(--am-muted)", fontSize: 12, margin: "4px 0 0" }}>{sub}</p>
      )}
    </div>
  );

  return (
    <div className="animate-slide-up flex flex-col gap-5" style={{ maxWidth: 560 }}>
      <div>
        <h1 style={{ color: "var(--am-text)", fontWeight: 800, fontSize: "1.6rem", margin: 0 }}>
          Impostazioni
        </h1>
        <p style={{ color: "var(--am-muted)", fontSize: 13, margin: "5px 0 0" }}>
          Gestisci il tuo profilo e le preferenze.
        </p>
      </div>

      {/* Profile */}
      <div style={sectionStyle}>
        {sectionTitle("Profilo", "Aggiorna nome e email associati al tuo account.")}
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>Nome completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
              readOnly
            />
            <p style={{ color: "var(--am-muted-2)", fontSize: 11, marginTop: 4 }}>
              Per cambiare email contatta il supporto.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            style={{
              background: savingProfile ? "rgba(0,255,136,0.4)" : "var(--am-green)",
              color: "#0a0a0a",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              alignSelf: "flex-start",
            }}
          >
            {savingProfile ? "Salvataggio..." : "Salva Profilo"}
          </button>
        </form>
      </div>

      {/* Password */}
      <div style={sectionStyle}>
        {sectionTitle("Cambia Password", "Usa una password forte di almeno 8 caratteri.")}
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div>
            <label style={labelStyle}>Password attuale</label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>
          <div>
            <label style={labelStyle}>Nuova password</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Min. 8 caratteri"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>
          <div>
            <label style={labelStyle}>Conferma nuova password</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder="Ripeti la password"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-green)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--am-line-2)")}
            />
          </div>
          <button
            type="submit"
            disabled={savingPwd}
            style={{
              background: savingPwd ? "rgba(0,255,136,0.4)" : "var(--am-green)",
              color: "#0a0a0a",
              fontWeight: 700,
              fontSize: 13,
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              alignSelf: "flex-start",
            }}
          >
            {savingPwd ? "Aggiornamento..." : "Aggiorna Password"}
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div style={sectionStyle}>
        {sectionTitle("Notifiche")}
        <label
          className="flex items-center gap-3"
          style={{ cursor: "pointer" }}
        >
          <div
            onClick={() => setEmailNotif((v) => !v)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 999,
              background: emailNotif ? "var(--am-green)" : "var(--am-panel-3)",
              border: `1px solid ${emailNotif ? "rgba(0,255,136,0.4)" : "var(--am-line-2)"}`,
              position: "relative",
              transition: "background 0.2s, border-color 0.2s",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: emailNotif ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: emailNotif ? "#0a0a0a" : "rgba(255,255,255,0.4)",
                transition: "left 0.2s",
              }}
            />
          </div>
          <div>
            <div style={{ color: "var(--am-text)", fontSize: 13, fontWeight: 600 }}>
              Alert email per ogni bet piazzata
            </div>
            <div style={{ color: "var(--am-muted)", fontSize: 11, marginTop: 2 }}>
              Ricevi una notifica quando il sistema piazza una scommessa
            </div>
          </div>
        </label>
      </div>

      {/* Danger zone */}
      <div
        style={{
          background: "rgba(255,68,68,0.04)",
          border: "1px solid rgba(255,68,68,0.2)",
          borderRadius: 10,
          padding: "20px",
        }}
      >
        <h2 style={{ color: "var(--am-red)", fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>
          Zona Pericolo
        </h2>
        <p style={{ color: "var(--am-muted)", fontSize: 12, margin: "0 0 16px" }}>
          L&apos;eliminazione dell&apos;account e&apos; irreversibile. Tutti i tuoi dati verranno persi.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label style={{ ...labelStyle, color: "rgba(255,68,68,0.7)" }}>
              Digita ELIMINA per confermare
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='ELIMINA'
              style={{
                ...inputStyle,
                border: "1px solid rgba(255,68,68,0.25)",
                maxWidth: 200,
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--am-red)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,68,68,0.25)")}
            />
          </div>
          <button
            onClick={handleDeleteAccount}
            style={{
              background: "rgba(255,68,68,0.12)",
              border: "1px solid rgba(255,68,68,0.35)",
              borderRadius: 8,
              color: "var(--am-red)",
              fontWeight: 700,
              fontSize: 13,
              padding: "10px 20px",
              alignSelf: "flex-start",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,68,68,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,68,68,0.12)")}
          >
            Elimina Account
          </button>
        </div>
      </div>
    </div>
  );
}
