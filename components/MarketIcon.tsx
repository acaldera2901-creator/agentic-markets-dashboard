// #CARD-REDESIGN-V2: icone-mercato illustrate (stile di casa, PNG trasparenti in
// /public/icons/market-*.png), stesso pattern di MenuIcon. Prodotte da Maven Studio.
// I micro-controlli (check/x/chevron/freccia/star) restano SVG line in MatchDetailSheet.
type MarketName = "result" | "goals" | "scorer" | "soft" | "betslip";

const SRC: Record<MarketName, string> = {
  result: "/icons/market-result.png",
  goals: "/icons/market-goals.png",
  scorer: "/icons/market-scorer.png",
  soft: "/icons/market-soft.png",
  betslip: "/icons/market-betslip.png",
};
const SRC_SM: Record<MarketName, string> = {
  result: "/icons/market-result-sm.png",
  goals: "/icons/market-goals-sm.png",
  scorer: "/icons/market-scorer-sm.png",
  soft: "/icons/market-soft-sm.png",
  betslip: "/icons/market-betslip-sm.png",
};

export function MarketIcon({ name, size = 16, className }: { name: MarketName; size?: number; className?: string }) {
  const src = size <= 24 ? SRC_SM[name] : SRC[name];
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
