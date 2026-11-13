"""One-off, explicitly reviewed TR-1113 corrections. Dry-run unless --apply.
Evidence is in reviewed-corrections.json; no matching or outcome inference here.
"""
import json,sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('/Users/calde/Desktop/agentic-markets/.env')
from tools.control_center.db import _dsn
import psycopg2
root=Path(__file__).parent
plans=json.loads((root/'reviewed-corrections.json').read_text())
if '--apply' not in sys.argv:
    print(json.dumps(plans,indent=2));raise SystemExit
applied=[]
with psycopg2.connect(_dsn(),connect_timeout=10,options='-c statement_timeout=45000 -c idle_in_transaction_session_timeout=60000') as conn:
 with conn.cursor() as c:
  for p in plans:
   c.execute('''SELECT notes FROM unified_predictions WHERE id=%s AND pick=%s AND result=%s
     AND verification_state IS DISTINCT FROM 'verified' FOR UPDATE''',(p['id'],p['expected_pick'],p['expected_result']))
   row=c.fetchone()
   if not row:continue
   try:notes=json.loads(row[0] or '{}')
   except (ValueError,TypeError):notes={}
   if not isinstance(notes,dict):notes={}
   notes.pop('final_score',None)
   if p['score']:notes['final_score']=p['score']
   notes['result_correction']=dict(batch='TR-1113-reviewed',previous_result=p['expected_result'],result=p['result'],winner=p['winner'],score=p['score'],reason=p['reason'],sources=p['sources'])
   params={**p,'notes':json.dumps(notes),'source':p['sources'][0]}
   c.execute('''INSERT INTO pick_settlement(source_table,source_id,model_version,result,outcome,final_score,is_backfill,settlement_revision,correction_reason)
    SELECT l.source_table,l.source_id,l.model_version,
      CASE WHEN %(result)s='void' THEN 'void' WHEN l.pick=%(winner)s THEN 'won' ELSE 'lost' END,
      %(winner)s,%(score)s,true,coalesce(s.settlement_revision,0)+1,'TR-1113-reviewed:' || %(reason)s
    FROM unified_predictions u JOIN pick_ledger l ON l.source_table=u.source_table AND l.source_id=u.source_id
    LEFT JOIN pick_settlement_current s ON s.source_table=l.source_table AND s.source_id=l.source_id AND s.model_version=l.model_version
    WHERE u.id=%(id)s AND l.pick IS NOT NULL AND
      (%(result)s='void' OR l.pick IN (u.home_team,u.away_team))
      AND s.result IS DISTINCT FROM CASE WHEN %(result)s='void' THEN 'void' WHEN l.pick=%(winner)s THEN 'won' ELSE 'lost' END
    ON CONFLICT(source_table,source_id,model_version,settlement_revision) DO NOTHING''',params)
   c.execute('''UPDATE unified_predictions SET result=%(result)s,notes=%(notes)s,verification_state='verified',
    verification_source=%(source)s,verification_note='TR-1113-reviewed',verification_at=now(),
    status='settled',is_historical=true,settled_at=now(),updated_at=now() WHERE id=%(id)s''',params)
   applied.append(p['id'])
(root/'reviewed-applied.json').write_text(json.dumps(applied,indent=2))
print('APPLIED',len(applied))
