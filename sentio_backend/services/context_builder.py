"""
Sentio – Per-session conversation memory.
Cache key : "{user_id}:{session_id}"
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from loguru import logger

Message = dict[str, str]


def _get_firestore():
    try:
        import firebase_admin
        from firebase_admin import firestore as fs
        if not firebase_admin._apps:
            return None
        return fs.client()
    except Exception:
        return None


def _get_window_size() -> int:
    try:
        from core.config import settings
        return getattr(settings, "MEMORY_WINDOW", 20)
    except Exception:
        return 20


class ContextBuilder:
    def __init__(self, window_size: int | None = None) -> None:
        self._window: int = window_size or _get_window_size()
        self._cache: dict[str, Deque[Message]] = {}

    @staticmethod
    def _key(user_id: str, session_id: str | None) -> str:
        return f"{user_id}:{session_id}" if session_id else user_id

    def get_history(self, user_id: str, session_id: str | None = None) -> list[Message]:
        key = self._key(user_id, session_id)
        if key not in self._cache:
            self._load_from_firestore(user_id, session_id, key)
        return list(self._cache.get(key, deque()))

    def add_message(self, user_id: str, role: str, content: str, session_id: str | None = None) -> None:
        key = self._key(user_id, session_id)
        if key not in self._cache:
            self._cache[key] = deque(maxlen=self._window)
        self._cache[key].append({"role": role, "content": content})

    def clear_history(self, user_id: str, session_id: str | None = None) -> None:
        self._cache.pop(self._key(user_id, session_id), None)

    def history_length(self, user_id: str, session_id: str | None = None) -> int:
        return len(self._cache.get(self._key(user_id, session_id), []))

    def _load_from_firestore(self, user_id: str, session_id: str | None, key: str) -> None:
        db = _get_firestore()
        if db is None:
            self._cache[key] = deque(maxlen=self._window)
            return

        try:
            if session_id:
                docs = (
                    db.collection("chats")
                    .document(user_id)
                    .collection("sessions")
                    .document(session_id)
                    .collection("messages")
                    .order_by("seq")
                    .limit_to_last(self._window)
                    .get()
                )
            else:
                docs = (
                    db.collection("chats")
                    .document(user_id)
                    .collection("context")
                    .order_by("seq")
                    .limit_to_last(self._window)
                    .get()
                )

            msgs: deque[Message] = deque(maxlen=self._window)
            for doc in docs:
                data = doc.to_dict()
                role    = data.get("role")
                content = data.get("content")
                if role and content:
                    msgs.append({"role": role, "content": content})

            self._cache[key] = msgs
            logger.debug(f"[ContextBuilder] Loaded {len(msgs)} messages for key={key!r}")

        except Exception as exc:
            logger.warning(f"[ContextBuilder] Firestore read failed for {key!r}: {exc}")
            self._cache[key] = deque(maxlen=self._window)