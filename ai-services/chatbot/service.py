"""
Serving side of the neural study chatbot: loads the fine-tuned encoder once and
ranks a message against every training phrasing.

The Node backend calls POST /chatbot/match (see register()) and decides what to
do with the ranking; this module only does the semantic matching. Fully local —
no API key, no external service.
"""
from __future__ import annotations

import json
import threading
import time
from pathlib import Path

from chatbot.evaluate import Index

MODEL_DIR = Path(__file__).parent / "model"
MAX_TEXT = 500


class ChatbotMatcher:
    def __init__(self, model_dir: Path = MODEL_DIR):
        self.model_dir = model_dir
        self._lock = threading.Lock()
        self._index: Index | None = None
        self._meta: dict = {}

    @property
    def available(self) -> bool:
        return (self.model_dir / "meta.json").exists() and (self.model_dir / "train.json").exists()

    def _ensure(self) -> Index:
        if self._index is not None:
            return self._index
        with self._lock:
            if self._index is not None:
                return self._index
            if not self.available:
                raise FileNotFoundError(
                    f"No trained chatbot model at {self.model_dir}. Run `python -m chatbot.train`."
                )
            # Imported lazily so the Flask app still starts fast / without torch cost
            # until the first chatbot request.
            from sentence_transformers import SentenceTransformer

            t0 = time.time()
            model = SentenceTransformer(str(self.model_dir), device="cpu")
            model.max_seq_length = 64
            encode = lambda texts: model.encode(  # noqa: E731
                texts, normalize_embeddings=True, convert_to_numpy=True, batch_size=64, show_progress_bar=False
            )
            train = json.loads((self.model_dir / "train.json").read_text(encoding="utf-8"))
            self._meta = json.loads((self.model_dir / "meta.json").read_text(encoding="utf-8"))
            self._index = Index(train, encode)
            print(f"[chatbot] model loaded in {time.time() - t0:.1f}s ({len(train)} phrasings)")
            return self._index

    def status(self) -> dict:
        if not self.available:
            return {"available": False, "loaded": False}
        meta = self._meta or json.loads((self.model_dir / "meta.json").read_text(encoding="utf-8"))
        return {
            "available": True,
            "loaded": self._index is not None,
            "trainedAt": meta.get("trained_at"),
            "baseModel": meta.get("base_model"),
            "threshold": meta.get("threshold"),
            "heldOut": meta.get("held_out"),
        }

    def match(self, text: str, top_k: int = 8) -> dict:
        index = self._ensure()
        ranked = index.rank([text[:MAX_TEXT]])[0][:top_k]
        threshold = float(self._meta["threshold"])
        return {
            "ranked": [{"target": t, "score": round(s, 4)} for t, s in ranked],
            "threshold": threshold,
            "confidentThreshold": min(0.95, round(threshold + 0.10, 2)),
            "suggestMargin": float(self._meta.get("suggest_margin", 0.12)),
            "trainedAt": self._meta.get("trained_at"),
        }


_matcher = ChatbotMatcher()


def get_matcher() -> ChatbotMatcher:
    return _matcher


def register(app, require_auth):
    """Attach the chatbot endpoints to the Flask app (auth via the shared service key)."""
    from flask import jsonify, request

    # Load the model in the background at start-up. Loading (torch import + encoding
    # the training phrasings) takes several seconds; doing it lazily would make the
    # first student's message time out and fall back to the weaker keyword model.
    def _warm():
        try:
            get_matcher()._ensure()
        except Exception as exc:
            print(f"[chatbot] warm-up skipped: {exc}")

    if get_matcher().available:
        threading.Thread(target=_warm, name="chatbot-warmup", daemon=True).start()

    @app.route("/chatbot/match", methods=["POST"])
    @require_auth
    def chatbot_match():
        text = (request.get_json(silent=True) or {}).get("text")
        if not isinstance(text, str) or not text.strip():
            return jsonify({"error": "'text' must be a non-empty string"}), 400
        matcher = get_matcher()
        if not matcher.available:
            return jsonify({"error": "chatbot model not trained yet"}), 503
        try:
            return jsonify(matcher.match(text.strip()))
        except Exception as exc:  # surfaced to the caller, which falls back to keyword matching
            print(f"[chatbot] match failed: {exc}")
            return jsonify({"error": str(exc)}), 500

    @app.route("/chatbot/status", methods=["GET"])
    @require_auth
    def chatbot_status():
        return jsonify(get_matcher().status())
