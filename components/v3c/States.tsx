"use client";
// components/v3c/States.tsx (#REDESIGN-V3C polish) — «la firma» negli stati che
// non sono dati: il loader col marchio, e le tre illustrazioni del kit
// (redesign/brand/states, GEN visti a occhio, nessun testo dentro) per 404,
// errore e vuoto. Un titolo da cartellone, una riga, UNA azione.
// Le illustrazioni sono WebP ridotti dal PNG del kit (public/brand/v3c/states).
import type { ReactNode } from "react";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { v3cLang } from "@/lib/v3c/copy";

type Kind = "404" | "500" | "empty";

const ART: Record<Kind, { src: string; w: number; h: number }> = {
  "404": { src: "/brand/v3c/states/illustration-404.webp", w: 880, h: 599 },
  "500": { src: "/brand/v3c/states/illustration-500.webp", w: 720, h: 720 },
  empty: { src: "/brand/v3c/states/illustration-empty.webp", w: 800, h: 415 },
};

/** Copia del kit (README §4): le 11 lingue (F10). */
export const STATE_COPY = {
  en: {
    loading: "Loading",
    "404": { code: "404", title: "Out of play", body: "This page went over the touchline.", action: "Back to the board" },
    "500": { code: "Error", title: "Lights flickered", body: "Something broke on our side. Try again in a minute.", action: "Try again" },
    empty: { code: "", title: "Bench is empty", body: "Nothing here yet.", action: "Back to the board" },
  },
  it: {
    loading: "Caricamento",
    "404": { code: "404", title: "Palla fuori", body: "Questa pagina è uscita oltre la linea laterale.", action: "Torna al board" },
    "500": { code: "Errore", title: "Luci a intermittenza", body: "Qualcosa si è rotto da noi. Riprova fra un minuto.", action: "Riprova" },
    empty: { code: "", title: "Panchina vuota", body: "Qui non c'è ancora niente.", action: "Torna al board" },
  },
    de: {
      loading: "Wird geladen",
      "404": { code: "404", title: "Im Aus", body: "Diese Seite ist über die Seitenlinie gegangen.", action: "Zurück zum Board" },
      "500": { code: "Fehler", title: "Flutlicht flackert", body: "Bei uns ist etwas kaputtgegangen. Versuch es in einer Minute noch einmal.", action: "Erneut versuchen" },
      empty: { code: "", title: "Die Bank ist leer", body: "Hier ist noch nichts.", action: "Zurück zum Board" },
    },
    es: {
      loading: "Cargando",
      "404": { code: "404", title: "Fuera de juego", body: "Esta página se fue por la banda.", action: "Volver al tablero" },
      "500": { code: "Error", title: "Se fue la luz", body: "Algo se ha roto por nuestra parte. Inténtalo de nuevo en un minuto.", action: "Reintentar" },
      empty: { code: "", title: "El banquillo está vacío", body: "Aquí aún no hay nada.", action: "Volver al tablero" },
    },
  fr: {
      loading: "Chargement",
      "404": { code: "404", title: "Hors jeu", body: "Cette page est sortie en touche.", action: "Retour au tableau" },
      "500": { code: "Erreur", title: "Les projecteurs ont vacillé", body: "Quelque chose a cassé de notre côté. Réessayez dans une minute.", action: "Réessayer" },
      empty: { code: "", title: "Le banc est vide", body: "Rien ici pour l’instant.", action: "Retour au tableau" },
    },
    nl: {
      loading: "Laden",
      "404": { code: "404", title: "Buiten spel", body: "Deze pagina is over de zijlijn gegaan.", action: "Terug naar het board" },
      "500": { code: "Fout", title: "De lichten flikkerden", body: "Er ging iets mis aan onze kant. Probeer het over een minuut opnieuw.", action: "Opnieuw proberen" },
      empty: { code: "", title: "De bank is leeg", body: "Hier staat nog niets.", action: "Terug naar het board" },
    },
    pl: {
      loading: "Wczytywanie",
      "404": { code: "404", title: "Poza grą", body: "Ta strona wyszła za linię boczną.", action: "Wróć do tablicy" },
      "500": { code: "Błąd", title: "Światła zamigotały", body: "Coś zepsuło się po naszej stronie. Spróbuj za minutę.", action: "Spróbuj ponownie" },
      empty: { code: "", title: "Ławka jest pusta", body: "Na razie nic tu nie ma.", action: "Wróć do tablicy" },
    },
  pt: {
      loading: "A carregar",
      "404": { code: "404", title: "Fora de jogo", body: "Esta página saiu pela linha lateral.", action: "Voltar ao board" },
      "500": { code: "Erro", title: "As luzes piscaram", body: "Algo avariou do nosso lado. Tenta de novo daqui a um minuto.", action: "Tentar de novo" },
      empty: { code: "", title: "O banco está vazio", body: "Ainda não há nada aqui.", action: "Voltar ao board" },
    },
  ru: {
      loading: "Загрузка",
      "404": { code: "404", title: "Мяч вне игры", body: "Эта страница ушла за боковую линию.", action: "Назад к панели" },
      "500": { code: "Ошибка", title: "Свет мигнул", body: "Что-то сломалось на нашей стороне. Попробуйте ещё раз через минуту.", action: "Повторить" },
      empty: { code: "", title: "Скамейка пуста", body: "Здесь пока ничего нет.", action: "Назад к панели" },
    },
    sv: {
      loading: "Laddar",
      "404": { code: "404", title: "Bollen är ute", body: "Den här sidan gick över sidlinjen.", action: "Tillbaka till boarden" },
      "500": { code: "Fel", title: "Strålkastarna flimrade", body: "Något gick sönder hos oss. Försök igen om en minut.", action: "Försök igen" },
      empty: { code: "", title: "Bänken är tom", body: "Inget här än.", action: "Tillbaka till boarden" },
    },
    tr: {
      loading: "Yükleniyor",
      "404": { code: "404", title: "Oyun dışı", body: "Bu sayfa taç çizgisini geçti.", action: "Panoya dön" },
      "500": { code: "Hata", title: "Işıklar titredi", body: "Bizim tarafımızda bir şey bozuldu. Bir dakika sonra tekrar dene.", action: "Tekrar dene" },
      empty: { code: "", title: "Yedek kulübesi boş", body: "Burada henüz bir şey yok.", action: "Panoya dön" },
    },
} as const;

