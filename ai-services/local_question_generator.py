"""
LocalQuestionGenerator - loads the fine-tuned local model ONCE and reuses it
for every question (Phase 11), with automatic fallback to the offline
question bank (Phase 7) and session-level duplicate prevention (Phase 8).

No external API key is used anywhere in this module.
"""

import concurrent.futures
import json
import os
import random
import re
import sys
import threading
import time

TRAINING_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training")
sys.path.insert(0, TRAINING_DIR)
import config  # noqa: E402

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="local-llm-gen")


def normalize_for_compare(question: str) -> str:
    q = question.strip().lower()
    q = re.sub(r"[^a-z0-9\s]", "", q)
    return " ".join(q.split())


TOPIC_CONCEPTS_PATH = os.path.join(TRAINING_DIR, "data", "interview_questions", "topic_concepts.json")
_topic_concepts_cache = None


def _load_topic_concepts() -> dict:
    global _topic_concepts_cache
    if _topic_concepts_cache is None:
        try:
            with open(TOPIC_CONCEPTS_PATH, "r", encoding="utf-8") as f:
                _topic_concepts_cache = json.load(f)
        except Exception:
            _topic_concepts_cache = {}
    return _topic_concepts_cache


def _stem(word: str) -> str:
    for suffix in ("ing", "edly", "ed", "es", "s"):
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def _is_topically_grounded(question: str, skill: str, topic: str) -> bool:
    """A tiny (82M param) model fine-tuned on ~9 examples per skill/topic
    tends to bleed vocabulary between topics when sampling freely, producing
    fluent-sounding but nonsensical mashups (e.g. "regularizing overloading
    vs using multiple weights" for an Overfitting/Regularization prompt).
    Reject anything that shares zero vocabulary with this topic's known
    concept list (topic_concepts.json - the same reference data
    local_answer_evaluator.py grades answers against) - if a question can't
    even land on one real concept word for its own topic, it's drifted."""
    concepts = _load_topic_concepts().get(skill, {}).get(topic, [])
    if not concepts:
        return True  # no reference data for this skill/topic - nothing to check against
    q_stems = {_stem(w) for w in re.findall(r"[a-z']+", question.lower())}
    for concept in concepts:
        for word in re.findall(r"[a-z']+", concept.lower()):
            if len(word) > 3 and _stem(word) in q_stems:
                return True
    return False


def _has_stutter(question: str) -> bool:
    """Catches degenerate outputs like "difference between join and joins in
    JOIN" or "argument and argument arguments" - the same word stem showing
    up in two different inflected forms NEAR each other is a strong signal
    of a garbled generation. Scoped to a small word-distance window (not
    "anywhere in the question") so a genuinely good long sentence that
    happens to use both a singular and plural form far apart isn't
    penalized - only a same-stem pair sitting close together is, which in
    practice is never how a fluent human-written sentence reads."""
    words = re.findall(r"[a-z']+", question.lower())
    window = 3
    for i in range(len(words)):
        if len(words[i]) <= 3:
            continue
        stem_i = _stem(words[i])
        for j in range(i + 1, min(i + 1 + window, len(words))):
            if words[j] != words[i] and _stem(words[j]) == stem_i:
                return True
    return False


class QuestionBank:
    """Offline fallback question source. Reuses the same curated dataset the
    model was trained on, so it always has real, skill/topic-correct
    questions available with zero external dependency."""

    def __init__(self, path: str = config.QUESTION_BANK_PATH):
        self._by_skill_topic_diff = {}
        self._by_skill_topic = {}
        self._by_skill = {}
        self._all = []
        self._load(path)

    def _load(self, path: str):
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)
        for r in records:
            skill = r.get("skill", "").strip().lower()
            topic = r.get("topic", "").strip().lower()
            difficulty = r.get("difficulty", "").strip().lower()
            question = r.get("question", "").strip()
            if not (skill and topic and difficulty and question):
                continue
            self._all.append(question)
            self._by_skill.setdefault(skill, []).append(question)
            self._by_skill_topic.setdefault((skill, topic), []).append(question)
            self._by_skill_topic_diff.setdefault((skill, topic, difficulty), []).append(question)

    def pick(self, skill: str, topic: str, difficulty: str, exclude: set) -> str | None:
        skill_k, topic_k, diff_k = skill.strip().lower(), topic.strip().lower(), difficulty.strip().lower()

        for pool in (
            self._by_skill_topic_diff.get((skill_k, topic_k, diff_k), []),
            self._by_skill_topic.get((skill_k, topic_k), []),
            self._by_skill.get(skill_k, []),
            self._all,
        ):
            candidates = [q for q in pool if normalize_for_compare(q) not in exclude]
            if candidates:
                return random.choice(candidates)

        # Every question in scope has already been asked this session -
        # still better to repeat something real than fail the interview.
        pool = (
            self._by_skill_topic_diff.get((skill_k, topic_k, diff_k))
            or self._by_skill_topic.get((skill_k, topic_k))
            or self._by_skill.get(skill_k)
            or self._all
        )
        return random.choice(pool) if pool else None


