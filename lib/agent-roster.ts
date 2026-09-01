// #HEALTH-ROSTER-0828 — single source of truth for the agent names that
// /api/health knows about.
//
// Extracted from app/api/health/route.ts so the roster can be asserted
// mechanically against the Python fleet (see agent-roster.test.ts). The bug
// that prompted this: `TennisResearchAgent` runs in the fleet and writes a
// heartbeat every cycle, but was missing from this list, so /api/health
// reported on 16 of the 17 agents that report. A dead agent nobody lists is
// indistinguishable from a healthy one — the health payload stays `ok`.
//
// Membership rule: every BaseAgent subclass that run.py registers
// UNCONDITIONALLY belongs here, because BaseAgent._heartbeat_loop makes
// heartbeats automatic. Two classes in agents/ are deliberately absent because
// they do not extend BaseAgent and therefore never emit a heartbeat at all —
// SportsbookScraperAgent and ShadowEvalAgent. Listing them here would invent a
// permanently-offline agent; making them observable is a fleet-side change.

export const CORE_AGENTS = [
  "DataCollector", "ModelAgent", "AnalystAgent", "StrategistAgent",
  "RiskManagerAgent", "TraderAgent", "MonitorAgent", "ResearchAgent",
  "AHCollectorAgent", "ResultSettlementAgent",
];

export const SIGNAL_ONLY_AGENTS = [
  "TennisDataCollectorAgent", "TennisModelAgent", "TennisAnalystAgent",
  "TennisRiskManagerAgent", "TennisTraderAgent", "TennisSettlementAgent",
  "TennisResearchAgent",
];

export const KNOWN_AGENTS = [...CORE_AGENTS, ...SIGNAL_ONLY_AGENTS];

// BaseAgent subclasses that run.py registers only behind a NEWSPORT_* flag.
// They are dark by default; when a flag is turned on they start emitting
// heartbeats and must be moved into the roster above in the same change.
export const FLAG_GATED_AGENTS = ["BaseballModelAgent", "MmaModelAgent"];

// Classes in agents/ that never emit a heartbeat because they do not extend
// BaseAgent. Not monitorable from the dashboard by construction.
export const NO_HEARTBEAT_AGENTS = ["SportsbookScraperAgent", "ShadowEvalAgent"];
