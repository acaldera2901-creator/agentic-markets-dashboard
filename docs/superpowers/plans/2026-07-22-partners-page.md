# Partner: pagina `/partners` + vetrina footer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare visibilità ai partner affiliati (FortunePlay ⭐, YBets, BetScore, slotsbonus) con una riga loghi nel footer e una pagina pubblica `/partners` attraente, il tutto geo-gated fail-closed.

**Architecture:** Un catalogo unico (`lib/partners.ts`, data + copy i18n) è la fonte di verità, riusa gli URL affiliati già esistenti. La pagina `/partners` è un client component che gata i contenuti gambling via `/api/geo-books` (autorevole server-side, fail-closed) — mai contenuto gambling nell'HTML iniziale — e legge la lingua da `localStorage` come `community/page.tsx`. Il footer riusa lo stesso gate geo già presente al suo interno.

**Tech Stack:** Next.js (App Router, versione custom — vedi `AGENTS.md`), React client components, Tailwind + token CSS `--am-*`, vitest (jsdom).

## Global Constraints

- **Compliance (non negoziabile):** tutti i partner sono gambling. La sezione partner (footer + pagina) è geo-gated **fail-closed**. Fonte unica di verità della blocklist: `GEO_BLOCKED_COUNTRIES` in `lib/sportsbooks/index.ts` = `{IT, DE, FR, NL, ES, BE}`, esposta al client da `/api/geo-books` (`{ blocked: boolean }`). Default se geo ignota / fetch fallito → **non mostrare** i partner.
- **Copy FTC-safe:** descrizioni neutre, **nessun claim** ("quote migliori", "battiamo il mercato", bonus garantiti).
- **Link in uscita:** sempre `target="_blank" rel="nofollow sponsored noopener"`.
- **Brand:** accent = `var(--am-coral)` (= `#23A559`, verde — il nome della variabile è legacy). Token `--am-*`, niente inline-style che blocchi il responsive.
- **i18n:** 5 lingue `it | en | es | fr | ru`, fallback `en`. Lingua da `localStorage["agentic-lang"]`.
- **Set partner:** solo `fortuneplay` (featured), `ybets`, `betscore` (sportsbook), `slotsbonus` (casino). **Stake/Roobet esclusi.**
- **Deploy gated:** branch+PR (già su `feat/partners-page`), no push su main; prod solo dopo PROPOSAL + APPROVE umano.

---

### Task 1: Catalogo partner + copy i18n (`lib/partners.ts`)

**Files:**
- Create: `lib/partners.ts`
- Test: `lib/partners.test.ts`

**Interfaces:**
- Consumes: `FORTUNEPLAY_BET_URL` da `@/lib/affiliate`; `LANDING_PARTNERS` da `@/lib/affiliate`; `BOOKS` da `@/lib/betconstruct-books`.
- Produces:
  - `type PartnerCategory = "sportsbook" | "casino"`
  - `type Partner = { id: string; name: string; category: PartnerCategory; logo: string; url: string; featured?: boolean }`
  - `const PARTNERS: Partner[]`
  - `type PartnersLang = "it" | "en" | "es" | "fr" | "ru"`
  - `function pickPartnersLang(lang: string): PartnersLang`
  - `const PARTNERS_COPY: Record<PartnersLang, {...}>` (chrome pagina)
  - `const PARTNER_TAGLINES: Record<string /*partner id*/, Record<PartnersLang, string>>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/partners.test.ts
import { describe, it, expect } from "vitest";
import { PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, pickPartnersLang } from "@/lib/partners";

const LANGS = ["it", "en", "es", "fr", "ru"] as const;

describe("partners catalog", () => {
  it("has exactly the approved partners, no Stake/Roobet", () => {
    const ids = PARTNERS.map((p) => p.id).sort();
    expect(ids).toEqual(["betscore", "fortuneplay", "slotsbonus", "ybets"]);
  });

  it("marks FortunePlay as the only featured partner", () => {
    expect(PARTNERS.filter((p) => p.featured).map((p) => p.id)).toEqual(["fortuneplay"]);
  });

  it("every partner has a non-empty https url, an svg logo and a valid category", () => {
    for (const p of PARTNERS) {
      expect(p.url).toMatch(/^https:\/\//);
      expect(p.logo).toMatch(/^\/logos\/.+\.svg$/);
      expect(["sportsbook", "casino"]).toContain(p.category);
    }
  });

  it("has page chrome copy in all 5 languages", () => {
    for (const l of LANGS) {
      expect(PARTNERS_COPY[l].title.length).toBeGreaterThan(0);
      expect(PARTNERS_COPY[l].subtitle.length).toBeGreaterThan(0);
      expect(PARTNERS_COPY[l].unavailableTitle.length).toBeGreaterThan(0);
    }
  });

  it("has a tagline for every partner in every language", () => {
    for (const p of PARTNERS) {
      for (const l of LANGS) {
        expect(PARTNER_TAGLINES[p.id]?.[l]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("pickPartnersLang falls back to en for unknown languages", () => {
    expect(pickPartnersLang("de")).toBe("en");
    expect(pickPartnersLang("it")).toBe("it");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/partners.test.ts`
