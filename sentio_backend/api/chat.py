"""
Sentio – /chat FastAPI route.
"""
from __future__ import annotations
import os
import httpx
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
    import os, httpx
from fastapi import UploadFile, File

@router.post("/transcribe", status_code=status.HTTP_200_OK)
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        logger.info(f"[/transcribe] Received file: {file.filename}, size: {len(audio_bytes)}")
        api_key = os.getenv("API_LLM_KEY")
        logger.info(f"[/transcribe] API key found: {bool(api_key)}")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={"file": (file.filename or "audio.webm", audio_bytes, "audio/webm")},
                data={"model": "whisper-large-v3-turbo"}
            )
        if response.status_code != 200:
            logger.error(f"[/transcribe] Groq error: {response.status_code} {response.text}")
            raise HTTPException(status_code=502, detail=f"Transcription failed: {response.text}")
        text = response.json().get("text", "")
        return {"text": text}
    except Exception as exc:
        logger.exception(f"[/transcribe] Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))