class LocalQuestionGenerator:
    """Singleton-style wrapper. Instantiate once per process and reuse it;
    the model is loaded lazily on first use and kept in memory afterwards."""

    _instance = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._model = None
        self._tokenizer = None
        self._device = "cpu"
        self._load_lock = threading.Lock()
        self._load_error = None
        self.last_load_time_ms = None
        self.bank = QuestionBank()

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def _ensure_loaded(self):
        if self._model is not None or self._load_error is not None:
            return
        with self._load_lock:
            if self._model is not None or self._load_error is not None:
                return
            start = time.time()
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoTokenizer

                model_dir = config.MODEL_OUTPUT_DIR
                if not os.path.isdir(model_dir) or not os.listdir(model_dir):
                    raise FileNotFoundError(
                        f"No fine-tuned model found at {model_dir}. Run training/train.py first."
                    )
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
                self._tokenizer = AutoTokenizer.from_pretrained(model_dir)
                self._model = AutoModelForCausalLM.from_pretrained(model_dir)
                self._model.to(self._device)
                self._model.eval()
            except Exception as e:  # noqa: BLE001 - any load failure must trigger fallback, not crash the app
                self._load_error = str(e)
            finally:
                self.last_load_time_ms = round((time.time() - start) * 1000, 1)

    def _run_generation(self, prompt: str) -> tuple:
        """Returns (text, ended_naturally). A well-trained model emits EOS
        (since every training completion ends with one) well before hitting
        max_new_tokens; a generation that instead runs out the clock is a
        strong degenerate-output signal and is flagged for rejection."""
        import torch

        inputs = self._tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(self._device)
        with torch.no_grad():
            output_ids = self._model.generate(
                **inputs,
                max_new_tokens=config.GEN_MAX_NEW_TOKENS,
                do_sample=True,
                temperature=config.GEN_TEMPERATURE,
                top_p=config.GEN_TOP_P,
                top_k=config.GEN_TOP_K,
                repetition_penalty=config.GEN_REPETITION_PENALTY,
                pad_token_id=self._tokenizer.pad_token_id or self._tokenizer.eos_token_id,
                eos_token_id=self._tokenizer.eos_token_id,
            )
        generated = output_ids[0][inputs["input_ids"].shape[1]:]
        ended_naturally = bool(
            generated.numel() < config.GEN_MAX_NEW_TOKENS
            or (generated.numel() > 0 and generated[-1].item() == self._tokenizer.eos_token_id)
        )
        text = self._tokenizer.decode(generated, skip_special_tokens=True)
        return text, ended_naturally

    @staticmethod
    def _clean_output(raw: str) -> str:
        text = raw.strip()
        # Stop at anything resembling a new section the model may hallucinate.
        for marker in ["###", "\n\n", "Instruction:", "Question:"]:
            idx = text.find(marker)
            if idx != -1:
                text = text[:idx]
        text = text.strip().strip('"').strip()
        return text

    @staticmethod
    def _is_valid(question: str, ended_naturally: bool = True, skill: str = "", topic: str = "") -> bool:
        if not question or not ended_naturally:
            return False
        if len(question) < 10 or len(question) > 300:
            return False
        if len(question.split()) < 3:
            return False
        # Our training data is a single sentence/question - more than two
        # sentence-ending marks usually means the model rambled on.
        if question.count("?") + question.count(". ") > 2:
            return False
        if _has_stutter(question):
            return False
        if skill and topic and not _is_topically_grounded(question, skill, topic):
            return False
        return True

    def _build_prompt(self, skill: str, topic: str, difficulty: str, candidate_level: str) -> str:
        instruction = config.INSTRUCTION_TEMPLATES[0].format(
            difficulty=difficulty, skill=skill, topic=topic, level=candidate_level
        )
        return config.PROMPT_HEADER.format(instruction=instruction)

    def generate_question(
        self,
        skill: str,
        topic: str,
        difficulty: str = "Medium",
        candidate_level: str = "Fresher",
        resume_skills: list | None = None,
        exclude_questions: list | None = None,
        max_retries: int = 6,
    ) -> dict:
        """Returns {"question": str, "source": "model"|"bank", "generation_time_ms": float, "attempts": int}.
        Never raises - any failure degrades to the offline question bank."""
        exclude = {normalize_for_compare(q) for q in (exclude_questions or [])}
        start = time.time()

        self._ensure_loaded()

        if self._model is not None:
            prompt = self._build_prompt(skill, topic, difficulty, candidate_level)
            for attempt in range(1, max_retries + 1):
                try:
                    future = _executor.submit(self._run_generation, prompt)
                    raw, ended_naturally = future.result(timeout=config.GENERATION_TIMEOUT_SECONDS)
                except (concurrent.futures.TimeoutError, Exception):
                    break  # model unusable this call -> fall through to bank

                question = self._clean_output(raw)
                if self._is_valid(question, ended_naturally, skill, topic) and normalize_for_compare(question) not in exclude:
                    return {
                        "question": question,
                        "source": "model",
                        "generation_time_ms": round((time.time() - start) * 1000, 1),
                        "attempts": attempt,
                    }
                # invalid or duplicate: retry (sampling is stochastic, so a
                # re-roll can legitimately produce a different question)

        # Fallback: local, offline question bank (Phase 7 / Phase 8)
        question = self.bank.pick(skill, topic, difficulty, exclude)
        return {
            "question": question or f"Explain a key concept in {skill} related to {topic}.",
            "source": "bank",
            "generation_time_ms": round((time.time() - start) * 1000, 1),
            "attempts": max_retries,
        }


_default_generator = None
_default_lock = threading.Lock()


def get_generator() -> LocalQuestionGenerator:
    """Process-wide accessor so the model is loaded once and reused."""
    global _default_generator
    if _default_generator is None:
        with _default_lock:
            if _default_generator is None:
                _default_generator = LocalQuestionGenerator()
    return _default_generator