Expected: FAIL — `Cannot find module '@/lib/partners'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/partners.ts
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
    featured: "В центре внимания", sportsbook: "Сбор ставок", casino: "Казино",
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/partners.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add lib/partners.ts lib/partners.test.ts
git commit -m "feat(#PARTNERS-PAGE-1): catalogo partner + copy i18n (source of truth)"
```

---

### Task 2: Loghi placeholder YBets + slotsbonus (`public/logos/*.svg`)

**Files:**
- Create: `public/logos/ybets.svg`
- Create: `public/logos/slotsbonus.svg`

Nota: badge-monogramma originali coerenti con `stake.svg`/`roobet.svg` (placeholder finché non arrivano asset ufficiali). `betscore.svg` è già presente (fornito da Andrea). Rifinitura estetica affidabile a **ui-andrea** in un secondo momento; qui servono asset validi per far girare pagina/footer.

- [ ] **Step 1: Create `public/logos/ybets.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32" role="img" aria-label="YBets">
  <rect x="0" y="4" width="24" height="24" rx="6" fill="#23A559"/>
  <text x="12" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#06140C">Y</text>
  <text x="32" y="21" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="currentColor">Bets</text>
</svg>
```

- [ ] **Step 2: Create `public/logos/slotsbonus.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 32" role="img" aria-label="slotsbonus">
  <rect x="0" y="4" width="24" height="24" rx="6" fill="#23A559"/>
  <text x="12" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#06140C">S</text>
  <text x="32" y="21" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="currentColor">slotsbonus</text>
</svg>
```

- [ ] **Step 3: Verify SVGs are well-formed**

Run: `for f in public/logos/ybets.svg public/logos/slotsbonus.svg; do python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('$f'); print('$f OK')"; done`
Expected: due righe `... OK`.

- [ ] **Step 4: Commit**

```bash
git add public/logos/ybets.svg public/logos/slotsbonus.svg
git commit -m "feat(#PARTNERS-PAGE-1): loghi placeholder monogramma YBets + slotsbonus"
```

---

### Task 3: Componente vetrina (`components/PartnersShowcase.tsx`) + CSS

**Files:**
- Create: `components/PartnersShowcase.tsx`
- Modify: `app/globals.css` (append blocco `.partners-*`, dopo il blocco `.site-footer-*` ~riga 8053)
- Test: `components/PartnersShowcase.test.tsx`

**Interfaces:**
- Consumes: `PARTNERS`, `PARTNERS_COPY`, `PARTNER_TAGLINES`, `PartnersLang` da `@/lib/partners`.
- Produces: `export function PartnersShowcase({ lang }: { lang: PartnersLang }): JSX.Element`

- [ ] **Step 1: Write the failing test**

