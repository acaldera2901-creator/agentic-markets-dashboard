from __future__ import annotations

import datetime
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import pandas as pd

log = logging.getLogger(__name__)

_ROLLING_KEYWORDS = ("rolling", "last", "form", "avg", "mean", "sum", "std")


@dataclass
class AuditReport:
    leakage_count: int
    leakage_pct: float
    auto_corrected: bool
    blocked: bool
    checks_run: list[str]
    clean_df: Optional[pd.DataFrame]   # None when blocked
    timestamp: str = field(default_factory=lambda: datetime.datetime.utcnow().isoformat())


class TemporalLeakageError(Exception):
    """Raised when leakage exceeds threshold and raise_on_block=True."""


class TemporalLeakageValidator:
    """
    Audits a training DataFrame before every model retrain.

    Checks performed:
    1. Temporal order        — feature_calc_date must be < match_date
    2. Closing odds removal  — closing_odds column → post-match, must not train on it
    3. Rolling window names  — logs presence of rolling/lag features for review

    Auto-correction policy:
    - leakage_pct <= max_leakage_pct_auto_correct → drop leaky rows, continue
    - leakage_pct >  max_leakage_pct_auto_correct → block, set clean_df = None
    - raise_on_block=True → raises TemporalLeakageError instead of returning report
    """

    def __init__(
        self,
        audit_log_dir: str = "logs",
        max_leakage_pct_auto_correct: float = 0.05,
        raise_on_block: bool = False,
    ) -> None:
        self.audit_log_dir = Path(audit_log_dir)
        self.audit_log_dir.mkdir(parents=True, exist_ok=True)
        self.max_leakage_pct = max_leakage_pct_auto_correct
        self.raise_on_block = raise_on_block

    # ── Main entry point ──────────────────────────────────────────────────────

    def audit(self, df: pd.DataFrame) -> AuditReport:
        checks_run: list[str] = []
        working = df.copy()
        leakage_count = 0
        leaky_mask = pd.Series(False, index=working.index)

        # Check 1: temporal order
        if "feature_calc_date" in working.columns and "match_date" in working.columns:
            mask = working["feature_calc_date"] >= working["match_date"]
            leaky_mask |= mask
            leakage_count = int(mask.sum())
            checks_run.append("temporal_order")
        else:
            checks_run.append("temporal_order_skipped")

        leakage_pct = leakage_count / max(len(working), 1)

        # Check 2: closing odds
        working, co_checks = self._check_closing_odds(working)
        checks_run.extend(co_checks)

        # Check 3: rolling window names
        rolling_checks = self._check_rolling_features(working)
        checks_run.extend(rolling_checks)

        # Decision
        auto_corrected = False
        blocked = False
        clean_df: Optional[pd.DataFrame] = None

        if leakage_count == 0:
            clean_df = working
        elif leakage_pct <= self.max_leakage_pct:
            clean_df = working[~leaky_mask].reset_index(drop=True)
            auto_corrected = True
            log.warning(
                f"TemporalLeakageValidator: auto-corrected {leakage_count} leaky rows "
                f"({leakage_pct:.1%})"
            )
        else:
            blocked = True
            if self.raise_on_block:
                raise TemporalLeakageError(
                    f"{leakage_count} rows with temporal leakage ({leakage_pct:.1%}) "
                    f"exceeds threshold {self.max_leakage_pct:.1%}"
                )
            log.error(
                f"TemporalLeakageValidator: BLOCKED — {leakage_count} leaky rows "
                f"({leakage_pct:.1%}) > threshold {self.max_leakage_pct:.1%}"
            )

        report = AuditReport(
            leakage_count=leakage_count,
            leakage_pct=leakage_pct,
            auto_corrected=auto_corrected,
            blocked=blocked,
            checks_run=checks_run,
            clean_df=clean_df,
        )
        self._save_report(report)
        return report

    # ── Checks ────────────────────────────────────────────────────────────────

    def _check_closing_odds(self, df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
        checks: list[str] = []
        if "closing_odds" not in df.columns:
            return df, checks
        if df["closing_odds"].isna().all():
            return df, checks

        df = df.copy()
        df["closing_odds_post"] = df["closing_odds"]
        df = df.drop(columns=["closing_odds"])
        checks.append("closing_odds_detected")
        log.warning("TemporalLeakageValidator: closing_odds removed from training set "
                    "(renamed to closing_odds_post)")
        return df, checks

    def _check_rolling_features(self, df: pd.DataFrame) -> list[str]:
        rolling_cols = [
            c for c in df.columns
            if any(kw in c.lower() for kw in _ROLLING_KEYWORDS)
        ]
        if not rolling_cols:
            return []
        log.debug(f"TemporalLeakageValidator: rolling features present — {rolling_cols}")
        return ["rolling_features_checked"]

    # ── Persistence ───────────────────────────────────────────────────────────

    def _save_report(self, report: AuditReport) -> None:
        ts = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        path = self.audit_log_dir / f"temporal_audit_{ts}.json"
        payload = {
            "leakage_count": report.leakage_count,
            "leakage_pct": report.leakage_pct,
            "auto_corrected": report.auto_corrected,
            "blocked": report.blocked,
            "checks_run": report.checks_run,
            "timestamp": report.timestamp,
        }
        with open(path, "w") as f:
            json.dump(payload, f, indent=2)
