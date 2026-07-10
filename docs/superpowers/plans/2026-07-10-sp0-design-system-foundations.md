# SP0 — Fondamenta Design System · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introdurre l'infrastruttura di test e le primitive di UI/design-system riusabili (token, `Crest`, `SportIcon`, `Chip`, `ConfidenceMeter`, `Button`, helper `confidence`) che uccidono l'AI-slop alla fonte e su cui poggerà SP1.

**Architecture:** Nessun cambiamento visibile all'utente. Ogni primitiva è un componente/funzione isolata sotto `components/ui/` e `lib/ui/`, testata su fixture senza backend (Vitest + Testing Library). Le primitive consumano i token CSS `--am-*` già presenti in `app/globals.css` (fonte di verità runtime) e un modulo TS gemello per la logica.

**Tech Stack:** Next.js 16.2.7 (App Router), React 19.2.4, TypeScript 5, Tailwind CSS 4, Vitest 3 + @testing-library/react + jsdom, npm.

## Global Constraints

- **Next.js del progetto ≠ quello noto:** leggere `node_modules/next/dist/docs/` prima di scrivere codice che tocca API Next (vedi `AGENTS.md`).
- **Zero AI-slop:** icone SVG a tratto consistente; **mai emoji come icone, mai cerchietti-monogramma-gradiente**. I crest passano solo per `<Crest/>`.
- **Verde brand** `#23A559` (mai edge negativo). Font: Hanken Grotesk (display) + JetBrains Mono (mono). Token esistenti `--am-*` in `app/globals.css` sono la fonte di verità.
- **FTC:** "Sicurezza" descrive la confidenza statistica del modello, non un esito garantito. Nessun claim "battiamo il mercato"/"vincita garantita".
- **TDD:** ogni componente/funzione nasce da un test che fallisce. Commit frequenti.
- **Disciplina git:** lavoro su branch `feat/sp0-design-system` (parte da `design/ux-overhaul-casual` o da `main` aggiornato); PR a fine SP; mai push ravvicinati su main.
- **Package manager:** npm (`package-lock.json`).

---

### Task 1: Infrastruttura di test (Vitest + Testing Library)

Motivazione: esistono già `.test.ts` (`lib/goalscorer-model.test.ts`, `lib/crm-unsub.test.ts`, `lib/weekly-pick.test.ts`, `lib/goalscorer-serve.test.ts`, `lib/why-text.test.ts`) che importano da `"vitest"`, ma **Vitest non è installato** (assente da `package-lock.json`). Questo task lo installa e risuscita quei test.

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (scripts + devDependencies via install)

**Interfaces:**
- Produces: comando `npm test` (esegue `vitest run`), `npm run test:watch`. Ambiente `jsdom`. Alias `@/` → root del repo. Matcher `@testing-library/jest-dom` disponibili globalmente nei test.

- [ ] **Step 1: Installare le dipendenze di test**

```bash
npm install -D vitest@^3 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25 @vitejs/plugin-react@^4
```

- [ ] **Step 2: Creare `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["{app,lib,components}/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 3: Creare `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Aggiungere gli script a `package.json`**

Nel blocco `"scripts"` aggiungere:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Verificare che i test esistenti (orfani) girino**