```tsx
// components/PartnersShowcase.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PartnersShowcase } from "@/components/PartnersShowcase";

describe("PartnersShowcase", () => {
  it("renders every partner name and an affiliate link with the safe rel", () => {
    render(<PartnersShowcase lang="en" />);
    expect(screen.getByText("FortunePlay")).toBeTruthy();
    expect(screen.getByText("YBets")).toBeTruthy();
    expect(screen.getByText("BetScore")).toBeTruthy();
    const links = screen.getAllByRole("link").filter((a) =>
      (a as HTMLAnchorElement).href.startsWith("https://"));
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const a of links) {
      const rel = (a as HTMLAnchorElement).getAttribute("rel") || "";
      expect(rel).toContain("nofollow");
      expect(rel).toContain("sponsored");
      expect(rel).toContain("noopener");
    }
  });

  it("shows the localized title in Italian", () => {
    render(<PartnersShowcase lang="it" />);
    expect(screen.getByText("I nostri partner")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/PartnersShowcase.test.tsx`
Expected: FAIL — `Cannot find module '@/components/PartnersShowcase'`. (`@testing-library/react` è già installato e usato da altri test componente, es. `components/ui/Button.test.tsx`.)

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/PartnersShowcase.tsx
// Presentazionale puro: riceve solo `lang` e consuma il catalogo da lib/partners.
// Nessuna logica geo qui — il gate fail-closed è nel page che lo monta.
import Link from "next/link";
import { PARTNERS, PARTNERS_COPY, PARTNER_TAGLINES, type PartnersLang, type Partner } from "@/lib/partners";

function PartnerCard({ p, lang, featured }: { p: Partner; lang: PartnersLang; featured?: boolean }) {
  const t = PARTNERS_COPY[lang];
  return (
    <a
      className={featured ? "partner-card partner-card-featured" : "partner-card"}
      href={p.url}
      target="_blank"
      rel="nofollow sponsored noopener"
    >
      <span className="partner-logo-wrap">
        {/* loghi statici in /public → <img> semplice, niente next/image */}
        <img src={p.logo} alt={p.name} className="partner-logo" loading="lazy" />
      </span>
      <span className="partner-name">{p.name}</span>
      <span className="partner-tagline">{PARTNER_TAGLINES[p.id][lang]}</span>
      <span className="partner-cta">{t.visit} →</span>
    </a>
  );
}

