// components/v3c/Sigillo.tsx (#REDESIGN-V3C F1)
// Il sigillo: «SEALED 09:02 UTC a91f…c3». Inchiostro su carta, taglio del
// lockup, hash in JetBrains Mono — l'unico mono del sistema. Il sigillo è una
// prova (la riga è nel registro pubblico da quell'ora), non un ornamento: se
// l'hash non è valido non si mostra niente che somigli a una prova.
import { sealTimeUtc, shortHash } from "@/lib/v3c/seal";
import { sealStamp, sealedBeforeKickoff } from "@/lib/v3c/fixui2";

type Props = {
  /** ISO dell'ora del sigillo, oppure l'ora già scritta («09:02 UTC»). */
  sealedAt: string;
  /** L'hash della riga, se il registro lo espone; senza, il sigillo mostra solo l'ora. */
  hash?: string | null;
  label?: string;
  /** Il tooltip; senza, quello di default spiega cos'è il sigillo. */
  title?: string;
  className?: string;
  /**
   * fixui M2: il fuso della vista. Con `tz` (dopo il mount) l'ora è locale e senza sigla — la
   * dichiara la nota del fuso della vista; senza, resta «hh:mm UTC» (server, ricevute del registro).
   */
  tz?: string;
  locale?: string;
  /**
   * fixui2 N8: the kick-off of the match. A row dated after it is not a pre-match seal: the stamp
   * then reads `afterLabel` («logged») with `afterTitle`, and carries data-seal="after".
   */
  kickoff?: string | null;
  afterLabel?: string;
  afterTitle?: string;
};

export function Sigillo({ sealedAt, hash, label = "sealed", title, className, tz, locale, kickoff, afterLabel, afterTitle }: Props) {
  // F3: the ledger stores no row hash today. Without one the seal shows the
  // time only — a fact (pick_ledger.captured_at) — and never a made-up code.
  const short = hash == null ? "" : shortHash(hash);
  if (hash != null && !short) return null;
  // fixui2 N8: day AND time («7 Oct 16:02») — a bare «16:02» next to a 16:00 kick-off read as sealed after it.
  // Before the mount (no zone) the stamp stays in UTC and says so, as before.
  const written = /^\d{2}:\d{2}/.test(sealedAt);
  const stamp = written ? sealedAt : sealStamp(sealedAt, tz, locale);
  const time = written ? sealedAt : stamp ? (tz ? stamp : `${stamp} UTC`) : sealTimeUtc(sealedAt);
  if (!time) return null;
  const after = !written && kickoff != null && !sealedBeforeKickoff(sealedAt, kickoff);
  return (
    <span
      className={["v3c-seal", className].filter(Boolean).join(" ")}
      data-seal={after ? "after" : undefined}
      title={after && afterTitle ? afterTitle : title ?? (short ? "Sealed to the public ledger; the hash is the first and last characters of the row at publication" : "Sealed to the public ledger at this time (UTC), before kick-off; the row cannot be edited afterwards")}
    >
      {/* polish: il monogramma ufficiale apre il sigillo (redesign/brand/signature, «inline UI») */}
      <svg className="v3c-seal-mk" viewBox="0 0 459 459" aria-hidden="true">
        <use href="/brand/v3c/mark.svg#mark" />
      </svg>
      <i>{after && afterLabel ? afterLabel : label}</i> {time}
      {short ? (
        <>
          {" "}
          <code>{short}</code>
        </>
      ) : null}
    </span>
  );
}
