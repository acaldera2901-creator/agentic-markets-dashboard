"""Retry historical public football outcomes against ESPN's durable archive.

Same identity/date and >48h postponement rules as recupera_calcio_1001.
Real grades require 90-minute finals; conflicting won/lost labels stay pending.
Public outcome and append-only sealed correction commit in one transaction.
"""
from datetime import datetime, timedelta, timezone
import asyncio
import json
import httpx
from sqlalchemy import text
from core.db import AsyncSessionLocal
from core.espn_http import ESPN_SITE_API, ESPN_HEADERS
from scripts.recupera_calcio_1001 import _strong_identity, parse_espn_event, espn_slugs


def plan_result(row, event):
    if not (_strong_identity(row['home_team'],event['home']) and _strong_identity(row['away_team'],event['away'])):
        return None
    when=row['starts_at']
    if isinstance(when,str): when=datetime.fromisoformat(when.replace('Z','+00:00'))
    if not when or not event.get('kickoff'): return None
    if when.tzinfo is None: when=when.replace(tzinfo=timezone.utc)
    same_id=str(row.get('external_event_id'))=='espn:'+event['id']
    gap=abs(when-event['kickoff'])
    if not same_id and gap>timedelta(minutes=20): return None
    pick=str(row.get('pick') or '').lower()
    if row.get('market')!='1X2' or pick not in ('home','away','draw'): return None
    reason=event['status']; score=None; outcome=None
    if event['kind']=='void': result='void'
    elif event['kind']=='final':
        if gap>timedelta(hours=48):
            result='void'; reason='rinviata-oltre-48h:'+event['kickoff'].isoformat()
        else:
            hg,ag=event['score']; score=f'{hg}-{ag}'
            outcome='home' if hg>ag else 'away' if ag>hg else 'draw'
            result='won' if pick==outcome else 'lost'
    else: return None
    if row.get('result') in ('won','lost') and row['result']!=result: return None
    return dict(id=str(row['id']),expected_pick=row['pick'],expected_result=row.get('result'),
                expected_verification=row.get('verification_state'),result=result,outcome=outcome,
                final_score=score,reason=reason,event_id=event['id'])


async def apply_result(plan):
    async with asyncio.timeout(90):
        async with AsyncSessionLocal() as session, session.begin():
            await session.execute(text("SET LOCAL statement_timeout = '45s'"))
            await session.execute(text("SET LOCAL idle_in_transaction_session_timeout = '60s'"))
            row=(await session.execute(text("""
                SELECT notes FROM unified_predictions WHERE id=CAST(:id AS uuid)
                AND sport='football' AND pick=:expected_pick
                AND result IS NOT DISTINCT FROM :expected_result
                AND verification_state IS NOT DISTINCT FROM :expected_verification
                AND verification_state IS DISTINCT FROM 'verified' FOR UPDATE
            """),plan)).mappings().first()
            if not row:return False
            try: notes=json.loads(row['notes'] or '{}')
            except (ValueError,TypeError):notes={}
            if not isinstance(notes,dict):notes={}
            notes.pop('final_score',None);notes.pop('void_reason',None)
            if plan['final_score']:notes['final_score']=plan['final_score']
            else:notes['void_reason']=plan['reason']
            notes['result_evidence']={'provider':'espn','event_id':plan['event_id'],'status':plan['reason']}
            params={**plan,'notes':json.dumps(notes)}
            await session.execute(text("""
                INSERT INTO pick_settlement
                (source_table,source_id,model_version,result,outcome,final_score,is_backfill,settlement_revision,correction_reason)
                SELECT l.source_table,l.source_id,l.model_version,
                  CASE WHEN :result='void' THEN 'void' WHEN lower(l.pick)=:outcome THEN 'won' ELSE 'lost' END,
                  :outcome,:final_score,true,coalesce(s.settlement_revision,0)+1,'public-football-recovery:' || :reason
                FROM unified_predictions u JOIN pick_ledger l ON l.source_table=u.source_table AND l.source_id=u.source_id
                LEFT JOIN pick_settlement_current s ON s.source_table=l.source_table AND s.source_id=l.source_id AND s.model_version=l.model_version
                WHERE u.id=CAST(:id AS uuid) AND lower(l.pick) IN ('home','draw','away')
                  AND s.result IS DISTINCT FROM CASE WHEN :result='void' THEN 'void' WHEN lower(l.pick)=:outcome THEN 'won' ELSE 'lost' END
                ON CONFLICT(source_table,source_id,model_version,settlement_revision) DO NOTHING
            """),params)
            await session.execute(text("""
                UPDATE unified_predictions SET result=:result,status='settled',is_historical=true,
                  settled_at=now(),updated_at=now(),notes=:notes,verification_state='verified',
                  verification_source='espn-archive',verification_at=now(),verification_note='public-football-recovery:' || :reason
                WHERE id=CAST(:id AS uuid)
            """),params)
    return True


async def recover_batch(after=None):
    async with AsyncSessionLocal() as session:
        rows=(await session.execute(text("""
            SELECT id::text,home_team,away_team,starts_at,league,external_event_id,pick,market,result,verification_state
            FROM unified_predictions WHERE sport='football' AND is_demo=false AND published_at IS NOT NULL
              AND pick IS NOT NULL AND starts_at<now()-interval '48 hours'
              AND verification_state IS DISTINCT FROM 'verified'
              AND (CAST(:after AS uuid) IS NULL OR id>CAST(:after AS uuid)) ORDER BY id LIMIT 25
        """),{'after':after})).mappings().all()
    slugs=espn_slugs(); count=0
    async with httpx.AsyncClient(timeout=15, headers=ESPN_HEADERS) as c:
        for row in rows:
            slug=slugs.get(row['league']); ext=str(row.get('external_event_id') or '')
            if not slug:continue
            try:
                base=f'{ESPN_SITE_API}/soccer/{slug}'
                if ext.startswith('espn:'):
                    r=await c.get(base+'/summary',params={'event':ext[5:]});r.raise_for_status()
                    comps=(r.json().get('header') or {}).get('competitions') or []
                    events=[parse_espn_event({'id':ext[5:],'date':x.get('date'),'status':x.get('status'),'competitions':[x]}) for x in comps]
                else:
                    day=row['starts_at'].strftime('%Y%m%d')
                    r=await c.get(base+'/scoreboard',params={'dates':day,'limit':1000});r.raise_for_status()
                    events=[parse_espn_event(x) for x in r.json().get('events',[])]
                plans=[p for e in events if (p:=plan_result(row,e))]
                if len(plans)==1:count+=bool(await apply_result(plans[0]))
            except (httpx.HTTPError,ValueError):continue
    return (rows[-1]['id'] if len(rows)==25 else None),count
