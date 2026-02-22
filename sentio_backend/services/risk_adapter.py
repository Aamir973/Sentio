"""
Sentio – Depression risk adapter.

Maps a continuous depression_score (0.0 – 1.0) to a discrete risk
level: LOW, MODERATE, or HIGH.
"""

from __future__ import annotations

from enum import Enum


class RiskLevel(str, Enum):
    """Discrete risk-level categories used throughout the app."""

    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


# ── Thresholds ────────────────────────────────────────────────────────────────
LOW_MAX: float = 0.35       # score ≤ 0.35  → LOW
MODERATE_MAX: float = 0.65  # score ≤ 0.65  → MODERATE
# score > 0.65              → HIGH


def map_risk_level(depression_score: float) -> RiskLevel:
    """
    Convert a raw depression score to a RiskLevel.

    Args:
        depression_score: Float in the range [0.0, 1.0].

    Returns:
        A RiskLevel enum member.

    Raises:
        ValueError: If *depression_score* is outside [0.0, 1.0].
    """
    if not (0.0 <= depression_score <= 1.0):
        raise ValueError(
            f"depression_score must be in [0, 1], got {depression_score}"
        )

    if depression_score <= LOW_MAX:
        return RiskLevel.LOW
    elif depression_score <= MODERATE_MAX:
        return RiskLevel.MODERATE
    else:
        return RiskLevel.HIGH


def risk_level_description(level: RiskLevel) -> str:
    """Return a short human-readable description for a given RiskLevel."""
    descriptions = {
        RiskLevel.LOW: "User shows minimal depression indicators. Maintain warm, encouraging tone.",
        RiskLevel.MODERATE: "User shows moderate depression indicators. Be empathetic and validate feelings.",
        RiskLevel.HIGH: "User shows significant depression indicators. Prioritise safety, express care, suggest professional help.",
    }
    return descriptions[level]
