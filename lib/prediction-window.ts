// Rolling publication window (#019, APPROVE Andrea 2026-06-06).
//
// Predictions are computed and served only for the next N days, refreshed
// daily: closer matches carry more information (squads, injuries, mature
// markets), so the served percentages are stronger than publishing the whole
// slate at once with weak distant edges. ALL sports — current and future —
// must respect this window. Keep in sync with config/settings.py
// (PREDICTION_WINDOW_DAYS).
export const PREDICTION_WINDOW_DAYS = 10;
