"""
Sentio – Smart Depression Score Manager
========================================

Strategy:
  - Every message  : instant keyword heuristic score (no ML, zero latency)
  - Every 5th msg  : full ML model runs in a background thread (non-blocking)
  - Cached score   : blended between heuristic and last ML result
  - Crisis keywords: handled separately in crisis_detection.py (always HIGH)

This keeps chat responses fast on CPU while still using real ML scores.
"""

from __future__ import annotations

import asyncio
import threading
from collections import defaultdict
from loguru import logger

# ── Keyword sets for instant heuristic ───────────────────────────────────────

_HIGH_KEYWORDS = {
    "hopeless", "worthless", "empty", "numb", "broken", "pointless",
    "hate myself", "can't cope", "no point", "give up", "no reason to live",
    "want to die", "end it", "disappear forever", "nobody cares",
    "exhausted of life", "can't go on",
}

_MODERATE_KEYWORDS = {
    "sad", "depressed", "lonely", "anxious", "overwhelmed", "tired",
    "lost", "confused", "stressed", "upset", "crying", "unhappy",
    "worried", "scared", "nervous", "frustrated", "angry", "hurt",
    "struggling", "difficult", "hard time", "not okay", "not good",
}

_LOW_KEYWORDS = {
    "okay", "fine", "good", "happy", "great", "better", "calm",
    "relaxed", "peaceful", "grateful", "hopeful", "positive",
}

# How often to run the full ML model (every N messages per user)
ML_INFERENCE_EVERY_N = 5

# Weight: how much the ML score influences the blended score
# 0.7 = 70% ML, 30% heuristic (when ML score available)
ML_WEIGHT = 0.7


class ScoreManager:
    """
    Per-user depression score manager.

    Maintains:
        - message_count  : rolling count per user
        - heuristic_score: latest keyword-based score
        - ml_score       : latest ML model score (updated every N messages)
        - blended_score  : what gets saved and shown on dashboard
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._message_counts: dict[str, int] = defaultdict(int)
        self._heuristic_scores: dict[str, float] = defaultdict(lambda: 0.3)
        self._ml_scores: dict[str, float] = {}  # None until first ML run
        self._ml_running: set[str] = set()  # users with ML inference in progress

    def get_score(self, user_id: str, message: str) -> float:
        """
        Get the current blended depression score for a user.

        Updates heuristic score immediately.
        Triggers background ML inference every N messages.

        Args:
            user_id: Unique user identifier.
            message: Current user message text.

        Returns:
            Blended float score in [0, 1].
        """
        with self._lock:
            # 1. Instant heuristic update
            h_score = _heuristic_score(message)
            # Smooth heuristic: 60% new, 40% previous (avoid wild swings)
            prev_h = self._heuristic_scores[user_id]
            self._heuristic_scores[user_id] = 0.6 * h_score + 0.4 * prev_h

            # 2. Increment message count
            self._message_counts[user_id] += 1
            count = self._message_counts[user_id]

            # 3. Trigger ML inference every N messages (non-blocking)
            should_run_ml = (
                count % ML_INFERENCE_EVERY_N == 0
                and user_id not in self._ml_running
            )

        if should_run_ml:
            self._trigger_ml_background(user_id, message)

        return self._blend(user_id)

    def get_cached_score(self, user_id: str) -> float:
        """Return the last blended score without updating anything."""
        return self._blend(user_id)

    def force_high(self, user_id: str) -> None:
        """Force score to HIGH (called on crisis detection)."""
        with self._lock:
            self._ml_scores[user_id] = 0.9
            self._heuristic_scores[user_id] = 0.9

    # ── Private ───────────────────────────────────────────────────────────────

    def _blend(self, user_id: str) -> float:
        h = self._heuristic_scores[user_id]
        ml = self._ml_scores.get(user_id)

        if ml is None:
            # No ML score yet — use heuristic only
            return round(h, 4)

        blended = ML_WEIGHT * ml + (1 - ML_WEIGHT) * h
        return round(blended, 4)

    def _trigger_ml_background(self, user_id: str, message: str) -> None:
        """Spawn a daemon thread to run ML inference without blocking."""
        with self._lock:
            self._ml_running.add(user_id)

        logger.info(f"[ScoreManager] Triggering background ML inference for user={user_id!r}")

        def _run():
            try:
                from models.depression_model import hybrid_model
                if hybrid_model.is_ready:
                    score, risk = hybrid_model.predict(text=message, audio_path=None)
                    with self._lock:
                        self._ml_scores[user_id] = score
                    logger.info(
                        f"[ScoreManager] ML score updated: user={user_id!r} "
                        f"score={score:.4f} risk={risk}"
                    )
                else:
                    logger.debug("[ScoreManager] ML model not ready — skipping.")
            except Exception as exc:
                logger.warning(f"[ScoreManager] Background ML failed: {exc}")
            finally:
                with self._lock:
                    self._ml_running.discard(user_id)

        t = threading.Thread(target=_run, daemon=True)
        t.start()


# ── Heuristic scorer ──────────────────────────────────────────────────────────

def _heuristic_score(text: str) -> float:
    """
    Instant keyword-based depression score.

    Returns float in [0, 1]:
        HIGH keywords   → base 0.75 + per-hit bonus
        MODERATE        → base 0.45 + per-hit bonus
        LOW             → base 0.15
        Neutral         → 0.30
    """
    lower = text.lower()

    high_hits = sum(1 for kw in _HIGH_KEYWORDS if kw in lower)
    mod_hits = sum(1 for kw in _MODERATE_KEYWORDS if kw in lower)
    low_hits = sum(1 for kw in _LOW_KEYWORDS if kw in lower)

    if high_hits > 0:
        return min(0.75 + high_hits * 0.05, 1.0)
    elif mod_hits > 0:
        return min(0.40 + mod_hits * 0.05, 0.74)
    elif low_hits > 0:
        return max(0.15 - low_hits * 0.02, 0.05)
    else:
        return 0.30  # neutral baseline


# ── Module-level singleton ────────────────────────────────────────────────────
score_manager = ScoreManager()