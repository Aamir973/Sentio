"""
Sentio – Abstract LLM interface.

All concrete LLM adapters must implement this protocol so the rest
of the codebase remains backend-agnostic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List


class LLMInterface(ABC):
    """Abstract base class for all LLM backends used by Sentio."""

    @abstractmethod
    async def chat(
        self,
        system_prompt: str,
        messages: List[dict],
    ) -> str:
        """
        Send a conversation to the language model and return its reply.

        Args:
            system_prompt: High-level instructions injected as the system message.
            messages: Ordered list of {"role": "user"|"assistant", "content": "..."}
                      dicts representing the conversation so far.

        Returns:
            The model's reply as a plain string.

        Raises:
            RuntimeError: If the LLM backend is unreachable or returns
                          an unexpected response.
        """
        ...
