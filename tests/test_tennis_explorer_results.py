from datetime import date
from core.tennis_explorer_results import parse_day, parse_detail

DAY = '''<tr id="r1"><td class="t-name"><a href="/player/doe/">Doe J.</a></td><td class="result">2</td><td class="score">6</td><td class="score">7<sup>4</sup></td><td><a href="/match-detail/?id=123">info</a></td></tr><tr id="r1b"><td class="t-name"><a href="/player/roe/">Roe A.</a></td><td class="result">0</td><td class="score">4</td><td class="score">6</td></tr>'''
DETAIL = '''<span class="upper">14.10.2026</span><table class="result gDetail"><tr><th class="plName"><a>Doe Jane</a></th><td class="gScore">2 : 0<br><span>(6-4, 7-6)</span></td><th class="plName"><a>Roe Alice</a></th></tr></table>'''

def test_day_parses_pair_score_ignoring_tiebreak_superscript():
    rs = parse_day(DAY)
    assert len(rs)==1
    assert rs[0]['score_text']=='6-4 7-6'
    assert rs[0]['detail_id']=='123'

def test_detail_requires_full_identity_and_matching_day():
    r=parse_day(DAY)[0]
    assert parse_detail(DETAIL,r,date(2026,10,14),'Jane Doe','Alice Roe','WTA') is not None
    assert parse_detail(DETAIL,r,date(2026,10,14),'Joan Doe','Alice Roe','WTA') is None
    assert parse_detail(DETAIL,r,date(2026,10,15),'Jane Doe','Alice Roe','WTA') is None

def test_incomplete_score_and_walkover_never_become_final():
    assert parse_day(DAY.replace('>7<sup>4</sup>','>1<sup>4</sup>'))==[]
    assert parse_day(DAY.replace('>2</td>','>w/o</td>'))==[]

def test_detail_score_disagreement_is_rejected():
    assert parse_detail(DETAIL.replace('6-4, 7-6','6-3, 7-6'),parse_day(DAY)[0],date(2026,10,14),'Jane Doe','Alice Roe','WTA') is None

def test_official_caty_catherine_alias_is_specific():
    from core.tennis_explorer_results import _tokens
    assert _tokens('Catherine McNally')==_tokens('McNally Caty')
    assert _tokens('Catherine Harrison')!=_tokens('Caty Harrison')

def test_different_events_on_same_day_are_not_collapsed():
    second=DAY.replace('r1','r2').replace('id=123','id=456')
    assert len(parse_day(DAY+second))==2
