"""
Unit tests for learning.temporal_validator.TemporalLeakageValidator

Audits training DataFrames BEFORE every retrain.
Detects and (where possible) auto-corrects temporal leakage.

Run: pytest tests/test_temporal_validator.py -v
"""
import datetime
import json
import os
import tempfile

import pandas as pd
import pytest

from learning.temporal_validator import (
    TemporalLeakageValidator,
    TemporalLeakageError,
    AuditReport,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def make_clean_df(n=20):
    """DataFrame with no leakage: feature_calc_date strictly before match_date."""
    today = datetime.date.today()
    rows = []
    for i in range(n):
        match_date = today + datetime.timedelta(days=i + 1)
        calc_date  = today + datetime.timedelta(days=i)      # always 1 day before
        rows.append({
            "match_id": f"m-{i:03d}",
            "match_date": pd.Timestamp(match_date),
            "feature_calc_date": pd.Timestamp(calc_date),
            "home_xg_rolling5": 1.5 + i * 0.1,
            "away_xg_rolling5": 1.2 + i * 0.05,
            "opening_odds_home": 2.1,
            "home_form_last5": 0.6,
            "pi_rating_home": 1500.0,
        })
    return pd.DataFrame(rows)


def make_leaky_df(n=20, leaky_pct=0.10):
    """DataFrame where leaky_pct rows have feature_calc_date >= match_date."""
    df = make_clean_df(n)
    n_leaky = max(1, int(n * leaky_pct))
    # Make the first n_leaky rows leaky
    df.loc[:n_leaky - 1, "feature_calc_date"] = df.loc[:n_leaky - 1, "match_date"]
    return df


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def validator(tmp_path):
    return TemporalLeakageValidator(
        audit_log_dir=str(tmp_path),
        max_leakage_pct_auto_correct=0.05,
    )


# ── AuditReport structure ─────────────────────────────────────────────────────

class TestAuditReportStructure:
    def test_audit_returns_report(self, validator):
        df = make_clean_df()
        report = validator.audit(df)
        assert isinstance(report, AuditReport)

    def test_report_has_leakage_count(self, validator):
        df = make_clean_df()
        report = validator.audit(df)
        assert hasattr(report, "leakage_count")

    def test_report_has_leakage_pct(self, validator):
        report = validator.audit(make_clean_df())
        assert hasattr(report, "leakage_pct")

    def test_report_has_auto_corrected_flag(self, validator):
        report = validator.audit(make_clean_df())
        assert hasattr(report, "auto_corrected")

    def test_report_has_blocked_flag(self, validator):
        report = validator.audit(make_clean_df())
        assert hasattr(report, "blocked")

    def test_report_has_checks_run(self, validator):
        report = validator.audit(make_clean_df())
        assert hasattr(report, "checks_run")

    def test_report_has_clean_df(self, validator):
        report = validator.audit(make_clean_df())
        assert hasattr(report, "clean_df")


# ── Check 1: temporal order ───────────────────────────────────────────────────

class TestTemporalOrderCheck:
    def test_clean_df_zero_leakage(self, validator):
        report = validator.audit(make_clean_df(20))
        assert report.leakage_count == 0

    def test_clean_df_not_blocked(self, validator):
        report = validator.audit(make_clean_df(20))
        assert report.blocked is False

    def test_leaky_df_detects_violations(self, validator):
        df = make_leaky_df(20, leaky_pct=0.10)  # 2 leaky rows
        report = validator.audit(df)
        assert report.leakage_count == 2

    def test_leakage_pct_calculation(self, validator):
        df = make_leaky_df(100, leaky_pct=0.04)
        report = validator.audit(df)
        assert report.leakage_pct == pytest.approx(0.04, abs=0.01)

    def test_feature_calc_date_strictly_after_match_date_is_leaky(self, validator):
        df = make_clean_df(10)
        # Set calc_date = match_date (same day → leakage)
        df.loc[0, "feature_calc_date"] = df.loc[0, "match_date"]
        report = validator.audit(df)
        assert report.leakage_count >= 1

    def test_feature_calc_date_one_second_after_is_leaky(self, validator):
        df = make_clean_df(5)
        df.loc[0, "feature_calc_date"] = df.loc[0, "match_date"] + pd.Timedelta(seconds=1)
        report = validator.audit(df)
        assert report.leakage_count >= 1


# ── Check 2: closing odds removal ────────────────────────────────────────────

class TestClosingOddsCheck:
    def test_closing_odds_detected_as_leakage(self, validator):
        df = make_clean_df(10)
        df["closing_odds"] = 1.95
        report = validator.audit(df)
        assert "closing_odds_detected" in report.checks_run

    def test_closing_odds_column_removed_from_clean_df(self, validator):
        df = make_clean_df(10)
        df["closing_odds"] = 1.95
        report = validator.audit(df)
        assert "closing_odds" not in report.clean_df.columns

    def test_closing_odds_renamed_to_post(self, validator):
        df = make_clean_df(10)
        df["closing_odds"] = 1.95
        report = validator.audit(df)
        # Column preserved under _post suffix for analysis, just not in training
        assert "closing_odds_post" in report.clean_df.columns

    def test_no_closing_odds_no_warning(self, validator):
        df = make_clean_df(10)
        report = validator.audit(df)
        assert "closing_odds_detected" not in report.checks_run

    def test_null_closing_odds_ignored(self, validator):
        df = make_clean_df(10)
        df["closing_odds"] = None
        report = validator.audit(df)
        assert "closing_odds_detected" not in report.checks_run


# ── Auto-correction policy ────────────────────────────────────────────────────

class TestAutoCorrectionPolicy:
    def test_small_leakage_auto_corrected(self, validator):
        # 4% leakage < 5% threshold → auto-correct
        df = make_leaky_df(100, leaky_pct=0.04)
        report = validator.audit(df)
        assert report.auto_corrected is True
        assert report.blocked is False

    def test_large_leakage_blocks_retrain(self, validator):
        # 10% leakage > 5% threshold → block
        df = make_leaky_df(100, leaky_pct=0.10)
        report = validator.audit(df)
        assert report.blocked is True

    def test_large_leakage_raises_when_strict(self, tmp_path):
        validator_strict = TemporalLeakageValidator(
            audit_log_dir=str(tmp_path),
            max_leakage_pct_auto_correct=0.05,
            raise_on_block=True,
        )
        df = make_leaky_df(100, leaky_pct=0.10)
        with pytest.raises(TemporalLeakageError):
            validator_strict.audit(df)

    def test_auto_corrected_df_has_no_leakage(self, validator):
        df = make_leaky_df(100, leaky_pct=0.04)
        report = validator.audit(df)
        assert report.auto_corrected is True
        # Re-check the clean df
        leaky_in_clean = report.clean_df[
            report.clean_df["feature_calc_date"] >= report.clean_df["match_date"]
        ]
        assert len(leaky_in_clean) == 0

    def test_blocked_report_clean_df_is_none(self, validator):
        df = make_leaky_df(100, leaky_pct=0.10)
        report = validator.audit(df)
        assert report.blocked is True
        assert report.clean_df is None

    def test_zero_leakage_not_auto_corrected(self, validator):
        report = validator.audit(make_clean_df(20))
        assert report.auto_corrected is False


# ── Audit log persistence ─────────────────────────────────────────────────────

class TestAuditLogPersistence:
    def test_audit_saves_json_report(self, validator, tmp_path):
        validator.audit(make_clean_df(10))
        log_files = list(tmp_path.glob("temporal_audit_*.json"))
        assert len(log_files) == 1

    def test_audit_log_contains_required_fields(self, validator, tmp_path):
        validator.audit(make_clean_df(10))
        log_file = list(tmp_path.glob("temporal_audit_*.json"))[0]
        with open(log_file) as f:
            data = json.load(f)
        for key in ("leakage_count", "leakage_pct", "auto_corrected",
                    "blocked", "timestamp"):
            assert key in data, f"missing: {key}"

    def test_second_audit_creates_second_file(self, validator, tmp_path):
        validator.audit(make_clean_df(10))
        validator.audit(make_clean_df(10))
        log_files = list(tmp_path.glob("temporal_audit_*.json"))
        assert len(log_files) == 2


# ── Rolling window check ──────────────────────────────────────────────────────

class TestRollingWindowCheck:
    def test_rolling_features_detected(self, validator):
        df = make_clean_df(10)
        # Already has home_xg_rolling5
        report = validator.audit(df)
        assert "rolling_features_checked" in report.checks_run

    def test_rolling_feature_names_in_report(self, validator):
        df = make_clean_df(10)
        df["away_form_rolling3"] = 0.5
        report = validator.audit(df)
        assert "rolling_features_checked" in report.checks_run

    def test_df_without_rolling_features_skips_check(self, validator):
        df = make_clean_df(10)
        df = df.drop(columns=["home_xg_rolling5", "away_xg_rolling5",
                               "home_form_last5"])
        report = validator.audit(df)
        # No rolling features → check not applicable
        assert "rolling_features_checked" not in report.checks_run


# ── Missing column handling ───────────────────────────────────────────────────

class TestMissingColumns:
    def test_missing_feature_calc_date_skips_temporal_check(self, validator):
        df = make_clean_df(10).drop(columns=["feature_calc_date"])
        report = validator.audit(df)
        # Cannot do temporal check → leakage_count = 0, not blocked
        assert report.leakage_count == 0
        assert "temporal_order_skipped" in report.checks_run

    def test_missing_match_date_skips_temporal_check(self, validator):
        df = make_clean_df(10).drop(columns=["match_date"])
        report = validator.audit(df)
        assert "temporal_order_skipped" in report.checks_run
