import type { PickCardVM } from "./pick-view-model";
import { Crest, SportIcon, ConfidenceMeter, Chip, Button } from "@/components/ui";

function kickoffLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function PickCard({ pick, pickOfDay, onOpen }: {
  pick: PickCardVM; pickOfDay?: boolean; onOpen?: (id: string) => void;
}) {
  if (pick.locked) {
    return (
      <div style={{ position: "relative", overflow: "hidden", background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 16, padding: 16 }}>
        <div style={{ filter: "blur(6px)", opacity: 0.5, pointerEvents: "none" }} aria-hidden="true">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)" }}>{pick.competition}</div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>Pronostico Pro</div>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: 20 }}>
          <strong style={{ fontSize: 15 }}>Pronostico Pro</strong>
          <p style={{ margin: 0, fontSize: 12, color: "var(--am-muted)" }}>Sblocca tutti i pick di oggi.</p>
          <Button variant="primary">Prova Pro →</Button>
        </div>
      </div>
    );
  }

  return (
    <div data-hero={pickOfDay ? "true" : undefined}
      style={{
        background: pickOfDay ? "linear-gradient(180deg,var(--am-green-dim),transparent 42%),var(--am-panel)" : "var(--am-panel)",
        border: `1px solid ${pickOfDay ? "var(--am-green-b)" : "var(--am-line)"}`,
        borderRadius: 16, padding: "16px 16px 14px",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)" }}>
          <SportIcon sport={pick.sport} /> {pick.competition} · {kickoffLabel(pick.kickoff)}
        </span>
        {pickOfDay && <Chip variant="pro">Pick del giorno</Chip>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <Crest team={pick.homeTeam} sport={pick.sport} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{pick.homeTeam}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted-2)" }}>VS</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <Crest team={pick.awayTeam} sport={pick.sport} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{pick.awayTeam}</span>
        </div>
      </div>

      <div style={{ background: "var(--am-inset)", border: "1px solid var(--am-line)", borderRadius: 14, padding: "13px 14px", marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--am-muted-2)", marginBottom: 6 }}>
          Il nostro pronostico
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>{pick.decision}</span>
          {pick.odds != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--am-green)", background: "var(--am-green-dim)", padding: "3px 8px", borderRadius: 8, border: "1px solid var(--am-green-b)" }}>
              quota {pick.odds.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 13 }}>
        <ConfidenceMeter score={pick.confidenceScore} showPercent />
      </div>

      {pick.why && (
        <p style={{ fontSize: 13, color: "var(--am-muted)", lineHeight: 1.5, margin: "0 0 15px" }}>{pick.why}</p>
      )}

      <Button variant="primary" style={{ width: "100%" }} onClick={() => onOpen?.(pick.id)}>
        Perché questa previsione
      </Button>
    </div>
  );
}
