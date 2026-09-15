// lib/analytics-events.test.ts — #RETENTION-ANALYTICS-0915
//
// Il rischio vero di questo job non e' che cancelli poco: e' che cancelli
// troppo. `session_id` porta ID ORDINE sugli eventi scritti dal server, e un
// predicato scritto come `session_id <> 'admin'` li azzererebbe insieme agli
// identificatori dei visitatori. Misurato sul DB di produzione il 15/09:
// `paygate_reconcile_diag` e' il primo event_type per righe con session_id
// (8.147 su 17.344), e `admin_profile_plan_changed` usa DUE valori diversi,
// non solo 'admin'. Questi test bloccano quella regressione.
import { describe, it, expect } from "vitest";
import {
  BROWSER_ANALYTICS_EVENTS,
  BROWSER_ANALYTICS_EVENT_SET,
  RETIRED_BROWSER_ANALYTICS_EVENTS,
  SERVER_WRITTEN_EVENTS,
  PSEUDONYMOUS_EVENTS,
  ANALYTICS_SESSION_RETENTION_INTERVAL,
  expiredPseudonymousRows,
  unclassifiedExpiredRows,
  type SqlFragment,
} from "./analytics-events";

// Modello fedele dell'interpolatore di lib/db.ts: e' lui che sostituisce i $n.
const interpolate = (sql: string, params: unknown[]): string =>
  sql.replace(/\$(\d+)/g, (_, n) => {
    const v = params[Number(n) - 1];
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  });

const rendered = (f: SqlFragment) => interpolate(f.where, f.params);

describe("perimetro della retention", () => {
  it("non tocca nessun evento scritto dal server (gli ID ordine restano)", () => {
    for (const ev of SERVER_WRITTEN_EVENTS) {
      expect(PSEUDONYMOUS_EVENTS).not.toContain(ev);
      expect(rendered(expiredPseudonymousRows())).not.toContain(`'${ev}'`);
    }
  });

  it("copre gli eventi del browser, compresi quelli non piu' emessi", () => {
    const sql = rendered(expiredPseudonymousRows());
    for (const ev of [...BROWSER_ANALYTICS_EVENTS, ...RETIRED_BROWSER_ANALYTICS_EVENTS]) {
      expect(sql).toContain(`'${ev}'`);
    }
  });

  it("i record contabili con maggior volume restano fuori", () => {
    const sql = rendered(expiredPseudonymousRows());
    expect(sql).not.toContain("'paygate_reconcile_diag'");
    expect(sql).not.toContain("'weekly_pick_purchased'");
    expect(sql).not.toContain("'admin_profile_plan_changed'");
  });

  it("azzera solo righe che un identificatore ce l'hanno, e solo se scadute", () => {
    const sql = rendered(expiredPseudonymousRows());
    expect(sql).toContain("session_id IS NOT NULL");
    expect(sql).toContain("created_at < now() - ('14 months')::interval");
  });
});

describe("gli sconosciuti si segnalano, non si cancellano", () => {
  it("il predicato di segnalazione esclude TUTTI gli eventi noti", () => {
    const sql = rendered(unclassifiedExpiredRows());
    expect(sql).toContain("NOT IN");
    for (const ev of [...PSEUDONYMOUS_EVENTS, ...SERVER_WRITTEN_EVENTS]) {
      expect(sql).toContain(`'${ev}'`);
    }
  });

  it("i due predicati sono disgiunti: nessuna riga cade in entrambi", () => {
    // Stesso event_type non puo' essere insieme dentro IN(...) e fuori da
    // NOT IN(...): basta che le liste non si sovrappongano per costruzione.
    const purged = new Set(PSEUDONYMOUS_EVENTS);
    expect(SERVER_WRITTEN_EVENTS.some((e) => purged.has(e))).toBe(false);
  });
});

describe("i segnaposto restano allineati ai parametri", () => {
  for (const [name, f] of [
    ["expiredPseudonymousRows", expiredPseudonymousRows()],
    ["unclassifiedExpiredRows", unclassifiedExpiredRows()],
  ] as const) {
    it(`${name}: ogni $n ha il suo parametro e nessuno avanza`, () => {
      const indexes = [...f.where.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      expect(new Set(indexes).size).toBe(indexes.length);
      expect(Math.max(...indexes)).toBe(f.params.length);
      expect(rendered(f)).not.toMatch(/\$\d/);
    });
  }
});

describe("il termine pubblicato", () => {
  it("e' 14 mesi, ed e' l'ultimo parametro del predicato", () => {
    expect(ANALYTICS_SESSION_RETENTION_INTERVAL).toBe("14 months");
    const f = expiredPseudonymousRows();
    expect(f.params.at(-1)).toBe("14 months");
  });
});

describe("una lista sola per /api/track e per il cron", () => {
  it("il Set dell'allowlist e' esattamente l'array condiviso", () => {
    expect(BROWSER_ANALYTICS_EVENT_SET.size).toBe(new Set(BROWSER_ANALYTICS_EVENTS).size);
    for (const ev of BROWSER_ANALYTICS_EVENTS) {
      expect(BROWSER_ANALYTICS_EVENT_SET.has(ev)).toBe(true);
    }
  });

  it("nessun evento duplicato fra le tre liste", () => {
    const all = [
      ...BROWSER_ANALYTICS_EVENTS,
      ...RETIRED_BROWSER_ANALYTICS_EVENTS,
      ...SERVER_WRITTEN_EVENTS,
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
