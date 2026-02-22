"""
Sentio – High-level ChatService.

Wires together all components and exposes a single async chat()
method called by the FastAPI route handler.
"""

from __future__ import annotations

from loguru import logger

from chatbot.api_llm import ApiLLM
from chatbot.safety_filter import SafetyFilter
from services.rule_engine import RuleEngine
from services.context_builder import ContextBuilder
from database.firestore_client import FirestoreClient


class ChatService:
    """
    Facade that coordinates a full chat turn end-to-end.

    Uses the API LLM backend (OpenAI-compatible /chat/completions endpoint).

    Usage::

        service = ChatService()
        result = await service.chat(
            user_id="abc123",
            message="I've been feeling really low lately",
            depression_score=0.72,
        )
    """

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
    ) -> dict:
        """
        Process one user message and return the assistant reply.

        Args:
            user_id: Unique identifier for the user.
            message: Raw user input text.
            depression_score: Float [0, 1] from the depression model.
                              Defaults to 0.0 (no risk).

        Returns:
            dict with keys:
                - ``response``   – final assistant text
                - ``risk_level`` – LOW / MODERATE / HIGH
                - ``is_crisis``  – bool
        """
        result = await self._engine.process(
            user_id=user_id,
            user_message=message,
            depression_score=depression_score,
        )

        # Persist to Firestore (non-blocking, best-effort)
        try:
            await self._db.save_message(
                user_id=user_id,
                user_message=message,
                assistant_response=result["response"],
                depression_score=depression_score,
                risk_level=result["risk_level"],
                is_crisis=result["is_crisis"],
            )
        except Exception as exc:
            logger.error(f"[ChatService] Firestore write failed: {exc}")

        return result
