"use client";
// components/news/NewsArt.tsx (#NEWS-FOTMOB-PROD-1026) — the picture of a note:
// our photo for the kind of story underneath, the real colours of the clubs
// the note names as a tint over it, and their REAL crests (the board's own
// bundled badges, lib/ui/crest-map.json) as sharp elements on a dark pill in
// the lower corners — first club left, second club right. No club named →
// the photo alone. No crest bundled for a club → no crest for it, never a
// substitute. Decorative photo (alt=""), named crests (alt = club).
import Image from "next/image";
import type { ClubBadge } from "@/lib/news/clubs";
import type { NewsImage } from "@/lib/news/kind";

export type NewsArtVariant = "thumb" | "strip" | "card";

const CREST_PX: Record<NewsArtVariant, number> = { thumb: 32, strip: 20, card: 56 };

/** The club colour that tints: the shirt, unless it is (near) white — then the second colour, so a white shirt does not wash the photo out. */
export function tintOf(colors: readonly [string, string] | null): string | null {
  if (!colors) return null;
  const lum = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  return lum(colors[0]) > 0.85 ? colors[1] : colors[0];
}

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** The tint gradient: one club → its colour from the left; two → one colour each side; none → nothing. */
export function tintGradient(badges: readonly ClubBadge[]): string | null {
  const l = tintOf(badges[0]?.colors ?? null);
  const r = badges.length > 1 ? tintOf(badges[1].colors) : null;
  if (!l && !r) return null;
  const L = l ? rgba(l, 0.68) : "transparent";
  const R = r ? rgba(r, 0.68) : "transparent";
  if (l && !r) return `linear-gradient(100deg, ${L} 0%, ${rgba(l, 0.3)} 40%, transparent 72%)`;
  return `linear-gradient(100deg, ${L} 0%, transparent 46%, transparent 54%, ${R} 100%)`;
}

export function NewsArt({ image, badges, variant, className, sizes }: { image: NewsImage | null; badges: readonly ClubBadge[]; variant: NewsArtVariant; className?: string; sizes: string }) {
  if (!image) return null;
  const tint = tintGradient(badges);
  const px = CREST_PX[variant];
  const shown = badges.filter((b) => b.crest).slice(0, 2);
  return (
    <span className={["nwa", className].filter(Boolean).join(" ")} data-variant={variant} data-clubs={shown.length || undefined}>
      <Image className="nwa-img" src={image.src} width={image.width} height={image.height} alt="" loading="lazy" sizes={sizes} />
      {tint && <span className="nwa-tint" aria-hidden="true" style={{ backgroundImage: tint }} />}
      {shown.map((b, i) => (
        <span key={b.name} className="nwa-badge" data-side={i === 0 ? "l" : "r"} style={{ width: px + 8, height: px + 8 }}>
          <Image src={b.crest!} alt={b.name} width={px} height={px} loading="lazy" />
        </span>
      ))}
    </span>
  );
}
