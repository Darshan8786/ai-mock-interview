"""
Inference for the local resume-category classifier (TF-IDF + calibrated
Linear SVM, trained on snehaanbhawal/resume-dataset - see
data/reports/dataset_usage_report.md and resume_classifier_eval.json for how
this was chosen and how well it performs). Loads the fitted vectorizer/model
once per process and reuses it (same lazy-singleton pattern as
local_question_generator.py / resume_enhancer.py elsewhere in ai-services).

No external API, no network call. If the model artifacts are missing (e.g.
training hasn't been run in this environment), classify_resume() returns
None instead of raising, so callers can fall back to the existing local
resume pipeline unaffected - this classifier is an additional signal, not a
replacement for localResumeParser.ts/localResumeAnalyzer.ts.
"""

import json
import threading
from pathlib import Path
from typing import Optional

MODEL_DIR = Path(__file__).parent / "models" / "resume_classifier"

_lock = threading.Lock()
_vectorizer = None
_model = None
_classes: Optional[list] = None
_load_attempted = False
_load_error: Optional[str] = None


def _ensure_loaded():
    global _vectorizer, _model, _classes, _load_attempted, _load_error
    if _load_attempted:
        return
    with _lock:
        if _load_attempted:
            return
        _load_attempted = True
        try:
            import joblib

            _vectorizer = joblib.load(MODEL_DIR / "vectorizer.joblib")
            _model = joblib.load(MODEL_DIR / "model.joblib")
            _classes = json.loads((MODEL_DIR / "classes.json").read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001 - any load failure just disables this feature
            _load_error = str(e)
            _vectorizer = _model = _classes = None


def is_loaded() -> bool:
    _ensure_loaded()
    return _model is not None


def load_error() -> Optional[str]:
    _ensure_loaded()
    return _load_error


def classify_resume(text: str, top_k: int = 3) -> Optional[dict]:
    """Returns {"category": str, "confidence": float, "top_3": [...]}, or None
    if the model isn't available (caller should fall back silently)."""
    _ensure_loaded()
    if _model is None or not text or not text.strip():
        return None

    X = _vectorizer.transform([text])
    probs = _model.predict_proba(X)[0]
    ranked = sorted(zip(_model.classes_, probs), key=lambda kv: -kv[1])

    top_category, top_confidence = ranked[0]
    return {
        "category": str(top_category),
        "confidence": round(float(top_confidence), 4),
        "top_3": [
            {"category": str(cat), "confidence": round(float(p), 4)}
            for cat, p in ranked[:top_k]
        ],
    }


if __name__ == "__main__":
    sample = (
        "Experienced software engineer with 5 years building scalable web "
        "applications using Python, React, and PostgreSQL. Led a team of 4 "
        "engineers to deliver a microservices platform. Skilled in AWS, "
        "Docker, and CI/CD pipelines."
    )
    result = classify_resume(sample)
    print("Loaded:", is_loaded(), "| error:", load_error())
    print("Result:", json.dumps(result, indent=2))
