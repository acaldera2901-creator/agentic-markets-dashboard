// lib/v3c/doc-titles.ts (#REDESIGN-V3C fixui · QA M1) — il <title> delle rotte v3c nella
// lingua del visitatore. Le rotte v3c hanno UNA URL (la lingua sta nel browser,
// localStorage «agentic-lang»): il server scrive il title inglese (SEO, canonical e
// JSON-LD invariati) e dopo il mount components/v3c/guide/DocLang lo riscrive con
// questa tabella, insieme a <html lang>. Le pagine tool con prefisso (/it/tools/…)
// hanno già il title tradotto dal server: lì il title inglese non combacia e resta.
// Chiave = il title inglese ESATTO del server; i suffissi servono ai title con nomi
// (partita). Se il server cambia un title, il test in guide.test.ts lo segnala.
import { v3cLang, type V3cLang } from "./copy";

/** I title inglesi del server, per rotta (app/v3c/…/page.tsx). */
export const EN_TITLES = {
  home: "BetRedge: Price Check for Football and Tennis Odds",
  board: "Today’s Board: Football and Tennis Odds | BetRedge",
  priceCheck: "Price check: what does this price claim? | BetRedge",
  record: "Track record: every pick sealed before kick-off | BetRedge",
  pricing: "Free and Pro Preview: Plans | BetRedge",
  partners: "Partners and Integrations | BetRedge",
  blog: "Betting Guides and Insights | BetRedge",
  method: "How it works | BetRedge",
} as const;

export const EN_SUFFIXES = {
  matchFootball: ": market, estimate and best price | BetRedge",
  matchTennis: ": market price and best price | BetRedge",
} as const;

type TitleKey = keyof typeof EN_TITLES;
type SuffixKey = keyof typeof EN_SUFFIXES;
export type DocTitles = { titles: Record<TitleKey, string>; suffixes: Record<SuffixKey, string> };

const EN: DocTitles = { titles: { ...EN_TITLES }, suffixes: { ...EN_SUFFIXES } };

