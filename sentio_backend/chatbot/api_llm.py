"""
Sentio – Remote API LLM adapter.

Calls any OpenAI-compatible /chat/completions endpoint.
Works out-of-the-box with Groq, Together AI, Anyscale, Replicate,
or a self-hosted vLLM / TGI server.

Required env vars:
    API_LLM_BASE_URL  – e.g. https://api.groq.com/openai/v1
    API_LLM_MODEL     – e.g. llama3-8b-8192
    API_LLM_KEY       – your API key
"""

from __future__ import annotations

from typing import List

import httpx
from loguru import logger

from core.config import settings
from chatbot.llm_interface import LLMInterface


class ApiLLM(LLMInterface):
    """
    OpenAI-compatible remote LLM adapter.

    Uses the /chat/completions endpoint supported by Groq, Together AI,
    Anyscale, and self-hosted servers.
    """

    def __init__(self) -> None:
        base = settings.API_LLM_BASE_URL.rstrip("/")
        self._endpoint: str = f"{base}/chat/completions"
        self._model: str = settings.API_LLM_MODEL
        self._api_key: str = settings.API_LLM_KEY
        self._timeout: float = 60.0

        if not self._api_key:
            logger.warning(
                "[ApiLLM] API_LLM_KEY is not set. "
                "Set it in your .env file before making requests."
            )

    async def chat(self, system_prompt: str, messages: List[dict]) -> str:
        """
        Send messages to the remote API and return the assistant reply.

        Args:
            system_prompt: Injected as the first system message.
            messages: Prior conversation turns.

        Returns:
            Assistant reply string.

        Raises:
            RuntimeError: On HTTP errors, timeouts, or malformed responses.
        """
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                *messages,
            ],
            "temperature": 0.7,
            "max_tokens": 512,
        }

        logger.debug(f"[ApiLLM] POST {self._endpoint} model={self._model}")

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(
                    self._endpoint, json=payload, headers=headers
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            logger.error(f"[ApiLLM] HTTP {status}: {exc.response.text[:200]}")
            raise RuntimeError(
                "The AI service returned an error. Please try again shortly."
            ) from exc
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            logger.error(f"[ApiLLM] Connection error: {exc}")
            raise RuntimeError(
                "I'm having trouble reaching the AI service. Please try again."
            ) from exc
        except (KeyError, IndexError) as exc:
            logger.error(f"[ApiLLM] Malformed response: {exc}")
            raise RuntimeError(
                "Received an unexpected response. Please try again."
            ) from exc
