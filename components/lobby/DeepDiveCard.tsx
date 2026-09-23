// components/lobby/DeepDiveCard.tsx — #RESTYLING-0921 round 7
//
// «Da approfondire»: i creativi della casa (public/banners/andrea-picks/, round
// 5) messi grandi e affiancati, col testo SOTTO la foto e non cotto dentro —
// così il titolo è testo vero, tradotto nelle cinque lingue, indicizzabile e
// leggibile da uno screen reader. È il trattamento del riferimento.
//
// Andrea, 22/09: «anche i banner vanno usati gli stessi, deve essere tutto
// nuovo» — che vuol dire nel SITO, non tutti nello stesso blocco: il
// riferimento ne mostra due affiancati. Gli altri restano dove già girano
// (board, tool, feed). La fonte è HOUSE_CAMPAIGNS, la stessa che alimenta
// board e tool.
//
// PERCHÉ LA BARRA SOTTO RESTA, anche se sembra ripetere il creativo. Round 8:
// era in discussione toglierla e lasciare solo il link, visto che titolo,
// sottotitolo e CTA sono già cotti dentro il JPEG. Misurato sul riferimento
// (22/09, `.image-campaign`): la barra c'è anche lì, e dice «Deep Analysis ·
// I fattori dietro ogni lettura · Scopri Pro ↗» sotto un creativo che in
// immagine dice «DEEP ANALYSIS. SEE THE WHY. · The factors behind the model's
// call, explained. · EXPLORE PRO». Non è un doppione: è la versione TRADOTTA.
// I creativi esistono solo in inglese, quindi quella barra è l'unico testo
// che un utente IT/ES/FR/RU legge, l'unico che Google indicizza e l'unico che
// uno screen reader sente. Togliendola il blocco diventava muto in quattro
// lingue su cinque. L'`alt` resta vuoto proprio perché la barra accanto dice
// già la stessa cosa: altrimenti la si sentirebbe due volte.
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
          /* Round 8: da due per riga la card è ~46vw, non 460px fissi. */
          sizes="(max-width: 720px) 100vw, 46vw"
          alt=""
          /* I creativi sono 1120×630. Dichiararlo qui (e come aspect-ratio nel
             CSS) è ciò che impedisce alla card di saltare da 0 a ~330px quando
             il lazy load consegna l'immagine. */
          width={1120}
          height={630}
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
