"""
Sentio – Centralised application configuration.

All environment variables are read here via pydantic-settings.
Import `settings` from this module anywhere in the codebase.
"""

from __future__ import annotations

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM backend (API only) ────────────────────────────────────────────────
    # Calls any OpenAI-compatible /chat/completions endpoint.
    # Supported providers: Groq, Together AI, Anyscale, self-hosted vLLM / TGI.
    API_LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    API_LLM_MODEL: str = "llama3-8b-8192"
    API_LLM_KEY: str = ""

    # ── Firebase ──────────────────────────────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    FIREBASE_PROJECT_ID: str = ""

    # ── Conversation memory ───────────────────────────────────────────────────
    MEMORY_WINDOW: int = 10

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    # ── Safety ────────────────────────────────────────────────────────────────
    SAFETY_FILTER_DEBUG: bool = False


settings = Settings()
