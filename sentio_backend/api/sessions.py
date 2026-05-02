"""
Sentio – Session management endpoints.

GET    /api/v1/sessions                         → list all sessions
POST   /api/v1/sessions                         → create new session
PATCH  /api/v1/sessions/{session_id}            → rename session
DELETE /api/v1/sessions/{session_id}            → delete session
GET    /api/v1/sessions/{session_id}/messages   → load full history
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from database.firestore_client import FirestoreClient

router = APIRouter()
_db = FirestoreClient()


# ── Request / Response models ──────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    session_id: str = Field(..., min_length=1, max_length=128)
    title: str = Field(default="New Chat", max_length=200)


class RenameSessionRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    title: str = Field(..., min_length=1, max_length=200)


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/sessions", status_code=status.HTTP_200_OK)
async def list_sessions(user_id: str = Query(..., min_length=1, max_length=128)):
    """Return all sessions for a user, newest first."""
    sessions = await _db.get_sessions(user_id)
    return {"sessions": sessions}


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(body: CreateSessionRequest):
    """Create a new session document in Firestore."""
    result = await _db.create_session(
        user_id=body.user_id,
        session_id=body.session_id,
        title=body.title,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore unavailable.",
        )
    return {"session": result}


@router.patch("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def rename_session(session_id: str, body: RenameSessionRequest):
    """Rename an existing session."""
    success = await _db.update_session_title(
        user_id=body.user_id,
        session_id=session_id,
        title=body.title,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore unavailable.",
        )
    return {"session_id": session_id, "title": body.title}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def delete_session(
    session_id: str,
    user_id: str = Query(..., min_length=1, max_length=128),
):
    """Delete a session and all its messages."""
    success = await _db.delete_session(user_id=user_id, session_id=session_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore unavailable.",
        )
    return {"deleted": session_id}


@router.get("/sessions/{session_id}/messages", status_code=status.HTTP_200_OK)
async def get_session_messages(
    session_id: str,
    user_id: str = Query(..., min_length=1, max_length=128),
):
    """Return all messages for a session in order."""
    messages = await _db.get_session_messages(user_id=user_id, session_id=session_id)
    return {"session_id": session_id, "messages": messages}