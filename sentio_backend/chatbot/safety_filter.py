"""
Sentio – Safety filter for LLM output.

Post-processes the raw LLM response before it is shown to the user:
  1. Removes or replaces diagnostic language
  2. Removes harmful medical claims
  3. Replaces unsafe phrases with safe alternatives
  4. Prevents therapist impersonation
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Tuple

from loguru import logger
from core.config import settings


@dataclass
class FilterRule:
    """A single find → replace safety rule."""

    pattern: str
    replacement: str
    description: str


_RAW_RULES: List[Tuple[str, str, str]] = [
    # Diagnostic language
    (
        r"\byou\s+(have|are\s+suffering\s+from|are\s+diagnosed\s+with|have\s+been\s+diagnosed\s+with)\s+(depression|anxiety|bipolar|schizophrenia|PTSD|OCD|ADHD|BPD)\b",
        "it sounds like you may be experiencing some difficult feelings",
        "Remove clinical diagnosis",
    ),
    (
        r"\b(you\s+(have|got|show\s+signs\s+of)\s+(major\s+depressive\s+disorder|MDD|clinical\s+depression))\b",
        "what you're describing sounds really hard",
        "Remove MDD diagnosis",
    ),
    # Medication / prescription claims
    (
        r"\b(you\s+should\s+take|try\s+taking|start\s+taking|increase\s+your\s+dose\s+of)\s+\w+\b",
        "speaking with a healthcare provider about treatment options",
        "Remove medication advice",
    ),
    (
        r"\b(antidepressants?|SSRIs?|SNRIs?|benzodiazepines?|Prozac|Zoloft|Lexapro|Xanax)\s+(will|can|should)\s+(help|fix|cure|treat)\s+you\b",
        "certain treatments may help – a doctor can guide you",
        "Remove specific medication claims",
    ),
    # Harmful minimisation
    (
        r"\b(just\s+cheer\s+up|just\s+snap\s+out\s+of\s+it|you\s+just\s+need\s+to\s+(be\s+more\s+positive|think\s+positively|try\s+harder))\b",
        "your feelings are real and valid",
        "Remove toxic positivity",
    ),
    # False guarantees
    (
        r"\b(I\s+guarantee|I\s+promise|this\s+will\s+definitely)\s+.{0,60}(better|fine|okay|work)\b",
        "things can get better with the right support",
        "Remove false guarantees",
    ),
    # Impersonation
    (
        r"\bI\s+am\s+(a\s+)?(licensed\s+)?(therapist|psychologist|psychiatrist|counselor|doctor|physician)\b",
        "I'm Sentio, an AI companion – not a licensed therapist",
        "Prevent therapist impersonation",
    ),
]

_COMPILED_RULES: List[FilterRule] = [
    FilterRule(pattern=rule[0], replacement=rule[1], description=rule[2])
    for rule in _RAW_RULES
]

_COMPILED_PATTERNS: List[Tuple[re.Pattern[str], str, str]] = [
    (re.compile(r.pattern, re.IGNORECASE), r.replacement, r.description)
    for r in _COMPILED_RULES
]


class SafetyFilter:
    """
    Post-processor that sanitises LLM output before delivery to the user.

    Usage::

        sf = SafetyFilter()
        clean = sf.filter(raw_llm_response)
    """

    def filter(self, text: str) -> str:
        """
        Apply all safety rules to *text* and return the sanitised version.

        Args:
            text: Raw string from the LLM.

        Returns:
            Sanitised string safe to display to the user.
        """
        result = text
        for pattern, replacement, description in _COMPILED_PATTERNS:
            new_result, count = pattern.subn(replacement, result)
            if count and settings.SAFETY_FILTER_DEBUG:
                logger.debug(
                    f"[SafetyFilter] Rule triggered: {description!r} ({count}x)"
                )
            result = new_result

        return result.strip()