Run: `npm test`
Expected: Vitest scopre ed esegue i `.test.ts` esistenti; il processo termina (PASS o eventuali fallimenti pre-esistenti mostrati). L'importante è che **il runner parta senza errori di configurazione** (nessun "Cannot find package 'vitest'").

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "test(sp0): install vitest + testing-library, jsdom env, @ alias"
```

---

### Task 2: Helper `confidence` (bucket + percentuale)

Traduce `confidence_score` (numerico) del modello in una parola umana e in una percentuale, con normalizzazione difensiva.

**Files:**
- Create: `lib/ui/confidence.ts`
- Test: `lib/ui/confidence.test.ts`

**Interfaces:**
- Produces:
  - `type ConfidenceBucket = "alta" | "media" | "bassa"`
  - `confidencePercent(score: number | null): number` — intero 0–100
  - `confidenceBucket(score: number | null): ConfidenceBucket`
  - `confidenceLabel(bucket: ConfidenceBucket): string` — "Alta" | "Media" | "Bassa"

> **Nota scorciatoia (marcata):** la scala reale di `confidence_score` va confermata contro i dati live in SP1 (assunta 0–100; se ≤1 trattata come frazione). Percorso di upgrade: se la scala risulta diversa, si aggiorna solo la normalizzazione qui, i consumer non cambiano.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { describe, it, expect } from "vitest";
import { confidencePercent, confidenceBucket, confidenceLabel } from "./confidence";

describe("confidencePercent", () => {
  it("null → 0", () => expect(confidencePercent(null)).toBe(0));
  it("scala 0–100 arrotondata e clampata", () => {
    expect(confidencePercent(78.4)).toBe(78);
    expect(confidencePercent(150)).toBe(100);
    expect(confidencePercent(-5)).toBe(0);
  });
  it("frazione 0–1 → percentuale", () => {
    expect(confidencePercent(0.61)).toBe(61);
    expect(confidencePercent(1)).toBe(100);
  });
});

describe("confidenceBucket", () => {
  it("≥70 alta, ≥50 media, <50 bassa", () => {
    expect(confidenceBucket(78)).toBe("alta");
    expect(confidenceBucket(61)).toBe("media");
    expect(confidenceBucket(40)).toBe("bassa");
    expect(confidenceBucket(null)).toBe("bassa");
  });
});

describe("confidenceLabel", () => {
  it("mappa bucket → etichetta italiana", () => {
    expect(confidenceLabel("alta")).toBe("Alta");
    expect(confidenceLabel("media")).toBe("Media");
    expect(confidenceLabel("bassa")).toBe("Bassa");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare il fallimento**

Run: `npx vitest run lib/ui/confidence.test.ts`
Expected: FAIL — "Failed to resolve import './confidence'".

- [ ] **Step 3: Implementare `lib/ui/confidence.ts`**

```ts
export type ConfidenceBucket = "alta" | "media" | "bassa";

