"""
Sentio – Model Inspector
========================
Verifies best_fusion_model.pt loads correctly and runs a test prediction.

Usage
-----
    cd sentio_backend
    python inspect_models.py
    python inspect_models.py --audio path/to/test.wav
    python inspect_models.py --text "I feel very hopeless today" --audio test.wav
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models"


def check_pt_file():
    pt = MODEL_DIR / "best_fusion_model.pt"
    print(f"\n{'='*60}")
    print("  best_fusion_model.pt")
    print(f"{'='*60}")
    if not pt.exists():
        print(f"  ✗  NOT FOUND at {pt}")
        print("  Place best_fusion_model.pt in the models/ directory.")
        return False
    print(f"  ✓  Found  ({pt.stat().st_size/1024/1024:.2f} MB)")

    try:
        import torch
        state = torch.load(pt, map_location="cpu", weights_only=True)
        print(f"  ✓  Loaded state_dict  ({len(state)} tensors)\n")
        total = 0
        for k, v in state.items():
            n = v.numel()
            total += n
            print(f"    {k:45s}  {str(tuple(v.shape)):20s}  {n:>8,}")
        print(f"\n  Total parameters: {total:,}")
        return True
    except ImportError:
        print("  ✗  PyTorch not installed.")
        print("     Run: pip install torch --index-url https://download.pytorch.org/whl/cpu")
        return False
    except Exception as e:
        print(f"  ✗  Load error: {e}")
        return False


def run_test(text: str, audio_path: str | None):
    print(f"\n{'='*60}")
    print("  Test Prediction")
    print(f"{'='*60}")
    print(f"  Text : {text!r}")
    print(f"  Audio: {audio_path or 'None (zero-padded)'}")

    sys.path.insert(0, str(Path(__file__).parent))
    from models.depression_model import hybrid_model

    if not hybrid_model.is_ready:
        print("\n  ⚠  Model not ready — running keyword heuristic fallback.")

    # predict() returns tuple[float, str] — unpack both
    score, risk = hybrid_model.predict(text=text, audio_path=audio_path)
    proba = hybrid_model.predict_proba(text=text, audio_path=audio_path)

    print(f"\n  ✅  Score     : {score:.4f}")
    print(f"  ✅  Risk level: {risk}")
    print(f"  ✅  Proba     : LOW={proba['LOW']:.3f}  MOD={proba['MODERATE']:.3f}  HIGH={proba['HIGH']:.3f}")


def check_projectors():
    print(f"\n{'='*60}")
    print("  Optional Projection Matrices")
    print(f"{'='*60}")
    for fname, desc in [
        ("text_projector.npy", "Text embed (BERT 384-d → 256-d)"),
        ("audio_projector.npy", "Audio MFCC (80-d → 256-d)"),
    ]:
        p = MODEL_DIR / fname
        if p.exists():
            import numpy as np
            arr = np.load(str(p))
            print(f"  ✓  {fname:30s}  shape={arr.shape}  ← will be used")
        else:
            print(f"  ⚠  {fname:30s}  NOT FOUND  ← random projection used (replace!)")
    print()
    print("  To create projection matrices from your training data:")
    print("  >>> import numpy as np")
    print("  >>> np.save('models/text_projector.npy', your_text_projection_matrix)")
    print("  >>> np.save('models/audio_projector.npy', your_audio_projection_matrix)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", default="I feel really hopeless and cannot go on")
    parser.add_argument("--audio", default=None)
    args = parser.parse_args()

    ok = check_pt_file()
    check_projectors()
    run_test(args.text, args.audio)
    print(f"\n{'='*60}\n")
