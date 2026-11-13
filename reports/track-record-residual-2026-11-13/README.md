# TR-1113 — residual result recovery, 13 November 2026

Andrea authorized publication and recovery with APPROVE #TR-1113, then requested an audit of the remaining 1,066 unresolved and 59 unverified events and alternative-source retries.

## Scope and measured results

The new audit snapshot contained 1,067 unresolved events (one additional event had entered the population), including 1,058 tennis and 9 football, plus the same 59 unverified events (46 tennis, 13 football). Counts use the public `trackRecordPopulation`/`dedupeShownPicks` functions, not raw table counts.

149 public rows recovered/verified:
- 132 tennis: 61 from existing BetConstruct results, 71 from Tennis Explorer's dated archive plus full-name/date/score confirmation on its match-detail pages. Includes 43 previously unverified grades and 89 previously missing results.
- 13 football: ESPN archive confirms 5 played results and 8 cancelled/postponed events. One played result replaces an obsolete suspended `void`; postponed events retain the existing >48h void rule.
- 4 individually reviewed corrections: Navarro's old winning label corrected to a loss against McNally; three existing voids independently confirmed (Levante–Athletic, Purcell–Bayldon, Putintseva–Shao). Evidence and expected original values are in `reviewed-corrections.json`.

All original 59 unverified events are now verified. Of the 1,067 original missing events, 90 were recovered; 977 remain without a confirmed grade. New matches can change live counters independently of this fixed audit cohort.

## Why results were missing

The partner audit read 145 dated archives and classified every residual tennis event (`tennis-audit.json`). Initial categories before this recovery:
- 618 missing tennis events had a nearby partner record but no usable winner/score.
- 135 had no player-pair match; 59 only matches outside the permitted date window.
- Remaining events included incomplete scores/retirements, distinct ambiguous events, and repeated identical event records at adjacent date boundaries.
- 40 of the 46 unverified tennis events already had complete confirming partner results, but the recovery query only selected null/unresolved outcomes.

The provider does not expose a reliable retirement/walkover flag. A partial score is not turned into a final result. Evans–Ma (14 October) was cancelled; Badenhorst–Braswell (14 October) ended by retirement, not a singles super-tiebreak. These examples explain why lowering score validation would invent results.

Sources considered: ESPN, BetConstruct/Ybets, Tennis Explorer, official club announcements, Tennis Abstract, LiveScore and Sofascore. Direct SofaScore API requests returned HTTP 403; official ITF/ATP endpoints probed were protected. Those are not advertised as working automatic integrations. Tennis Explorer was tested live and integrated; it confirms only complete singles, not inferred retirement or doubles results.

## Automatic changes

- Tennis historical recovery also revisits unverified won/lost labels. A conflicting result is logged for review, never silently overwritten.
- Identical copies of an event ID and all its settlement evidence are collapsed. Distinct IDs or conflicting snapshots remain ambiguous.
- Tennis Explorer fallback validates both full identities, source date, final set counts and agreement between archive and detail page. Same bounded two-day window as the partner fallback; separate matches remain ambiguous. Catherine/Caty McNally is a source-local explicit alias supported by WTA player 325725.
- Football has an independent rotating 25-row historical recovery loop, using ESPN archive IDs or exact-date team matching, checking 90-minute final states, and preserving the existing >48h postponement rule.
- Both public grades and append-only sealed corrections commit atomically. Real settled tennis grades are not overwritten by the automatic recovery. No Elo/model retraining or money metrics are replayed.
- Bounded requests, timeouts and caches; source failure preserves results already obtained from primary sources. The result-source registry includes the new tennis fallback.

## Verification

189 targeted Python tests passed; 47 TypeScript/React/API/Postgres integration tests passed; TypeScript typecheck passed. SQL integration verifies differing public/sealed picks, obsolete void correction, append-only revisions, stale-plan guards and idempotency.

`tennis-plans.json`, initial/second apply logs, `football-plans.json`, `reviewed-corrections.json`, `alternative-evidence.json`, `database-verification.json` and `live-verification.json` retain evidence and measured effects. The reviewed correction script defaults to dry-run and requires explicit `--apply`.