export const DOC_TITLES: Record<V3cLang, DocTitles> = {
  en: EN,
  it: {
    titles: {
      home: "BetRedge: controllo delle quote di calcio e tennis",
      board: "La board di oggi: quote di calcio e tennis | BetRedge",
      priceCheck: "Controllo prezzo: cosa dice questa quota? | BetRedge",
      record: "Registro: ogni stima sigillata prima del fischio d’inizio | BetRedge",
      pricing: "Free e anteprima Pro: i piani | BetRedge",
      partners: "Partner e integrazioni | BetRedge",
      blog: "Guide e approfondimenti sulle scommesse | BetRedge",
      method: "Come funziona | BetRedge",
    },
    suffixes: { matchFootball: ": mercato, stima e miglior prezzo | BetRedge", matchTennis: ": prezzo di mercato e miglior prezzo | BetRedge" },
  },
  de: {
    titles: {
      home: "BetRedge: Quoten-Check für Fußball und Tennis",
      board: "Das Board von heute: Fußball- und Tennisquoten | BetRedge",
      priceCheck: "Quoten-Check: Was sagt diese Quote? | BetRedge",
      record: "Register: jede Schätzung vor dem Anstoß versiegelt | BetRedge",
      pricing: "Free und Pro-Vorschau: die Pläne | BetRedge",
      partners: "Partner und Integrationen | BetRedge",
      blog: "Wett-Ratgeber und Analysen | BetRedge",
      method: "So funktioniert es | BetRedge",
    },
    suffixes: { matchFootball: ": Markt, Schätzung und beste Quote | BetRedge", matchTennis: ": Marktpreis und beste Quote | BetRedge" },
  },
  es: {
    titles: {
      home: "BetRedge: comprobar cuotas de fútbol y tenis",
      board: "El tablero de hoy: cuotas de fútbol y tenis | BetRedge",
      priceCheck: "Comprobar cuota: ¿qué dice esta cuota? | BetRedge",
      record: "Registro: cada estimación sellada antes del inicio | BetRedge",
      pricing: "Free y vista previa de Pro: planes | BetRedge",
      partners: "Socios e integraciones | BetRedge",
      blog: "Guías y análisis de apuestas | BetRedge",
      method: "Cómo funciona | BetRedge",
    },
    suffixes: { matchFootball: ": mercado, estimación y mejor cuota | BetRedge", matchTennis: ": precio de mercado y mejor cuota | BetRedge" },
  },
  fr: {
    titles: {
      home: "BetRedge : vérifier les cotes de football et de tennis",
      board: "Le tableau du jour : cotes de football et de tennis | BetRedge",
      priceCheck: "Vérifier la cote : que dit cette cote ? | BetRedge",
      record: "Registre : chaque estimation scellée avant le coup d’envoi | BetRedge",
      pricing: "Free et aperçu de Pro : les offres | BetRedge",
      partners: "Partenaires et intégrations | BetRedge",
      blog: "Guides et analyses de paris | BetRedge",
      method: "Comment ça marche | BetRedge",
    },
    suffixes: { matchFootball: " : marché, estimation et meilleure cote | BetRedge", matchTennis: " : prix du marché et meilleure cote | BetRedge" },
  },
  nl: {
    titles: {
      home: "BetRedge: odds-check voor voetbal en tennis",
      board: "Het board van vandaag: odds voor voetbal en tennis | BetRedge",
      priceCheck: "Odds-check: wat zegt deze odd? | BetRedge",
      record: "Register: elke schatting verzegeld voor de aftrap | BetRedge",
      pricing: "Free en Pro-preview: de abonnementen | BetRedge",
      partners: "Partners en integraties | BetRedge",
      blog: "Gidsen en inzichten over wedden | BetRedge",
      method: "Hoe het werkt | BetRedge",
    },
    suffixes: { matchFootball: ": markt, schatting en beste odds | BetRedge", matchTennis: ": marktprijs en beste odds | BetRedge" },
  },
  pl: {
    titles: {
      home: "BetRedge: sprawdź kursy na piłkę nożną i tenis",
      board: "Dzisiejsza tablica: kursy na piłkę nożną i tenis | BetRedge",
      priceCheck: "Sprawdź kurs: co mówi ten kurs? | BetRedge",
      record: "Rejestr: każdy szacunek zapieczętowany przed meczem | BetRedge",
      pricing: "Free i podgląd Pro: plany | BetRedge",
      partners: "Partnerzy i integracje | BetRedge",
      blog: "Poradniki i analizy zakładów | BetRedge",
      method: "Jak to działa | BetRedge",
    },
    suffixes: { matchFootball: ": rynek, szacunek i najlepszy kurs | BetRedge", matchTennis: ": cena rynkowa i najlepszy kurs | BetRedge" },
  },
  pt: {
    titles: {
      home: "BetRedge: verificar odds de futebol e ténis",
      board: "O board de hoje: odds de futebol e ténis | BetRedge",
      priceCheck: "Verificar odd: o que diz esta odd? | BetRedge",
      record: "Registo: cada estimativa selada antes do início | BetRedge",
      pricing: "Free e pré-visualização Pro: planos | BetRedge",
      partners: "Parceiros e integrações | BetRedge",
      blog: "Guias e análises de apostas | BetRedge",
      method: "Como funciona | BetRedge",
    },
    suffixes: { matchFootball: ": mercado, estimativa e melhor odd | BetRedge", matchTennis: ": preço de mercado e melhor odd | BetRedge" },
  },
  ru: {
    titles: {
      home: "BetRedge: проверка коэффициентов на футбол и теннис",
      board: "Панель на сегодня: коэффициенты на футбол и теннис | BetRedge",
      priceCheck: "Проверка коэффициента: что он говорит? | BetRedge",
      record: "Реестр: каждая оценка зафиксирована до начала матча | BetRedge",
      pricing: "Free и предпросмотр Pro: тарифы | BetRedge",
      partners: "Партнёры и интеграции | BetRedge",
      blog: "Гиды и разборы ставок | BetRedge",
      method: "Как это работает | BetRedge",
    },
    suffixes: { matchFootball: ": рынок, оценка и лучший коэффициент | BetRedge", matchTennis: ": рыночная цена и лучший коэффициент | BetRedge" },
  },
  sv: {
    titles: {
      home: "BetRedge: oddskoll för fotboll och tennis",
      board: "Dagens board: odds för fotboll och tennis | BetRedge",
      priceCheck: "Oddskoll: vad säger oddset? | BetRedge",
      record: "Register: varje uppskattning förseglad före avspark | BetRedge",
      pricing: "Free och förhandsvisning av Pro: planer | BetRedge",
      partners: "Partner och integrationer | BetRedge",
      blog: "Guider och insikter om spel | BetRedge",
      method: "Så fungerar det | BetRedge",
    },
    suffixes: { matchFootball: ": marknad, uppskattning och bästa odds | BetRedge", matchTennis: ": marknadspris och bästa odds | BetRedge" },
  },
  tr: {
    titles: {
      home: "BetRedge: futbol ve tenis oran kontrolü",
      board: "Bugünün panosu: futbol ve tenis oranları | BetRedge",
      priceCheck: "Oran kontrolü: bu oran ne diyor? | BetRedge",
      record: "Kayıt defteri: her tahmin başlamadan önce mühürlendi | BetRedge",
      pricing: "Free ve Pro önizlemesi: planlar | BetRedge",
      partners: "Ortaklar ve entegrasyonlar | BetRedge",
      blog: "Bahis rehberleri ve analizler | BetRedge",
      method: "Nasıl çalışır | BetRedge",
    },
    suffixes: { matchFootball: ": piyasa, tahmin ve en iyi oran | BetRedge", matchTennis: ": piyasa fiyatı ve en iyi oran | BetRedge" },
  },
};

/** Il title inglese del server → lo stesso nella lingua `lang`; un title sconosciuto resta com'è. */
export function localTitle(enTitle: string, lang: string | null | undefined): string {
  const l = v3cLang(lang);
  if (l === "en") return enTitle;
  const d = DOC_TITLES[l];
  const key = (Object.keys(EN_TITLES) as TitleKey[]).find((k) => EN_TITLES[k] === enTitle);
  if (key) return d.titles[key];
  for (const k of Object.keys(EN_SUFFIXES) as SuffixKey[]) {
    if (enTitle.endsWith(EN_SUFFIXES[k])) return enTitle.slice(0, -EN_SUFFIXES[k].length) + d.suffixes[k];
  }
  return enTitle;
}
