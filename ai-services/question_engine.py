"""
Common question-generation engine for the three learning systems - INTERVIEW, APTITUDE, TECH.

    receive config -> domain -> topic/technology -> difficulty -> question type -> (weak areas: chosen by the caller)
      -> generate (local v2 model) -> validate structure -> validate answer -> check duplicates -> return
      -> on any failure: next candidate / retry -> verified offline fallback  (never raises, never returns junk)

Each domain has its own pipeline (prompts are specialised per domain in interviewer_llm/training/prompting.py):

  generate_interview_question()  the EXISTING mock-interview chain (local_question_generator), unchanged
  generate_aptitude_question()   v2 model -> structured_validator (+ deterministic numeric verification, or a model
                                 self-consistency check for non-numeric items) -> template -> verified seed bank
  generate_tech_question()       v2 model -> structured_validator (+ self-consistency for MCQs) -> verified dataset

The returned record CONTAINS the answer key. It is meant for the Node backend only (service-to-service, behind
X-AI-Service-Key); the backend stores it and strips the key before anything reaches a browser.
No external API anywhere.
"""
from __future__ import annotations

import hashlib
import json
import os
import random
import threading
import time
from pathlib import Path

from interviewer_llm import aptitude_templates
from interviewer_llm.multidomain import get_multidomain_llm
from interviewer_llm.question_validator import is_duplicate, normalize
from interviewer_llm.structured_validator import (APTITUDE_CATEGORIES, TECHNOLOGIES, TECH_TYPES, _opt_key, norm_difficulty,
                                                  structure_signature, validate_structured)
from tech_question_engine import get_engine as get_tech_engine

ROOT = Path(__file__).resolve().parent
APTITUDE_BANK = ROOT / "interviewer_llm" / "data" / "v2_combined" / "aptitude_bank.jsonl"
MODEL_BATCHES = int(os.environ.get("QUESTION_ENGINE_MODEL_BATCHES", "2"))
MODEL_BATCH_SIZE = int(os.environ.get("QUESTION_ENGINE_BATCH", "3"))
MODEL_BUDGET_S = float(os.environ.get("QUESTION_ENGINE_MODEL_BUDGET_S", "12"))  # a batch started before the deadline may still finish (~12 s on CPU)
# STRICT (default ON): model output is only served where its answer key can be PROVEN - numerical aptitude, via
# numeric_verifier. Tech and non-numeric aptitude then come from the curated, verified banks. Measured reason: the
# model's self-consistency check (its own greedy re-answer) agreed with a factually wrong generated Java MCQ in a live
# test, and its mcq_answer accuracy on the held-out test split is 0.625 - not a safe gate for answer keys.
# QUESTION_ENGINE_STRICT=off re-enables model tech / non-numeric aptitude items behind the self-consistency check.
STRICT = os.environ.get("QUESTION_ENGINE_STRICT", "on").lower() in ("1", "on", "true", "yes")
NUMERIC_APTITUDE = ("Quantitative", "Data Interpretation")

TECH_TYPE_TO_DATASET = {"mcq": ["MCQ"], "conceptual": ["Conceptual", "Technical", "Scenario Based"],
                        "output_prediction": ["Output Prediction"], "debugging": ["Debugging"],
                        "coding": ["Coding", "Programming Problem", "SQL Query"]}
DATASET_TO_TECH_TYPE = {d: t for t, ds in TECH_TYPE_TO_DATASET.items() for d in ds}
MODEL_TECH_TYPES = ("mcq", "conceptual", "output_prediction", "debugging")   # coding always comes from the dataset
CAP = {"easy": "Easy", "medium": "Medium", "hard": "Hard"}


def _gen_id(prefix: str, text: str) -> str:
    return f"{prefix}_{hashlib.sha1(text.encode('utf-8')).hexdigest()[:12]}"


def _dup(question: str, exclude: list[str], session: list[str], same_template_ok: bool = False) -> str | None:
    d = is_duplicate(question, exclude + session)
    if d:
        return d
    if session and not same_template_ok:
        sig = structure_signature(question)
        from difflib import SequenceMatcher
        if any(SequenceMatcher(None, sig, structure_signature(s)).ratio() >= 0.92 for s in session):
            return "same_template_in_session"
    return None


