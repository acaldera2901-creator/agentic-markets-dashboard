"""Conservative singles fallback from Tennis Explorer's dated results archive.

Only complete, internally consistent scores are accepted. The detail page must
confirm the date, both full names and the score. Initials only shortlist requests;
never identify players. Retirements/walkovers remain pending without explicit
status evidence. HTML changes fail closed. No credentials or paid API required.
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, time, timezone, timedelta
from html.parser import HTMLParser
from time import monotonic
import httpx
from core.tennis_names import canonical_player_key
from core.tennis_set_validation import settlement_allowed, sets_won

_BASE = 'https://www.tennisexplorer.com'
logger = logging.getLogger(__name__)
_cache: dict[str, tuple[float, str]] = {}
_TTL = 3600
_MAX_DETAILS = 30

class _Cells(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=None; self.cell=None; self.sup=0; self.upper=False; self.dates=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='tr': self.row={'id':a.get('id',''),'cells':[]}
        if tag in ('td','th') and self.row is not None:
            self.cell={'class':a.get('class',''),'text':'','links':[]}
        if tag=='a' and self.cell is not None: self.cell['links'].append(a.get('href',''))
        if tag=='sup': self.sup+=1
        if tag=='span' and a.get('class')=='upper': self.upper=True
    def handle_endtag(self, tag):
        if tag=='sup': self.sup=max(0,self.sup-1)
        if tag=='span': self.upper=False
        if tag in ('td','th') and self.cell is not None:
            if self.row is not None: self.row['cells'].append(self.cell)
            self.cell=None
        if tag=='tr' and self.row is not None: self.rows.append(self.row); self.row=None
    def handle_data(self, data):
        if self.cell is not None and not self.sup: self.cell['text']+=data
        if self.upper: self.dates.append(data.strip())

def _cells(row, cls): return [c for c in row['cells'] if cls in c['class'].split()]
def _tokens(name):
    tokens = sorted(canonical_player_key(name).split())
    # WTA player 325725: official profile URL Catherine_McNally, display Caty.
    # https://www.wtatennis.com/players/325725/Catherine_McNally
    if tokens == ['catherine', 'mcnally']:
        return ['caty', 'mcnally']
    return tokens

def parse_day(html):
    p=_Cells(); p.feed(html); out=[]
    for r,other in zip(p.rows,p.rows[1:]):
        if not r['id'] or other['id']!=r['id']+'b': continue
        names=[_cells(x,'t-name') for x in (r,other)]
        totals=[_cells(x,'result') for x in (r,other)]
        scores=[_cells(x,'score') for x in (r,other)]
        if any(len(x)!=1 for x in names+totals): continue
        # Doubles require a different identity contract; never match initials.
        if any(not any(h.startswith('/player/') for h in x[0]['links']) for x in names): continue
        vals=[x[0]['text'].strip() for x in totals]
        if not all(v.isdigit() for v in vals): continue
        ss=[[c['text'].strip() for c in cs if c['text'].strip()] for cs in scores]
        if len(ss[0])!=len(ss[1]) or not all(v.isdigit() for s in ss for v in s): continue
        a,b=map(int,vals)
        if a==b: continue
        winner=0 if a>b else 1
        text=' '.join(f'{x}-{y}' for x,y in zip(ss[winner],ss[1-winner]))
        if sets_won(text)!=(max(a,b),min(a,b)): continue
        if not settlement_allowed(text,source_completed=True)[0]: continue
        ids=[re.fullmatch(r'/match-detail/\?id=(\d+)',h) for c in r['cells'] for h in c['links']]
        ids=[m[1] for m in ids if m]
        if len(ids)!=1: continue
        out.append({'detail_id':ids[0],'names':[x[0]['text'].strip() for x in names],
                    'winner':winner,'score_text':text,'totals':vals})
    return out

def parse_detail(html, row, day, player1, player2, tournament):
    p=_Cells();p.feed(html)
    if day.strftime('%d.%m.%Y') not in p.dates: return None
    headers=[r for r in p.rows if len(_cells(r,'plName'))==2 and len(_cells(r,'gScore'))==1]
    if len(headers)!=1: return None
    h=headers[0]; names=[c['text'].strip() for c in _cells(h,'plName')]
    if sorted([_tokens(n) for n in names])!=sorted([_tokens(player1),_tokens(player2)]): return None
    if _tokens(player1)==_tokens(player2): return None
    score=_cells(h,'gScore')[0]['text']
    m=re.fullmatch(r'\s*(\d+)\s*:\s*(\d+)\s*\(([^)]+)\)\s*',score)
    if not m or [m[1],m[2]]!=row['totals']: return None
    pairs=re.findall(r'(\d+)\s*-\s*(\d+)',m[3])
    text=' '.join(f'{a}-{b}' if row['winner']==0 else f'{b}-{a}' for a,b in pairs)
    if text!=row['score_text']: return None
    if not settlement_allowed(text,tournament=tournament,source_completed=True)[0]: return None
    winning=names[row['winner']]
    winner=player1 if _tokens(winning)==_tokens(player1) else player2
    loser=player2 if winner==player1 else player1
    return dict(event_id='te:'+row['detail_id'],winner_key=canonical_player_key(winner),
                loser_key=canonical_player_key(loser),winner_name=winner,loser_name=loser,
                score_text=text,event_date=datetime.combine(day,time(12),timezone.utc),
                tournament=tournament,source_completed=True,status_name='STATUS_FINAL',
                source_url=_BASE+'/match-detail/?id='+row['detail_id'])

def _short_matches(short, full):
    # Loose shortlist only. Detail page subsequently checks ALL full-name tokens.
    parts=canonical_player_key(short).split(); fullparts=canonical_player_key(full).split()
    return bool(parts and fullparts and all(p in fullparts or (len(p)==1 and any(x.startswith(p) for x in fullparts)) for p in parts))

async def _get(client,path):
    now=monotonic()
    if path in _cache and now-_cache[path][0]<_TTL: return _cache[path][1]
    r=await client.get(_BASE+path);r.raise_for_status()
    if len(_cache)>=512: _cache.pop(next(iter(_cache)))
    _cache[path]=(now,r.text)
    return r.text

async def get_explorer_results(pending):
    out={}; details=0
    days={}
    for pred in pending:
        when=pred.scheduled_at
        if isinstance(when,str): when=datetime.fromisoformat(when.replace('Z','+00:00'))
        if not when: continue
        for delta in (-2,-1,0,1,2): days.setdefault((when+timedelta(days=delta)).date(),[]).append(pred)
    async with httpx.AsyncClient(timeout=15,follow_redirects=True) as client:
        for day,preds in sorted(days.items(),reverse=True):
            try:
                html=await _get(client,f'/results/?type=all&year={day.year}&month={day.month:02d}&day={day.day:02d}')
                for r in parse_day(html):
                    candidates=[p for p in preds if (_short_matches(r['names'][0],p.player1) and _short_matches(r['names'][1],p.player2)) or (_short_matches(r['names'][1],p.player1) and _short_matches(r['names'][0],p.player2))]
                    if not candidates: continue
                    if details>=_MAX_DETAILS: return list(out.values())
                    detail=await _get(client,'/match-detail/?id='+r['detail_id']);details+=1
                    for p in candidates:
                        result=parse_detail(detail,r,day,p.player1,p.player2,p.tournament)
                        if result: out[(result['event_id'],result['winner_key'],result['loser_key'])]=result
            except (httpx.HTTPError,ValueError) as exc:
                logger.warning('Tennis Explorer archive %s unavailable (%s)',day,type(exc).__name__)
    return list(out.values())
