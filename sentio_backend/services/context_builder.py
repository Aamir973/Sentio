"""
Sentio – Per-user conversation memory.

Maintains a sliding window of the last N messages for each user.
The window is held in-process memory. For production at scale,
swap the backing store for Redis or Firestore.
"""

from __future__ import annotations

from collections import deque
from typing import Deque

from core.config import settings


# Type alias for a single chat message
Message = dict[str, str]  # {"role": "user" | "assistant", "content": "..."}


class ContextBuilder:
    """
    In-memory conversation context manager.

    Each user gets a fixed-size deque of Message dicts.
    When the deque is full, the oldest message is automatically dropped.

    Args:
        window_size: Maximum number of messages to retain per user.
                     Defaults to settings.MEMORY_WINDOW.
    """

    def __init__(self, window_size: int | None = None) -> None:
        self._window: int = window_size or settings.MEMORY_WINDOW
        self._store: dict[str, Deque[Message]] = {}

    def get_history(self, user_id: str) -> list[Message]:
        """
        Return the conversation history for *user_id* as a plain list.

        Args:
            user_id: Unique user identifier.

        Returns:
            Ordered list of message dicts (oldest first).
        """
        return list(self._store.get(user_id, deque()))

    def add_message(self, user_id: str, role: str, content: str) -> None:
        """
        Append a new message to *user_id*'s history.

        Args:
            user_id: Unique user identifier.
            role: "user" or "assistant".
            content: Message text.
        """
        if user_id not in self._store:
            self._store[user_id] = deque(maxlen=self._window)
        self._store[user_id].append({"role": role, "content": content})

    def clear_history(self, user_id: str) -> None:
        """Erase the entire history for *user_id*."""
        self._store.pop(user_id, None)

    def history_length(self, user_id: str) -> int:
        """Return the number of stored messages for *user_id*."""
        return len(self._store.get(user_id, []))
