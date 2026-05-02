"""
Sentio – Rule-based crisis detection.

Returns structured hotlines data separately from the empathetic chat response
so the frontend can display them in a modal without cluttering the chat bubble.

Crisis events are logged to Firestore via the rule engine (which has access
to user_id and session_id) — crisis_detection itself stays stateless.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from loguru import logger

_BOUNDARIES_PATH = Path(__file__).parent.parent / "config" / "sentio_boundaries.json"

CRISIS_PATTERNS: list[str] = [
    r"\bsuicid\w*\b",
    r"\bkill\s+my\s*self\b",
    r"\bend\s+my\s+life\b",
    r"\bwant\s+to\s+die\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bwish\s+i\s+was\s+dead\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bbetter\s+off\s+without\s+me\b",
    r"\bself[\s\-]?harm\b",
    r"\bcut\s+(my\s*)?(wrist|arm|self)\b",
    r"\bhurt\s+my\s*self\b",
    r"\bself[\s\-]?injur\w*\b",
    r"\boverdos\w*\b",
    r"\bhanging\s+my\s*self\b",
    r"\bjump\s+off\b",
    r"\bslit\s+(my\s*)?(wrist|throat)\b",
]

_COMPILED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in CRISIS_PATTERNS
]


@lru_cache(maxsize=1)
def _load_boundaries() -> dict:
    try:
        with open(_BOUNDARIES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        logger.warning(f"[CrisisDetection] Could not load boundaries: {exc}")
        return {}


def _get_country_from_timezone(timezone: str | None) -> str:
    if not timezone:
        return "DEFAULT"
    b = _load_boundaries()
    tz_map: dict = b.get("timezone_to_country", {})
    return tz_map.get(timezone, "DEFAULT")


def _get_crisis_contacts(timezone: str | None) -> dict:
    """Return raw crisis contacts dict for the user's country."""
    b = _load_boundaries()
    contacts: dict = b.get("crisis_contacts", {})
    country_code = _get_country_from_timezone(timezone)
    return contacts.get(country_code) or contacts.get("DEFAULT", {})


# Empathetic chat response — NO hotlines in here
_EMPATHETIC_RESPONSE = (
    "What you've just shared takes courage, and I'm really glad you told me. "
    "You are not alone in this — and what you're feeling right now is not permanent, "
    "even when it feels that way. "
    "I'm still here with you. Would you like to talk about what's been going on?"
)


@dataclass
class CrisisResult:
    is_crisis: bool
    matched_pattern: str | None = None
    response: str | None = None
    # Structured hotlines for frontend modal — NOT embedded in response
    crisis_contacts: dict = field(default_factory=dict)


def detect_crisis(user_message: str, timezone: str | None = None) -> CrisisResult:
    for pattern in _COMPILED_PATTERNS:
        if pattern.search(user_message):
            return CrisisResult(
                is_crisis=True,
                matched_pattern=pattern.pattern,
                response=_EMPATHETIC_RESPONSE,
                crisis_contacts=_get_crisis_contacts(timezone),
            )
    return CrisisResult(is_crisis=False)