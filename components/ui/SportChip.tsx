// components/ui/SportChip.tsx — #RESTYLING-0921
// Categoria (sport): icona + parola, cornice sottile. È l'unica chip con bordo
// nella riga: la lega accanto è contesto e resta testo nudo (LeagueChip).
import { IconSport } from "@/components/ui/icons";

const LABEL: Record<string, string> = {
  football: "Football",
  tennis: "Tennis",
  worldcup: "World Cup",
  baseball: "Baseball",
  mma: "MMA",
};

export function sportLabel(sport: string): string {
  const key = sport.toLowerCase();
  return LABEL[key] ?? (key.charAt(0).toUpperCase() + key.slice(1));
}

export function SportChip({ sport, className }: { sport: string; className?: string }) {
  return (
    <span className={["br-chip", className].filter(Boolean).join(" ")} data-kind="sport" data-sport={sport}>
      <IconSport sport={sport} size={12} stroke={2} />
      {sportLabel(sport)}
    </span>
  );
}
