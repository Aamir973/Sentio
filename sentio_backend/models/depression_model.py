"""
Sentio – Hybrid Depression Model  (PyTorch Fusion)
====================================================

Architecture reverse-engineered from best_fusion_model.pt:
-----------------------------------------------------------

  text  (raw string)
    │
    ▼  BERT (sentence-transformers → 768-d → PCA/Linear → 256-d)
  text_features [256]
    │                                          ┌──────────────────────┐
    ├──▶ text_proj  Linear(256→512) ──▶ t  ───▶│                      │
    │                                          │  Attention gate       │──▶ fused [512]
    ├──▶ audio_proj Linear(256→512) ──▶ a  ───▶│  Linear(512→256→1)   │
    │                                          └──────────────────────┘
  audio (.wav/.mp3)
    │
    ▼  MFCC: librosa → 40 coeffs → mean+std = 80 → Linear(80→256)
  audio_features [256]
                                           │
                                           ▼
                              predictor  Linear(512→256)
                                         BatchNorm1d(256)
                                         Linear(256→128)
                                         Linear(128→1)   ← raw regression score
                                           │
                                           ▼
                              sigmoid → [0, 1] → LOW / MODERATE / HIGH

Public API
----------
predict(text, audio_path=None) → tuple[float, str]
    Returns (depression_score, risk_level)
    - depression_score : float in [0, 1]
    - risk_level       : "LOW" | "MODERATE" | "HIGH"

IMPORTANT: The caller (api/chat.py) MUST unpack both values:
    score, risk_hint = hybrid_model.predict(text=..., audio_path=...)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
from loguru import logger

# ── Paths ──────────────────────────────────────────────────────────────────────
_MODEL_DIR = Path(__file__).parent
FUSION_MODEL_PATH = _MODEL_DIR / "best_fusion_model.pt"

# ── Dimension constants (from .pt inspection) ──────────────────────────────────
TEXT_EMBED_DIM = 256
AUDIO_EMBED_DIM = 256
N_MFCC = 40
AUDIO_RAW_DIM = 2 * N_MFCC  # 80 → projected to 256

# ── MFCC config ────────────────────────────────────────────────────────────────
SAMPLE_RATE = 22050
MAX_AUDIO_SEC = 30

# ── Score → risk thresholds ────────────────────────────────────────────────────
LOW_MAX = 0.35
MODERATE_MAX = 0.65


# ──────────────────────────────────────────────────────────────────────────────
#  PyTorch model class  (must EXACTLY match training definition)
# ──────────────────────────────────────────────────────────────────────────────

def _build_fusion_model():
    import torch
    import torch.nn as nn

    class FusionModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.text_proj = nn.Linear(256, 512)
            self.audio_proj = nn.Linear(256, 512)
            self.attention = nn.Sequential(
                nn.Linear(512, 256),
                nn.ReLU(),
                nn.Linear(256, 1),
            )
            self.predictor = nn.Sequential(
                nn.Linear(512, 256),    # [0]
                nn.ReLU(),              # [1]
                nn.Dropout(0.3),        # [2]
                nn.BatchNorm1d(256),    # [3]
                nn.Linear(256, 128),    # [4]
                nn.ReLU(),              # [5]
                nn.Dropout(0.3),        # [6]
                nn.Linear(128, 1),      # [7]
            )

        def forward(self, text_feat, audio_feat):
            t = self.text_proj(text_feat)
            a = self.audio_proj(audio_feat)
            combined = t + a
            attn_weight = torch.sigmoid(self.attention(combined))
            fused = attn_weight * t + (1 - attn_weight) * a
            raw = self.predictor(fused)
            return torch.sigmoid(raw).squeeze(1)

    return FusionModel()


# ──────────────────────────────────────────────────────────────────────────────
#  Feature extractors
# ──────────────────────────────────────────────────────────────────────────────

class _TextProjector:
    SENTENCE_MODEL = "all-MiniLM-L6-v2"
    RAW_EMBED_DIM = 384

    def __init__(self):
        self._encoder = None
        self._projector = None
        self._ready = False
        self._load()

    def _load(self):
        proj_path = _MODEL_DIR / "text_projector.npy"
        if proj_path.exists():
            self._projector = np.load(str(proj_path))
            logger.info("[TextProjector] Loaded projection matrix.")

        try:
            from sentence_transformers import SentenceTransformer
            self._encoder = SentenceTransformer(self.SENTENCE_MODEL)
            self._ready = True
            logger.info(f"[TextProjector] Loaded {self.SENTENCE_MODEL}.")
        except ImportError:
            logger.warning(
                "[TextProjector] sentence-transformers not installed. "
                "Install: pip install sentence-transformers\n"
                "Using TF-IDF heuristic fallback."
            )
        except Exception as e:
            logger.warning(f"[TextProjector] Load error: {e}. Using fallback.")

    def encode(self, text: str) -> np.ndarray:
        """Return (256,) float32 array."""
        if not self._ready:
            return self._tfidf_fallback(text)

        raw = self._encoder.encode([text], convert_to_numpy=True)[0]

        if self._projector is not None:
            vec = raw @ self._projector
        else:
            rng = np.random.default_rng(42)
            P = rng.standard_normal((len(raw), TEXT_EMBED_DIM)).astype(np.float32)
            P /= np.linalg.norm(P, axis=0, keepdims=True) + 1e-8
            vec = raw @ P

        return vec.astype(np.float32)

    @staticmethod
    def _tfidf_fallback(text: str) -> np.ndarray:
        rng = np.random.default_rng(abs(hash(text)) % (2**31))
        return rng.standard_normal(TEXT_EMBED_DIM).astype(np.float32)


class _AudioProjector:
    def __init__(self):
        self._projector = None
        proj_path = _MODEL_DIR / "audio_projector.npy"
        if proj_path.exists():
            self._projector = np.load(str(proj_path))
            logger.info("[AudioProjector] Loaded audio projection matrix.")

    def encode(self, audio_path: str | Path) -> np.ndarray:
        """Extract MFCC then project to (256,) float32."""
        mfcc_raw = self._extract_mfcc(audio_path)
        return self._project(mfcc_raw)

    def zeros(self) -> np.ndarray:
        """Return zero vector for text-only mode."""
        return np.zeros(AUDIO_EMBED_DIM, dtype=np.float32)

    @staticmethod
    def _extract_mfcc(audio_path: str | Path) -> np.ndarray:
        try:
            import librosa
        except ImportError as e:
            raise ImportError(
                "librosa required for audio. Run: pip install librosa soundfile"
            ) from e
        y, sr = librosa.load(
            str(audio_path), sr=SAMPLE_RATE, duration=MAX_AUDIO_SEC, mono=True
        )
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
        return np.concatenate(
            [mfcc.mean(axis=1), mfcc.std(axis=1)]
        ).astype(np.float32)

    def _project(self, mfcc: np.ndarray) -> np.ndarray:
        if self._projector is not None:
            return (mfcc @ self._projector).astype(np.float32)
        rng = np.random.default_rng(99)
        P = rng.standard_normal((AUDIO_RAW_DIM, AUDIO_EMBED_DIM)).astype(np.float32)
        P /= np.linalg.norm(P, axis=0, keepdims=True) + 1e-8
        return (mfcc @ P).astype(np.float32)


# ──────────────────────────────────────────────────────────────────────────────
#  Main model class
# ──────────────────────────────────────────────────────────────────────────────

class HybridDepressionModel:
    """
    Sentio multimodal depression risk scorer.

    Returns: tuple[float, str]  ← (depression_score, risk_level)

    Always unpack both values at the call site:
        score, risk = hybrid_model.predict(text="...", audio_path=None)
    """

    def __init__(self):
        self._model = None
        self._text_proj = _TextProjector()
        self._audio_proj = _AudioProjector()
        self._ready = False
        self._load_model()

    def _load_model(self):
        try:
            import torch
        except ImportError:
            logger.error(
                "[HybridDepressionModel] PyTorch not installed!\n"
                "Install: pip install torch --index-url https://download.pytorch.org/whl/cpu"
            )
            return

        if not FUSION_MODEL_PATH.exists():
            logger.warning(
                f"[HybridDepressionModel] Model not found: {FUSION_MODEL_PATH}\n"
                "Place best_fusion_model.pt in the models/ directory.\n"
                "Falling back to keyword heuristic."
            )
            return

        try:
            self._model = _build_fusion_model()
            state = torch.load(
                FUSION_MODEL_PATH, map_location="cpu", weights_only=True
            )
            self._model.load_state_dict(state)
            self._model.eval()
            self._ready = True
            logger.info(
                "✓ [HybridDepressionModel] best_fusion_model.pt loaded (559,618 params)."
            )
        except Exception as exc:
            logger.error(f"[HybridDepressionModel] Load failed: {exc}")

    # ── Public API ─────────────────────────────────────────────────────────────

    def predict(
        self,
        text: str,
        audio_path: Optional[str | Path] = None,
    ) -> tuple[float, str]:
        """
        Predict depression risk score and tier.

        Parameters
        ----------
        text       : User message (required).
        audio_path : Path to .wav or .mp3 (optional).
                     When absent the audio slot is zero-padded.

        Returns
        -------
        (depression_score, risk_level)
            depression_score : float [0, 1]
            risk_level       : "LOW" | "MODERATE" | "HIGH"
        """
        if not self._ready:
            logger.debug("[HybridDepressionModel] Falling back to heuristic.")
            return _heuristic_predict(text)

        try:
            return self._run_inference(text, audio_path)
        except Exception as exc:
            logger.error(f"[HybridDepressionModel] Inference error: {exc}")
            return _heuristic_predict(text)

    def _run_inference(self, text: str, audio_path) -> tuple[float, str]:
        import torch

        text_vec = self._text_proj.encode(text)

        if audio_path is not None:
            audio_vec = self._audio_proj.encode(audio_path)
            logger.debug(f"[HybridDepressionModel] Audio encoded from {audio_path}")
        else:
            audio_vec = self._audio_proj.zeros()
            logger.debug("[HybridDepressionModel] No audio — zero-padded.")

        with torch.no_grad():
            t = torch.tensor(text_vec, dtype=torch.float32).unsqueeze(0)
            a = torch.tensor(audio_vec, dtype=torch.float32).unsqueeze(0)
            score_tensor = self._model(t, a)
            score = float(score_tensor.item())

        risk = _score_to_risk(score)
        logger.info(
            f"[HybridDepressionModel] score={score:.4f}  risk={risk}"
            + (f"  audio=✓" if audio_path else "  audio=✗(zero-padded)")
        )
        return score, risk

    def predict_proba(self, text: str, audio_path=None) -> dict:
        """
        Return probability-style dict for each tier.

        Returns  {"LOW": float, "MODERATE": float, "HIGH": float}
        """
        score, _ = self.predict(text, audio_path)
        if score <= LOW_MAX:
            p_low, p_mod, p_high = 1 - score / LOW_MAX, score / LOW_MAX, 0.0
        elif score <= MODERATE_MAX:
            t = (score - LOW_MAX) / (MODERATE_MAX - LOW_MAX)
            p_low, p_mod, p_high = 0.0, 1 - t, t
        else:
            t = (score - MODERATE_MAX) / (1.0 - MODERATE_MAX)
            p_low, p_mod, p_high = 0.0, 0.0, t
        return {
            "LOW": round(p_low, 4),
            "MODERATE": round(p_mod, 4),
            "HIGH": round(p_high, 4),
        }

    def reload(self):
        """Hot-reload model weights from disk without restarting the server."""
        logger.info("[HybridDepressionModel] Reloading…")
        self._ready = False
        self._model = None
        self._load_model()

    @property
    def is_ready(self) -> bool:
        return self._ready


# ──────────────────────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _score_to_risk(score: float) -> str:
    if score <= LOW_MAX:
        return "LOW"
    elif score <= MODERATE_MAX:
        return "MODERATE"
    else:
        return "HIGH"


_NEG_KW = {
    "hopeless", "worthless", "tired", "exhausted", "empty", "lonely",
    "depressed", "numb", "lost", "broken", "pointless", "overwhelmed",
    "anxious", "panic", "hate myself", "can't cope", "no point", "give up",
}


def _heuristic_predict(text: str) -> tuple[float, str]:
    """Keyword fallback used when .pt is not loaded."""
    hits = sum(1 for kw in _NEG_KW if kw in text.lower())
    score = min(hits / 5.0, 1.0)
    return score, _score_to_risk(score)


# ── Module-level singleton ─────────────────────────────────────────────────────
hybrid_model = HybridDepressionModel()