class QuestionGenerationService:
    def __init__(self):
        self.llm = get_multidomain_llm()
        self._bank: list[dict] | None = None
        self._bank_lock = threading.Lock()
        self.stats = {"aptitude": {}, "tech": {}}

    # ── shared helpers ─────────────────────────────────────────────────────────
    def aptitude_bank(self) -> list[dict]:
        if self._bank is None:
            with self._bank_lock:
                if self._bank is None:
                    rows = []
                    if APTITUDE_BANK.exists():
                        rows = [json.loads(l) for l in APTITUDE_BANK.read_text(encoding="utf-8").splitlines() if l.strip()]
                    self._bank = rows
        return self._bank

    def _count(self, domain: str, key: str) -> None:
        self.stats[domain][key] = self.stats[domain].get(key, 0) + 1

    def _model_candidates(self, ctx: dict, validate, deadline: float) -> tuple[dict | None, list[dict]]:
        """Samples from the v2 model until one candidate passes `validate` or the budget is spent."""
        rejected: list[dict] = []
        if not self.llm.loaded:
            return None, rejected
        for _ in range(MODEL_BATCHES):
            if time.time() > deadline:
                break
            try:
                cands = self.llm.generate(ctx, n=MODEL_BATCH_SIZE)
            except Exception as exc:  # noqa: BLE001 - model failure -> fallback, never an error to the student
                rejected.append({"reasons": [f"generation_error: {type(exc).__name__}"]})
                break
            if not cands:
                rejected.append({"reasons": ["unparseable_output"]})
            for c in cands:
                ok, reasons, rec = validate(c)
                if ok:
                    return rec, rejected
                rejected.append({"question": str(c.get("question", ""))[:120], "reasons": reasons})
        return None, rejected

    def _self_consistent(self, question: str, options: list[str], answer: str) -> bool:
        """The model re-answers its own MCQ greedily; the key must match. A consistency filter, not a proof."""
        if STRICT:
            return False
        try:
            got = self.llm.answer_mcq(question, options)
        except Exception:  # noqa: BLE001
            return False
        return bool(got) and _opt_key(got) == _opt_key(answer)

    # ── INTERVIEW ──────────────────────────────────────────────────────────────
    def generate_interview_question(self, skill: str, topic: str, difficulty: str = "Medium", job_role: str = "",
                                    exclude: list[str] | None = None) -> dict:
        """Delegates to the existing mock-interview chain (fine-tuned interviewer -> small model -> bank) unchanged."""
        from local_question_generator import get_generator
        r = get_generator().generate_question(skill=skill, topic=topic, difficulty=difficulty, job_role=job_role,
                                              exclude_questions=exclude or [])
        return {"domain": "interview", "question": r["question"], "skill": skill, "topic": topic, "source": r["source"]}

    # ── APTITUDE ───────────────────────────────────────────────────────────────
    def generate_aptitude_question(self, category: str, topic: str, difficulty: str = "medium", exclude: list[str] | None = None,
                                   session: list[str] | None = None, exclude_bank_ids: list[str] | None = None,
                                   use_model: bool = True) -> dict:
        exclude, session = list(exclude or []), list(session or [])
        difficulty = norm_difficulty(difficulty) or "medium"
        if category not in APTITUDE_CATEGORIES:
            category = next((r["category"] for r in self.aptitude_bank() if r["topic"] == topic), "Quantitative")
        ctx = {"domain": "aptitude", "category": category, "topic": topic, "difficulty": difficulty, "question_type": "mcq"}
        t0 = time.time()

        def validate(c):
            v = validate_structured(c, ctx, exclude=exclude, session_exclude=session)
            if not v.ok:
                return False, v.reasons, None
            rec = v.record
            verification = v.verification
            if verification != "deterministic":
                if not self._self_consistent(rec["question"], rec["options"], rec["answer"]):
                    return False, ["failed_self_consistency" if not STRICT else "not_deterministically_verifiable"], None
                verification = "self_consistency"
            return True, [], {**rec, "verification": verification}

        rejected: list[dict] = []
        provable = category in NUMERIC_APTITUDE or topic == "Number Series"
        if use_model and (provable or not STRICT):
            rec, rejected = self._model_candidates(ctx, validate, t0 + MODEL_BUDGET_S)
            if rec:
                self._count("aptitude", "model")
                return self._aptitude_out(rec, ctx, "model", rejected, t0)

        # verified fallback 1: correct-by-construction template (fresh numbers every time)
        if topic in aptitude_templates.TEMPLATES:
            rng = random.Random()
            for _ in range(12):
                it = aptitude_templates.generate(topic, difficulty, rng)
                if not _dup(it["question"], exclude, session):
                    self._count("aptitude", "template")
                    return self._aptitude_out({**it, "verification": "deterministic"}, ctx, "template", rejected, t0)

        # verified fallback 2: cleaned, answer-checked seed bank
        banned = set(exclude_bank_ids or [])
        pools = [lambda r: r["topic"] == topic and r["difficulty"] == difficulty,
                 lambda r: r["topic"] == topic,
                 lambda r: r["category"] == category and r["difficulty"] == difficulty,
                 lambda r: r["category"] == category]
        for pool in pools:
            cands = [r for r in self.aptitude_bank() if pool(r) and r["id"] not in banned and not is_duplicate(r["question"], exclude + session)]
            if cands:
                self._count("aptitude", "bank")
                return self._aptitude_out(dict(random.choice(cands)), ctx, "bank", rejected, t0)
        # everything in scope already seen: repeat the least-bad option rather than fail the session
        any_topic = [r for r in self.aptitude_bank() if r["topic"] == topic] or [r for r in self.aptitude_bank() if r["category"] == category]
        if any_topic:
            self._count("aptitude", "bank_repeat")
            return self._aptitude_out(dict(random.choice(any_topic)), ctx, "bank", rejected, t0, repeated=True)
        return {"error": f"no aptitude question available for {category} / {topic}"}

    @staticmethod
    def _aptitude_out(rec: dict, ctx: dict, source: str, rejected: list, t0: float, repeated: bool = False) -> dict:
        opts = list(rec["options"])
        idx = rec.get("answer_index", opts.index(rec["answer"]) if rec.get("answer") in opts else -1)
        return {
            "id": rec.get("id") or _gen_id("apt", rec["question"] + "|".join(opts)),
            "domain": "aptitude", "category": rec.get("category") or ctx["category"], "topic": rec.get("topic") or ctx["topic"],
            "difficulty": norm_difficulty(rec.get("difficulty")) or ctx["difficulty"], "question": rec["question"],
            "options": opts, "answer_index": idx, "explanation": rec.get("explanation", ""),
            "estimated_time": rec.get("estimated_time", 60), "companies": rec.get("companies", []),
            "source": source, "verification": rec.get("verification", ""), "repeated": repeated,
            "model_rejections": len(rejected), "rejection_reasons": sorted({r for x in rejected for r in x.get("reasons", [])})[:10],
            "generation_ms": round((time.time() - t0) * 1000, 1),
        }

    # ── TECH ───────────────────────────────────────────────────────────────────
    def generate_tech_question(self, technology: str, topic: str = "", difficulty: str = "medium", question_type: str = "mcq",
                               exclude: list[str] | None = None, session: list[str] | None = None,
                               exclude_ids: list[str] | None = None, use_model: bool = True) -> dict:
        exclude, session = list(exclude or []), list(session or [])
        difficulty = norm_difficulty(difficulty) or "medium"
        question_type = question_type if question_type in TECH_TYPES else "mcq"
        if technology not in TECHNOLOGIES:
            return {"error": f"unsupported technology {technology}"}
        engine = get_tech_engine()
        pool_all = engine._by_technology.get(technology, [])
        if not topic:
            # only topics that actually have the requested question type
            topics = sorted({r["topic"] for r in pool_all if r["question_type"] in TECH_TYPE_TO_DATASET[question_type]}) \
                or sorted({r["topic"] for r in pool_all})
            topic = random.choice(topics) if topics else ""
        ctx = {"domain": "tech", "technology": technology, "topic": topic, "difficulty": difficulty, "question_type": question_type}
        t0 = time.time()

        def validate(c):
            v = validate_structured(c, ctx, exclude=exclude, session_exclude=None)
            if not v.ok:
                return False, v.reasons, None
            rec = v.record
            if session and is_duplicate(rec["question"], session):
                return False, ["session_duplicate"], None
            verification = "structural"
            if question_type == "mcq":
                if not self._self_consistent(rec["question"], rec["options"], rec["answer"]):
                    return False, ["failed_self_consistency"], None
                verification = "self_consistency"
            elif STRICT:
                return False, ["not_deterministically_verifiable"], None
            return True, [], {**rec, "verification": verification}

        rejected: list[dict] = []
        if use_model and not STRICT and question_type in MODEL_TECH_TYPES:
            rec, rejected = self._model_candidates(ctx, validate, t0 + MODEL_BUDGET_S)
            if rec:
                self._count("tech", "model")
                return self._tech_from_model(rec, ctx, rejected, t0)

        # verified fallback: the curated tech dataset (same filters, widening step by step)
        banned = set(exclude_ids or [])
        types = TECH_TYPE_TO_DATASET[question_type]
        cap = CAP[difficulty]
        pools = [lambda r: r["topic"] == topic and r["difficulty"] == cap and r["question_type"] in types,
                 lambda r: r["topic"] == topic and r["question_type"] in types,
                 lambda r: r["topic"] == topic,
                 lambda r: r["difficulty"] == cap and r["question_type"] in types,
                 lambda r: r["question_type"] in types,
                 lambda r: True]
        for pool in pools:
            cands = [r for r in pool_all if pool(r) and r["id"] not in banned and not is_duplicate(r["question"], exclude + session)]
            if cands:
                self._count("tech", "bank")
                return self._tech_out(dict(random.choice(cands)), "bank", rejected, t0)
        if pool_all:
            self._count("tech", "bank_repeat")
            cands = [r for r in pool_all if r["topic"] == topic] or pool_all
            return self._tech_out(dict(random.choice(cands)), "bank", rejected, t0, repeated=True)
        return {"error": f"no tech question available for {technology}"}

    @staticmethod
    def _tech_out(rec: dict, source: str, rejected: list, t0: float, repeated: bool = False) -> dict:
        return {**rec, "domain": "tech", "question_kind": DATASET_TO_TECH_TYPE.get(rec.get("question_type"), "conceptual"),
                "source": source, "verification": rec.get("verification", "curated_dataset"), "repeated": repeated,
                "model_rejections": len(rejected), "rejection_reasons": sorted({r for x in rejected for r in x.get("reasons", [])})[:10],
                "generation_ms": round((time.time() - t0) * 1000, 1)}

    def _tech_from_model(self, rec: dict, ctx: dict, rejected: list, t0: float) -> dict:
        """Model JSON -> the tech dataset schema, so tech_answer_evaluator grades it exactly like a dataset item."""
        qt = ctx["question_type"]
        out = {"id": _gen_id(f"gen_{ctx['technology'].lower().replace('+', 'p').replace('.', '')}", rec["question"]),
               "technology": ctx["technology"], "topic": ctx["topic"], "difficulty": CAP[ctx["difficulty"]],
               "question": rec["question"], "answer": rec["answer"], "explanation": rec["explanation"],
               "keywords": rec.get("concepts", []), "verification": rec["verification"]}
        if qt == "mcq":
            out.update(question_type="MCQ", options=rec["options"], correct_option=rec["answer_index"])
        elif qt == "output_prediction":
            out.update(question_type="Output Prediction", code_snippet=rec.get("code", ""))
        elif qt == "debugging":
            out.update(question_type="Debugging", buggy_code=rec.get("code", ""), fixed_code=rec.get("fixed_code", ""))
        else:
            out.update(question_type="Conceptual")
        return self._tech_out(out, "model", rejected, t0)

    def status(self) -> dict:
        return {"model": self.llm.status(), "strict": STRICT,
                "model_used_for": ["aptitude (numerical, deterministically verified)", "interview (existing chain)"] if STRICT
                else ["aptitude", "tech", "interview (existing chain)"], "aptitude_bank_size": len(self.aptitude_bank()),
                "aptitude_template_topics": aptitude_templates.supported_topics(), "served": self.stats}


_service: QuestionGenerationService | None = None
_service_lock = threading.Lock()


def get_question_service() -> QuestionGenerationService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = QuestionGenerationService()
    return _service
