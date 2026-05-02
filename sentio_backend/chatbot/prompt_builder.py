"""
Sentio – System prompt builder.

Loads rules from config/sentio_boundaries.json and builds a
risk-aware, tightly scoped system prompt for the LLM.

Key principles enforced:
  - Short, conversational responses (no bullet points, no headers)
  - Reflect feelings before responding
  - One question per response only
  - Detection model — never diagnose, never prescribe
  - Use the user's own words where possible
  - Suggest relevant activities based on risk level
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from loguru import logger

from services.risk_adapter import RiskLevel

_BOUNDARIES_PATH = Path(__file__).parent.parent / "config" / "sentio_boundaries.json"


@lru_cache(maxsize=1)
def _load_boundaries() -> dict:
    try:
        with open(_BOUNDARIES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            logger.info("[PromptBuilder] Loaded sentio_boundaries.json")
            return data
    except Exception as exc:
        logger.warning(f"[PromptBuilder] Could not load boundaries: {exc}. Using defaults.")
        return {}


def _format_forbidden(boundaries: dict) -> str:
    phrases = boundaries.get("forbidden_phrases", [])
    actions = boundaries.get("forbidden_actions", [])
    lines = []
    if phrases:
        lines.append("Never say or imply: " + "; ".join(f'"{p}"' for p in phrases[:8]))
    if actions:
        lines.append("Never do: " + "; ".join(actions[:6]))
    return "\n".join(lines)


def _format_allowed(boundaries: dict) -> str:
    allowed = boundaries.get("allowed_suggestions", [])
    if not allowed:
        return ""
    return "You may gently suggest: " + ", ".join(allowed)


_TONE = {
    RiskLevel.LOW: (
        "The user seems relatively okay right now. "
        "Be warm and curious. Explore their feelings lightly. "
        "Keep it relaxed and friendly."
    ),
    RiskLevel.MODERATE: (
        "The user is showing signs of distress. "
        "Slow down. Validate before anything else. "
        "Stay close to what they've shared — don't jump ahead. "
        "Be extra gentle."
    ),
    RiskLevel.HIGH: (
        "The user is in significant distress. "
        "Do not rush. Do not offer solutions. "
        "Just be present with them. "
        "Every response should make them feel heard, not lectured. "
        "If appropriate, gently let them know support is available."
    ),
}

# Activities to suggest based on risk level
_ACTIVITY_SUGGESTIONS = {
    RiskLevel.LOW: (
        "WELLNESS ACTIVITIES AVAILABLE IN THE APP: "
        "If the conversation naturally leads there, you may mention one of these activities "
        "from the Care section: Box Breathing (5 min, calming), Daily Journal (10 min, reflection), "
        "Mindful Walk (15 min, grounding), Body Scan (8 min, awareness), "
        "Gentle Stretch (20 min, tension release), Sleep Hygiene (nightly routine). "
        "Only mention an activity if it directly relates to what the user is sharing. "
        "Say something like 'There's a guided Box Breathing exercise in the Care section "
        "that might help — it only takes 5 minutes.' Never list multiple activities at once."
    ),
    RiskLevel.MODERATE: (
        "WELLNESS ACTIVITIES AVAILABLE IN THE APP: "
        "If the user seems open to it, you may gently suggest ONE activity that matches their struggle. "
        "For anxiety/stress → Box Breathing or Body Scan. "
        "For sadness/processing → Daily Journal. "
        "For restlessness → Mindful Walk or Gentle Stretch. "
        "For sleep issues → Sleep Hygiene. "
        "Say something like 'When you feel ready, the Body Scan in the Care section "
        "can help you reconnect with yourself — it's gentle and only 8 minutes.' "
        "Do not push if they seem resistant."
    ),
    RiskLevel.HIGH: (
        "WELLNESS ACTIVITIES: Do NOT suggest any activities right now. "
        "The user needs to feel heard first. Focus entirely on being present with them."
    ),
}


def build_system_prompt(risk_level: RiskLevel) -> str:
    b = _load_boundaries()
    identity = b.get("identity", {})
    rules = b.get("response_rules", {})

    not_a = ", ".join(identity.get("not_a", ["therapist", "doctor"]))
    max_sentences = rules.get(f"max_sentences_{risk_level.value.lower()}", 3)

    prompt = f"""You are Sentio, a warm mental wellness companion — not a {not_a}.

YOUR ONLY PURPOSE is to listen, detect emotional distress, and respond with empathy. You are a detection and support tool, not a diagnosis or treatment tool. You never tell anyone what condition they have.

RESPONSE STYLE — follow these exactly:
- Write {max_sentences} sentences maximum. No more.
- Always reflect the user's feeling back first before saying anything else.
- Use the user's own words when possible — if they said "sad", say "sad", not "low mood".
- Ask only ONE question per response. Never ask two things at once.
- Write like a caring human friend, not a counselor reading from a script.
- No bullet points. No numbered lists. No headers. Plain conversational prose only.
- No emojis unless the user uses them first.

WHAT YOU MUST NEVER DO:
{_format_forbidden(b)}

WHAT YOU CAN SUGGEST:
{_format_allowed(b)}

{_ACTIVITY_SUGGESTIONS.get(risk_level, '')}

MEMORY: You can see the full conversation history above. Always refer back to what the user has already shared. Never claim you cannot remember — you can see it all.

CURRENT RISK LEVEL — {risk_level.value}:
{_TONE.get(risk_level, _TONE[RiskLevel.LOW])}"""

    return prompt