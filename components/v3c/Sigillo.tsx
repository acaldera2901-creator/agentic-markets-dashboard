// components/v3c/Sigillo.tsx (#REDESIGN-V3C F1)
// Il sigillo: «SEALED 09:02 UTC a91f…c3». Inchiostro su carta, taglio del
// lockup, hash in JetBrains Mono — l'unico mono del sistema. Il sigillo è una
// prova (la riga è nel registro pubblico da quell'ora), non un ornamento: se
// l'hash non è valido non si mostra niente che somigli a una prova.
import { sealTimeUtc, shortHash } from "@/lib/v3c/seal";

type Props = {
  /** ISO dell'ora del sigillo, oppure l'ora già scritta («09:02 UTC»). */
  sealedAt: string;
  hash: string;
  label?: string;
  className?: string;
};

export function Sigillo({ sealedAt, hash, label = "sealed", className }: Props) {
  const short = shortHash(hash);
  if (!short) return null;
  const time = /^\d{2}:\d{2}/.test(sealedAt) ? sealedAt : sealTimeUtc(sealedAt);
  return (
    <span
      className={["v3c-seal", className].filter(Boolean).join(" ")}
      title="Sealed to the public ledger; the hash is the first and last characters of the row at publication"
    >
      <i>{label}</i> {time} <code>{short}</code>
    </span>
  );
}
