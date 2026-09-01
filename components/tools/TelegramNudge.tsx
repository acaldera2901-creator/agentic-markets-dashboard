// components/tools/TelegramNudge.tsx (#TG-TOOLS-CTA)
// L'ingresso a basso attrito, sotto la CTA di prodotto: le pagine dei tool sono
// traffico organico freddo che un account non lo apre — cinque passi con un
// cambio di app in mezzo — mentre entrare in un canale è un tap.
//
// Volutamente NON un secondo box coral accanto al primo: il box-su-box è il tell
// #1 di AI-slop, e questa voce è subordinata alla CTA di prodotto qui sopra.
// Tipografia e un filetto a sinistra, come .tl-takeaway.
//
// Attribuzione: un link a un CANALE Telegram non porta parametri (solo i bot
// leggono `?start=`), quindi non sapremo da quale pagina è arrivato un iscritto.
// Il numero che conta al cancello è il totale dei membri, non la sorgente.

import { SOCIAL } from "@/lib/social-links";

export function TelegramNudge({
  title,
  body,
  button,
}: {
  title: string;
  body: string;
  button: string;
}) {
  return (
    <section className="tl-tg" aria-label={title}>
      <h2>{title}</h2>
      <p>{body}</p>
      <a href={SOCIAL.telegram} target="_blank" rel="noopener noreferrer">
        {button} →
      </a>
    </section>
  );
}
