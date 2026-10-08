# fixq — QA-REPORT-4 Q3–Q10 (v3c only)

Branch `betredge/v3c-fixq` from `betredge/v3c-final7` (29d9765a). Not touched: `app/layout.tsx`, `/plans`, the live site (Q1, Q2 go with the Base→Pro migration).

## Fixed
- **Q3** live banner (11 languages): «Matches in play: live scores, pre-match numbers» (was «prices moving now»). Books page label «Live prices on the board» → «Current prices on the board» (in-play wording in 10 languages for a pre-match feed).
- **Q4** football «Market only» because the model is > 25 pp away (model_far): `estimateShown()` is false under any «Market only». Page: no ESTIMATE box, no arrow, estimate column «—», no «fair price», no «largest gap», no fair line in the tape. Board: no estimate, no «Draw ±0.0» sub-line, the reason is «the model differs too much to show» (not the price_far sentence). OG and price check were already clean. Regression: `components/v3c/fixq.test.tsx` (Napoli shape).
- **Q5** tools: EV and Kelly (board table, prefill, preview, prefill note) on the best linked book price (`best_price` with its link), never the composite; no linked book → «—». Price column shows the price used; note under the table. Heidenheim shape: 1.82 → EV −3.5%, not +6.7% at 1.94.
- **Q6** a sealed tennis Elo (model_tempered) with no market: one label («Model only») on row and gap column; the seal says «The sealed number is our Elo model», never «market-based» (row, page header, page step).
- **Q9** price age «50 h old» (was «50:08 old (hh:mm)»); the API's technical `gap_null_reason` replaced by a sentence in the visitor's language; the gap bar prints the same one-decimal text as the table.

## Left (declared)
- **Q7** live count (home 7 vs board 5) and «pre-match» beside live tennis rows: count logic spans home/board/live feed, not a one-line fix.
- **Q8** tennis match CLS 0.124 (Struff): not reproduced on the mock (tennis pages CLS 0); needs the live payload.
- **Q10** info only.

## New i18n keys (11 languages, REVIEW-NATIVE for the 9 non EN/IT)
- `lib/v3c/fixq-copy.ts`: `sealedWhyModel`, `gapNoSealMarket`, `gapNotSealed`, `gapIsMarket` (registered in `lib/v3c/i18n-parity.test.ts`).
- `lib/i18n/v3c-tools/*`: `tool.bestPriceNote`.
- Changed: `banner-copy` `live.title`, `pages-copy` `books.live`, `final7-copy` `staleAged`, `fixdata3-copy` `staleNote`/`priceAge` (no «(hh:mm)»).

## Shared files touched
`components/v3c/Nastro.tsx` (gap text), `scripts/v3c/mock-db.ts` (`MOCK_FIXQ=1`: Napoli, Heidenheim), `lib/v3c/i18n-parity.test.ts` (one entry).