// Normalizza a intero 0–100. Difensivo: valori ≤1 (esclusa 0) trattati come
// frazione; il resto come scala 0–100. Scala reale da confermare in SP1.
export function confidencePercent(score: number | null): number {
  if (score == null || Number.isNaN(score)) return 0;
  const pct = score > 0 && score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function confidenceBucket(score: number | null): ConfidenceBucket {
  const p = confidencePercent(score);
  if (p >= 70) return "alta";
  if (p >= 50) return "media";
  return "bassa";
}

export function confidenceLabel(bucket: ConfidenceBucket): string {
  return { alta: "Alta", media: "Media", bassa: "Bassa" }[bucket];
}
```

- [ ] **Step 4: Eseguire il test e verificare il passaggio**

Run: `npx vitest run lib/ui/confidence.test.ts`
Expected: PASS (tutti i casi).

- [ ] **Step 5: Commit**

```bash
git add lib/ui/confidence.ts lib/ui/confidence.test.ts
git commit -m "feat(sp0): confidence helper (bucket alta/media/bassa + percent)"
```

---

### Task 3: `SportIcon`

Set di icone sport SVG inline, tratto consistente. Sostituisce ogni icona sport disegnata a mano nel monolite.

**Files:**
- Create: `components/ui/SportIcon.tsx`
- Test: `components/ui/SportIcon.test.tsx`

**Interfaces:**
- Produces: `SportIcon({ sport, size, className }: { sport: string; size?: number; className?: string }): JSX.Element`. Sport riconosciuti: `"football"`/`"calcio"`, `"tennis"`. Fallback: icona generica. `aria-hidden` sempre; `size` default 16.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SportIcon } from "./SportIcon";

describe("SportIcon", () => {
  it("rende un <svg> per football", () => {
    const { container } = render(<SportIcon sport="football" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
  it("applica size e className", () => {
    const { container } = render(<SportIcon sport="tennis" size={24} className="x" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveClass("x");
  });
  it("è decorativa (aria-hidden)", () => {
    const { container } = render(<SportIcon sport="football" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run components/ui/SportIcon.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `components/ui/SportIcon.tsx`**

```tsx
type Props = { sport: string; size?: number; className?: string };

export function SportIcon({ sport, size = 16, className }: Props) {
  const s = sport.toLowerCase();
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, className, "aria-hidden": true,
  };
  if (s.includes("tenn")) {
    return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M5 5c5 3 9 7 14 14M19 5C14 8 10 12 5 19" /></svg>);
  }
  if (s.includes("foot") || s.includes("calc") || s.includes("soccer")) {
    return (<svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>);
  }
  return (<svg {...common}><circle cx="12" cy="12" r="9" /></svg>);
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run components/ui/SportIcon.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/SportIcon.tsx components/ui/SportIcon.test.tsx
git commit -m "feat(sp0): SportIcon (football/tennis, tratto consistente)"
```

---

### Task 4: `Crest`

Crest di squadra/giocatore. Consuma una asset-map; **fallback = scudo piatto monocromatico** tinto in modo deterministico dal nome. Mai monogramma-gradiente.

**Files:**
- Create: `lib/ui/crest-assets.ts`
- Create: `components/ui/Crest.tsx`
- Test: `components/ui/Crest.test.tsx`

**Interfaces:**
- Consumes: nessuno.
- Produces:
  - `crestUrl(team: string | null, sport: string): string | null` — restituisce l'URL del crest reale se noto, altrimenti `null`. **In SP0 ritorna sempre `null`** (fonte crest reali = questione aperta, decisa a monte di SP0/SP1; vedi spec §9). Percorso di upgrade: popolare la mappa qui, i consumer non cambiano.
  - `Crest({ team, sport, size, className }: { team: string | null; sport: string; size?: number; className?: string }): JSX.Element` — se `crestUrl` è non-null rende `<img>`, altrimenti uno scudo SVG tinto. `size` default 44.

> **Nota scorciatoia (marcata):** il fallback-scudo è un segnaposto onesto finché non è decisa la fonte dei crest reali. Nessun testo/monogramma dentro lo scudo (regola no-slop).

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Crest } from "./Crest";
import { crestUrl } from "@/lib/ui/crest-assets";

describe("crestUrl", () => {
  it("SP0: sconosciuto → null", () => {
    expect(crestUrl("Inter", "football")).toBeNull();
    expect(crestUrl(null, "football")).toBeNull();
  });
});

describe("Crest", () => {
  it("senza asset rende uno scudo SVG (nessun testo/monogramma)", () => {
    const { container } = render(<Crest team="Inter" sport="football" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe(""); // niente lettere dentro il crest
  });
  it("tinta deterministica: stesso nome → stesso fill", () => {
    const a = render(<Crest team="Inter" sport="football" />).container.querySelector("path")!.getAttribute("fill");
    const b = render(<Crest team="Inter" sport="football" />).container.querySelector("path")!.getAttribute("fill");
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run components/ui/Crest.test.tsx`
Expected: FAIL — moduli non risolti.

- [ ] **Step 3: Implementare `lib/ui/crest-assets.ts`**

```ts
// Mappa dei crest reali. Vuota in SP0: la fonte (licenza/asset pipeline) è
// una questione aperta risolta a monte. Popolare qui non cambia i consumer.
const CREST_MAP: Record<string, string> = {};

function key(team: string, sport: string): string {
  return `${sport.toLowerCase()}:${team.trim().toLowerCase()}`;
}

export function crestUrl(team: string | null, sport: string): string | null {
  if (!team) return null;
  return CREST_MAP[key(team, sport)] ?? null;
}
```

- [ ] **Step 4: Implementare `components/ui/Crest.tsx`**

```tsx
import { crestUrl } from "@/lib/ui/crest-assets";

type Props = { team: string | null; sport: string; size?: number; className?: string };

// Tinta deterministica dal nome (hash → hue), saturazione/luminosità fisse.
function tint(team: string | null): string {
  if (!team) return "hsl(220 8% 40%)";
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 42%)`;
}

export function Crest({ team, sport, size = 44, className }: Props) {
  const url = crestUrl(team, sport);
  if (url) {
    return <img src={url} alt={team ?? ""} width={size} height={size} className={className} />;
  }
  return (
    <svg width={size} height={size * (44 / 40)} viewBox="0 0 40 44" className={className} aria-label={team ?? "squadra"} role="img">
      <path d="M20 2 4 8v14c0 10 7 16 16 20 9-4 16-10 16-20V8L20 2Z" fill={tint(team)} />
    </svg>
  );
}
```

- [ ] **Step 5: Eseguire e verificare il passaggio**

Run: `npx vitest run components/ui/Crest.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ui/crest-assets.ts components/ui/Crest.tsx components/ui/Crest.test.tsx
git commit -m "feat(sp0): Crest con fallback scudo tinto (no monogrammi), asset-map stub"
```

---

### Task 5: `Chip`

Pill/etichetta riusabile per sicurezza (alta/media/bassa), PRO e neutra.

**Files:**
- Create: `components/ui/Chip.tsx`
- Test: `components/ui/Chip.test.tsx`

**Interfaces:**
- Produces: `type ChipVariant = "high" | "mid" | "low" | "pro" | "neutral"`; `Chip({ variant, children, className }: { variant: ChipVariant; children: React.ReactNode; className?: string }): JSX.Element`. Colori dai token: high→verde, mid→ambra, low/neutral→muted, pro→verde.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("rende il contenuto", () => {
    render(<Chip variant="high">Alta</Chip>);
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
  it("espone la variante come data-attr", () => {
    render(<Chip variant="pro">PRO</Chip>);
    expect(screen.getByText("PRO")).toHaveAttribute("data-variant", "pro");
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run components/ui/Chip.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `components/ui/Chip.tsx`**

```tsx
import type { ReactNode } from "react";

