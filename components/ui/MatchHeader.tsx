// components/ui/MatchHeader.tsx — #RESTYLING-0921
//
// La testa della match page: risponde a «cosa sto guardando?» in un colpo
// d'occhio — sport/lega/quando, le due squadre grandi con lo stemma, e sotto
// il PICK. Solo presentazione: il «perché il modello pensa questo» (livelli
// 2/3 del brief) è la pagina sotto, non questo header.
// `actions` è lo slot a destra del kicker (WatchlistButton, share…).
//
// Round 14: via anche il chip dell'edge accanto al pick — era l'ultimo numero
// di mercato rimasto nella scheda dopo il round 13, e poteva essere NEGATIVO
// («−3,2%»), cioè la scheda diceva a chi la apriva che il mercato ci batte.
// Andrea: «non deve esserci più nessun riferimento nelle schede per quanto
// riguarda il market, solo modello». Resta la sola percentuale del modello.
import type { ReactNode } from "react";
import { Crest } from "@/components/ui/Crest";
import { SportChip } from "@/components/ui/SportChip";
import { LeagueChip } from "@/components/ui/LeagueChip";
import { LiveBadge } from "@/components/ui/LiveBadge";
import { IconLock } from "@/components/ui/icons";

type Props = {
  sport: string;
  league: string | null;
  home: string;
  away: string;
  kickoffLabel?: string | null;
  isLive?: boolean;
  liveMinute?: string | number | null;
  score?: { home: number; away: number } | null;
  pick: string | null;
  locked?: boolean;
  actions?: ReactNode;
  className?: string;
};

export function MatchHeader({ sport, league, home, away, kickoffLabel, isLive = false, liveMinute, score, pick, locked = false, actions, className }: Props) {
  return (
    <header className={["br-mh", className].filter(Boolean).join(" ")} data-live={isLive}>
      <div className="br-mh__kicker">
        <SportChip sport={sport} />
        <LeagueChip league={league} />
        {isLive ? <LiveBadge minute={liveMinute} /> : kickoffLabel ? <span className="br-card__when">{kickoffLabel}</span> : null}
        {actions && <span className="br-card__side">{actions}</span>}
      </div>

      {/* Un solo h1 per la pagina: contiene entrambe le squadre, la griglia
          è sua. Gli screen reader leggono «Arsenal vs Chelsea». */}
      <h1 className="br-mh__teams">
        <span className="br-mh__team" data-side="home">
          <Crest team={home} sport={sport} size={56} role="home" />
          <span className="br-mh__name">{home}</span>
        </span>
        <span className="br-mh__mid">
          {score ? (
            <span className="br-mh__score">{score.home}<span className="br-mh__vs">&ndash;</span>{score.away}</span>
          ) : (
            <span className="br-mh__vs">vs</span>
          )}
        </span>
        <span className="br-mh__team" data-side="away">
          <Crest team={away} sport={sport} size={56} role="away" />
          <span className="br-mh__name">{away}</span>
        </span>
      </h1>

      <div className="br-mh__pick">
        <span className="br-label">Pick</span>
        {locked || !pick ? (
          <strong className="br-mh__pick-v" data-locked="true">
            <IconLock size={16} />{locked ? "Pro pick" : "No pick"}
          </strong>
        ) : (
          <strong className="br-mh__pick-v">{pick}</strong>
        )}
      </div>
    </header>
  );
}
