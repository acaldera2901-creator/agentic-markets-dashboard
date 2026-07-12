"use client";

import type { PickCardVM } from "./pick-view-model";
import { useMatchDetail } from "./use-match-detail";
import { buildAllGroups, buildModelVsMarket, type MarketChip, type MarketGroup } from "./market-groups";
import { ResultBlock } from "./PickCard";
import { Crest, SportIcon, Chip, ConfidenceMeter, Button, type ChipVariant } from "@/components/ui";
import { confidenceBucket, confidenceLabel } from "@/lib/ui/confidence";

function kickoffLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

const BUCKET_CHIP: Record<"alta" | "media" | "bassa", ChipVariant> = { alta: "high", media: "mid", bassa: "low" };

function pct(p: number | null): string {
  return p == null ? "—" : `${Math.round(p * 100)}%`;
}

function MarketChipRow({ chip }: { chip: MarketChip }) {
  const variant = BUCKET_CHIP[confidenceBucket(chip.prob != null ? chip.prob * 100 : null)];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--am-line)" }}>
      {chip.hasValue && (
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--am-coral)", flexShrink: 0 }} />
      )}
      <span style={{ fontSize: 12, color: "var(--am-muted)", minWidth: 90 }}>{chip.market}</span>
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{chip.selection}</span>
      <Chip variant={variant}>{chip.prob != null ? confidenceLabel(confidenceBucket(chip.prob * 100)) : "—"}</Chip>
      {chip.odds != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--am-muted)" }}>{chip.odds.toFixed(2)}</span>
      )}
    </div>
  );
}

function MarketGroupSection({ group }: { group: MarketGroup }) {
  if (group.locked) {
    return (
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, border: "1px solid var(--am-line)", padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ filter: "blur(6px)", opacity: 0.5, pointerEvents: "none" }} aria-hidden="true">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{group.title}</div>
          <div style={{ fontSize: 12, color: "var(--am-muted)" }}>Contenuto riservato</div>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: 16 }}>
          <strong style={{ fontSize: 13 }}>{group.title}</strong>
          {group.note && <p style={{ margin: 0, fontSize: 12, color: "var(--am-muted)" }}>{group.note}</p>}
          <Button variant="primary">Prova Pro</Button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{group.title}</div>
      {group.note && <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--am-muted-2)" }}>{group.note}</p>}
      <div>
        {group.chips.map((chip) => (
          <MarketChipRow key={chip.id} chip={chip} />
        ))}
      </div>
    </div>
  );
}

export function PickCardExpanded({ pick }: { pick: PickCardVM }) {
  const { detail, loading, error } = useMatchDetail(pick.externalEventId);

  const recap = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)", marginBottom: 14 }}>
        <SportIcon sport={pick.sport} /> {pick.competition} · {kickoffLabel(pick.kickoff)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Crest team={pick.homeTeam} sport={pick.sport} />
        <SportIcon sport={pick.sport} />
        <Crest team={pick.awayTeam} sport={pick.sport} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 13 }}>{pick.decision}</div>
      {pick.settled ? (
        <div style={{ marginBottom: 16 }}>
          <ResultBlock pick={pick} />
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <ConfidenceMeter score={pick.confidenceScore} showPercent />
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div style={{ background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 16, padding: 16 }}>
        <p style={{ fontSize: 13, color: "var(--am-muted)" }}>Caricamento della scheda…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 16, padding: 16 }}>
        {recap}
        <p style={{ fontSize: 13, color: "var(--am-muted)" }}>Qualcosa è andato storto.</p>
      </div>
    );
  }

  if (!detail || detail.locked || detail.p_home == null) {
    return (
      <div style={{ background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 16, padding: 16 }}>
        {recap}
        {pick.why && <p style={{ fontSize: 13, color: "var(--am-muted)", lineHeight: 1.5 }}>{pick.why}</p>}
      </div>
    );
  }

  const mvm = buildModelVsMarket(detail);
  const groups = buildAllGroups(detail);
  const why = detail.enrichment?.explanation ?? pick.why;

  return (
    <div style={{ background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 16, padding: 16 }}>
      {recap}

      {why && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--am-muted-2)", marginBottom: 6 }}>
            Perché
          </div>
          <p style={{ fontSize: 13, color: "var(--am-muted)", lineHeight: 1.5, margin: 0 }}>{why}</p>
        </div>
      )}

      <div style={{ background: "var(--am-inset)", border: "1px solid var(--am-line)", borderRadius: 14, padding: "13px 14px", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Modello vs Mercato</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
          <span style={{ color: "var(--am-muted)" }}>Probabilità modello</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{pct(mvm.modelProb)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
          <span style={{ color: "var(--am-muted)" }}>Probabilità implicita nella quota</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{pct(mvm.impliedProb)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
          <span style={{ color: "var(--am-muted)" }}>Quota migliore</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{mvm.bestOdds != null ? mvm.bestOdds.toFixed(2) : "—"}</span>
        </div>
      </div>

      {groups.map((group) => (
        <MarketGroupSection key={group.key} group={group} />
      ))}
    </div>
  );
}