export type ChipVariant = "high" | "mid" | "low" | "pro" | "neutral";

const STYLE: Record<ChipVariant, { color: string; bg: string; border: string }> = {
  high:    { color: "var(--am-green)",  bg: "var(--am-green-dim)",  border: "var(--am-green-b)" },
  pro:     { color: "var(--am-green)",  bg: "var(--am-green-dim)",  border: "var(--am-green-b)" },
  mid:     { color: "var(--am-amber)",  bg: "rgba(251,191,36,.14)", border: "rgba(251,191,36,.3)" },
  low:     { color: "var(--am-muted)",  bg: "var(--am-hi)",         border: "var(--am-line)" },
  neutral: { color: "var(--am-muted)",  bg: "var(--am-hi)",         border: "var(--am-line)" },
};

export function Chip({ variant, children, className }: { variant: ChipVariant; children: ReactNode; className?: string }) {
  const s = STYLE[variant];
  return (
    <span
      data-variant={variant}
      className={className}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
        color: s.color, background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 999, padding: "4px 9px", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run components/ui/Chip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Chip.tsx components/ui/Chip.test.tsx
git commit -m "feat(sp0): Chip (high/mid/low/pro/neutral) su token --am-*"
```

---

### Task 6: `ConfidenceMeter`

Etichetta "Sicurezza" + barra a 5 segmenti + percentuale opzionale. Consuma `confidence` (Task 2) e `Chip` (Task 5).

**Files:**
- Create: `components/ui/ConfidenceMeter.tsx`
- Test: `components/ui/ConfidenceMeter.test.tsx`

**Interfaces:**
- Consumes: `confidenceBucket`, `confidenceLabel`, `confidencePercent` da `@/lib/ui/confidence`; `Chip` da `@/components/ui/Chip`.
- Produces: `ConfidenceMeter({ score, showPercent }: { score: number | null; showPercent?: boolean }): JSX.Element`. Segmenti accesi = 5 (alta) / 3 (media) / 2 (bassa). Colore segmenti: verde se alta, ambra se media, muted se bassa.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceMeter } from "./ConfidenceMeter";

describe("ConfidenceMeter", () => {
  it("mostra l'etichetta bucket", () => {
    render(<ConfidenceMeter score={78} />);
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
  it("mostra la percentuale solo se richiesto", () => {
    const { rerender } = render(<ConfidenceMeter score={78} />);
    expect(screen.queryByText(/78%/)).toBeNull();
    rerender(<ConfidenceMeter score={78} showPercent />);
    expect(screen.getByText(/78%/)).toBeInTheDocument();
  });
  it("accende 5 segmenti su confidenza alta", () => {
    const { container } = render(<ConfidenceMeter score={90} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(5);
  });
  it("accende 2 segmenti su confidenza bassa", () => {
    const { container } = render(<ConfidenceMeter score={30} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run components/ui/ConfidenceMeter.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `components/ui/ConfidenceMeter.tsx`**

```tsx
import { confidenceBucket, confidenceLabel, confidencePercent, type ConfidenceBucket } from "@/lib/ui/confidence";
import { Chip } from "@/components/ui/Chip";

const SEGMENTS: Record<ConfidenceBucket, number> = { alta: 5, media: 3, bassa: 2 };
const CHIP: Record<ConfidenceBucket, "high" | "mid" | "low"> = { alta: "high", media: "mid", bassa: "low" };
const SEGCOLOR: Record<ConfidenceBucket, string> = {
  alta: "var(--am-green)", media: "var(--am-amber)", bassa: "var(--am-muted-2)",
};

export function ConfidenceMeter({ score, showPercent }: { score: number | null; showPercent?: boolean }) {
  const bucket = confidenceBucket(score);
  const on = SEGMENTS[bucket];
  const pct = confidencePercent(score);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--am-muted-2)" }}>
          Sicurezza del modello
        </span>
        <Chip variant={CHIP[bucket]}>{confidenceLabel(bucket)}{showPercent ? ` · ${pct}%` : ""}</Chip>
      </div>
      <div style={{ display: "flex", gap: 3, height: 8 }}>
        {Array.from({ length: 5 }, (_, i) => {
          const active = i < on;
          return (
            <span key={i} data-on={active}
              style={{ flex: 1, borderRadius: 3, background: active ? SEGCOLOR[bucket] : "var(--am-panel-3)" }} />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run components/ui/ConfidenceMeter.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/ConfidenceMeter.tsx components/ui/ConfidenceMeter.test.tsx
git commit -m "feat(sp0): ConfidenceMeter (etichetta + 5 segmenti + % opzionale)"
```

---

### Task 7: `Button`

Bottone primitivo, varianti `primary` (verde) e `ghost`, con slot icona.

**Files:**
- Create: `components/ui/Button.tsx`
- Test: `components/ui/Button.test.tsx`

**Interfaces:**
- Produces: `type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost"; icon?: React.ReactNode }`; `Button(props: ButtonProps): JSX.Element`. Default variant `ghost`. Focus visibile.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("rende il testo e gestisce il click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Perché</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Perché" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("espone la variante come data-attr", () => {
    render(<Button variant="primary">Vai</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "primary");
  });
  it("rispetta disabled", () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run components/ui/Button.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `components/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  icon?: ReactNode;
};

export function Button({ variant = "ghost", icon, children, style, ...rest }: ButtonProps) {
  const base = {
    fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600,
    borderRadius: 11, padding: "11px 12px", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
  } as const;
  const skin = variant === "primary"
    ? { background: "linear-gradient(145deg,var(--am-green),var(--am-coral-2))", border: "1px solid transparent", color: "#fff" }
    : { background: "var(--am-panel-2)", border: "1px solid var(--am-line)", color: "var(--am-text)" };
  return (
    <button data-variant={variant} style={{ ...base, ...skin, ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run components/ui/Button.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Button.tsx components/ui/Button.test.tsx
git commit -m "feat(sp0): Button (primary/ghost, slot icona)"
```

---

### Task 8: Barrel export + verifica finale SP0

**Files:**
- Create: `components/ui/index.ts`

**Interfaces:**
- Produces: re-export di `SportIcon`, `Crest`, `Chip`, `ConfidenceMeter`, `Button` da `@/components/ui`.

- [ ] **Step 1: Creare `components/ui/index.ts`**

```ts
export { SportIcon } from "./SportIcon";
export { Crest } from "./Crest";
export { Chip, type ChipVariant } from "./Chip";
export { ConfidenceMeter } from "./ConfidenceMeter";
export { Button, type ButtonProps } from "./Button";
```

- [ ] **Step 2: Eseguire l'intera suite**

Run: `npm test`
Expected: PASS per tutti i test SP0 (confidence, SportIcon, Crest, Chip, ConfidenceMeter, Button); i test pre-esistenti non regrediscono.

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: nessun errore introdotto dai nuovi file.

- [ ] **Step 4: Commit**

```bash
git add components/ui/index.ts
git commit -m "feat(sp0): barrel export components/ui + verifica suite verde"
```

---

## Self-Review

- **Copertura spec §6 (design system alla fonte):** token `--am-*` (fonte runtime esistente) + `Crest`/`SportIcon`/`Chip`/`ConfidenceMeter`/`Button` = Task 3–8. Helper `confidence` (§3 "Sicurezza") = Task 2. Infra test (§8) = Task 1. ✔
- **YAGNI:** `Sheet` NON incluso — serve a SP2/SP3, non a SP1. Rimandato.
- **Placeholder:** nessuno; ogni step ha codice/comando reale. Le due scorciatoie (scala confidenza, asset crest) sono marcate con percorso di upgrade, come da regole coding.
- **Coerenza tipi:** `ConfidenceBucket` definito in Task 2 e riusato in Task 6; `ChipVariant` in Task 5 usato in Task 6; nomi `confidencePercent/confidenceBucket/confidenceLabel` coerenti tra Task 2 e 6.

## Prossimo passo
Alla chiusura di SP0 (suite verde), procedere con **SP1 — Feed "Oggi"** (`docs/superpowers/plans/2026-07-10-sp1-feed-oggi.md`), che consuma queste primitive.
