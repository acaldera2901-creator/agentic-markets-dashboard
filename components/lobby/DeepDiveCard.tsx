// components/lobby/DeepDiveCard.tsx — #RESTYLING-0921 round 7
//
// «Da approfondire»: i creativi della casa (public/banners/andrea-picks/, round
// 5) messi grandi e affiancati, col testo SOTTO la foto e non cotto dentro —
// così il titolo è testo vero, tradotto nelle cinque lingue, indicizzabile e
// leggibile da uno screen reader. È il trattamento del riferimento.
//
// Andrea, 22/09: «anche i banner vanno usati gli stessi, deve essere tutto
// nuovo». Quindi qui non ne girano due ma quanti ne servono a riempire la
// sezione; la fonte è HOUSE_CAMPAIGNS, la stessa che alimenta board e tool.
import Link from "next/link";
import type { MouseEvent } from "react";

export type DeepDiveCardProps = {
  eyebrow: string;
  title: string;
  sub?: string;
  cta: string;
  href: string;
  image: { src: string; srcSm?: string };
  onClick?: (ev: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

export function DeepDiveCard({ eyebrow, title, sub, cta, href, image, onClick, className }: DeepDiveCardProps) {
  return (
    <Link href={href} className={["br-dd", className].filter(Boolean).join(" ")} onClick={onClick}>
      <span className="br-dd__shot">
        <img
          className="br-dd__img"
          src={image.src}
          srcSet={image.srcSm ? `${image.srcSm} 560w, ${image.src} 1120w` : undefined}
          sizes="(max-width: 720px) 100vw, 460px"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className="br-dd__body">
        <span className="br-dd__eyebrow">{eyebrow}</span>
        <span className="br-dd__title">{title}</span>
        {sub && <span className="br-dd__sub">{sub}</span>}
        <span className="br-dd__cta">{cta}</span>
      </span>
    </Link>
  );
}

/** La griglia di «Da approfondire». */
export function DeepDiveGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={["br-dds", className].filter(Boolean).join(" ")}>{children}</div>;
}
