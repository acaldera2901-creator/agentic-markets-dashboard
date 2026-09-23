// components/ui/LeagueChip.tsx — #RESTYLING-0921
// La lega è contesto, non categoria: testo mono maiuscolo, nessuna cornice,
// troncata a 22ch. Meno bordi, meno micro-rumore (brief: «bordi e micro-label
// eccessivi» da ridurre).
export function LeagueChip({ league, className }: { league: string | null | undefined; className?: string }) {
  if (!league) return null;
  return (
    <span className={["br-chip", className].filter(Boolean).join(" ")} data-kind="league" title={league}>
      {league}
    </span>
  );
}
