// components/tools/ToolIcon.tsx (#TOOLS-HUB-0805-ART)
// Icona illustrata del tool: stessa famiglia delle menu-*.png del rail (oggetto
// 3D vetro verde + oro su trasparente, generate con gptimg). Niente line-art e
// niente emoji — regola standing.
//
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
  const src = `/icons/tool-${slug}`;
  const small = size <= 64;
  return (
    <picture style={{ display: "block", flex: "0 0 auto" }}>
      <source
        type="image/webp"
        srcSet={small ? `${src}-sm.webp 128w, ${src}.webp 320w` : `${src}.webp`}
        sizes={small ? `${size}px` : undefined}
      />
      <img
        src={`${src}${small ? "-sm" : ""}.png`}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain", display: "block" }}
      />
    </picture>
  );
}
