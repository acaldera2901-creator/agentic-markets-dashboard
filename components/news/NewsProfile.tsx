"use client";

import Link from "next/link";
import Image from "next/image";
import { planLabel, type SupportedLang } from "@/lib/commercial-plan";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { HomeAuthModal } from "@/components/auth/HomeAuthModal";
import { useSiteLang } from "./use-news";
import "./news-profile.css";

type Profile = { displayName: string; username: string; bio: string; avatarUrl: string | null };
type Activity = { newsGuid: string; title: string; createdAt: string };
type ProfileData = {
  profile: Profile;
  account: { identifier: string; plan: string; createdAt: string | null; planExpiresAt: string | null };
  activity: { comments: (Activity & { id: string | number; body: string })[]; likes: Activity[]; commentCount: number; likeCount: number };
};
const english = {
  profile: "Profile", title: "Your profile", back: "News", account: "Your account", joined: "Member since", plan: "Plan", expires: "Plan expires", plans: "Explore plans", name: "Name", username: "Username", bio: "Bio", upload: "Upload image", remove: "Remove image", avatar: "Your avatar", save: "Save profile", saved: "Profile saved", busy: "Saving…", comments: "Your comments", likes: "Your likes", emptyComments: "No comments yet.", emptyLikes: "No likes yet.", latest: "Latest 100", on: "On:", loading: "Loading profile…", login: "Sign in", loginHint: "Sign in to manage your profile.", retry: "Retry", error: "Unable to save changes. Please try again.", loadError: "Unable to load your profile. Please try again.", taken: "This username is already taken.", format: "Use 3–20 letters, numbers or underscores, or leave blank.", imageError: "Choose a PNG, JPEG or WebP image up to 2 MB.", imageHint: "PNG, JPEG or WebP · Max 2 MB", unknown: "Not available", nameError: "Use a name of 1–40 characters without control characters.", bioError: "Use up to 160 characters for your bio, without null characters.",
};
type Copy = typeof english;
const copies: Record<string, Copy> = {
  en: english,
  it: { profile: "Profilo", title: "Il tuo profilo", back: "News", account: "Il tuo account", joined: "Iscritto dal", plan: "Piano", expires: "Scadenza piano", plans: "Scopri i piani", name: "Nome", username: "Username", bio: "Bio", upload: "Carica immagine", remove: "Rimuovi immagine", avatar: "Il tuo avatar", save: "Salva profilo", saved: "Profilo salvato", busy: "Salvataggio…", comments: "I tuoi commenti", likes: "I tuoi like", emptyComments: "Nessun commento ancora.", emptyLikes: "Nessun like ancora.", latest: "Ultimi 100", on: "Su:", loading: "Caricamento profilo…", login: "Accedi", loginHint: "Accedi per gestire il tuo profilo.", retry: "Riprova", error: "Impossibile salvare le modifiche. Riprova.", loadError: "Impossibile caricare il profilo. Riprova.", taken: "Questo username è già in uso.", format: "Usa 3–20 lettere, numeri o underscore, oppure lascia vuoto.", imageError: "Scegli un’immagine PNG, JPEG o WebP fino a 2 MB.", imageHint: "PNG, JPEG o WebP · Max 2 MB", unknown: "Non disponibile", nameError: "Usa un nome di 1–40 caratteri senza caratteri di controllo.", bioError: "Usa fino a 160 caratteri per la bio, senza caratteri nulli." },
  es: { profile: "Perfil", title: "Tu perfil", back: "Noticias", account: "Tu cuenta", joined: "Miembro desde", plan: "Plan", expires: "Vencimiento del plan", plans: "Ver planes", name: "Nombre", username: "Usuario", bio: "Bio", upload: "Subir imagen", remove: "Eliminar imagen", avatar: "Tu avatar", save: "Guardar perfil", saved: "Perfil guardado", busy: "Guardando…", comments: "Tus comentarios", likes: "Tus me gusta", emptyComments: "Aún no hay comentarios.", emptyLikes: "Aún no hay me gusta.", latest: "Últimos 100", on: "En:", loading: "Cargando perfil…", login: "Entrar", loginHint: "Entra para gestionar tu perfil.", retry: "Reintentar", error: "No se pudieron guardar los cambios. Reintenta.", loadError: "No se pudo cargar el perfil. Reintenta.", taken: "Este usuario ya está en uso.", format: "Usa 3–20 letras, números o guiones bajos, o déjalo vacío.", imageError: "Elige una imagen PNG, JPEG o WebP de hasta 2 MB.", imageHint: "PNG, JPEG o WebP · Máx. 2 MB", unknown: "No disponible", nameError: "Usa un nombre de 1–40 caracteres sin caracteres de control.", bioError: "Usa hasta 160 caracteres en la bio, sin caracteres nulos." },
  fr: { profile: "Profil", title: "Ton profil", back: "Actualités", account: "Ton compte", joined: "Membre depuis", plan: "Offre", expires: "Expiration de l’offre", plans: "Voir les offres", name: "Nom", username: "Pseudo", bio: "Bio", upload: "Importer une image", remove: "Supprimer l’image", avatar: "Ton avatar", save: "Enregistrer le profil", saved: "Profil enregistré", busy: "Enregistrement…", comments: "Tes commentaires", likes: "Tes mentions J’aime", emptyComments: "Aucun commentaire.", emptyLikes: "Aucune mention J’aime.", latest: "Les 100 derniers", on: "Sur :", loading: "Chargement du profil…", login: "Connexion", loginHint: "Connecte-toi pour gérer ton profil.", retry: "Réessayer", error: "Impossible d’enregistrer les modifications. Réessaie.", loadError: "Impossible de charger le profil. Réessaie.", taken: "Ce pseudo est déjà utilisé.", format: "3–20 lettres, chiffres ou underscores, ou laisser vide.", imageError: "Choisis une image PNG, JPEG ou WebP de 2 Mo maximum.", imageHint: "PNG, JPEG ou WebP · Max 2 Mo", unknown: "Indisponible", nameError: "Utilise un nom de 1–40 caractères sans caractères de contrôle.", bioError: "Utilise 160 caractères maximum pour la bio, sans caractères nuls." },
  ru: { profile: "Профиль", title: "Твой профиль", back: "Новости", account: "Твой аккаунт", joined: "Дата регистрации", plan: "Тариф", expires: "Окончание тарифа", plans: "Посмотреть тарифы", name: "Имя", username: "Никнейм", bio: "О себе", upload: "Загрузить фото", remove: "Удалить фото", avatar: "Твой аватар", save: "Сохранить профиль", saved: "Профиль сохранён", busy: "Сохранение…", comments: "Твои комментарии", likes: "Твои лайки", emptyComments: "Комментариев пока нет.", emptyLikes: "Лайков пока нет.", latest: "Последние 100", on: "К новости:", loading: "Загрузка профиля…", login: "Войти", loginHint: "Войди, чтобы управлять профилем.", retry: "Повторить", error: "Не удалось сохранить изменения. Повтори.", loadError: "Не удалось загрузить профиль. Повтори.", taken: "Этот никнейм уже занят.", format: "3–20 латинских букв, цифр или подчёркиваний, либо пустое поле.", imageError: "Выбери PNG, JPEG или WebP до 2 МБ.", imageHint: "PNG, JPEG или WebP · До 2 МБ", unknown: "Нет данных", nameError: "Имя: 1–40 символов без управляющих символов.", bioError: "Описание: до 160 символов без нулевых символов." },
};