export function useStateCopy() {
  const lang = useV3cLang();
  return STATE_COPY[v3cLang(lang)];
}

/** Il monogramma che si accende pezzo per pezzo (rispetta prefers-reduced-motion dentro l'SVG). */
export function BrandLoader({ label, size = 40 }: { label?: string; size?: number }) {
  const c = useStateCopy();
  return (
    <span className="v3c-loader" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/v3c/loader.svg" alt="" width={size} height={Math.round((size * 479) / 456)} />
      <span>{label ?? c.loading}</span>
    </span>
  );
}

type ArtProps = {
  kind: Kind;
  /** sovrascrive titolo e riga del kit (per es. «Match not found») */
  title?: string;
  body?: ReactNode;
  /** l'unica azione: un nodo (link o bottone) già pronto */
  action?: ReactNode;
  /** «page» = 404/500 a pagina intera; «inline» = dentro una sezione */
  size?: "page" | "inline";
  role?: "alert";
};

export function StateArt({ kind, title, body, action, size = "inline", role }: ArtProps) {
  const c = useStateCopy()[kind];
  const a = ART[kind];
  const H = size === "page" ? "h1" : "h2";
  return (
    <section className={`v3c-state v3c-state-${kind} v3c-state-${size}`} role={role}>
      <div className="v3c-state-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.src} alt="" width={a.w} height={a.h} loading={size === "page" ? "eager" : "lazy"} decoding="async" />
      </div>
      <div className="v3c-state-txt">
        {c.code ? <p className="v3c-lab">{c.code}</p> : null}
        <H className="v3c-t-page">{title ?? c.title}</H>
        {body == null || typeof body === "string" ? <p className="v3c-lede">{body ?? c.body}</p> : <div className="v3c-lede">{body}</div>}
        {action ? <div className="v3c-state-act">{action}</div> : null}
      </div>
    </section>
  );
}
