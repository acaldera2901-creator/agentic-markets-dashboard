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
// Stile (#SIGNUP-V3): ridisegnato on-brand col look "Live Terminal" della home
// v3. Namespace CSS .av-* scoped sotto .hv3 in globals.css (il modal è montato
// dentro <div className="lp hv3">) → eredita i token --v-* (dark + light) e resta
// squadrato/mono come il resto del sito. NON tocca le classi .auth-modal globali,
// che restano al ClientAuthModal del desk.
// Su login riuscito: naviga al desk (/app). Su register: email di attivazione →
// passa alla tab login (stesso flusso del desk).

import Link from "next/link";
import { useEffect, useState } from "react";
import { readRefCode, writeRefCode, normalizeRefCode } from "@/lib/referral-code";

export type HomeAuthIntent = "login" | "create";

type AuthLang = "it" | "en" | "es" | "fr" | "ru";

const COPY: Record<AuthLang, {
  eyebrow: string; loginTitle: string; createTitle: string; loginSub: string; createSub: string;
  login: string; create: string; name: string; namePh: string; userHint: string; pwPhNew: string;
  show: string; hide: string; forgot: string; backLogin: string; recoverTitle: string; recoverSub: string;
  sendReset: string; close: string; secure: string; age: string; marketing: string; tosPre: string; tosTerms: string; tosMid: string; tosPriv: string; tosPost: string;
  errWrong: string; errNoAcct: string; errExists: string; errPwShort: string; errGeneric: string; footer: string;
  pendingMail: (e: string) => string; resetSent: (e: string) => string; activationReq: string; resend: string; sendMail: string;
  refLabel: string; refPh: string; addInvite: string; invitedBy: (c: string) => string; promoFirst: string;
}> = {
  it: {
    eyebrow: "ACCESSO BETREDGE", loginTitle: "Bentornato", createTitle: "Crea il tuo profilo",
    loginSub: "Accedi per entrare nel desk.", createSub: "Gratis per iniziare. Niente carta richiesta.",
    login: "Login", create: "Registrati", name: "Username", namePh: "iltuonome", userHint: "3–20 caratteri · lettere, numeri, underscore", pwPhNew: "Min. 8 caratteri",
    show: "Mostra", hide: "Nascondi", forgot: "Password dimenticata?", backLogin: "Torna all'accesso",
    recoverTitle: "Recupera la password", recoverSub: "Ti inviamo un link per impostare una nuova password.",
    sendReset: "Invia link di reset", close: "Chiudi", secure: "Sicuro",
    age: "Confermo di avere almeno 18 anni.",
    marketing: "Voglio ricevere offerte e novità BetRedge via email (facoltativo).",
    tosPre: "Accetto i ", tosTerms: "Termini", tosMid: " e la ", tosPriv: "Privacy", tosPost: ".",
    errWrong: "Password errata.", errNoAcct: "Nessun account con questa email.", errExists: "Email già registrata.",
    errPwShort: "La password deve avere almeno 8 caratteri.", errGeneric: "Qualcosa è andato storto. Riprova.",
    footer: "Connessione cifrata. Non condividiamo mai i tuoi dati.",
    pendingMail: (e) => `Ti abbiamo inviato un'email di attivazione a ${e}. Clicca il link (controlla anche lo spam), poi accedi qui.`,
    resetSent: (e) => `Se esiste un account per ${e}, ti abbiamo inviato un link di reset (controlla lo spam). Scade tra 1 ora.`,
    activationReq: "Questo profilo non è ancora attivo. Conferma l'email dal link che ti abbiamo inviato.",
    resend: "Non l'hai ricevuta? Reinvia l'email di attivazione", sendMail: "…",
    refLabel: "Codice invito (facoltativo)", refPh: "es. MARIO10", addInvite: "Ho un codice invito", invitedBy: (c) => `Invitato da ${c}`, promoFirst: "−50% sul primo acquisto",
  },
  en: {
    eyebrow: "BETREDGE ACCESS", loginTitle: "Welcome back", createTitle: "Create your profile",
    loginSub: "Sign in to enter the desk.", createSub: "Free to start. No card required.",
    login: "Login", create: "Register", name: "Username", namePh: "yourname", userHint: "3–20 chars · letters, numbers, underscore", pwPhNew: "Min. 8 characters",
    show: "Show", hide: "Hide", forgot: "Forgot your password?", backLogin: "Back to login",
    recoverTitle: "Recover your password", recoverSub: "We'll email you a link to set a new password.",
    sendReset: "Send reset link", close: "Close", secure: "Secure",
    age: "I confirm I am at least 18 years old.",
    marketing: "I want to receive BetRedge offers and news by email (optional).",
    tosPre: "I accept the ", tosTerms: "Terms", tosMid: " and ", tosPriv: "Privacy", tosPost: ".",
    errWrong: "Wrong password.", errNoAcct: "No account with this email.", errExists: "Email already registered.",
    errPwShort: "Password must be at least 8 characters.", errGeneric: "Something went wrong. Please retry.",
    footer: "Encrypted connection. We never share your data.",
    pendingMail: (e) => `We sent an activation email to ${e}. Click the link (check spam too), then log in here.`,
    resetSent: (e) => `If an account exists for ${e}, we sent a reset link (check spam too). It expires in 1 hour.`,
    activationReq: "This profile isn't activated yet. Confirm your email via the link we sent you.",
    resend: "Didn't get it? Resend the activation email", sendMail: "…",
    refLabel: "Invite code (optional)", refPh: "e.g. JOHN10", addInvite: "Have an invite code", invitedBy: (c) => `Invited by ${c}`, promoFirst: "−50% on your first purchase",
  },
  es: {
    eyebrow: "ACCESO BETREDGE", loginTitle: "Bienvenido de nuevo", createTitle: "Crea tu perfil",
    loginSub: "Entra para acceder al desk.", createSub: "Gratis para empezar. Sin tarjeta.",
    login: "Login", create: "Regístrate", name: "Usuario", namePh: "tunombre", userHint: "3–20 caracteres · letras, números, guion bajo", pwPhNew: "Mín. 8 caracteres",
    show: "Mostrar", hide: "Ocultar", forgot: "¿Olvidaste la contraseña?", backLogin: "Volver al acceso",
    recoverTitle: "Recupera tu contraseña", recoverSub: "Te enviamos un enlace para una nueva contraseña.",
    sendReset: "Enviar enlace", close: "Cerrar", secure: "Seguro",
    age: "Confirmo que tengo al menos 18 años.",
    marketing: "Quiero recibir ofertas y novedades de BetRedge por email (opcional).",
    tosPre: "Acepto los ", tosTerms: "Términos", tosMid: " y la ", tosPriv: "Privacidad", tosPost: ".",
    errWrong: "Contraseña incorrecta.", errNoAcct: "No hay cuenta con este email.", errExists: "Email ya registrado.",
    errPwShort: "La contraseña debe tener al menos 8 caracteres.", errGeneric: "Algo salió mal. Inténtalo de nuevo.",
    footer: "Conexión cifrada. Nunca compartimos tus datos.",
    pendingMail: (e) => `Enviamos un email de activación a ${e}. Haz clic en el enlace (revisa el spam) y entra aquí.`,
    resetSent: (e) => `Si existe una cuenta para ${e}, enviamos un enlace de reseteo (revisa el spam). Caduca en 1 hora.`,
    activationReq: "Este perfil no está activado. Confirma tu email con el enlace que enviamos.",
    resend: "¿No lo recibiste? Reenviar el email de activación", sendMail: "…",
    refLabel: "Código de invitación (opcional)", refPh: "ej. MARIO10", addInvite: "Tengo un código de invitación", invitedBy: (c) => `Invitado por ${c}`, promoFirst: "−50% en tu primera compra",
  },
  fr: {
    eyebrow: "ACCÈS BETREDGE", loginTitle: "Bon retour", createTitle: "Crée ton profil",
    loginSub: "Connecte-toi pour accéder au desk.", createSub: "Gratuit pour commencer. Sans carte.",
    login: "Login", create: "S'inscrire", name: "Pseudo", namePh: "tonpseudo", userHint: "3–20 caractères · lettres, chiffres, underscore", pwPhNew: "Min. 8 caractères",
    show: "Afficher", hide: "Masquer", forgot: "Mot de passe oublié ?", backLogin: "Retour à la connexion",
    recoverTitle: "Récupère ton mot de passe", recoverSub: "Nous t'envoyons un lien pour un nouveau mot de passe.",
    sendReset: "Envoyer le lien", close: "Fermer", secure: "Sécurisé",
    age: "Je confirme avoir au moins 18 ans.",
    marketing: "Je veux recevoir les offres et actus BetRedge par email (facultatif).",
    tosPre: "J'accepte les ", tosTerms: "Conditions", tosMid: " et la ", tosPriv: "Confidentialité", tosPost: ".",
    errWrong: "Mot de passe incorrect.", errNoAcct: "Aucun compte avec cet email.", errExists: "Email déjà enregistré.",
    errPwShort: "Le mot de passe doit faire au moins 8 caractères.", errGeneric: "Une erreur est survenue. Réessaie.",
    footer: "Connexion chiffrée. Nous ne partageons jamais tes données.",
    pendingMail: (e) => `Nous avons envoyé un email d'activation à ${e}. Clique le lien (vérifie les spams), puis connecte-toi ici.`,
    resetSent: (e) => `Si un compte existe pour ${e}, nous avons envoyé un lien de réinitialisation (vérifie les spams). Il expire dans 1 heure.`,
    activationReq: "Ce profil n'est pas encore activé. Confirme ton email via le lien envoyé.",
    resend: "Pas reçu ? Renvoyer l'email d'activation", sendMail: "…",
    refLabel: "Code d'invitation (facultatif)", refPh: "ex. MARIO10", addInvite: "J'ai un code d'invitation", invitedBy: (c) => `Invité par ${c}`, promoFirst: "−50% sur le premier achat",
  },
  ru: {
    eyebrow: "ВХОД BETREDGE", loginTitle: "С возвращением", createTitle: "Создай профиль",
    loginSub: "Войди, чтобы открыть desk.", createSub: "Бесплатно для старта. Без карты.",
    login: "Login", create: "Регистрация", name: "Никнейм", namePh: "nickname", userHint: "3–20 символов · буквы, цифры, подчёркивание", pwPhNew: "Мин. 8 символов",
    show: "Показать", hide: "Скрыть", forgot: "Забыли пароль?", backLogin: "Назад ко входу",
    recoverTitle: "Восстановить пароль", recoverSub: "Пришлём ссылку для нового пароля.",
    sendReset: "Отправить ссылку", close: "Закрыть", secure: "Защищено",
    age: "Подтверждаю, что мне есть 18 лет.",
    marketing: "Хочу получать предложения и новости BetRedge по email (необязательно).",
    tosPre: "Принимаю ", tosTerms: "Условия", tosMid: " и ", tosPriv: "Политику", tosPost: ".",
    errWrong: "Неверный пароль.", errNoAcct: "Аккаунт с этим email не найден.", errExists: "Email уже зарегистрирован.",
    errPwShort: "Пароль должен быть не короче 8 символов.", errGeneric: "Что-то пошло не так. Повторите.",
    footer: "Шифрованное соединение. Мы никогда не передаём ваши данные.",
    pendingMail: (e) => `Мы отправили письмо активации на ${e}. Нажмите ссылку (проверьте спам), затем войдите здесь.`,
    resetSent: (e) => `Если аккаунт для ${e} существует, мы отправили ссылку сброса (проверьте спам). Действует 1 час.`,
    activationReq: "Профиль ещё не активирован. Подтвердите email по ссылке, которую мы отправили.",
    resend: "Не пришло? Отправить письмо активации повторно", sendMail: "…",
    refLabel: "Код приглашения (необязательно)", refPh: "напр. JOHN10", addInvite: "Есть код приглашения", invitedBy: (c) => `Приглашён(а): ${c}`, promoFirst: "−50% на первую покупку",
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
  const [marketingOk, setMarketingOk] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  // #REFERRAL-SIGNUP-UX: codice invito — prefill dal link (readRefCode, con
  // scadenza), editabile a mano (fallback se l'attribuzione s'è persa: cross-device,
  // incognito, link diretto). effectiveRef = codice valido corrente (o null).
  const [refInput, setRefInput] = useState("");
  // Invite code SECONDARIO: collassato di default, si espande a mano. Se un codice
  // arriva dal link (readRefCode) lo mostriamo già aperto — non nascondiamo mai
  // un'attribuzione attiva.
  const [refOpen, setRefOpen] = useState(false);
  useEffect(() => {
    const c = readRefCode();
    if (c) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync del ref da localStorage (one-shot)
      setRefInput(c);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefOpen(true);
    }
  }, []);
  const effectiveRef = normalizeRefCode(refInput);
  // La riga "−50% primo acquisto" appare solo se la promo di lancio è attiva
  // (stesso flag del banner) → mai una claim di sconto quando la promo è spenta.
  const promoOn = process.env.NEXT_PUBLIC_LAUNCH_PROMO_ENABLED === "true";

  // Chiusura facile (Escape) + blocco scroll di sfondo mentre il modal è aperto
  // → l'uscita è facile quanto l'ingresso, niente jank di scroll del body.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [onClose]);

  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome"; } catch { return "Europe/Rome"; } })();
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = normalizedEmail.includes("@");
  const pwValid = password.length >= 8;
  // Username (decisione Andrea): 3–20 caratteri, alfanumerico + underscore, no spazi.
  // Inviato tal quale nel campo `name` della POST /api/auth (nessun cambio backend:
  // il server fa solo trim + slice(200) su `name`, nessuna validazione di formato).
  const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
  const usernameValid = USERNAME_RE.test(name.trim());
  const canSubmit = mode === "login"
    ? emailValid && pwValid
    : usernameValid && emailValid && pwValid && ageOk && tosOk;

  // Riusa LO STESSO contratto /api/auth del desk. Nessuna modifica al server.
  const submit = async () => {
    if (!canSubmit || busy) return;
    // First-touch persist del codice inserito/prefillato (no-op se già presente).
    if (mode === "create" && effectiveRef) writeRefCode(effectiveRef);
    setBusy(true); setError(""); setInfo(""); setShowResend(false);
    try {
      const resp = await fetch("/api/auth", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({
          action: mode === "login" ? "login" : "register",
          identifier: normalizedEmail, password,
          name: mode === "create" ? name.trim() : undefined,
          marketing_opt_in: mode === "create" ? marketingOk : undefined,
          language: lang, timezone: tz,
          ref: mode === "create" ? (effectiveRef ?? undefined) : undefined,
          // #C1-CONSENT-FIX: server-side assertConsent (SP3) richiede questi flag
          // sul register — senza, ogni signup falliva con 400 consent_required.
          age_confirmed: mode === "create" ? ageOk : undefined,
          tos_accepted: mode === "create" ? tosOk : undefined,
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

  // Barra di stato "terminal" — richiama .v-scan-head della home. Il × chiude.
  const statusBar = (
    <div className="av-status">
      <span className="dot" aria-hidden />
      <span>{t.eyebrow}</span>
      <span className="av-secure">{t.secure}</span>
      <button type="button" className="av-close" onClick={onClose} aria-label={t.close}>×</button>
    </div>
  );

  if (forgot) {
    return (
      <div className="av-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <form className="av-modal" onSubmit={(e) => { e.preventDefault(); submitForgot(); }}>
          {statusBar}
          <div className="av-body">
            <div className="av-head">
              <h3>{t.recoverTitle}</h3>
              <p>{t.recoverSub}</p>
            </div>
            {forgotSent ? (
              <p className="av-info">{t.resetSent(normalizedEmail)}</p>
            ) : (
              <>
                <label className="av-field">
                  <span className="av-label">Email</span>
                  <input className="av-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="email" />
                </label>
                {error && <p className="av-error">{error}</p>}
                <button className="av-cta" disabled={!emailValid || busy}>{busy ? <span className="av-spin" aria-hidden /> : t.sendReset}</button>
              </>
            )}
            <button type="button" className="av-link" style={{ alignSelf: "center" }}
              onClick={() => { setForgot(false); setForgotSent(false); setError(""); }}>
              {t.backLogin}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="av-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="av-modal" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {statusBar}
        <div className="av-body">
          <div className="av-head">
            <h3>{mode === "login" ? t.loginTitle : t.createTitle}</h3>
            <p>{mode === "login" ? t.loginSub : t.createSub}</p>
          </div>
          <div className="av-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "login"} className={`av-tab ${mode === "login" ? "is-active" : ""}`} onClick={() => { setMode("login"); setError(""); }}>{t.login}</button>
            <button type="button" role="tab" aria-selected={mode === "create"} className={`av-tab ${mode === "create" ? "is-active" : ""}`} onClick={() => { setMode("create"); setError(""); }}>{t.create}</button>
          </div>
          {mode === "create" && (
            <div className="av-field">
              <label className="av-field">
                <span className="av-label">{t.name}</span>
                {/* USERNAME (non nome reale): no spazi in input, max 20; inviato nel campo `name`. */}
                <input className={`av-input ${name.length > 0 && !usernameValid ? "is-invalid" : ""}`}
                  value={name} onChange={(e) => setName(e.target.value.replace(/\s/g, ""))}
                  placeholder={t.namePh} autoComplete="username" maxLength={20} autoCapitalize="none" spellCheck={false} />
              </label>
              <span className={`av-hint ${name.length > 0 ? (usernameValid ? "is-ok" : "is-bad") : ""}`}>{t.userHint}</span>
            </div>
          )}
          <label className="av-field">
            <span className="av-label">Email</span>
            <input className="av-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" inputMode="email" autoComplete="email" />
          </label>
          <label className="av-field">
            <span className="av-label">Password</span>
            <div className="av-pw">
              <input className="av-input" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "create" ? t.pwPhNew : "••••••••"}
                autoComplete={mode === "login" ? "current-password" : "new-password"} />
              <button type="button" className="av-reveal" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw} aria-label={showPw ? t.hide : t.show}>
                {showPw ? t.hide : t.show}
              </button>
            </div>
          </label>
          {mode === "create" && (
            !refOpen ? (
              <button type="button" className="av-invite-toggle" onClick={() => setRefOpen(true)}>+ {t.addInvite}</button>
            ) : (
              <div className="av-field">
                <label className="av-field">
                  <span className="av-label">{t.refLabel}</span>
                  <input className="av-input" value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder={t.refPh} maxLength={20} autoCapitalize="characters" spellCheck={false} />
                </label>
                {effectiveRef && (
                  <p className="av-invite-note">🎁 {t.invitedBy(effectiveRef)}{promoOn ? ` · ${t.promoFirst}` : ""}</p>
                )}
              </div>
            )
          )}
          {mode === "login" && (
            <button type="button" className="av-link" onClick={() => { setForgot(true); setError(""); setInfo(""); }}>{t.forgot}</button>
          )}
          {mode === "create" && (
            <div className="av-consents">
              <label className="av-check">
                <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
                <span>{t.age}</span>
              </label>
              <label className="av-check">
                <input type="checkbox" checked={tosOk} onChange={(e) => setTosOk(e.target.checked)} />
                {/* link in-site (route interne), niente target="_blank" */}
                <span>{t.tosPre}<Link className="av-inline" href="/terms">{t.tosTerms}</Link>{t.tosMid}<Link className="av-inline" href="/privacy">{t.tosPriv}</Link>{t.tosPost}</span>
              </label>
              {/* Consenso marketing FACOLTATIVO (non pre-flaggato, de-enfatizzato) —
                  sblocca i flussi CRM acquisition. Non incide su canSubmit. */}
              <label className="av-check av-check--opt">
                <input type="checkbox" checked={marketingOk} onChange={(e) => setMarketingOk(e.target.checked)} />
                <span>{t.marketing}</span>
              </label>
            </div>
          )}
          {error && <p className="av-error">{error}</p>}
          {info && <p className="av-info">{info}</p>}
          {showResend && (
            <button type="button" className="av-link" onClick={resendActivation} disabled={busy || !emailValid}>{t.resend}</button>
          )}
          <button className="av-cta" disabled={!canSubmit || busy}>{busy ? <span className="av-spin" aria-hidden /> : (mode === "login" ? t.login : t.create)}</button>
          <p className="av-foot"><span className="dot" aria-hidden />{t.footer}</p>
        </div>
      </form>
    </div>
  );
}
