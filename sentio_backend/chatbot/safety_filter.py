"""
Sentio – Safety filter.

Post-processes raw LLM output to enforce boundary rules defined in
config/sentio_boundaries.json:

  1. Strip bullet points and numbered lists → convert to prose
  2. Remove forbidden clinical phrases
  3. Enforce max sentence count per risk level
  4. Strip headers (markdown ## / **)
  5. Collapse excessive whitespace
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from loguru import logger

_BOUNDARIES_PATH = Path(__file__).parent.parent / "config" / "sentio_boundaries.json"

# Fallback forbidden phrases if config is unavailable
_FALLBACK_FORBIDDEN = [
    r"I recommend you see\b",
    r"you should see a therapist",
    r"you should seek professional help",
    r"I recommend that",
    r"it is important to",
    r"it's important to",
    r"clinically speaking",
    r"\bdiagnos\w+\b",
    r"I know how you feel",
    r"everything happens for a reason",
    r"just think positive",
    r"cheer up",
]


@lru_cache(maxsize=1)
def _load_boundaries() -> dict:
    try:
        with open(_BOUNDARIES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _get_forbidden_patterns() -> list[re.Pattern]:
    b = _load_boundaries()
    phrases = b.get("forbidden_phrases", _FALLBACK_FORBIDDEN)
    return [re.compile(re.escape(p), re.IGNORECASE) for p in phrases]


# Compiled once at import time for bullet/list stripping
_BULLET_RE = re.compile(r"^\s*[-•*]\s+", re.MULTILINE)
_NUMBERED_RE = re.compile(r"^\s*\d+\.\s+", re.MULTILINE)
_HEADER_RE = re.compile(r"^#{1,4}\s+.*$", re.MULTILINE)
_BOLD_HEADER_RE = re.compile(r"^\*\*[^*]+\*\*\s*$", re.MULTILINE)
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


class SafetyFilter:
    """
    Post-processes LLM output to enforce Sentio's boundary rules.

    Usage::

        sf = SafetyFilter()
        clean = sf.filter(raw_llm_response, max_sentences=3)
    """

    def filter(self, text: str, max_sentences: int = 3) -> str:
        """
        Clean and constrain a raw LLM response.

        Args:
            text: Raw text from the LLM.
            max_sentences: Maximum number of sentences to keep.

        Returns:
            Cleaned, boundary-compliant response string.
        """
        if not text or not text.strip():
            return "I'm here with you. What's on your mind?"

        text = self._strip_markdown(text)
        text = self._remove_forbidden_phrases(text)
        text = self._enforce_sentence_limit(text, max_sentences)
        text = self._clean_whitespace(text)

        if not text.strip():
            logger.warning("[SafetyFilter] Response was empty after filtering — using fallback.")
            return "I hear you. Can you tell me a bit more about how you're feeling?"

        return text.strip()

    # ── Private helpers ───────────────────────────────────────────────────────

    def _strip_markdown(self, text: str) -> str:
        """Remove bullet points, numbered lists, headers, and bold headers."""
        # Convert bullet/numbered list items to plain sentences
        text = _BULLET_RE.sub("", text)
        text = _NUMBERED_RE.sub("", text)
        # Remove markdown headers
        text = _HEADER_RE.sub("", text)
        text = _BOLD_HEADER_RE.sub("", text)
        # Remove remaining ** bold markers
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        # Remove remaining * italic markers
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        return text

    def _remove_forbidden_phrases(self, text: str) -> str:
        """Replace forbidden clinical / scripted phrases with empty string."""
        for pattern in _get_forbidden_patterns():
            if pattern.search(text):
                logger.debug(f"[SafetyFilter] Removed forbidden phrase: {pattern.pattern}")
                text = pattern.sub("", text)
        return text

    def _enforce_sentence_limit(self, text: str, max_sentences: int) -> str:
        """
        Keep only the first `max_sentences` sentences.

        Uses a simple regex sentence splitter — good enough for the
        short, conversational outputs Sentio produces.
        """
        # Split on sentence-ending punctuation followed by whitespace or end
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) <= max_sentences:
            return " ".join(sentences)
        trimmed = " ".join(sentences[:max_sentences])
        logger.debug(
            f"[SafetyFilter] Trimmed response from {len(sentences)} to {max_sentences} sentences."
        )
        return trimmed

    def _clean_whitespace(self, text: str) -> str:
        """Collapse multiple newlines and strip leading/trailing whitespace."""
        text = _MULTI_NEWLINE_RE.sub("\n\n", text)
        return text.strip()