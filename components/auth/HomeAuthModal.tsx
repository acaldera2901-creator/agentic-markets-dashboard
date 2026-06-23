"use client";

// components/auth/HomeAuthModal.tsx (#UI-HOMEAUTH-0623, spec item #4)
// Modale auth IN-PLACE per la marketing home (/). Prima i bottoni Sign In/Register
// della home erano <a href="/app?auth=..."> → navigavano sul desk e lì un effetto
// apriva ClientAuthModal. Requisito: aprire la modale SULLA home senza cambiare
// pagina.
//
// Perché una modale dedicata e non il ClientAuthModal del desk: quel componente
// vive in app/app/page.tsx, è grande (~250 righe) ed è agganciato ai context del
// desk (useT/useLang/LanguageCtx) e a molti tipi locali (ClientProfile,
// defaultNotifications, pick5, ...). Estrarlo per condividerlo richiederebbe di
// sollevare quei context/tipi fuori dal monolite → troppo entangled per essere
// sicuro senza toccare la logica di auth. Quindi (come da spec, ramo "self-
// contained") replico una modale FOCALIZZATA che riusa LO STESSO contratto
// /api/auth (login + register + forgot + resend), con show-password e link a
// /terms /privacy. Nessuna modifica al comportamento dell'API di auth.
//
// Stile: riusa le classi CSS esistenti (.auth-modal-backdrop / .auth-modal /
// .auth-modal-head / .auth-mode-switch / .auth-error / .auth-info), così è
// coerente col desk e segue il tema.
// Su login riuscito: naviga al desk (/app). Su register: email di attivazione →
// passa alla tab login (stesso flusso del desk).

import Link from "next/link";
import { useState } from "react";

export type HomeAuthIntent = "login" | "create";

type AuthLang = "it" | "en" | "es" | "fr" | "ru";

