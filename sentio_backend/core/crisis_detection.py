"""
Sentio – Rule-based crisis detection.

Scans user input for suicide / self-harm keywords and phrases.
If a match is found, the normal LLM pipeline is bypassed entirely
and a pre-written emergency response is returned immediately.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ── Crisis keyword / phrase list ──────────────────────────────────────────────
CRISIS_PATTERNS: list[str] = [
    # Suicidal ideation
    r"\bsuicid\w*\b",
    r"\bkill\s+my\s*self\b",
    r"\bend\s+my\s+life\b",
    r"\bwant\s+to\s+die\b",
    r"\bno\s+reason\s+to\s+live\b",
    r"\bwish\s+i\s+was\s+dead\b",
    r"\bbetter\s+off\s+dead\b",
    r"\bbetter\s+off\s+without\s+me\b",
    # Self-harm
    r"\bself[\s\-]?harm\b",
    r"\bcut\s+(my\s*)?(wrist|arm|self)\b",
    r"\bhurt\s+my\s*self\b",
    r"\bself[\s\-]?injur\w*\b",
    # Crisis phrases
    r"\boverdos\w*\b",
    r"\bhanging\s+my\s*self\b",
    r"\bjump\s+off\b",
    r"\bslit\s+(my\s*)?(wrist|throat)\b",
]

_COMPILED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE) for p in CRISIS_PATTERNS
]

CRISIS_RESPONSE = (
    "I'm really concerned about what you've shared, and I want you to know that "
    "you are not alone. Your life has value, and there are people who care about you.\n\n"
    "**Please reach out for immediate support:**\n"
    "🆘 **National Suicide Prevention Lifeline:** Call or text **988** (US)\n"
    "🆘 **Crisis Text Line:** Text HOME to **741741**\n"
    "🆘 **International Association for Suicide Prevention:** https://www.iasp.info/resources/Crisis_Centres/\n\n"
    "If you are in immediate danger, please call **911** or your local emergency number.\n\n"
    "I'm here with you right now. Would you like to talk about what you're going through?"
)


@dataclass
class CrisisResult:
    """Result of a crisis-detection scan."""

    is_crisis: bool
    matched_pattern: str | None = None
    response: str | None = None


def detect_crisis(user_message: str) -> CrisisResult:
    """
    Scan *user_message* for crisis indicators.

    Returns a CrisisResult with ``is_crisis=True`` and the pre-written
    emergency response when a pattern matches, otherwise ``is_crisis=False``.
    """
    for pattern in _COMPILED_PATTERNS:
        match = pattern.search(user_message)
        if match:
            return CrisisResult(
                is_crisis=True,
                matched_pattern=pattern.pattern,
                response=CRISIS_RESPONSE,
            )

    return CrisisResult(is_crisis=False)
