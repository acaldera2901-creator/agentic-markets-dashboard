// components/v3c/Sigillo.tsx (#REDESIGN-V3C F1)
// Il sigillo: «SEALED 09:02 UTC a91f…c3». Inchiostro su carta, taglio del
// lockup, hash in JetBrains Mono — l'unico mono del sistema. Il sigillo è una
// prova (la riga è nel registro pubblico da quell'ora), non un ornamento: se
// l'hash non è valido non si mostra niente che somigli a una prova.
import { sealTimeUtc, shortHash } from "@/lib/v3c/seal";

type Props = {
  /** ISO dell'ora del sigillo, oppure l'ora già scritta («09:02 UTC»). */
  sealedAt: string;
  /** L'hash della riga, se il registro lo espone; senza, il sigillo mostra solo l'ora. */
  hash?: string | null;
  label?: string;
  /** Il tooltip; senza, quello di default spiega cos'è il sigillo. */
  title?: string;
  className?: string;
};

export function Sigillo({ sealedAt, hash, label = "sealed", title, className }: Props) {
  // F3: the ledger stores no row hash today. Without one the seal shows the
  // time only — a fact (pick_ledger.captured_at) — and never a made-up code.
  const short = hash == null ? "" : shortHash(hash);
  if (hash != null && !short) return null;
  const time = /^\d{2}:\d{2}/.test(sealedAt) ? sealedAt : sealTimeUtc(sealedAt);
  if (!time) return null;
  return (
    <span
      className={["v3c-seal", className].filter(Boolean).join(" ")}
      title={title ?? (short ? "Sealed to the public ledger; the hash is the first and last characters of the row at publication" : "Sealed to the public ledger at this time (UTC), before kick-off; the row cannot be edited afterwards")}
    >
      {/* polish: il monogramma ufficiale apre il sigillo (redesign/brand/signature, «inline UI») */}
      <svg className="v3c-seal-mk" viewBox="0 0 459 459" aria-hidden="true">
        <use href="/brand/v3c/mark.svg#mark" />
      </svg>
      <i>{label}</i> {time}
      {short ? (
        <>
          {" "}
          <code>{short}</code>
        </>
      ) : null}
    </span>
  );
}
