"""
Sentio – High-level ChatService.
"""

from __future__ import annotations

from loguru import logger

from chatbot.api_llm import ApiLLM
from chatbot.safety_filter import SafetyFilter
from services.rule_engine import RuleEngine
from services.context_builder import ContextBuilder
from database.firestore_client import FirestoreClient


class ChatService:
    def __init__(self) -> None:
        llm = ApiLLM()
        logger.info("[ChatService] LLM backend: Remote API (OpenAI-compatible)")

        self._engine = RuleEngine(
            llm=llm,
            context_builder=ContextBuilder(),
            safety_filter=SafetyFilter(),
        )
        self._db = FirestoreClient()

    async def chat(
        self,
        user_id: str,
        message: str,
        depression_score: float = 0.0,
        session_id: str | None = None,
        timezone: str | None = None,
    ) -> dict:
        result = await self._engine.process(
            user_id=user_id,
            user_message=message,
            depression_score=depression_score,
            session_id=session_id,       # ← was missing
            timezone=timezone,
        )

        try:
            await self._db.save_message(
                user_id=user_id,
                user_message=message,
                assistant_response=result["response"],
                depression_score=depression_score,
                risk_level=result["risk_level"],
                is_crisis=result["is_crisis"],
                session_id=session_id,
            )
        except Exception as exc:
            logger.error(f"[ChatService] Firestore write failed: {exc}")

        return result