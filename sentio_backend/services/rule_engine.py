"""
Sentio – Rule engine.

Orchestrates the core decision pipeline:
  1. Crisis detection  → bypass LLM if triggered
  2. Risk mapping      → map depression_score → LOW / MODERATE / HIGH
  3. Context building  → assemble conversation history
  4. Prompt building   → create risk-aware system prompt
  5. LLM call         → generate response
  6. Safety filter    → scrub the LLM output
"""

from __future__ import annotations

from loguru import logger

from core.crisis_detection import detect_crisis
from services.risk_adapter import map_risk_level, RiskLevel
from services.context_builder import ContextBuilder
from chatbot.llm_interface import LLMInterface
from chatbot.prompt_builder import build_system_prompt
from chatbot.safety_filter import SafetyFilter


class RuleEngine:
    """
    Central orchestrator for a single chat turn.

    Args:
        llm: An LLMInterface instance.
        context_builder: Manages per-user conversation history.
        safety_filter: Post-processes LLM output.
    """

    def __init__(
        self,
        llm: LLMInterface,
        context_builder: ContextBuilder,
        safety_filter: SafetyFilter,
    ) -> None:
        self.llm = llm
        self.context_builder = context_builder
        self.safety_filter = safety_filter

    async def process(
        self,
        user_id: str,
        user_message: str,
        depression_score: float,
    ) -> dict:
        """
        Run the full rule-engine pipeline for one chat turn.

        Args:
            user_id: Unique identifier for the user (used for memory).
            user_message: Raw text from the user.
            depression_score: Float 0–1 from the ML depression model.

        Returns:
            dict with keys:
                - ``response``   (str)  – final reply to show the user
                - ``risk_level`` (str)  – LOW / MODERATE / HIGH
                - ``is_crisis``  (bool) – whether crisis was detected
        """

        # ── 1. Crisis detection ───────────────────────────────────────────────
        crisis = detect_crisis(user_message)
        if crisis.is_crisis:
            logger.warning(
                f"[CRISIS] user={user_id!r} | pattern={crisis.matched_pattern!r}"
            )
            self.context_builder.add_message(user_id, "user", user_message)
            self.context_builder.add_message(
                user_id, "assistant", crisis.response  # type: ignore[arg-type]
            )
            return {
                "response": crisis.response,
                "risk_level": RiskLevel.HIGH.value,
                "is_crisis": True,
            }

        # ── 2. Risk mapping ───────────────────────────────────────────────────
        risk_level: RiskLevel = map_risk_level(depression_score)
        logger.info(
            f"[RISK] user={user_id!r} | score={depression_score:.3f} | level={risk_level.value}"
        )

        # ── 3. Build conversation context ─────────────────────────────────────
        history = self.context_builder.get_history(user_id)

        # ── 4. Build system prompt ────────────────────────────────────────────
        system_prompt = build_system_prompt(risk_level)

        # ── 5. Construct message list for LLM ─────────────────────────────────
        messages = history + [{"role": "user", "content": user_message}]

        # ── 6. Call LLM ───────────────────────────────────────────────────────
        raw_response = await self.llm.chat(
            system_prompt=system_prompt, messages=messages
        )

        # ── 7. Safety filter ──────────────────────────────────────────────────
        safe_response = self.safety_filter.filter(raw_response)

        # ── 8. Update memory ──────────────────────────────────────────────────
        self.context_builder.add_message(user_id, "user", user_message)
        self.context_builder.add_message(user_id, "assistant", safe_response)

        return {
            "response": safe_response,
            "risk_level": risk_level.value,
            "is_crisis": False,
        }
