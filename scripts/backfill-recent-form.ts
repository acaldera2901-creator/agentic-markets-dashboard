/** Offline only. Requires PR560/562's shared form helpers.
 * npx tsx scripts/backfill-recent-form.ts input.json [--write NEW_OUTPUT_DIRECTORY]
 * Default prints a dry-run report. --write creates review artifacts, never connects
 * to a DB. Input must be a fresh DB export plus freshly retrieved source snapshots.
 * histories: normalized fd.org FINISHED matches; summer_snapshot: shipped snapshot
 * with per-league fetched_at (or generated_at). See BackfillInput below.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { computeTeamForms, computeCrossCompetitionForms } from '../lib/pi-rating';
import { buildModel } from '../lib/poisson-model';
import { isSummerLeague, matchModelTeam } from '../lib/summer-leagues';

type Result = { homeTeam: string; awayTeam: string; homeGoals: number; awayGoals: number };
type Row = { match_id: string; league: string; home_team: string; away_team: string; kickoff: string; computed_at: string; enrichment: Record<string, unknown> };
export type BackfillInput = {
  captured_at: string;
  histories: { code: string; fetched_at: string; matches: (Result & { utcDate: string })[] }[];
  summer_snapshot?: { generated_at: string; leagues: Record<string, { fetched_at?: string; matches: (Result & { date: string })[] }> };
  rows: Row[];
};
type Forms = { form_home?: unknown; form_away?: unknown };
type Change = { match_id: string; computed_at: string; before: Forms; after: Forms };
const fdCodes = new Set(['PL', 'SA', 'PD', 'BL1', 'FL1', 'CL']);
const quote = (s: string) => "E'" + s.replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
function fresh(timestamp: string, now: number, label: string) {
  const t = Date.parse(timestamp);
  if (!Number.isFinite(t) || t > now || now - t > 6 * 3600000) throw new Error(`${label}: fresh input required (maximum age 6 hours)`);
}
function sql(changes: Change[], generatedAt: string, rollback = false): string {
  const data = changes.map(c => ({ ...c, before: rollback ? c.after : c.before, after: rollback ? c.before : c.after }));
  let tag = '$backfill$';
  while (JSON.stringify(data).includes(tag)) tag = tag.replace('$backfill', '$backfill_');
  return `-- REVIEW ONLY. Requires fresh inputs and explicit production authorization.
-- Only match_predictions is changed: verify downstream unified sync separately.
BEGIN;
DO ${tag}
DECLARE changed integer;
BEGIN
  IF transaction_timestamp() < ${quote(generatedAt)}::timestamptz - interval '5 minutes' THEN
    RAISE EXCEPTION 'Database clock predates plan: regenerate using DB time';
  END IF;
  IF transaction_timestamp() > ${quote(generatedAt)}::timestamptz + interval '30 minutes' THEN
    RAISE EXCEPTION 'Plan expired: regenerate from fresh inputs';
  END IF;
  WITH targets AS (
    SELECT * FROM jsonb_to_recordset(${quote(JSON.stringify(data))}::jsonb)
      AS x(match_id text, computed_at timestamptz, before jsonb, after jsonb)
  ), updated AS (
    UPDATE public.match_predictions p
    SET enrichment = (p.enrichment - 'form_home' - 'form_away') || x.after
    FROM targets x
    WHERE p.match_id = x.match_id AND p.kickoff > transaction_timestamp()
      AND p.computed_at = x.computed_at
      AND p.enrichment->'form_home' IS NOT DISTINCT FROM x.before->'form_home'
      AND p.enrichment->'form_away' IS NOT DISTINCT FROM x.before->'form_away'
    RETURNING p.match_id
  ) SELECT count(*) INTO changed FROM updated;
  IF changed <> ${changes.length} THEN
    RAISE EXCEPTION 'Backfill conflict: expected ${changes.length} rows, updated %; transaction aborted', changed;
  END IF;
END
${tag};
COMMIT;
`;
}
export function generateRecentFormBackfill(input: BackfillInput, nowIso = new Date().toISOString()) {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) throw new Error('Invalid generation time');
  fresh(input.captured_at, now, 'DB rows');
  const seen = new Set<string>();
  const sources: {code:string; fetched_at:string; last_match_at:string|null; scope:string}[]=[];
  for (const h of input.histories) {
    if (!fdCodes.has(h.code) || seen.has(h.code)) throw new Error(`Invalid or duplicate source ${h.code}`);
    seen.add(h.code); fresh(h.fetched_at,now,h.code);
    validateMatches(h.matches,now);
    sources.push({code:h.code,fetched_at:h.fetched_at,last_match_at:lastDate(h.matches.map(m=>m.utcDate)),scope:'league/CL union, not all competitions'});
  }
  if (input.rows.some(r => !isSummerLeague(r.league) && Date.parse(r.kickoff)>now)) {
    for (const code of fdCodes) if (!seen.has(code)) throw new Error(`Missing source ${code}: export all six fd.org histories`);
  }
  const cross = computeCrossCompetitionForms(input.histories.map(h=>h.matches), now);
  const summer = new Map<string,{forms:ReturnType<typeof computeTeamForms>; roster:string[]}>();
  const changes: Change[]=[]; const backup: Row[]=[]; const skipped: {match_id:string;reason:string}[]=[];
  const ids = new Set<string>();
  for (const row of input.rows) {
    if (!row.match_id || ids.has(row.match_id)) throw new Error('Invalid or duplicate row identity');
    ids.add(row.match_id);
    if (!Number.isFinite(Date.parse(row.kickoff)) || !Number.isFinite(Date.parse(row.computed_at))) throw new Error(`Invalid row timestamp: ${row.match_id}`);
    if (Date.parse(row.kickoff)<=now) { skipped.push({match_id:row.match_id,reason:'already started'}); continue; }
    if (!row.enrichment || typeof row.enrichment!=='object' || Array.isArray(row.enrichment)) throw new Error(`Invalid enrichment: ${row.match_id}`);
    let forms=cross, home=row.home_team, away=row.away_team;
    if (isSummerLeague(row.league)) {
      if (!summer.has(row.league)) {
        const snapshot=input.summer_snapshot, h=snapshot?.leagues[row.league];
        if (!h || !snapshot) throw new Error(`Missing source ${row.league}`);
        const fetched=h.fetched_at ?? snapshot.generated_at; fresh(fetched,now,row.league);
        const matches=h.matches.map(m=>({...m,utcDate:m.date})); validateMatches(matches,now);
        // Same source ordering as fetchSummerHistory; reject unsorted snapshots.
        if (matches.some((m,i)=>i>0 && Date.parse(m.utcDate)<Date.parse(matches[i-1].utcDate))) throw new Error(`Unsorted source ${row.league}`);
        const model=buildModel(matches);
        if (!model) throw new Error(`Insufficient source ${row.league}`);
        summer.set(row.league,{forms:computeTeamForms(matches),roster:Object.keys(model.strengths)});
        sources.push({code:row.league,fetched_at:fetched,last_match_at:lastDate(matches.map(m=>m.utcDate)),scope:'league only'});
      }
      const s=summer.get(row.league)!;forms=s.forms;home=matchModelTeam(home,s.roster)??'';away=matchModelTeam(away,s.roster)??'';
    } else if (!seen.has(row.league)) throw new Error(`Missing source ${row.league}`);
    if (!forms[home]?.form || !forms[away]?.form) throw new Error(`Unmatched or empty form: ${row.match_id}`);
    const before:Forms={};
    for (const key of ['form_home','form_away'] as const) if (Object.hasOwn(row.enrichment,key)) before[key]=row.enrichment[key];
    const after={form_home:forms[home].form,form_away:forms[away].form};
    if (before.form_home===after.form_home && before.form_away===after.form_away) {skipped.push({match_id:row.match_id,reason:'unchanged'});continue;}
    changes.push({match_id:row.match_id,computed_at:row.computed_at,before,after});backup.push(row);
  }
  return {report:{generated_at:nowIso,coverage:'Available league + CL histories; snapshot leagues league only; not all competitions',expected_count:changes.length,sources,skipped},changes,backup,applySql:sql(changes,nowIso),rollbackSql:sql(changes,nowIso,true)};
}
function lastDate(dates:string[]) { return dates.length ? dates.reduce((a,b)=>Date.parse(a)>Date.parse(b)?a:b) : null; }
function validateMatches(matches:(Result & {utcDate:string})[],now:number) {
  for (const m of matches) if (!m.homeTeam || !m.awayTeam || !Number.isFinite(Date.parse(m.utcDate)) || Date.parse(m.utcDate)>now || ![m.homeGoals,m.awayGoals].every(g=>Number.isInteger(g)&&g>=0)) throw new Error('Invalid finished-match source');
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [file,flag,directory,...extra]=process.argv.slice(2);
  if (!file || extra.length || (flag && (flag!=='--write'||!directory))) throw new Error('Usage: tsx scripts/backfill-recent-form.ts input.json [--write NEW_OUTPUT_DIRECTORY]');
  const plan=generateRecentFormBackfill(JSON.parse(readFileSync(file,'utf8')) as BackfillInput);
  if (flag==='--write') {
    mkdirSync(directory,{recursive:false});
    for (const [name,value] of Object.entries({'report.json':JSON.stringify(plan.report,null,2),'backup.json':JSON.stringify(plan.backup,null,2),'changes.json':JSON.stringify(plan.changes,null,2),'apply.sql':plan.applySql,'rollback.sql':plan.rollbackSql})) writeFileSync(resolve(directory,name),value,{flag:'wx',mode:0o600});
  }
  console.log(JSON.stringify(plan.report,null,2));
}