export function PartnersShowcase({ lang }: { lang: PartnersLang }) {
  const t = PARTNERS_COPY[lang];
  const featured = PARTNERS.filter((p) => p.featured);
  const sportsbooks = PARTNERS.filter((p) => p.category === "sportsbook" && !p.featured);
  const casinos = PARTNERS.filter((p) => p.category === "casino");
  return (
    <div className="partners-page">
      <header className="partners-hero">
        <Link href="/" className="partners-back">{t.back}</Link>
        <h1 className="partners-title">{t.title}</h1>
        <p className="partners-subtitle">{t.subtitle}</p>
      </header>

      {featured.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.featured}</h2>
          <div className="partners-grid partners-grid-featured">
            {featured.map((p) => <PartnerCard key={p.id} p={p} lang={lang} featured />)}
          </div>
        </section>
      )}

      {sportsbooks.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.sportsbook}</h2>
          <div className="partners-grid">
            {sportsbooks.map((p) => <PartnerCard key={p.id} p={p} lang={lang} />)}
          </div>
        </section>
      )}

      {casinos.length > 0 && (
        <section className="partners-section">
          <h2 className="partners-label">{t.casino}</h2>
          <div className="partners-grid">
            {casinos.map((p) => <PartnerCard key={p.id} p={p} lang={lang} />)}
          </div>
        </section>
      )}

      <p className="partners-disclosure">{t.disclosure}</p>
    </div>
  );
}
```

- [ ] **Step 4: Append CSS to `app/globals.css`**

```css
/* #PARTNERS-PAGE-1 — vetrina partner (pagina /partners). Token --am-* → segue il tema. */
.partners-page { max-width: 960px; margin: 0 auto; padding: 40px 20px 64px; }
.partners-hero { text-align: center; margin-bottom: 36px; }
.partners-back { display: inline-block; margin-bottom: 18px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--am-muted-2); text-decoration: none; }
.partners-back:hover { color: var(--am-coral); }
.partners-title { margin: 0 0 10px; font-size: 30px; font-weight: 800; color: var(--am-text); letter-spacing: -0.01em; }
.partners-subtitle { margin: 0 auto; max-width: 560px; font-size: 14px; line-height: 1.6; color: var(--am-muted); }
.partners-section { margin-top: 34px; }
.partners-label { margin: 0 0 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--am-muted-2); border-bottom: 1px solid var(--am-line); padding-bottom: 8px; }
.partners-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.partners-grid-featured { grid-template-columns: 1fr; }
.partner-card { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 22px; border: 1px solid var(--am-line); border-radius: 16px; background: var(--am-surface); color: var(--am-text); text-decoration: none; transition: border-color .15s, transform .15s, box-shadow .15s; }
.partner-card:hover { border-color: var(--am-coral-b); transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,.18); }
.partner-card-featured { align-items: center; text-align: center; padding: 36px 28px; background: linear-gradient(180deg, var(--am-coral-dim), var(--am-surface)); border-color: var(--am-coral-b); }
.partner-logo-wrap { display: flex; align-items: center; justify-content: flex-start; height: 40px; }
.partner-card-featured .partner-logo-wrap { height: 56px; justify-content: center; }
.partner-logo { max-height: 100%; width: auto; max-width: 180px; display: block; }
.partner-name { font-size: 15px; font-weight: 700; color: var(--am-text); }
.partner-tagline { font-size: 13px; line-height: 1.5; color: var(--am-muted); }
.partner-cta { margin-top: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--am-coral); }
.partners-disclosure { margin-top: 40px; text-align: center; font-size: 11px; color: var(--am-muted-2); }
@media (max-width: 480px) { .partners-title { font-size: 24px; } .partners-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/PartnersShowcase.test.tsx`
Expected: PASS (2 test).

- [ ] **Step 6: Commit**

```bash
git add components/PartnersShowcase.tsx components/PartnersShowcase.test.tsx app/globals.css
git commit -m "feat(#PARTNERS-PAGE-1): componente vetrina partner + CSS"
```

---

### Task 4: Pagina `/partners` (client, geo-gated) + metadata

**Files:**
- Create: `app/partners/page.tsx`
- Create: `app/partners/layout.tsx`

**Interfaces:**
- Consumes: `PartnersShowcase` da `@/components/PartnersShowcase`; `SiteFooter` da `@/components/SiteFooter`; `PARTNERS_COPY`, `pickPartnersLang`, `PartnersLang` da `@/lib/partners`; endpoint `GET /api/geo-books` → `{ blocked: boolean }`.

- [ ] **Step 1: Create `app/partners/layout.tsx`** (metadata neutra — un client component non può esportare `metadata`)

```tsx
// app/partners/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Partner — BetRedge",
  description: "I partner di BetRedge.",
};

export default function PartnersLayout({ children }: { children: ReactNode }) {
  return children;
}
```

- [ ] **Step 2: Create `app/partners/page.tsx`**

```tsx
"use client";
// /partners — vetrina pubblica dei partner. Tutti i partner sono gambling →
// contenuto gattato FAIL-CLOSED sulla geo via /api/geo-books (autorevole
// server-side). Il contenuto gambling NON è mai nell'HTML iniziale: viene
// montato solo dopo che il server conferma blocked===false. Lingua da
// localStorage["agentic-lang"] come le altre pagine standalone (community).
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PartnersShowcase } from "@/components/PartnersShowcase";
import { PARTNERS_COPY, pickPartnersLang, type PartnersLang } from "@/lib/partners";

type GeoState = "loading" | "allowed" | "blocked";

