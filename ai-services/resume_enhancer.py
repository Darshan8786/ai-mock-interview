"""
LocalResumeEnhancer - loads the fine-tuned local resume-content-enhancer
model ONCE and reuses it for every request (same pattern as
local_question_generator.py), with a rule-based fallback so the endpoint
never fails outright if the model is unavailable or produces bad output.

No external API key is used anywhere in this module.
"""

import concurrent.futures
import os
import re
import sys
import threading
import time

TRAINING_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training")
sys.path.insert(0, TRAINING_DIR)
import resume_config as config  # noqa: E402

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="resume-enhancer-gen")

WEAK_OPENERS = {
    "was responsible for": "Managed",
    "responsible for": "Managed",
    "worked on": "Developed",
    "helped with": "Contributed to",
    # Bare "helped <verb>" (e.g. "helped mentor") takes a bare infinitive in
    # English, unlike "Contributed to" which needs a gerund ("contributed to
    # mentoring") - so this needs a different replacement to stay grammatical.
    "helped": "Supported efforts to",
    "in charge of": "Led",
    "involved in": "Participated in",
    "tasked with": "Delivered",
    "was part of": "Collaborated on",
    "did": "Executed",
}


def _rule_based_bullet_fallback(original_text: str) -> str:
    """Deterministic, local fallback used if the trained model is
    unavailable: swaps a weak opening phrase for a stronger action verb.
    Never fabricates a metric that isn't already in the original text."""
    fixed = original_text.strip()
    lower = fixed.lower()
    for weak, strong in WEAK_OPENERS.items():
        if lower.startswith(weak):
            fixed = strong + fixed[len(weak):]
            break
    return fixed


_GROUNDING_STOPWORDS = {
    "the", "a", "an", "and", "for", "with", "that", "this", "was", "were", "have", "has",
    "had", "from", "into", "onto", "than", "then", "them", "they", "your", "you", "its",
    "our", "their", "using", "used", "while", "over", "under", "through", "across",
}


def _introduces_new_number(original: str, generated: str) -> bool:
    """True if `generated` contains a digit sequence not present anywhere in
    `original` - i.e. it asserts a specific quantity the source text never
    gave it, which on a resume is a fabricated metric."""
    orig_numbers = set(re.findall(r"\d+", original))
    gen_numbers = set(re.findall(r"\d+", generated))
    return bool(gen_numbers - orig_numbers)


def _shares_grounding(original: str, generated: str) -> bool:
    """True if the rewrite shares at least one meaningful content word with
    the original - a cheap but effective check that the model rewrote THIS
    bullet rather than free-associating a memorized training example."""
    orig_words = {w for w in re.findall(r"[a-z']+", original.lower()) if len(w) > 3 and w not in _GROUNDING_STOPWORDS}
    if not orig_words:
        return True
    gen_words = {w for w in re.findall(r"[a-z']+", generated.lower()) if len(w) > 3 and w not in _GROUNDING_STOPWORDS}
    return len(orig_words & gen_words) >= 1


def _rule_based_summary_fallback(role: str, skills: list, experience_years) -> str:
    skills_text = ", ".join(skills[:5]) if skills else "a range of relevant technologies"
    years = experience_years or 0
    if years and float(years) >= 1:
        unit = "year" if float(years) == 1 else "years"
        experience_phrase = f"with {years} {unit} of experience"
    else:
        experience_phrase = "with hands-on project and academic experience"
    return (
        f"{role} {experience_phrase} in {skills_text}. Focused on applying strong technical fundamentals "
        f"to deliver real, measurable impact. Looking to grow further as a {role} on a collaborative team."
    )


