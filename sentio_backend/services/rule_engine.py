"""
Sentio – Rule engine.
"""
from __future__ import annotations
from loguru import logger
from core.crisis_detection import detect_crisis
from services.risk_adapter import map_risk_level, RiskLevel
from services.context_builder import ContextBuilder
from chatbot.llm_interface import LLMInterface
from chatbot.prompt_builder import build_system_prompt
from chatbot.safety_filter import SafetyFilter

_MAX_SENTENCES: dict[RiskLevel, int] = {
    RiskLevel.LOW: 3,
    RiskLevel.MODERATE: 4,
    RiskLevel.HIGH: 4,
}


class RuleEngine:
    def __init__(self, llm: LLMInterface, context_builder: ContextBuilder, safety_filter: SafetyFilter) -> None:
        self.llm = llm
        self.context_builder = context_builder
        self.safety_filter = safety_filter

    async def process(
        self,
        user_id: str,
        user_message: str,
        depression_score: float,
        session_id: str | None = None,
        timezone: str | None = None,
    ) -> dict:

        # ── 1. Crisis detection ───────────────────────────────────
        crisis = detect_crisis(user_message, timezone=timezone)
        if crisis.is_crisis:
            logger.warning(f"[CRISIS] user={user_id!r} | pattern={crisis.matched_pattern!r}")
            from services.score_manager import score_manager
            score_manager.force_high(user_id)

            # Log crisis event to Firestore (non-blocking, best-effort)
            try:
                from database.firestore_client import FirestoreClient
                fs = FirestoreClient()
                import asyncio
                asyncio.ensure_future(
                    fs.save_crisis_event(
                        user_id=user_id,
                        matched_pattern=crisis.matched_pattern,
                        session_id=session_id,
                    )
                )
            except Exception as exc:
                logger.warning(f"[RuleEngine] Failed to log crisis event: {exc}")

            self.context_builder.add_message(user_id, "user", user_message, session_id=session_id)
            self.context_builder.add_message(user_id, "assistant", crisis.response, session_id=session_id)
            return {
                "response": crisis.response,
                "risk_level": RiskLevel.HIGH.value,
                "is_crisis": True,
                "crisis_contacts": crisis.crisis_contacts,
            }

        # ── 2. Risk mapping ───────────────────────────────────────
        risk_level: RiskLevel = map_risk_level(depression_score)

        # ── 3. Context ────────────────────────────────────────────
        history = self.context_builder.get_history(user_id, session_id=session_id)

        # ── 4. Prompt ─────────────────────────────────────────────
        system_prompt = build_system_prompt(risk_level)

        # ── 5. LLM ───────────────────────────────────────────────
        messages = history + [{"role": "user", "content": user_message}]
        raw_response = await self.llm.chat(system_prompt=system_prompt, messages=messages)

        # ── 6. Safety filter ──────────────────────────────────────
        max_sentences = _MAX_SENTENCES.get(risk_level, 3)
        safe_response = self.safety_filter.filter(raw_response, max_sentences=max_sentences)

        # ── 7. Update memory ──────────────────────────────────────
        self.context_builder.add_message(user_id, "user", user_message, session_id=session_id)
        self.context_builder.add_message(user_id, "assistant", safe_response, session_id=session_id)

        return {
            "response": safe_response,
            "risk_level": risk_level.value,
            "is_crisis": False,
            "crisis_contacts": {},
        }