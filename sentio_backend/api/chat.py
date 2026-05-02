"""
Sentio – /chat FastAPI route.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from loguru import logger
from services.chat_service import ChatService

router = APIRouter()
_chat_service: ChatService | None = None

def _get_service() -> ChatService:
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service

class ChatRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=2000)
    depression_score: float | None = Field(default=None, ge=0.0, le=1.0)
    audio_path: str | None = Field(default=None)
    session_id: str | None = Field(default=None)
    timezone: str | None = Field(default=None)

class ChatResponse(BaseModel):
    response: str
    risk_level: str
    is_crisis: bool
    depression_score: float
    crisis_contacts: dict = Field(default_factory=dict)

@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    score = request.depression_score
    if score is None:
        from services.score_manager import score_manager
        score = score_manager.get_score(
            user_id=request.user_id,
            message=request.message,
        )

    try:
        result = await _get_service().chat(
            user_id=request.user_id,
            message=request.message,
            depression_score=score,
            session_id=request.session_id,
            timezone=request.timezone,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        logger.exception(f"[/chat] Unexpected error: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An unexpected error occurred.")

    return ChatResponse(
        response=result["response"],
        risk_level=result["risk_level"],
        is_crisis=result["is_crisis"],
        depression_score=score,
        crisis_contacts=result.get("crisis_contacts", {}),
    )