const COPY: Record<AuthLang, {
  eyebrow: string; loginTitle: string; createTitle: string; loginSub: string; createSub: string;
  login: string; create: string; name: string; namePh: string; pwPhNew: string;
  show: string; hide: string; forgot: string; backLogin: string; recoverTitle: string; recoverSub: string;
  sendReset: string; close: string; age: string; tosPre: string; tosTerms: string; tosMid: string; tosPriv: string; tosPost: string;
  errWrong: string; errNoAcct: string; errExists: string; errPwShort: string; errGeneric: string; footer: string;
  pendingMail: (e: string) => string; resetSent: (e: string) => string; activationReq: string; resend: string; sendMail: string;
}> = {
  it: {
    eyebrow: "ACCESSO BETREDGE", loginTitle: "Bentornato", createTitle: "Crea il tuo profilo",
    loginSub: "Accedi per entrare nel desk.", createSub: "Gratis per iniziare. Niente carta richiesta.",
    login: "Login", create: "Registrati", name: "Nome", namePh: "Il tuo nome", pwPhNew: "Min. 8 caratteri",
    show: "Mostra", hide: "Nascondi", forgot: "Password dimenticata?", backLogin: "Torna all'accesso",
    recoverTitle: "Recupera la password", recoverSub: "Ti inviamo un link per impostare una nuova password.",
    sendReset: "Invia link di reset", close: "Chiudi",
    age: "Confermo di avere almeno 18 anni.",
    tosPre: "Accetto i ", tosTerms: "Termini", tosMid: " e la ", tosPriv: "Privacy", tosPost: ".",
    errWrong: "Password errata.", errNoAcct: "Nessun account con questa email.", errExists: "Email già registrata.",
    errPwShort: "La password deve avere almeno 8 caratteri.", errGeneric: "Qualcosa è andato storto. Riprova.",
    footer: "Connessione cifrata. Non condividiamo mai i tuoi dati.",
    pendingMail: (e) => `Ti abbiamo inviato un'email di attivazione a ${e}. Clicca il link (controlla anche lo spam), poi accedi qui.`,
    resetSent: (e) => `Se esiste un account per ${e}, ti abbiamo inviato un link di reset (controlla lo spam). Scade tra 1 ora.`,
    activationReq: "Questo profilo non è ancora attivo. Conferma l'email dal link che ti abbiamo inviato.",
    resend: "Non l'hai ricevuta? Reinvia l'email di attivazione", sendMail: "…",
  },
  en: {
    eyebrow: "BETREDGE ACCESS", loginTitle: "Welcome back", createTitle: "Create your profile",
    loginSub: "Sign in to enter the desk.", createSub: "Free to start. No card required.",
    login: "Login", create: "Register", name: "Name", namePh: "Your name", pwPhNew: "Min. 8 characters",
    show: "Show", hide: "Hide", forgot: "Forgot your password?", backLogin: "Back to login",
    recoverTitle: "Recover your password", recoverSub: "We'll email you a link to set a new password.",
    sendReset: "Send reset link", close: "Close",
    age: "I confirm I am at least 18 years old.",
    tosPre: "I accept the ", tosTerms: "Terms", tosMid: " and ", tosPriv: "Privacy", tosPost: ".",
    errWrong: "Wrong password.", errNoAcct: "No account with this email.", errExists: "Email already registered.",
    errPwShort: "Password must be at least 8 characters.", errGeneric: "Something went wrong. Please retry.",
    footer: "Encrypted connection. We never share your data.",
    pendingMail: (e) => `We sent an activation email to ${e}. Click the link (check spam too), then log in here.`,
    resetSent: (e) => `If an account exists for ${e}, we sent a reset link (check spam too). It expires in 1 hour.`,
    activationReq: "This profile isn't activated yet. Confirm your email via the link we sent you.",
    resend: "Didn't get it? Resend the activation email", sendMail: "…",
  },
  es: {
    eyebrow: "ACCESO BETREDGE", loginTitle: "Bienvenido de nuevo", createTitle: "Crea tu perfil",
    loginSub: "Entra para acceder al desk.", createSub: "Gratis para empezar. Sin tarjeta.",
    login: "Login", create: "Regístrate", name: "Nombre", namePh: "Tu nombre", pwPhNew: "Mín. 8 caracteres",
    show: "Mostrar", hide: "Ocultar", forgot: "¿Olvidaste la contraseña?", backLogin: "Volver al acceso",
    recoverTitle: "Recupera tu contraseña", recoverSub: "Te enviamos un enlace para una nueva contraseña.",
    sendReset: "Enviar enlace", close: "Cerrar",
    age: "Confirmo que tengo al menos 18 años.",
    tosPre: "Acepto los ", tosTerms: "Términos", tosMid: " y la ", tosPriv: "Privacidad", tosPost: ".",
    errWrong: "Contraseña incorrecta.", errNoAcct: "No hay cuenta con este email.", errExists: "Email ya registrado.",
    errPwShort: "La contraseña debe tener al menos 8 caracteres.", errGeneric: "Algo salió mal. Inténtalo de nuevo.",
    footer: "Conexión cifrada. Nunca compartimos tus datos.",
    pendingMail: (e) => `Enviamos un email de activación a ${e}. Haz clic en el enlace (revisa el spam) y entra aquí.`,
    resetSent: (e) => `Si existe una cuenta para ${e}, enviamos un enlace de reseteo (revisa el spam). Caduca en 1 hora.`,
    activationReq: "Este perfil no está activado. Confirma tu email con el enlace que enviamos.",
    resend: "¿No lo recibiste? Reenviar el email de activación", sendMail: "…",
  },
  fr: {
    eyebrow: "ACCÈS BETREDGE", loginTitle: "Bon retour", createTitle: "Crée ton profil",
    loginSub: "Connecte-toi pour accéder au desk.", createSub: "Gratuit pour commencer. Sans carte.",
    login: "Login", create: "S'inscrire", name: "Nom", namePh: "Ton nom", pwPhNew: "Min. 8 caractères",
    show: "Afficher", hide: "Masquer", forgot: "Mot de passe oublié ?", backLogin: "Retour à la connexion",
    recoverTitle: "Récupère ton mot de passe", recoverSub: "Nous t'envoyons un lien pour un nouveau mot de passe.",
    sendReset: "Envoyer le lien", close: "Fermer",
    age: "Je confirme avoir au moins 18 ans.",
    tosPre: "J'accepte les ", tosTerms: "Conditions", tosMid: " et la ", tosPriv: "Confidentialité", tosPost: ".",
    errWrong: "Mot de passe incorrect.", errNoAcct: "Aucun compte avec cet email.", errExists: "Email déjà enregistré.",
    errPwShort: "Le mot de passe doit faire au moins 8 caractères.", errGeneric: "Une erreur est survenue. Réessaie.",
    footer: "Connexion chiffrée. Nous ne partageons jamais tes données.",
    pendingMail: (e) => `Nous avons envoyé un email d'activation à ${e}. Clique le lien (vérifie les spams), puis connecte-toi ici.`,
    resetSent: (e) => `Si un compte existe pour ${e}, nous avons envoyé un lien de réinitialisation (vérifie les spams). Il expire dans 1 heure.`,
    activationReq: "Ce profil n'est pas encore activé. Confirme ton email via le lien envoyé.",
    resend: "Pas reçu ? Renvoyer l'email d'activation", sendMail: "…",
  },
  ru: {
    eyebrow: "ВХОД BETREDGE", loginTitle: "С возвращением", createTitle: "Создай профиль",
    loginSub: "Войди, чтобы открыть desk.", createSub: "Бесплатно для старта. Без карты.",
    login: "Login", create: "Регистрация", name: "Имя", namePh: "Твоё имя", pwPhNew: "Мин. 8 символов",
    show: "Показать", hide: "Скрыть", forgot: "Забыли пароль?", backLogin: "Назад ко входу",
    recoverTitle: "Восстановить пароль", recoverSub: "Пришлём ссылку для нового пароля.",
    sendReset: "Отправить ссылку", close: "Закрыть",
    age: "Подтверждаю, что мне есть 18 лет.",
    tosPre: "Принимаю ", tosTerms: "Условия", tosMid: " и ", tosPriv: "Политику", tosPost: ".",
    errWrong: "Неверный пароль.", errNoAcct: "Аккаунт с этим email не найден.", errExists: "Email уже зарегистрирован.",
    errPwShort: "Пароль должен быть не короче 8 символов.", errGeneric: "Что-то пошло не так. Повторите.",
    footer: "Шифрованное соединение. Мы никогда не передаём ваши данные.",
    pendingMail: (e) => `Мы отправили письмо активации на ${e}. Нажмите ссылку (проверьте спам), затем войдите здесь.`,
    resetSent: (e) => `Если аккаунт для ${e} существует, мы отправили ссылку сброса (проверьте спам). Действует 1 час.`,
    activationReq: "Профиль ещё не активирован. Подтвердите email по ссылке, которую мы отправили.",
    resend: "Не пришло? Отправить письмо активации повторно", sendMail: "…",
  },
};

