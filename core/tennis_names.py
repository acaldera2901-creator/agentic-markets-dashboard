"""Shared tennis player name cleanup.

Feeds disagree on punctuation and sometimes include seeds, countries or score
suffixes. Keep display names readable, but use canonical keys for lookups.
"""
from __future__ import annotations

import re
import unicodedata

_SEEDING = re.compile(r"\(\d+\)\s*")
_NATION = re.compile(r"\([A-Z]{2,3}\)")
_SCORE_SUFFIX = re.compile(
    r"\s+\d+(?:[-–]\d+)?(?:\(\d+\))?(?:\s+\d+(?:[-–]\d+)?(?:\(\d+\))?)*(?:\s+(?:ret|w/o|wo|walkover))?\s*$",
    re.IGNORECASE,
)
_PUNCT = re.compile(r"[^a-z0-9\s]")


def clean_player_name(raw: str | None) -> str:
    """Return a display-safe player name without provider noise."""
    if not raw:
        return ""
    name = str(raw)
    name = _SEEDING.sub("", name)
    name = _NATION.sub("", name)
    name = _SCORE_SUFFIX.sub("", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip(" -–")


def canonical_player_key(raw: str | None) -> str:
    """Return a provider-insensitive key for Elo/ranking lookup."""
    name = clean_player_name(raw)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = name.lower().replace("-", " ")
    name = _PUNCT.sub(" ", name)
    return re.sub(r"\s+", " ", name).strip()
