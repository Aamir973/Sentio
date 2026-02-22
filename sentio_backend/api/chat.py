"""
Sentio – /chat FastAPI route.

Exposes a single POST /api/v1/chat endpoint that:
  1. Validates the request body via Pydantic
  2. Optionally runs the depression ML model if no score is supplied
  3. Delegates to ChatService
  4. Returns a structured JSON response
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from loguru import logger

from services.chat_service import ChatService

router = APIRouter()

_chat_service: ChatService | None = None


def _get_service() -> ChatService:
    """Lazy singleton accessor for ChatService."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service


# ── Request / Response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """Incoming chat request payload."""

    user_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Unique identifier for the user (UUID, Firebase UID, etc.)",
        examples=["user_abc123"],
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's message text.",
        examples=["I've been feeling really down lately."],
    )
    depression_score: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description=(
            "Depression risk score [0, 1] from your ML model. "
            "If omitted, the built-in hybrid model is used."
        ),
        examples=[0.65],
    )
    audio_path: str | None = Field(
        default=None,
        description=(
            "Optional path to an audio file (.wav or .mp3) for multimodal "
            "depression scoring. Only used when depression_score is not provided."
        ),
        examples=["/tmp/session_audio.wav"],
    )


class ChatResponse(BaseModel):
    """Outgoing chat response payload."""

    response: str = Field(..., description="The assistant's reply.")
    risk_level: str = Field(
        ...,
        description="Detected risk level: LOW, MODERATE, or HIGH.",
    )
    is_crisis: bool = Field(
        ...,
        description="True if a crisis keyword was detected; normal LLM was bypassed.",
    )
    depression_score: float = Field(
        ...,
        description="The depression score used for this turn.",
    )


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a message to Sentio",
    description=(
        "Main chat endpoint. Accepts a user message and optional depression score, "
        "runs crisis detection, adapts tone to risk level, and returns the AI reply."
    ),
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    Process one chat turn.

    - If ``depression_score`` is not provided, it is estimated from the
      message (and optionally audio) using the built-in hybrid model.
    - Crisis keywords short-circuit the LLM and return an emergency response.

    BUG FIX: HybridDepressionModel.predict() returns (score, risk_level) tuple.
    We unpack correctly here — only the float score is passed downstream.
    """
    score = request.depression_score

    if score is None:
        # ── Run the hybrid depression model ───────────────────────────────────
        # predict() returns tuple[float, str] — unpack to get the score only.
        # The rule_engine re-derives risk_level from the score independently.
        try:
            from models.depression_model import hybrid_model
            score, _risk_hint = hybrid_model.predict(
                text=request.message,
                audio_path=request.audio_path,
            )
            logger.debug(
                f"[/chat] HybridModel depression_score={score:.3f} "
                f"risk_hint={_risk_hint} user={request.user_id!r}"
            )
        except Exception as exc:
            # Model load failure — fall back to 0.0 (LOW) so the chat still works
            logger.error(f"[/chat] Depression model error, defaulting score=0.0: {exc}")
            score = 0.0

    try:
        result = await _get_service().chat(
            user_id=request.user_id,
            message=request.message,
            depression_score=score,
        )
    except RuntimeError as exc:
        logger.error(f"[/chat] LLM error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception(f"[/chat] Unexpected error: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred. Please try again.",
        ) from exc

    return ChatResponse(
        response=result["response"],
        risk_level=result["risk_level"],
        is_crisis=result["is_crisis"],
        depression_score=score,
    )
