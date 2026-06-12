"use client";

import { PickLedger, type LedgerRow } from "./PickLedger";
import { EdgeCard } from "./EdgeCard";
import { SegmentTable } from "./SegmentTable";
import { ConsistencyHeatmap } from "./ConsistencyHeatmap";

// Stili namespaced .tr-* (token reali --am-*), iniettati una volta. Si evita
// l'import di CSS globale (vincolo App Router) come nel prototipo verificato.
const CSS = `
.tr-root{
  --c:var(--am-coral);--c2:var(--am-coral-2);--cd:var(--am-coral-dim);--cb:var(--am-coral-b);
  --panel:var(--am-panel);--panel2:var(--am-panel-2);--inset:var(--am-inset);
  --line:var(--am-line);--line2:var(--am-line-2);--text:var(--am-text);
  --mut:var(--am-muted);--mut2:var(--am-muted-2);--hi:var(--am-hi);
  --pos:var(--am-positive);--cobalt:var(--am-cobalt);
  --m:var(--font-mono),ui-monospace,monospace;color:var(--text);
}
.tr-root .tr-eye{font-family:var(--m);font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--mut2);font-weight:600}
.tr-root .tr-lab{font-family:var(--m);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut2);margin-top:6px}
.tr-root .tr-win{color:var(--pos)}
.tr-root .tr-big{font-family:var(--m);font-weight:600;letter-spacing:-.01em;font-size:22px}
.tr-root .tr-card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px;box-shadow:inset 0 1px 0 var(--hi)}
.tr-root .tr-pill{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 11px;border:1px solid var(--line);border-radius:999px;background:var(--inset);font-family:var(--m);font-size:11px;font-weight:600;color:var(--mut)}
.tr-root .tr-pill.c{border-color:var(--cb);background:var(--cd);color:var(--c)}
.tr-root .tr-pill.btn{cursor:pointer}
.tr-root .tr-pill.btn.on{border-color:var(--cb);background:var(--cd);color:var(--c)}
.tr-root .tr-divider{width:1px;height:20px;background:var(--line)}
.tr-root .tr-dot{width:6px;height:6px;border-radius:999px;background:var(--c)}
.tr-root .tr-dot.live{background:var(--pos);box-shadow:0 0 10px rgba(52,211,153,.6)}
.tr-root .tr-glyph{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--cd);color:var(--c);font-size:15px;flex:0 0 auto}
.tr-root .tr-sh{display:flex;align-items:center;gap:10px;margin:30px 0 12px}
.tr-root .tr-sh h2{font-size:13px;font-weight:700;margin:0}
.tr-root .tr-sh .hint{font-size:12px;color:var(--mut2);margin-left:auto}
.tr-root .tr-seg{display:inline-flex;background:var(--inset);border:1px solid var(--line);border-radius:8px;padding:2px;gap:2px;margin-left:auto}
.tr-root .tr-seg button{font-family:var(--m);font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;color:var(--mut);background:none;border:none;cursor:pointer}
.tr-root .tr-seg button.on{background:var(--c);color:#fff}
.tr-root .tr-cardtop{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.tr-root .tr-hero{position:relative;overflow:hidden;padding:26px;border-radius:16px}
.tr-root .tr-hero::before{content:"";position:absolute;inset:0 0 auto 0;height:2px;background:linear-gradient(90deg,var(--c),var(--cobalt));opacity:.55}
.tr-root .tr-hero h1{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:0 0 18px}
.tr-root .tr-vs{display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center}
.tr-root .tr-vside{padding:18px;border-radius:12px;text-align:center}
.tr-root .tr-vside .tr-big{font-size:34px;margin-top:10px}
.tr-root .tr-us{border:1px solid var(--cb);background:linear-gradient(180deg,var(--cd),transparent)}
.tr-root .tr-mk{border:1px solid var(--line);background:var(--panel)}
.tr-root .tr-mk .tr-big{color:var(--mut)}
.tr-root .tr-vx{font-family:var(--m);color:var(--mut2);font-size:14px}
.tr-root .tr-hbot{display:flex;gap:10px;margin-top:14px}
.tr-root .tr-hbot .tr-card{flex:1;padding:14px;text-align:center}
.tr-root .tr-fil{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.tr-root .tr-ledger{padding:4px 16px}
.tr-root .tr-lrow{display:grid;grid-template-columns:78px 1fr 92px 56px 70px;gap:12px;align-items:center;padding:12px 6px;border-bottom:1px solid var(--line);font-size:14px}
.tr-root .tr-lrow:last-child{border-bottom:none}
.tr-root .tr-lrow .d{font-family:var(--m);font-size:11px;color:var(--mut2)}
.tr-root .tr-lrow .comp{font-family:var(--m);font-size:11px;color:var(--mut)}
.tr-root .tr-lrow .pr{font-family:var(--m);font-size:12.5px;text-align:right;color:var(--mut)}
.tr-root .tr-tag{justify-self:end;font-family:var(--m);font-size:10px;font-weight:600;padding:4px 10px;border-radius:999px}
.tr-root .tr-tag.w{color:var(--pos);background:rgba(52,211,153,.10);border:1px solid rgba(52,211,153,.3)}
.tr-root .tr-tag.l{color:var(--am-negative);background:rgba(248,113,113,.10);border:1px solid rgba(248,113,113,.3)}
.tr-root .tr-glock{display:flex;align-items:center;justify-content:center;gap:10px;padding:18px;border-top:1px solid var(--line);color:var(--mut);font-size:13px}
.tr-root .tr-score{padding:6px 16px}
.tr-root .tr-score table{width:100%;border-collapse:collapse}
.tr-root .tr-score th{font-family:var(--m);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut2);text-align:right;font-weight:600;padding:9px 12px;border-bottom:1px solid var(--line)}
.tr-root .tr-score th:first-child{text-align:left}
.tr-root .tr-score th.vcol{border-left:1px solid var(--line)}
.tr-root .tr-score td{padding:13px 12px;border-bottom:1px solid var(--line);text-align:right;font-family:var(--m);font-size:13.5px}
.tr-root .tr-score td.vcol{border-left:1px solid var(--line);background:rgba(59,130,246,.05)}
.tr-root .tr-score tr:last-child td{border-bottom:none}
.tr-root .tr-score .seg-name{font-family:var(--font-display);font-size:14px}
.tr-root .tr-score td:first-child{text-align:left}
.tr-root .tr-score .cv{font-size:16px;font-weight:600}
.tr-root .tr-score .cn{font-size:11px;color:var(--mut2)}
.tr-root .tr-empty{text-align:center;color:var(--mut2);font-family:var(--font-display);font-size:13px;padding:20px}
.tr-root .tr-ehm53{display:grid;grid-template-columns:repeat(53,1fr);gap:2px}
.tr-root .tr-ec{aspect-ratio:1;border-radius:2.5px;background:var(--inset)}
.tr-root .tr-eleg{display:flex;align-items:center;gap:5px;margin-top:12px;font-family:var(--m);font-size:10px;color:var(--mut2)}
.tr-root .tr-foot{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut2);font-size:11.5px;line-height:1.6}
@media(max-width:760px){.tr-root .tr-vs,.tr-root .tr-hbot{grid-template-columns:1fr;flex-direction:column}.tr-root .tr-lrow{grid-template-columns:60px 1fr 64px}.tr-root .tr-lrow .comp,.tr-root .tr-lrow .pr{display:none}}
`;

export function TrackRecordView({ rows }: { rows: LedgerRow[] }) {
  return (
    <div className="tr-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ marginBottom: 6 }}>
        <span className="tr-pill">
          <span className="tr-dot live" /> si aggiorna a ogni match che finisce
        </span>
      </div>

      <div className="tr-sh">
        <span className="tr-glyph">🧾</span>
        <h2>Registro pick</h2>
        <span className="hint">pick concluse · arrivano qui quando la partita finisce</span>
      </div>
      <PickLedger rows={rows} />

      <div className="tr-sh">
        <span className="tr-glyph">📈</span>
        <h2>Lo storico in sintesi</h2>
      </div>
      <EdgeCard />
      <SegmentTable />
      <ConsistencyHeatmap />

      <p className="tr-foot">
        <b>2026</b> = pick reali settlate man mano che le partite finiscono. <b>2025</b> ={" "}
        ricostruzione walk-forward (clic 2025 in ogni scheda per confrontare). I due anni non si
        sommano mai.
      </p>
    </div>
  );
}
