"""
Step 11 - run the fine-tuned interviewer model locally.

    # from ai-services/
    python -m interviewer_llm.inference --topic SQL --difficulty Medium --count 5
    python -m interviewer_llm.inference --role "Backend Developer" --topic Python --count 3
    python -m interviewer_llm.inference --role "Data Engineer" --count 5        # role only -> topics picked for the role

Everything runs on this machine: no API key, no network call. Weights live in
models/software-engineering-interviewer/  (either merged/  or  adapter/ + the base model named in training_info.json).

Every candidate goes through question_validator.validate_question(); rejected ones are re-sampled (`max_retries`),
and if the model still cannot produce enough good questions the remainder comes from the verified local question bank.
Each returned item says which of the two produced it (`source`: "model" | "bank").
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import threading
import time
from pathlib import Path

from .question_validator import clean_generation, normalize, validate_question
from .training import common, prompting

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = ROOT / "models" / "software-engineering-interviewer"
CLEANED = ROOT / "data" / "processed" / "interview_cleaned.jsonl"

GEN = dict(max_new_tokens=64, do_sample=True, temperature=0.8, top_p=0.92, top_k=50, repetition_penalty=1.05)


def topics_for_role(role: str) -> list[str]:
    """Topics whose role list (common.ROLE_MAP) mentions this role; falls back to generic software-engineering topics."""
    r = role.strip().lower()
    hits = [t for t, roles in common.ROLE_MAP.items() if any(r == x.lower() or r in x.lower() or x.lower() in r for x in roles)]
    if not hits:
        hits = [t for t, roles in common.ROLE_MAP.items() if "Software Engineer" in roles]
    return hits or ["Data Structures", "Algorithms", "OOP"]


class QuestionBank:
    """Verified local fallback: the cleaned, de-duplicated interview questions (already checked when the dataset was built)."""

    def __init__(self, path: Path = CLEANED):
        self.records: list[dict] = []
        if path.exists():
            self.records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

    def pick(self, topic: str | None, difficulty: str | None, exclude: set[str]) -> str | None:
        pools = []
        if topic:
            pools.append([r for r in self.records if r["topic"].lower() == topic.lower() and r.get("difficulty") == difficulty])
            pools.append([r for r in self.records if r["topic"].lower() == topic.lower()])
        pools.append(self.records)
        for pool in pools:
            fresh = [r["question"] for r in pool if normalize(r["question"]) not in exclude]
            if fresh:
                return random.choice(fresh)
        return None


class InterviewerLLM:
    def __init__(self, model_dir: str | Path = DEFAULT_MODEL_DIR, device: str | None = None):
        self.model_dir = Path(model_dir)
        self.device = device
        self._model = None
        self._tok = None
        self._lock = threading.Lock()
        self.load_error: str | None = None
        self.load_ms: float | None = None
        self.bank = QuestionBank()

    # ------------------------------------------------------------------ loading
    def available(self) -> bool:
        return (self.model_dir / "merged").is_dir() or (self.model_dir / "adapter").is_dir()

    def _load(self) -> None:
        if self._model is not None or self.load_error:
            return
        with self._lock:
            if self._model is not None or self.load_error:
                return
            t0 = time.time()
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer

                if not self.available():
                    raise FileNotFoundError(f"no trained model in {self.model_dir} - run training/train.py first")
                self.device = self.device or ("cuda" if torch.cuda.is_available() else "cpu")
                dtype = torch.float16 if self.device == "cuda" else torch.float32
                merged = self.model_dir / "merged"
                if merged.is_dir():
                    self._tok = AutoTokenizer.from_pretrained(merged)
                    model = AutoModelForCausalLM.from_pretrained(merged, torch_dtype=dtype)
                else:
                    from peft import PeftModel

                    info = json.loads((self.model_dir / "training_info.json").read_text(encoding="utf-8"))
                    self._tok = AutoTokenizer.from_pretrained(info["base_model"])
                    base = AutoModelForCausalLM.from_pretrained(info["base_model"], torch_dtype=dtype)
                    model = PeftModel.from_pretrained(base, self.model_dir / "adapter")
                self._model = model.to(self.device).eval()
            except Exception as exc:  # noqa: BLE001 - any failure must degrade to the bank, never crash the caller
                self.load_error = f"{type(exc).__name__}: {exc}"
            finally:
                self.load_ms = round((time.time() - t0) * 1000, 1)

    @property
    def ready(self) -> bool:
        self._load()
        return self._model is not None

    # --------------------------------------------------------------- generation
    def sample(self, topic: str, difficulty: str | None = None, role: str | None = None, subtopic: str | None = None,
               n: int = 4) -> list[str]:
        """Raw model outputs (already reduced to one line, NOT yet validated)."""
        if not self.ready:
            return []
        import torch

        msgs = prompting.build_messages("qgen", prompting.QGEN_INSTRUCTION, prompting.qgen_input(role, topic, difficulty, subtopic))
        text = self._tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
        enc = self._tok(text, return_tensors="pt", add_special_tokens=False).to(self.device)
        with torch.no_grad():
            out = self._model.generate(**enc, num_return_sequences=n, pad_token_id=self._tok.pad_token_id,
                                       eos_token_id=self._tok.eos_token_id, **GEN)
        return [clean_generation(self._tok.decode(o[enc["input_ids"].shape[1]:], skip_special_tokens=True)) for o in out]

    def warm(self) -> None:
        """Start loading in a background thread and return immediately (used at server start-up)."""
        if self._model is None and not self.load_error and self.available():
            threading.Thread(target=self._load, name="interviewer-llm-warmup", daemon=True).start()

    @property
    def loaded(self) -> bool:
        """True only if the model is already in memory - never triggers a load, never blocks."""
        return self._model is not None

    def generate_from_model(self, topic: str, difficulty: str | None = None, role: str | None = None, subtopic: str | None = None,
                            exclude: list[str] | None = None, max_retries: int = 4, batch: int = 4,
                            reject_if=None) -> dict | None:
        """A validated, non-duplicate question from the MODEL ONLY, or None if it could not produce one
        (so the caller can move on to the next fallback). Never raises.
        `reject_if(question) -> bool` lets the caller veto a question that passed validation (MindPrep passes its
        global cross-user history check here, so a repeat triggers a re-sample instead of a wasted outer attempt)."""
        exclude = list(exclude or [])
        rejected: list[dict] = []
        t0 = time.time()
        attempts = 0
        for _ in range(max_retries):
            try:
                candidates = self.sample(topic, difficulty, role, subtopic, n=batch)
            except Exception as exc:  # noqa: BLE001
                self.load_error = self.load_error or f"generation failed: {exc}"
                return None
            if not candidates:
                return None
            for cand in candidates:
                attempts += 1
                verdict = validate_question(cand, topic=topic, exclude=exclude, cleaned=True)
                if verdict.ok and reject_if is not None and reject_if(verdict.question):
                    verdict.reasons.append("history_duplicate")
                if verdict.ok:
                    return {"question": verdict.question, "source": "model", "attempts": attempts, "rejected": rejected,
                            "ms": round((time.time() - t0) * 1000, 1)}
                rejected.append({"text": cand, "reasons": verdict.reasons})
        self.last_rejected = rejected
        return None

    def generate_question(self, topic: str, difficulty: str | None = None, role: str | None = None, subtopic: str | None = None,
                          exclude: list[str] | None = None, max_retries: int = 4, batch: int = 4) -> dict:
        """One validated, non-duplicate question: model first, then the verified bank. Never raises.
        {"question","source": "model"|"bank"|"none","attempts","rejected":[...]}."""
        t0 = time.time()
        got = self.generate_from_model(topic, difficulty, role, subtopic, exclude, max_retries, batch)
        if got:
            return got
        picked = self.bank.pick(topic, difficulty, {normalize(q) for q in (exclude or [])})
        return {"question": picked, "source": "bank" if picked else "none", "attempts": 0, "rejected": getattr(self, "last_rejected", []),
                "ms": round((time.time() - t0) * 1000, 1)}

    def generate_questions(self, count: int, topic: str | None = None, difficulty: str | None = None, role: str | None = None,
                           exclude: list[str] | None = None, **kw) -> list[dict]:
        """`count` distinct questions. With no topic, topics are chosen from the role and rotated for variety."""
        exclude = list(exclude or [])
        topics = [topic] if topic else topics_for_role(role or "Software Engineer")
        results: list[dict] = []
        for i in range(count):
            t = topics[i % len(topics)]
            r = self.generate_question(t, difficulty, role, exclude=exclude, **kw)
            if not r["question"]:
                continue
            r["topic"] = t
            results.append(r)
            exclude.append(r["question"])
        return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--topic")
    ap.add_argument("--difficulty", choices=["Easy", "Medium", "Hard"])
    ap.add_argument("--role")
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    ap.add_argument("--show-rejected", action="store_true")
    args = ap.parse_args()
    if not args.topic and not args.role:
        ap.error("give --topic and/or --role")

    llm = InterviewerLLM(args.model_dir)
    if not llm.ready:
        print(f"[model unavailable: {llm.load_error}] -> answers below come from the verified question bank", file=sys.stderr)
    for i, r in enumerate(llm.generate_questions(args.count, args.topic, args.difficulty, args.role), 1):
        print(f"{i}. [{r['topic']}] ({r['source']}, {r['attempts']} tries, {r['ms']} ms) {r['question']}")
        if args.show_rejected:
            for rej in r["rejected"]:
                print(f"     x {rej['reasons']}: {rej['text'][:100]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