function pickLang(lang: string): AuthLang {
  return lang === "it" || lang === "es" || lang === "fr" || lang === "ru" ? lang : "en";
}

export function HomeAuthModal({
  intent,
  lang,
  onClose,
}: {
  intent: HomeAuthIntent;
  lang: string;
  onClose: () => void;
}) {
  const t = COPY[pickLang(lang)];
  const [mode, setMode] = useState<HomeAuthIntent>(intent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [tosOk, setTosOk] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome"; } catch { return "Europe/Rome"; } })();
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = normalizedEmail.includes("@");
  const pwValid = password.length >= 8;
  const canSubmit = mode === "login"
    ? emailValid && pwValid
    : name.trim().length > 1 && emailValid && pwValid && ageOk && tosOk;

  // Riusa LO STESSO contratto /api/auth del desk. Nessuna modifica al server.
  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true); setError(""); setInfo(""); setShowResend(false);
    try {
      const resp = await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({
          action: mode === "login" ? "login" : "register",
          identifier: normalizedEmail, password,
          name: mode === "create" ? name.trim() : undefined,
          language: lang, timezone: tz,
          ref: mode === "create"
            ? (() => { try { return window.localStorage.getItem("am_ref") ?? undefined; } catch { return undefined; } })()
            : undefined,
        }),
      });
      const data = await resp.json().catch(() => ({})) as { pending_activation?: boolean; error?: string };
      if (resp.status === 202 || data.pending_activation) {
        setInfo(t.pendingMail(normalizedEmail));
        setShowResend(true);
        setMode("login"); // register → login (gate email), come il desk
      } else if (resp.ok) {
        // Login riuscito: il cookie di sessione è settato → entra nel desk.
        window.location.href = "/app";
      } else if (resp.status === 403 && data.error === "activation_required") {
        setError(t.activationReq); setShowResend(true);
      } else if (resp.status === 401) setError(t.errWrong);
      else if (resp.status === 404) setError(t.errNoAcct);
      else if (resp.status === 409) setError(t.errExists);
      else if (resp.status === 400) setError(t.errPwShort);
      else setError(t.errGeneric);
    } catch { setError(t.errGeneric); }
    finally { setBusy(false); }
  };

  const resendActivation = async () => {
    if (busy || !emailValid) return;
    setBusy(true); setError("");
    try {
      await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: "resend_activation", identifier: normalizedEmail, language: lang }),
      });
      setInfo(t.pendingMail(normalizedEmail));
    } catch { setError(t.errGeneric); }
    finally { setBusy(false); }
  };

  const submitForgot = async () => {
    if (busy || !emailValid) return;
    setBusy(true); setError("");
    try {
      await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ action: "forgot_password", identifier: normalizedEmail, language: lang }),
      });
      setForgotSent(true);
    } catch { setError(t.errGeneric); }
    finally { setBusy(false); }
  };

  const closeBtn = (
    <button type="button" onClick={onClose} aria-label={t.close}
      style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none",
        color: "var(--am-muted-2)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4 }}>
      ×
    </button>
  );

  if (forgot) {
    return (
      <div className="auth-modal-backdrop">
        <form className="auth-modal" onSubmit={(e) => { e.preventDefault(); submitForgot(); }} style={{ position: "relative" }}>
          {closeBtn}
          <div className="auth-modal-head">
            <p className="eyebrow">{t.eyebrow}</p>
            <h3>{t.recoverTitle}</h3>
            <span>{t.recoverSub}</span>
          </div>
          {forgotSent ? (
            <p className="auth-info" style={{ fontSize: 13, lineHeight: 1.5, color: "var(--am-coral)", margin: "4px 0 0" }}>
              {t.resetSent(normalizedEmail)}
            </p>
          ) : (
            <>
              <label>
                <span>Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="email" />
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button disabled={!emailValid || busy}>{busy ? "…" : t.sendReset}</button>
            </>
          )}
          <button type="button" onClick={() => { setForgot(false); setForgotSent(false); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--am-muted)", textDecoration: "underline",
              cursor: "pointer", fontSize: 12, padding: "6px 0", alignSelf: "center" }}>
            {t.backLogin}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="auth-modal-backdrop">
      <form className="auth-modal" onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ position: "relative" }}>
        {closeBtn}
        <div className="auth-modal-head">
          <p className="eyebrow">{t.eyebrow}</p>
          <h3>{mode === "login" ? t.loginTitle : t.createTitle}</h3>
          <span>{mode === "login" ? t.loginSub : t.createSub}</span>
        </div>
        <div className="auth-mode-switch">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); }}>{t.login}</button>
          <button type="button" className={mode === "create" ? "is-active" : ""} onClick={() => { setMode("create"); setError(""); }}>{t.create}</button>
        </div>
        {mode === "create" && (
          <label>
            <span>{t.name}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} autoComplete="name" />
          </label>
        )}
        <label>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="email" />
        </label>
        <label>
          <span>Password</span>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "create" ? t.pwPhNew : "••••••••"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{ width: "100%", paddingRight: 52 }} />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}
              aria-label={showPw ? t.hide : t.show}
              style={{ position: "absolute", right: 8, background: "none", border: "none",
                color: "var(--am-muted)", fontSize: 11, fontWeight: 700, letterSpacing: ".04em",
                textTransform: "uppercase", cursor: "pointer", padding: "4px 6px" }}>
              {showPw ? t.hide : t.show}
            </button>
          </div>
        </label>
        {mode === "login" && (
          <button type="button" onClick={() => { setForgot(true); setError(""); setInfo(""); }}
            style={{ background: "none", border: "none", color: "var(--am-muted)", textDecoration: "underline",
              cursor: "pointer", fontSize: 12, padding: "2px 0", alignSelf: "flex-start" }}>
            {t.forgot}
          </button>
        )}
        {mode === "create" && (
          <div className="auth-consent" style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 0" }}>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              <span>{t.age}</span>
            </label>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.45, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
              <input type="checkbox" checked={tosOk} onChange={(e) => setTosOk(e.target.checked)} style={{ width: "auto", marginTop: 2, flex: "0 0 auto" }} />
              {/* link in-site (route interne), niente target="_blank" */}
              <span>{t.tosPre}<Link href="/terms" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>{t.tosTerms}</Link>{t.tosMid}<Link href="/privacy" style={{ color: "var(--am-coral)", textDecoration: "underline" }}>{t.tosPriv}</Link>{t.tosPost}</span>
            </label>
          </div>
        )}
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--am-coral)", margin: "4px 0 0" }}>{info}</p>}
        {showResend && (
          <button type="button" onClick={resendActivation} disabled={busy || !emailValid}
            style={{ background: "none", border: "none", color: "var(--am-muted)", textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: "4px 0", alignSelf: "flex-start" }}>
            {t.resend}
          </button>
        )}
        <button disabled={!canSubmit || busy}>{busy ? "…" : (mode === "login" ? t.login : t.create)}</button>
        <p>{t.footer}</p>
      </form>
    </div>
  );
}
