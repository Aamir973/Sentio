"""
Sentio – Firebase Firestore client.

Firestore schema
─────────────────────────
chats/{user_id}/
    profile/latest/
        depression_score   : float
        risk_level         : str   (LOW / MODERATE / HIGH)
        last_updated       : timestamp

    sessions/{session_id}/
        title              : str
        created_at         : timestamp
        last_updated       : timestamp
        message_count      : int

        messages/{auto_id}/
            role           : "user" | "assistant"
            content        : str
            seq            : int
            timestamp      : timestamp
            risk_level     : str   (assistant messages only — LOW / MODERATE / HIGH)

    crisis_log/{auto_id}/
        timestamp          : timestamp
        matched_pattern    : str
        session_id         : str | None
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger

from core.config import settings

_firestore_db = None


def _init_firebase():
    global _firestore_db
    if _firestore_db is not None:
        return _firestore_db

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
        if not cred_path.exists():
            logger.warning(
                f"Firebase credentials not found at {cred_path}. "
                "Firestore persistence is DISABLED."
            )
            return None

        if not firebase_admin._apps:
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)

        _firestore_db = firestore.client()
        logger.info("Firebase Firestore initialised successfully.")
        return _firestore_db

    except Exception as exc:
        logger.error(f"Firebase initialisation failed: {exc}")
        return None


class FirestoreClient:
    def __init__(self) -> None:
        self._db = _init_firebase()

    # ──────────────────────────────────────────────
    # Session CRUD
    # ──────────────────────────────────────────────

    async def create_session(self, user_id: str, session_id: str, title: str = "New Chat") -> dict:
        if self._db is None:
            return {}
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._create_session, user_id, session_id, title)

    async def get_sessions(self, user_id: str) -> list[dict]:
        if self._db is None:
            return []
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._get_sessions, user_id)

    async def delete_session(self, user_id: str, session_id: str) -> bool:
        if self._db is None:
            return False
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._delete_session, user_id, session_id)

    async def get_session_messages(self, user_id: str, session_id: str) -> list[dict]:
        if self._db is None:
            return []
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._get_session_messages, user_id, session_id)

    async def update_session_title(self, user_id: str, session_id: str, title: str) -> bool:
        if self._db is None:
            return False
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._update_session_title, user_id, session_id, title)

    # ──────────────────────────────────────────────
    # Message persistence
    # ──────────────────────────────────────────────

    async def save_message(
        self,
        user_id: str,
        user_message: str,
        assistant_response: str,
        depression_score: float,
        risk_level: str,
        is_crisis: bool,
        session_id: str | None = None,
    ) -> None:
        if self._db is None:
            logger.debug("[Firestore] Skipping write – client not initialised.")
            return

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._write_message,
            user_id,
            user_message,
            assistant_response,
            depression_score,
            risk_level,
            is_crisis,
            session_id,
        )

    async def get_user_profile(self, user_id: str) -> dict | None:
        if self._db is None:
            return None
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._read_profile, user_id)

    # ──────────────────────────────────────────────
    # Crisis event logging
    # ──────────────────────────────────────────────

    async def save_crisis_event(
        self,
        user_id: str,
        matched_pattern: str | None = None,
        session_id: str | None = None,
    ) -> None:
        """Write a crisis event to chats/{user_id}/crisis_log/{auto_id}."""
        if self._db is None:
            logger.debug("[Firestore] Skipping crisis log write – client not initialised.")
            return
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            self._log_crisis_event,
            user_id,
            matched_pattern,
            session_id,
        )

    async def get_crisis_count_this_week(self, user_id: str) -> int:
        """Return number of crisis events in the last 7 days for dashboard widget."""
        if self._db is None:
            return 0
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._count_recent_crisis_events, user_id)

    # ──────────────────────────────────────────────
    # Sync internals
    # ──────────────────────────────────────────────

    def _create_session(self, user_id: str, session_id: str, title: str) -> dict:
        now = datetime.now(timezone.utc)
        data = {
            "title": title,
            "created_at": now,
            "last_updated": now,
            "message_count": 0,
        }
        (
            self._db.collection("chats")
            .document(user_id)
            .collection("sessions")
            .document(session_id)
            .set(data)
        )
        logger.debug(f"[Firestore] Created session {session_id!r} for user {user_id!r}")
        return {"session_id": session_id, **data}

    def _get_sessions(self, user_id: str) -> list[dict]:
        docs = (
            self._db.collection("chats")
            .document(user_id)
            .collection("sessions")
            .order_by("last_updated", direction="DESCENDING")
            .stream()
        )
        sessions = []
        for doc in docs:
            d = doc.to_dict()
            d["session_id"] = doc.id
            for key in ("created_at", "last_updated"):
                if key in d and hasattr(d[key], "isoformat"):
                    d[key] = d[key].isoformat()
            sessions.append(d)
        return sessions

    def _delete_session(self, user_id: str, session_id: str) -> bool:
        session_ref = (
            self._db.collection("chats")
            .document(user_id)
            .collection("sessions")
            .document(session_id)
        )
        messages = session_ref.collection("messages").stream()
        for msg in messages:
            msg.reference.delete()

        session_ref.delete()
        logger.debug(f"[Firestore] Deleted session {session_id!r} for user {user_id!r}")
        return True

    def _get_session_messages(self, user_id: str, session_id: str) -> list[dict]:
        docs = (
            self._db.collection("chats")
            .document(user_id)
            .collection("sessions")
            .document(session_id)
            .collection("messages")
            .order_by("seq")
            .stream()
        )
        messages = []
        for doc in docs:
            d = doc.to_dict()
            if "timestamp" in d and hasattr(d["timestamp"], "isoformat"):
                d["timestamp"] = d["timestamp"].isoformat()
            messages.append(d)
        return messages

    def _update_session_title(self, user_id: str, session_id: str, title: str) -> bool:
        (
            self._db.collection("chats")
            .document(user_id)
            .collection("sessions")
            .document(session_id)
            .update({"title": title, "last_updated": datetime.now(timezone.utc)})
        )
        logger.debug(f"[Firestore] Renamed session {session_id!r} → {title!r}")
        return True

    def _write_message(
        self,
        user_id: str,
        user_message: str,
        assistant_response: str,
        depression_score: float,
        risk_level: str,
        is_crisis: bool,
        session_id: str | None,
    ) -> None:
        now = datetime.now(timezone.utc)

        if session_id:
            session_ref = (
                self._db.collection("chats")
                .document(user_id)
                .collection("sessions")
                .document(session_id)
            )
            session_doc = session_ref.get()
            current_count = session_doc.to_dict().get("message_count", 0) if session_doc.exists else 0

            # Write user message (no risk_level — risk is assessed on the response)
            session_ref.collection("messages").add({
                "role": "user",
                "content": user_message,
                "seq": current_count,
                "timestamp": now,
            })
            # Write assistant message WITH risk_level for sentiment timeline
            session_ref.collection("messages").add({
                "role": "assistant",
                "content": assistant_response,
                "seq": current_count + 1,
                "timestamp": now,
                "risk_level": risk_level,
            })
            # Update session metadata
            session_ref.update({
                "last_updated": now,
                "message_count": current_count + 2,
            })
        else:
            # Fallback: flat collection (legacy, no session)
            self._db.collection("chats").document(user_id).collection("messages").add({
                "user_message": user_message,
                "assistant_response": assistant_response,
                "depression_score": depression_score,
                "risk_level": risk_level,
                "is_crisis": is_crisis,
                "timestamp": now,
            })

        # Always update profile
        (
            self._db.collection("chats")
            .document(user_id)
            .collection("profile")
            .document("latest")
            .set(
                {"depression_score": depression_score, "risk_level": risk_level, "last_updated": now},
                merge=True,
            )
        )
        logger.debug(f"[Firestore] Saved message for user={user_id!r} session={session_id!r} risk={risk_level!r}")

    def _log_crisis_event(
        self,
        user_id: str,
        matched_pattern: str | None,
        session_id: str | None,
    ) -> None:
        now = datetime.now(timezone.utc)
        (
            self._db.collection("chats")
            .document(user_id)
            .collection("crisis_log")
            .add({
                "timestamp": now,
                "matched_pattern": matched_pattern or "",
                "session_id": session_id or "",
            })
        )
        logger.debug(f"[Firestore] Logged crisis event for user={user_id!r}")

    def _count_recent_crisis_events(self, user_id: str) -> int:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        docs = (
            self._db.collection("chats")
            .document(user_id)
            .collection("crisis_log")
            .where("timestamp", ">=", cutoff)
            .stream()
        )
        return sum(1 for _ in docs)

    def _read_profile(self, user_id: str) -> dict | None:
        doc = (
            self._db.collection("chats")
            .document(user_id)
            .collection("profile")
            .document("latest")
            .get()
        )
        return doc.to_dict() if doc.exists else None