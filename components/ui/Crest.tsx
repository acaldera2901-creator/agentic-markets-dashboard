import { crestUrl } from "@/lib/ui/crest-assets";

type Props = { team: string | null; sport: string; size?: number; className?: string };

// Tinta deterministica dal nome (hash → hue), saturazione/luminosità fisse.
function tint(team: string | null): string {
  if (!team) return "hsl(220 8% 40%)";
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 42%)`;
}

export function Crest({ team, sport, size = 44, className }: Props) {
  const url = crestUrl(team, sport);
  if (url) {
    return <img src={url} alt={team ?? ""} width={size} height={size} className={className} />;
  }
  return (
    <svg width={size} height={size * (44 / 40)} viewBox="0 0 40 44" className={className} aria-label={team ?? "squadra"} role="img">
      <path d="M20 2 4 8v14c0 10 7 16 16 20 9-4 16-10 16-20V8L20 2Z" fill={tint(team)} />
    </svg>
  );
}
