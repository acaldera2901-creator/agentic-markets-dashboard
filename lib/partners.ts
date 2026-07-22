// Fonte unica di verità della vetrina partner (footer + pagina /partners).
// Solo routing affiliato in uscita — mai gestione fondi/scommesse. Gli URL
// sono importati dalle costanti già esistenti (niente duplicazione); slotsbonus
// è l'unica URL centralizzata qui (spostata dal footer). Tutti i partner sono
// gambling → il consumo è SEMPRE geo-gated fail-closed (vedi /api/geo-books).
import { FORTUNEPLAY_BET_URL, LANDING_PARTNERS } from "@/lib/affiliate";
import { BOOKS } from "@/lib/betconstruct-books";

export type PartnerCategory = "sportsbook" | "casino";
export type Partner = {
  id: string;
  name: string;
  category: PartnerCategory;
  logo: string; // path in /public/logos
  url: string;  // landing affiliato
  featured?: boolean;
};

const YBETS_URL = BOOKS.find((b) => b.key === "ybets")?.landing ?? "https://ybetspromo.io/dputempxc";
const BETSCORE_URL = LANDING_PARTNERS.find((p) => p.name === "BetScore")?.url
  ?? "https://bsr.lynmonkel.com/?mid=381903_2215092";
const SLOTSBONUS_URL =
  "https://slotsbonus.bet/?utm_source=betredge&utm_medium=partner&utm_campaign=cross-referral";

export const PARTNERS: Partner[] = [
  { id: "fortuneplay", name: "FortunePlay", category: "sportsbook", logo: "/logos/fortuneplay.svg", url: FORTUNEPLAY_BET_URL, featured: true },
  { id: "ybets", name: "YBets", category: "sportsbook", logo: "/logos/ybets.svg", url: YBETS_URL },
  { id: "betscore", name: "BetScore", category: "sportsbook", logo: "/logos/betscore.svg", url: BETSCORE_URL },
  { id: "slotsbonus", name: "slotsbonus", category: "casino", logo: "/logos/slotsbonus.svg", url: SLOTSBONUS_URL },
];

export type PartnersLang = "it" | "en" | "es" | "fr" | "ru";

export function pickPartnersLang(lang: string): PartnersLang {
  return lang === "it" || lang === "es" || lang === "fr" || lang === "ru" ? lang : "en";
}

export const PARTNERS_COPY: Record<PartnersLang, {
  back: string; title: string; subtitle: string;
  featured: string; sportsbook: string; casino: string;
  visit: string; disclosure: string;
  unavailableTitle: string; unavailableBody: string; unavailableBack: string;
}> = {
  it: {
    back: "← BetRedge",
    title: "I nostri partner",
    subtitle: "Gli operatori dove puoi agire sulle analisi di BetRedge. BetRedge non accetta scommesse: questi sono partner terzi indipendenti.",
    featured: "In evidenza", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visita", disclosure: "18+ · I link ai partner sono affiliati commerciali · Gioca responsabilmente",
    unavailableTitle: "Non disponibile nella tua area",
    unavailableBody: "Questa sezione non è disponibile dalla tua posizione.",
    unavailableBack: "← Torna alla home",
  },
  en: {
    back: "← BetRedge",
    title: "Our partners",
    subtitle: "Where you can act on BetRedge's analysis. BetRedge takes no bets — these are independent third-party partners.",
    featured: "Featured", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visit", disclosure: "18+ · Partner links are commercial affiliates · Gamble responsibly",
    unavailableTitle: "Not available in your region",
    unavailableBody: "This section is not available from your location.",
    unavailableBack: "← Back to home",
  },
  es: {
    back: "← BetRedge",
    title: "Nuestros partners",
    subtitle: "Los operadores donde puedes actuar sobre el análisis de BetRedge. BetRedge no acepta apuestas: son partners externos independientes.",
    featured: "Destacado", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visitar", disclosure: "18+ · Los enlaces de partners son afiliados comerciales · Juega con responsabilidad",
    unavailableTitle: "No disponible en tu región",
    unavailableBody: "Esta sección no está disponible desde tu ubicación.",
    unavailableBack: "← Volver al inicio",
  },
  fr: {
    back: "← BetRedge",
    title: "Nos partenaires",
    subtitle: "Les opérateurs où agir sur les analyses de BetRedge. BetRedge n'accepte pas de paris : ce sont des partenaires tiers indépendants.",
    featured: "En vedette", sportsbook: "Sportsbook", casino: "Casino",
    visit: "Visiter", disclosure: "18+ · Les liens partenaires sont des affiliés commerciaux · Jouez de manière responsable",
    unavailableTitle: "Non disponible dans votre région",
    unavailableBody: "Cette section n'est pas disponible depuis votre position.",
    unavailableBack: "← Retour à l'accueil",
  },
  ru: {
    back: "← BetRedge",
    title: "Наши партнёры",
    subtitle: "Операторы, где можно применить аналитику BetRedge. BetRedge не принимает ставки — это независимые сторонние партнёры.",
    featured: "В центре внимания", sportsbook: "Букмекеры", casino: "Казино",
    visit: "Перейти", disclosure: "18+ · Партнёрские ссылки — коммерческие аффилиаты · Играйте ответственно",
    unavailableTitle: "Недоступно в вашем регионе",
    unavailableBody: "Этот раздел недоступен из вашего местоположения.",
    unavailableBack: "← На главную",
  },
};

export const PARTNER_TAGLINES: Record<string, Record<PartnersLang, string>> = {
  fortuneplay: {
    it: "Sportsbook con quote live, collegato direttamente dalle schede BetRedge.",
    en: "Sportsbook with live odds, linked straight from BetRedge cards.",
    es: "Sportsbook con cuotas en vivo, enlazado desde las fichas de BetRedge.",
    fr: "Sportsbook avec cotes en direct, lié depuis les fiches BetRedge.",
    ru: "Букмекер с live-коэффициентами, связан прямо с карточками BetRedge.",
  },
  ybets: {
    it: "Sportsbook della rete BetConstruct, ampia copertura di campionati.",
    en: "BetConstruct-network sportsbook with broad league coverage.",
    es: "Sportsbook de la red BetConstruct, amplia cobertura de ligas.",
    fr: "Sportsbook du réseau BetConstruct, large couverture de ligues.",
    ru: "Букмекер сети BetConstruct с широким охватом лиг.",
  },
  betscore: {
    it: "Sportsbook partner con registrazione rapida.",
    en: "Partner sportsbook with a quick sign-up.",
    es: "Sportsbook partner con registro rápido.",
    fr: "Sportsbook partenaire avec inscription rapide.",
    ru: "Партнёрский букмекер с быстрой регистрацией.",
  },
  slotsbonus: {
    it: "Portale di bonus e offerte casino.",
    en: "A portal of casino bonuses and offers.",
    es: "Portal de bonos y ofertas de casino.",
    fr: "Portail de bonus et offres de casino.",
    ru: "Портал казино-бонусов и предложений.",
  },
};
