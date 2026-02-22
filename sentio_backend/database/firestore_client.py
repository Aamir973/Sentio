"""
Sentio – Firebase Firestore client.

Handles all database I/O. Each chat turn is persisted as a document
inside the chats/{user_id}/messages sub-collection.

Firestore document schema
─────────────────────────
chats/{user_id}/
    profile/
        depression_score   : float
        risk_level         : str   (LOW / MODERATE / HIGH)
        last_updated       : timestamp

    messages/{auto_id}/
        user_message       : str
        assistant_response : str
        depression_score   : float
        risk_level         : str
        is_crisis          : bool
        timestamp          : timestamp

── Setup ─────────────────────────────────────────────────────────────────────
1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore (Native mode)
3. Project Settings → Service Accounts → Generate new private key
4. Save JSON as serviceAccountKey.json in the project root
5. Set FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json in .env
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger

from core.config import settings

_firestore_db = None


def _init_firebase():
    """
    Initialise Firebase Admin SDK (idempotent).

    Returns:
        Firestore client instance, or None if initialisation fails.
    """
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
                "Firestore persistence is DISABLED. "
                "Create serviceAccountKey.json to enable it."
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
    """
    Async-friendly wrapper around the synchronous Firebase Admin SDK.

    All blocking Firestore calls are run in a thread-pool executor so
    they do not block FastAPI's async event loop.
    """

    def __init__(self) -> None:
        self._db = _init_firebase()

    async def save_message(
        self,
        user_id: str,
        user_message: str,
        assistant_response: str,
        depression_score: float,
        risk_level: str,
        is_crisis: bool,
    ) -> None:
        """
        Persist a single chat turn to Firestore.

        Args:
            user_id: Unique user identifier.
            user_message: Raw user input.
            assistant_response: Final (post-filter) assistant reply.
            depression_score: Float [0, 1].
            risk_level: "LOW", "MODERATE", or "HIGH".
            is_crisis: Whether crisis was detected this turn.
        """
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
        )

    async def get_user_profile(self, user_id: str) -> dict | None:
        """
        Fetch the latest depression score and risk level for a user.

        Args:
            user_id: Unique user identifier.

        Returns:
            Profile dict or None if not found.
        """
        if self._db is None:
            return None

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._read_profile, user_id)

    def _write_message(
        self,
        user_id: str,
        user_message: str,
        assistant_response: str,
        depression_score: float,
        risk_level: str,
        is_crisis: bool,
    ) -> None:
        """Synchronous Firestore write – do not call from async context directly."""
        now = datetime.now(timezone.utc)

        messages_ref = (
            self._db.collection("chats").document(user_id).collection("messages")
        )
        messages_ref.add(
            {
                "user_message": user_message,
                "assistant_response": assistant_response,
                "depression_score": depression_score,
                "risk_level": risk_level,
                "is_crisis": is_crisis,
                "timestamp": now,
            }
        )

        profile_ref = (
            self._db.collection("chats")
            .document(user_id)
            .collection("profile")
            .document("latest")
        )
        profile_ref.set(
            {
                "depression_score": depression_score,
                "risk_level": risk_level,
                "last_updated": now,
            },
            merge=True,
        )

        logger.debug(f"[Firestore] Saved message for user={user_id!r}")

    def _read_profile(self, user_id: str) -> dict | None:
        """Synchronous Firestore read – do not call from async context directly."""
        doc = (
            self._db.collection("chats")
            .document(user_id)
            .collection("profile")
            .document("latest")
            .get()
        )
        if doc.exists:
            return doc.to_dict()
        return None