export function NewsProfile() {
  const lang = useSiteLang();
  const t = copies[lang] ?? english;
  const [data, setData] = useState<ProfileData | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "guest" | "error">("loading");
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/news/profile", { credentials: "same-origin", cache: "no-store", signal });
      if (signal?.aborted) return;
      if (response.status === 401) { setState("guest"); return; }
      if (!response.ok) throw new Error("profile");
      const result = await response.json() as ProfileData;
      if (signal?.aborted) return;
      setData(result); setDraft(result.profile); setState("ready");
    } catch { if (!signal?.aborted) setState("error"); }
  }, []);
  // The fetch callback updates state only after the server response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const date = (value: string | null) => {
    if (!value || Number.isNaN(Date.parse(value))) return t.unknown;
    return new Date(value).toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  };
  const checkResponse = async (response: Response) => {
    if (response.status === 401) { setAuth(true); throw new Error(t.loginHint); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const validation: Record<string, string> = { invalid_username: t.format, invalid_display_name: t.nameError, invalid_bio: t.bioError, invalid_avatar: t.imageError, avatar_too_large: t.imageError };
      throw new Error(response.status === 409 ? t.taken : validation[result.error] ?? t.error);
    }
    return result;
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      await checkResponse(await fetch("/api/news/profile", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: draft.displayName.trim(), username: draft.username.trim(), bio: draft.bio }) }));
      setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.error); }
    finally { setBusy(false); }
  };
  const avatar = async (file?: File) => {
    if (busy) return;
    setError(""); setSaved(false);
    if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) { setError(t.imageError); return; }
    setBusy(true);
    try {
      const body = new FormData(); if (file) body.append("avatar", file);
      const result = await checkResponse(await fetch("/api/news/profile/avatar", { method: file ? "POST" : "DELETE", credentials: "same-origin", body: file ? body : undefined }));
      setDraft(previous => previous ? { ...previous, avatarUrl: result.avatarUrl } : previous);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.error); }
    finally { setBusy(false); }
  };
  return <div className="np-page">
    <header className="np-header"><span>{t.profile}</span><Link href="/blog#news">← {t.back}</Link></header>
    <main className="np-main">
      <h1>{t.title}</h1>
      {state === "loading" && <p role="status">{t.loading}</p>}
      {state === "error" && <div role="alert"><p>{t.loadError}</p><button className="np-secondary" onClick={() => { setState("loading"); void load(); }}>{t.retry}</button></div>}
      {state === "guest" && <div><p>{t.loginHint}</p><button className="np-save" onClick={() => setAuth(true)}>{t.login}</button></div>}
      {state === "ready" && data && draft && <>
        <div className="np-avatar-row">
          <div className="np-avatar">{draft.avatarUrl ? <Image src={draft.avatarUrl} alt={t.avatar} width={84} height={84} unoptimized /> : <span aria-label={t.avatar}>{draft.displayName.slice(0, 2).toUpperCase() || "?"}</span>}</div>
          <div><label className={`np-secondary np-upload${busy ? " np-disabled" : ""}`}>{t.upload}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void avatar(file); }} /></label><small className="np-image-hint">{t.imageHint}</small>{draft.avatarUrl && <button className="np-remove" disabled={busy} onClick={() => void avatar()}>{t.remove}</button>}</div>
        </div>
        <section className="np-account" aria-labelledby="np-account-title"><h2 id="np-account-title">{t.account}</h2><dl>
          <div><dt>Email</dt><dd>{data.account.identifier}</dd></div>
          <div><dt>{t.joined}</dt><dd>{date(data.account.createdAt)}</dd></div>
          <div><dt>{t.plan}</dt><dd><span className="np-plan">{data.account.plan === "base" || data.account.plan === "premium" ? planLabel(data.account.plan, (copies[lang] ? lang : "en") as SupportedLang) : data.account.plan || t.unknown}</span></dd></div>
          {data.account.planExpiresAt && <div><dt>{t.expires}</dt><dd>{date(data.account.planExpiresAt)}</dd></div>}
        </dl><Link className="np-plans" href="/plans">{t.plans}</Link></section>
        <form className="np-form" onSubmit={save}>
          <label>{t.name}<input required maxLength={40} autoComplete="name" value={draft.displayName} disabled={busy} onChange={e => { setSaved(false); setDraft({ ...draft, displayName: e.target.value }); }} /></label>
          <label>{t.username}<input maxLength={20} pattern="[A-Za-z0-9_]{3,20}" title={t.format} aria-describedby="np-username-hint" autoCapitalize="none" spellCheck={false} value={draft.username} disabled={busy} onChange={e => { setSaved(false); setDraft({ ...draft, username: e.target.value }); }} /></label>
          <small id="np-username-hint">{t.format}</small>
          <label>{t.bio}<textarea maxLength={160} value={draft.bio} disabled={busy} onChange={e => { setSaved(false); setDraft({ ...draft, bio: e.target.value }); }} /></label>
          <button className="np-save" disabled={busy}>{busy ? t.busy : t.save}</button>
          {saved && <p className="np-success" role="status">{t.saved}</p>}
        </form>
        <section className="np-activity"><h2>{t.comments} ({data.activity.commentCount})</h2>{data.activity.commentCount > 100 && <small>{t.latest}</small>}{data.activity.comments.length ? <ul>{data.activity.comments.slice(0, 100).map(comment => <li key={comment.id}><p>{comment.body}</p><Link href={`/blog#post-${encodeURIComponent(comment.newsGuid)}`}><small>{t.on} {comment.title}</small></Link></li>)}</ul> : <p>{t.emptyComments}</p>}</section>
        <section className="np-activity"><h2>{t.likes} ({data.activity.likeCount})</h2>{data.activity.likeCount > 100 && <small>{t.latest}</small>}{data.activity.likes.length ? <ul>{data.activity.likes.slice(0, 100).map(like => <li key={like.newsGuid}><Link href={`/blog#post-${encodeURIComponent(like.newsGuid)}`}>{like.title}</Link></li>)}</ul> : <p>{t.emptyLikes}</p>}</section>
      </>}
      {error && <p className="np-error" role="alert">{error}</p>}
    </main>
    {auth && <div className="hv3"><HomeAuthModal intent="login" lang={lang} newsHero onClose={() => setAuth(false)} onAuthenticated={() => { setAuth(false); setError(""); void load(); }} /></div>}
  </div>;
}
