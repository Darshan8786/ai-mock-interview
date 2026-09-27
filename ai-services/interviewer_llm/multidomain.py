"""
Runtime wrapper for the v2 COMBINED model (interview + aptitude + tech), trained by
training/train.py on data/v2_combined (see TRAINING.md section 12).

    llm = get_multidomain_llm()
    llm.warm()                                   # background load at server start - never blocks
    if llm.loaded:
        cands = llm.generate(ctx, n=3)           # parsed JSON dicts (NOT yet validated)
        llm.answer_mcq(question, options)        # greedy self-consistency answer (option text) or None

Weights: models/v2_combined/merged (plain transformers - what the Flask venv can load) or models/v2_combined/adapter
(+ base model, needs peft). MULTIDOMAIN_LLM=off disables it; every caller then uses its verified offline fallback.
No network, no API key.
"""
from __future__ import annotations

import json
import os
import threading
import time
from pathlib import Path

from .structured_validator import parse_json_output
from .training import prompting

ROOT = Path(__file__).resolve().parent
DEFAULT_DIR = Path(os.environ.get("MULTIDOMAIN_LLM_DIR", ROOT / "models" / "v2_combined"))
GEN = dict(do_sample=True, temperature=0.8, top_p=0.92, top_k=50, repetition_penalty=1.05)
MAX_NEW = {"interview": 96, "aptitude": 300, "tech": 380}


class MultiDomainLLM:
    def __init__(self, model_dir: str | Path = DEFAULT_DIR):
        self.model_dir = Path(model_dir)
        self._model = None
        self._tok = None
        self._lock = threading.Lock()
        self._gen_lock = threading.Lock()          # one generation at a time: CPU inference, bounded memory
        self.device = None
        self.load_error: str | None = None
        self.load_ms: float | None = None

    @property
    def enabled(self) -> bool:
        return os.environ.get("MULTIDOMAIN_LLM", "on").lower() not in ("off", "0", "false", "no")

    def available(self) -> bool:
        return (self.model_dir / "merged").is_dir() or (self.model_dir / "adapter").is_dir()

    def _load(self) -> None:
        if self._model is not None or self.load_error or not self.enabled:
            return
        with self._lock:
            if self._model is not None or self.load_error:
                return
            t0 = time.time()
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer

                if not self.available():
                    raise FileNotFoundError(f"no trained v2 model in {self.model_dir}")
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
                dtype = torch.float16 if self.device == "cuda" else torch.float32
                merged = self.model_dir / "merged"
                if merged.is_dir():
                    self._tok = AutoTokenizer.from_pretrained(merged)
                    model = AutoModelForCausalLM.from_pretrained(merged, torch_dtype=dtype)
                else:
                    from peft import PeftModel
                    info = json.loads((self.model_dir / "training_info.json").read_text(encoding="utf-8"))
                    self._tok = AutoTokenizer.from_pretrained(info["base_model"])
                    model = PeftModel.from_pretrained(AutoModelForCausalLM.from_pretrained(info["base_model"], torch_dtype=dtype),
                                                      self.model_dir / "adapter")
                self._model = model.to(self.device).eval()
            except Exception as exc:  # noqa: BLE001 - any failure degrades to the offline fallbacks
                self.load_error = f"{type(exc).__name__}: {exc}"
            finally:
                self.load_ms = round((time.time() - t0) * 1000, 1)

    def warm(self) -> None:
        if self.enabled and self._model is None and not self.load_error and self.available():
            threading.Thread(target=self._load, name="multidomain-llm-warmup", daemon=True).start()

    @property
    def loaded(self) -> bool:
        return self._model is not None

    def status(self) -> dict:
        return {"enabled": self.enabled, "trained_model_present": self.available(), "loaded": self.loaded,
                "device": self.device, "load_error": self.load_error, "load_ms": self.load_ms, "model_dir": str(self.model_dir)}

    def _run(self, task: str, instruction: str, input_text: str, n: int, max_new: int, sample: bool) -> list[str]:
        import torch

        msgs = prompting.build_messages(task, instruction, input_text)
        text = self._tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
        enc = self._tok(text, return_tensors="pt", add_special_tokens=False).to(self.device)
        kw = dict(GEN) if sample else {"do_sample": False}
        with self._gen_lock, torch.no_grad():
            out = self._model.generate(**enc, num_return_sequences=n, max_new_tokens=max_new, pad_token_id=self._tok.pad_token_id,
                                       eos_token_id=self._tok.eos_token_id, **kw)
        return [self._tok.decode(o[enc["input_ids"].shape[1]:], skip_special_tokens=True) for o in out]

    def generate(self, ctx: dict, n: int = 3) -> list[dict]:
        """Up to n parsed candidates for `ctx` (domain, topic, ... question_type). Unparseable outputs are dropped.
        Returns [] if the model is not loaded - callers fall back, never wait."""
        if not self.loaded:
            return []
        raw = self._run(prompting.qgen_v2_task(ctx["domain"]), prompting.QGEN_V2_INSTRUCTION, prompting.qgen_v2_input(ctx),
                        n, MAX_NEW.get(ctx["domain"], 300), True)
        return [p for p in (parse_json_output(r) for r in raw) if p]

    def answer_mcq(self, question: str, options: list[str]) -> str | None:
        """The model's own greedy answer to an MCQ (used as a self-consistency check on generated keys)."""
        if not self.loaded:
            return None
        out = self._run("mcq_answer", prompting.MCQ_ANSWER_INSTRUCTION, prompting.mcq_answer_input(question, options), 1, 60, False)
        return out[0].strip() if out else None


_instance: MultiDomainLLM | None = None
_instance_lock = threading.Lock()


def get_multidomain_llm() -> MultiDomainLLM:
    global _instance
    if _instance is None:
        with _instance_lock:
            if _instance is None:
                _instance = MultiDomainLLM()
    return _instance
