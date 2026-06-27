"use client";
import { useCallback, useEffect, useState } from "react";

type Clause = { field: string; op: string; value?: unknown };
type Segment = {
  id: string; key: string; name: string; description: string | null;
  rule: { all: Clause[] }; active: boolean;
  last_count: number | null; last_synced_at: string | null;
};

const FIELD_OPS: Record<string, string[]> = {
  plan: ["eq", "in"],
  language: ["eq", "in"],
  requested_plan: ["eq", "in", "is_null"],
  activated: ["eq"],
  account_age_days: ["lte", "gte"],
  plan_expires_at: ["expired", "active", "expiring_in_days"],
};

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ key: string; name: string; clauses: Clause[] }>({ key: "", name: "", clauses: [] });
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/segments");
    if (!res.ok) { setError("Caricamento segmenti fallito"); return; }
    const data = await res.json();
    setSegments(data.segments ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const runPreview = useCallback(async () => {
    const res = await fetch("/api/admin/segments/preview/count".replace("preview", "00000000-0000-0000-0000-000000000000"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule: { all: draft.clauses } }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Preview fallita"); return; }
    setError(null); setPreview(data.count ?? 0);
  }, [draft.clauses]);

  const create = useCallback(async () => {
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/segments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: draft.key, name: draft.name, rule: { all: draft.clauses } }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Creazione fallita"); return; }
    setDraft({ key: "", name: "", clauses: [] }); setPreview(null); void load();
  }, [draft, load]);

  const sync = useCallback(async (id: string) => {
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/segments/${id}/sync`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Sync fallito"); return; }
    void load();
  }, [load]);

  const addClause = () => setDraft((d) => ({ ...d, clauses: [...d.clauses, { field: "plan", op: "eq", value: "" }] }));
  const updClause = (i: number, patch: Partial<Clause>) =>
    setDraft((d) => ({ ...d, clauses: d.clauses.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const delClause = (i: number) => setDraft((d) => ({ ...d, clauses: d.clauses.filter((_, j) => j !== i) }));

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui,sans-serif", color: "#0f172a" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Marketing — Segmenti</h1>
      <p style={{ color: "#64748b", fontSize: 13 }}>
        I segmenti sincronizzati su Resend non inviano email: i Broadcast si compongono nella dashboard Resend.
      </p>
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>⚠️ {error}</p>}

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, margin: "16px 0" }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Nuovo segmento</h2>
        <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
          <input placeholder="key (es. pro_it)" value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
            style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
          <input placeholder="Nome leggibile" value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            style={{ flex: 2, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
        </div>
        {draft.clauses.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 8, margin: "6px 0" }}>
            <select value={c.field} onChange={(e) => updClause(i, { field: e.target.value, op: FIELD_OPS[e.target.value][0] })}>
              {Object.keys(FIELD_OPS).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={c.op} onChange={(e) => updClause(i, { op: e.target.value })}>
              {FIELD_OPS[c.field].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input placeholder="value (CSV per 'in', numero per giorni)" value={String(c.value ?? "")}
              onChange={(e) => {
                const op = c.op;
                let v: unknown = e.target.value;
                if (op === "in") v = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                else if (op === "eq" && c.field === "activated") v = e.target.value === "true";
                else if (["expiring_in_days", "lte", "gte"].includes(op)) v = Number(e.target.value);
                updClause(i, { value: v });
              }}
              style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 6 }} />
            <button onClick={() => delClause(i)}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={addClause}>+ clausola</button>
          <button onClick={runPreview} disabled={busy}>Anteprima conteggio</button>
          <button onClick={create} disabled={busy || !draft.key || !draft.name}>Crea segmento</button>
          {preview != null && <span style={{ alignSelf: "center", fontSize: 13 }}>≈ {preview} utenti</span>}
        </div>
      </section>

      <h2 style={{ fontSize: 15, fontWeight: 700 }}>Segmenti esistenti</h2>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead><tr style={{ textAlign: "left", color: "#64748b" }}>
          <th>Nome</th><th>key</th><th>Match</th><th>Ultimo sync</th><th></th>
        </tr></thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td>{s.name}</td><td>{s.key}</td>
              <td>{s.last_count ?? "—"}</td>
              <td>{s.last_synced_at ? new Date(s.last_synced_at).toLocaleString("it-IT") : "mai"}</td>
              <td><button onClick={() => sync(s.id)} disabled={busy}>Sync su Resend</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
