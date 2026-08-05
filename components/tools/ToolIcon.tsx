// components/tools/ToolIcon.tsx (#TOOLS-HUB-0805-ART)
// Icona illustrata del tool: stessa famiglia delle menu-*.png del rail (oggetto
// 3D vetro verde + oro su trasparente, generate con gptimg). Niente line-art e
// niente emoji — regola standing.
//
// Due varianti come per MenuIcon: master 320px e -sm 128px. La -sm copre gli usi
// fino a 64px (card hub, chip "altri strumenti") restando nitida su retina.
//
// <img> e non next/image, identico a MenuIcon/SportIcon: sono PNG già dimensionati
// e serviti dal nostro dominio, l'optimizer non ha nulla da guadagnare.
// ESLint avvisa (@next/next/no-img-element) su ogni <img> sotto components/ —
// SiteFooter, HouseBanner e SiteTopbar hanno lo stesso avviso da sempre. Warning
// accettato e coerente col resto del sito, non una svista.

import type { ToolSlug } from "@/lib/tools/registry";

export function ToolIcon({
  slug,
  size = 40,
  className,
}: {
  slug: ToolSlug;
  size?: number;
  className?: string;
}) {
  const src = size <= 64 ? `/icons/tool-${slug}-sm.png` : `/icons/tool-${slug}.png`;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain", display: "block", flex: "0 0 auto" }}
    />
  );
}
