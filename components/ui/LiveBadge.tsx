// components/ui/LiveBadge.tsx — #RESTYLING-0921
// Il giallo neon è un accento: un puntino che pulsa e la parola LIVE, su fondo
// tinto al 12%. Mai un fill pieno. Il minuto usa il primo tipografico (′).
type Props = {
  minute?: string | number | null;
  label?: string;
  className?: string;
};

export function LiveBadge({ minute, label = "Live", className }: Props) {
  const min = minute == null || minute === "" ? null : String(minute).replace(/['′]$/, "");
  return (
    <span className={["br-live", className].filter(Boolean).join(" ")} role="status">
      <i className="br-live__dot" aria-hidden="true" />
      {label}
      {min != null && <span className="br-live__min">{min}&prime;</span>}
    </span>
  );
}