export default function PartnersPage() {
  const [lang, setLang] = useState<PartnersLang>("en");
  const [geo, setGeo] = useState<GeoState>("loading");

  useEffect(() => {
    try {
      const sl = localStorage.getItem("agentic-lang");
      if (sl) setLang(pickPartnersLang(sl));
    } catch { /* default en */ }
  }, []);

  useEffect(() => {
    fetch("/api/geo-books", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setGeo(d?.blocked === false ? "allowed" : "blocked")) // fail-closed
      .catch(() => setGeo("blocked"));
  }, []);

  const t = PARTNERS_COPY[lang];

  return (
    <div className="min-h-screen font-mono" style={{ background: "var(--am-bg)", color: "var(--am-muted)" }}>
      {geo === "allowed" ? (
        <PartnersShowcase lang={lang} />
      ) : geo === "blocked" ? (
        <div className="partners-page" style={{ textAlign: "center" }}>
          <h1 className="partners-title">{t.unavailableTitle}</h1>
          <p className="partners-subtitle">{t.unavailableBody}</p>
          <p style={{ marginTop: 20 }}>
            <Link href="/" className="partners-back">{t.unavailableBack}</Link>
          </p>
        </div>
      ) : (
        // loading: nessun contenuto partner (fail-closed anche durante il fetch)
        <div className="partners-page" aria-busy="true" />
      )}
      <SiteFooter lang={lang} />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript + build**

Run: `npx tsc --noEmit && npx next build`
Expected: nessun errore; `/partners` compare tra le route buildate.

- [ ] **Step 4: Commit**

```bash
git add app/partners/page.tsx app/partners/layout.tsx
git commit -m "feat(#PARTNERS-PAGE-1): pagina /partners client geo-gated fail-closed"
```

---

### Task 5: Riga loghi partner nel footer (`components/SiteFooter.tsx`) + CSS

**Files:**
- Modify: `components/SiteFooter.tsx` (import `PARTNERS`; nuova riga loghi gattata da `partnerAllowed`; link testo "Partner" → `/partners`; rimozione link diretto slotsbonus)
- Modify: `app/globals.css` (classe `.site-footer-partners`, dopo ~riga 8053)

**Interfaces:**
- Consumes: `PARTNERS` da `@/lib/partners`. Riusa lo state `partnerAllowed` (già presente, da `/api/geo-books`).

- [ ] **Step 1: Sostituire il link partner diretto con il link interno alla pagina**

In `components/SiteFooter.tsx`, sostituire l'intero blocco condizionale del link slotsbonus (attualmente):

```tsx
        {partnerAllowed && (
          <a
            href="https://slotsbonus.bet/?utm_source=betredge&utm_medium=partner&utm_campaign=cross-referral"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="site-footer-partner-link"
          >
            {t.partner}
          </a>
        )}
```

con:

```tsx
        {/* #PARTNERS-PAGE-1: il link "Partner" ora punta alla vetrina interna
            /partners (route client, gambling gattato fail-closed nella pagina).
            I loghi dei singoli partner sono nella riga dedicata più sotto. */}
        <Link href="/partners" className="site-footer-partner-link">{t.partner}</Link>
```

- [ ] **Step 2: Aggiungere la riga loghi partner** — subito prima del blocco `site-footer-social` (`<div className="site-footer-social" ...>`), inserire:

```tsx
      {/* #PARTNERS-PAGE-1: riga loghi partner, gattata fail-closed sulla geo
          (stesso partnerAllowed dei link-book). In IT/geo bloccate non compare. */}
      {partnerAllowed && (
        <div className="site-footer-partners" aria-label={t.partner}>
          {PARTNERS.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="site-footer-partner-logo"
              aria-label={p.name}
            >
              <img src={p.logo} alt={p.name} loading="lazy" />
            </a>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Aggiungere l'import** in cima a `components/SiteFooter.tsx`, dopo gli import esistenti:

```tsx
import { PARTNERS } from "@/lib/partners";
```

- [ ] **Step 4: Append CSS a `app/globals.css`**

```css
/* #PARTNERS-PAGE-1 — riga loghi partner nel footer (geo-gated). */
.site-footer-partners { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; margin: 4px 0 2px; }
.site-footer-partner-logo img { height: 18px; width: auto; max-width: 120px; display: block; opacity: .6; transition: opacity .15s; }
.site-footer-partner-logo:hover img { opacity: 1; }
```

- [ ] **Step 5: Verify TypeScript + build**

Run: `npx tsc --noEmit && npx next build`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add components/SiteFooter.tsx app/globals.css
git commit -m "feat(#PARTNERS-PAGE-1): riga loghi partner nel footer + link a /partners"
```

---

### Task 6: Verifica finale (Costruito ≠ Verificato ≠ Operativo)

**Files:** nessuno (solo verifica).

- [ ] **Step 1: Suite test completa**

Run: `npx vitest run lib/partners.test.ts components/PartnersShowcase.test.tsx`
Expected: tutti verdi.

- [ ] **Step 2: Typecheck + build completi**

Run: `npx tsc --noEmit && npx next build`
Expected: nessun errore; route `/partners` presente.

- [ ] **Step 3: Visual check da loggato (preview) — delega a `ui-andrea`**

Deploy preview del branch, poi con `ui-andrea` (headless + cookie Chrome, mai solo anonimo — vedi `feedback_visual_check_loggato`):
- `/partners` da geo consentita (simulare header/geo): hero, FortunePlay in evidenza, griglia YBets/BetScore, sezione casino slotsbonus, striscia compliance, CTA con `rel` corretto; responsive mobile (≤480px).
- Footer: riga loghi partner visibile e allineata; link "Partner" → `/partners`.
- Loghi armonizzati (wordmark BetScore + logo FortunePlay + monogrammi YBets/slotsbonus) senza stonature; se serve, ui-andrea rifinisce `ybets.svg`/`slotsbonus.svg`.

- [ ] **Step 4: Verifica geo fail-closed**

Da geo bloccata (IT — es. header `x-vercel-ip-country: IT` o `/api/geo-books` che ritorna `{blocked:true}`):
- `/partners` mostra lo stato neutro "Non disponibile nella tua area" (nessun nome/logo/URL partner nel DOM).
- Footer: la riga loghi partner **non** compare.

- [ ] **Step 5: QA pre-deploy — delega a `qa-andrea`**

Regressione footer sulle pagine che lo montano (home, /terms, /privacy, world-cup): niente rotture di layout; back button OK sul link interno /partners.

- [ ] **Step 6: PROPOSAL deploy prod (gate)**

NON mergiare/deployare in autonomia. Postare PROPOSAL con change-spec (file toccati, route nuova, geo-policy invariata, rollback = revert branch) su `ch_deploy_gate` e attendere `APPROVE #PARTNERS-PAGE-1` umano (Andrea/Michele). Solo dopo: merge PR + deploy prod + report "cosa è cambiato davvero vs proposto".

---

## Self-Review

**1. Spec coverage:**
- Footer riga loghi partner → Task 5 ✓
- Pagina `/partners` attraente → Task 3 (UI) + Task 4 (route) ✓
- Geo-gate fail-closed server-authoritative → Task 4 (page) + Task 5 (footer) via `/api/geo-books` ✓
- Stato neutro in geo bloccata → Task 4 ✓
- Registry unico riusando URL esistenti → Task 1 ✓
- Set partner senza Stake/Roobet, BetScore incluso → Task 1 ✓
- Loghi mancanti YBets/slotsbonus + BetScore fornito → Task 2 (+ già copiato) ✓
- i18n 5 lingue → Task 1 (copy) + Task 3/4 (consumo) ✓
- Copy FTC-safe / rel sponsored / 18+ → Task 1 (copy) + Task 3 (link rel + disclosure) ✓
- No form "Diventa partner", no nav, no ripristino PartnersTab → non implementati (fuori scope) ✓
- Testing + visual + QA + gate → Task 6 ✓

**2. Placeholder scan:** nessun TBD/TODO; ogni step con codice/comando concreto.

**3. Type consistency:** `Partner`, `PartnerCategory`, `PartnersLang`, `PARTNERS`, `PARTNERS_COPY`, `PARTNER_TAGLINES`, `pickPartnersLang`, `PartnersShowcase({lang})` coerenti fra Task 1/3/4/5. `partnerAllowed` è il nome dello state già esistente in `SiteFooter.tsx`.

Dipendenze verificate: `@testing-library/react@16.3.2` installato; token `--am-coral` = `#23A559` (verde); footer CSS in `app/globals.css` (~7944-8053); `/api/geo-books` ritorna `{blocked}` da `GEO_BLOCKED_COUNTRIES`.
