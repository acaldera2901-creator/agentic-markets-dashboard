// app/v3c/_og/og.tsx (#REDESIGN-V3C polish) — i template OG del kit (redesign/brand/og):
// fondo Codex (carta + fascia), lockup ufficiale bianco, testo e cifre messi DA
// CODICE con i dati veri. Font statici OFL (Big Shoulders Display 800, Archivo)
// in questa cartella: satori non legge i variabili. Cartella privata (_og): non è una rotta.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

const dir = join(process.cwd(), "app/v3c/_og");
const file = (n: string) => readFile(join(dir, n));

export async function ogAssets(bg: "match" | "tool") {
  const [display, text6, text8, back, lockup] = await Promise.all([
    file("big-shoulders-display-latin-800-normal.woff"),
    file("archivo-latin-600-normal.woff"),
    file("archivo-latin-800-normal.woff"),
    file(`og-${bg}-bg.jpg`),
    file("lockup-white.svg"),
  ]);
  return {
    bg: `data:image/jpeg;base64,${back.toString("base64")}`,
    lockup: `data:image/svg+xml;base64,${lockup.toString("base64")}`,
    fonts: [
      { name: "Display", data: display, weight: 800 as const, style: "normal" as const },
      { name: "Text", data: text6, weight: 600 as const, style: "normal" as const },
      { name: "Text", data: text8, weight: 800 as const, style: "normal" as const },
    ],
  };
}

export const OG = {
  ink: "#14171C",
  ink2: "#4A515B",
  sky: "#0E6FA8",
  lime: "#C8FF00",
  royal: "#145AFF",
};

/** La cornice comune: fondo, lockup nella fascia, riga 18+ in basso. */
export function OgFrame({ bg, lockup, foot, children }: { bg: string; lockup: string; foot: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Text", color: OG.ink }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg} width={1200} height={630} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lockup} width={170} height={56} alt="" style={{ position: "absolute", left: 48, top: 22 }} />
      <div style={{ position: "absolute", left: 56, top: 120, right: 360, bottom: 70, display: "flex", flexDirection: "column" }}>{children}</div>
      <div style={{ position: "absolute", left: 56, bottom: 30, fontSize: 15, fontWeight: 600, letterSpacing: 2, color: OG.ink2 }}>{foot}</div>
    </div>
  );
}