class LocalResumeEnhancer:
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
                        f"No fine-tuned resume-enhancer model found at {model_dir}. "
                        "Run training/train_resume_enhancer.py first."
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
        for marker in ["###", "\n\n", "Instruction:", "Original:", "Rewritten:", "Summary:"]:
            idx = text.find(marker)
            if idx != -1:
                text = text[:idx]
        return text.strip().strip('"').strip()

    @staticmethod
    def _is_valid_bullet(text: str, ended_naturally: bool, original_text: str) -> bool:
        """Structural validity PLUS a faithfulness gate. With only ~55 training
        examples, this model learned the surface pattern "strong verb + a
        number" without reliably learning to stay grounded in what the
        original bullet actually said - left unchecked it fabricates
        achievements (e.g. turning "wrote documentation" into "recovered 2
        million page views"), which on a resume is a factual-integrity
        problem, not just a quality one. So: reject any generation that (a)
        introduces a number/metric not present in the original - a rewrite
        must never invent an achievement the user didn't provide - or (b)
        shares no meaningful vocabulary with the original at all (a sign the
        model drifted onto an unrelated topic from its training data)."""
        if not text or not ended_naturally:
            return False
        if len(text) < 10 or len(text) > 300:
            return False
        if _introduces_new_number(original_text, text):
            return False
        if not _shares_grounding(original_text, text):
            return False
        return True

    @staticmethod
    def _is_valid_summary(text: str, ended_naturally: bool, role: str, skills: list) -> bool:
        """Same faithfulness concern as bullets, and worse in practice: with
        only 12 training examples the model reliably produces fluent
        paragraphs for a DIFFERENT role/skillset than the one requested (e.g.
        asked for "Backend Developer" + Python/Django/PostgreSQL, it wrote a
        confident "Front end developer... Data Science... Azure" paragraph -
        a plain substring check on "developer" alone let that through). So
        this requires EVERY word of the requested role to appear (not just
        one generic word like "developer") AND at least one of the
        candidate's actual skills to be named - both signals, not either."""
        if not text or not ended_naturally:
            return False
        if len(text) < 40 or len(text) > 700:
            return False
        lower = text.lower()
        role_words = [w for w in re.findall(r"[a-z]+", role.lower()) if len(w) > 2]
        role_hit = all(w in lower for w in role_words) if role_words else True
        skill_hit = any(s.lower() in lower for s in (skills or []))
        return role_hit and skill_hit

    def enhance_bullet(self, original_text: str, max_retries: int = 3) -> str:
        self._ensure_loaded()
        if self._model is not None:
            prompt = config.BULLET_PROMPT.format(weak=original_text.strip())
            for _ in range(max_retries):
                try:
                    future = _executor.submit(self._run_generation, prompt)
                    raw, ended_naturally = future.result(timeout=config.GENERATION_TIMEOUT_SECONDS)
                except (concurrent.futures.TimeoutError, Exception):
                    break
                text = self._clean_output(raw)
                if self._is_valid_bullet(text, ended_naturally, original_text):
                    return text
        return _rule_based_bullet_fallback(original_text)

    def enhance_summary(self, role: str, skills: list, experience_years, max_retries: int = 3) -> str:
        self._ensure_loaded()
        if self._model is not None:
            prompt = config.SUMMARY_PROMPT.format(
                role=role, skills=", ".join(skills or []), years=experience_years or 0
            )
            for _ in range(max_retries):
                try:
                    future = _executor.submit(self._run_generation, prompt)
                    raw, ended_naturally = future.result(timeout=config.GENERATION_TIMEOUT_SECONDS)
                except (concurrent.futures.TimeoutError, Exception):
                    break
                text = self._clean_output(raw)
                if self._is_valid_summary(text, ended_naturally, role, skills or []):
                    return text
        return _rule_based_summary_fallback(role, skills or [], experience_years)


_default_enhancer = None
_default_lock = threading.Lock()


def get_enhancer() -> LocalResumeEnhancer:
    global _default_enhancer
    if _default_enhancer is None:
        with _default_lock:
            if _default_enhancer is None:
                _default_enhancer = LocalResumeEnhancer()
    return _default_enhancer


def enhance_resume_content(enhancement_type: str, context: dict) -> str:
    """Entry point matching the shape the Flask endpoint needs."""
    enhancer = get_enhancer()
    if enhancement_type == "summary":
        return enhancer.enhance_summary(
            role=context.get("role", ""),
            skills=context.get("skills", []),
            experience_years=context.get("experience_years", 0),
        )
    original_text = context.get("original_text", "")
    if not original_text:
        return ""
    return enhancer.enhance_bullet(original_text)
