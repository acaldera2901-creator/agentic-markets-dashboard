import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  CORE_AGENTS,
  SIGNAL_ONLY_AGENTS,
  KNOWN_AGENTS,
  FLAG_GATED_AGENTS,
  NO_HEARTBEAT_AGENTS,
} from "./agent-roster";

// #HEALTH-ROSTER-0828 — the dashboard roster must match the fleet that
// actually reports.
//
// The defect this guards: `TennisResearchAgent` has been running in the fleet
// and writing a heartbeat every cycle, while /api/health only knew 16 of the
// 17 reporting agents. Measured on prod 28/08: agent_heartbeats held 17 rows,
// KNOWN_AGENTS held 16. An unlisted agent cannot be reported dead — the health
// payload reads `ok` whether it is alive or gone. `scripts/live_monitor.py`
// already listed all 17, so the two monitoring surfaces disagreed about the
// fleet, which is worse than either being wrong alone.
//
// A missing name is an ABSENCE: it looks like nothing in review, exactly like
// the missing ON CONFLICT columns in adapter-refresh-parity.test.ts. So it is
// asserted against the Python source rather than eyeballed.
//
// NB co-located under lib/ on purpose: vitest.config.ts `include` is
// {app,lib,components,features}/**/*.test.ts, so a file in tests/ would never
// run.

const ROOT = join(__dirname, "..");

/** Heartbeat name of every BaseAgent subclass, keyed by class name.
 *  BaseAgent.__init__(name) is what lands in agent_heartbeats.agent_name, and
 *  it is NOT always the class name (DataCollectorAgent reports as
 *  "DataCollector"), so the constructor argument is what we read. */
function baseAgentHeartbeatNames(): Map<string, string> {
  const dir = join(ROOT, "agents");
  const out = new Map<string, string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".py"))) {
    const src = readFileSync(join(dir, file), "utf-8");
    const cls = src.match(/^class\s+(\w+)\(BaseAgent\)/m);
    if (!cls) continue;
    const name = src.match(/super\(\)\.__init__\(\s*"([^"]+)"/);
    out.set(cls[1], name ? name[1] : cls[1]);
  }
  return out;
}

/** Class names registered unconditionally in the run.py `agents = [...]`
 *  literal — i.e. the fleet that starts on every boot, excluding the
 *  flag-gated appends that follow the list. */
function unconditionallyRegisteredClasses(): string[] {
  const src = readFileSync(join(ROOT, "run.py"), "utf-8");
  const start = src.indexOf("agents = [");
  expect(start, "run.py must declare an `agents = [` list").toBeGreaterThan(-1);
  const end = src.indexOf("\n    ]", start);
  expect(end, "run.py `agents = [` list must be closed").toBeGreaterThan(start);
  const block = src.slice(start, end);
  return [...block.matchAll(/^\s*(\w+)\(\),/gm)].map((m) => m[1]);
}

describe("#HEALTH-ROSTER-0828 dashboard roster vs Python fleet", () => {
  it("lists every unconditionally-registered agent that emits a heartbeat", () => {
    const heartbeatNames = baseAgentHeartbeatNames();
    const expected = unconditionallyRegisteredClasses()
      .filter((cls) => heartbeatNames.has(cls))
      .map((cls) => heartbeatNames.get(cls)!);

    expect(expected.length).toBeGreaterThan(0);
    expect([...KNOWN_AGENTS].sort()).toEqual([...expected].sort());
  });

  it("does not list agents that never emit a heartbeat", () => {
    const heartbeatNames = baseAgentHeartbeatNames();
    for (const cls of NO_HEARTBEAT_AGENTS) {
      // Documented reason they are excluded: they do not extend BaseAgent, so
      // no heartbeat loop exists. If one ever does, this flips and the roster
      // must gain it.
      expect(heartbeatNames.has(cls)).toBe(false);
      expect(KNOWN_AGENTS).not.toContain(cls);
    }
  });

  it("keeps flag-gated agents out until their flag is wired", () => {
    const registered = new Set(unconditionallyRegisteredClasses());
    for (const cls of FLAG_GATED_AGENTS) {
      expect(registered.has(cls)).toBe(false);
      expect(KNOWN_AGENTS).not.toContain(cls);
    }
  });

  it("agrees with scripts/live_monitor.py MONITORED_AGENTS", () => {
    const src = readFileSync(join(ROOT, "scripts", "live_monitor.py"), "utf-8");
    const block = src.match(/MONITORED_AGENTS\s*=\s*\[([\s\S]*?)\]/);
    expect(block, "live_monitor.py must declare MONITORED_AGENTS").not.toBeNull();
    const monitored = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...KNOWN_AGENTS].sort()).toEqual([...monitored].sort());
  });

  it("has no duplicates and no overlap between core and signal groups", () => {
    expect(new Set(KNOWN_AGENTS).size).toBe(KNOWN_AGENTS.length);
    const core = new Set(CORE_AGENTS);
    expect(SIGNAL_ONLY_AGENTS.filter((a) => core.has(a))).toEqual([]);
  });
});
