"""
Step 12 - validate a generated interview question before it is shown to a candidate.

Pure Python, no ML dependency, no network. Used by inference.py, by the MindPrep question service and by
evaluate.py (so the metric and the production gate are the same code).

    verdict = validate_question(text, topic="SQL", exclude=[...])
    verdict.ok        -> bool
    verdict.reasons   -> list of machine-readable reason codes when not ok
    verdict.question  -> the cleaned question text
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

VOCAB_PATH = Path(__file__).resolve().parent / "data" / "topic_vocab.json"
MIN_TOPIC_KEYWORDS = 10           # topics with a thinner vocabulary can't be checked reliably -> check skipped
MIN_WORDS, MAX_WORDS, MAX_CHARS = 4, 45, 300
NEAR_DUPLICATE = 0.85

_STOP = set("""a an the of to in on for with and or is are was were be been being do does did what why how when where which
who whom whose can could should would will shall may might must this that these those it its as at by from into than then
there their them they you your yours we our us i me my not no yes if else so such between about over under out up down
each any all some more most other another one two use used using write explain describe difference differences""".split())

# A valid interview prompt is a question or an imperative task ("Explain ...", "Write a query ...").
_IMPERATIVE = ("explain", "describe", "write", "implement", "design", "compare", "define", "list", "discuss", "given", "create",
               "differentiate", "distinguish", "outline", "illustrate", "demonstrate", "walk", "state", "tell", "how", "what", "why",
               "when", "where", "which", "who", "can", "could", "is", "are", "do", "does", "did", "should", "would", "will",
               "have", "has", "suppose", "consider", "identify", "name", "give", "show", "solve", "find", "build", "develop")
_LEAK_MARKERS = re.compile(r"(?:^|\n)\s*(?:answer|solution|explanation|response)\s*:|\bthe answer is\b|<\|im_", re.I)
_TEMPLATE_ECHO = re.compile(r"\b(role|topic|subtopic|difficulty|type)\s*:", re.I)

_vocab_cache: dict[str, set[str]] | None = None


def _stem(word: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def _keywords(text: str) -> set[str]:
    return {_stem(w) for w in re.findall(r"[a-z][a-z0-9+#.\-]*", text.lower()) if len(w) > 2 and w not in _STOP}


def normalize(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9\s]", "", text.lower()).split())


def topic_vocab() -> dict[str, set[str]]:
    global _vocab_cache
    if _vocab_cache is None:
        try:
            _vocab_cache = {t: set(w) for t, w in json.loads(VOCAB_PATH.read_text(encoding="utf-8")).items()}
        except (OSError, ValueError):
            _vocab_cache = {}
    return _vocab_cache


def clean_generation(raw: str) -> str:
    """Take what the model produced and reduce it to one question string (no labels, quotes, numbering, extra lines)."""
    text = (raw or "").replace("<|im_end|>", "\n").replace("<|endoftext|>", "\n").strip()
    text = text.split("\n")[0].strip() if text else ""
    text = re.sub(r"^(?:question|q)\s*\d*\s*[:.)-]\s*", "", text, flags=re.I)
    text = re.sub(r"^\s*(?:\d+[.)]|[-*•])\s+", "", text)
    return text.strip().strip('"').strip("'").strip()


@dataclass
class Verdict:
    question: str
    reasons: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.reasons


def is_duplicate(question: str, exclude: list[str] | set[str] | None) -> str | None:
    """Return 'exact_duplicate' / 'near_duplicate' if the question repeats something in `exclude`, else None."""
    norm = normalize(question)
    for other in exclude or ():
        o = normalize(other)
        if not o:
            continue
        if o == norm:
            return "exact_duplicate"
        if SequenceMatcher(None, norm, o).ratio() >= NEAR_DUPLICATE:
            return "near_duplicate"
    return None


def validate_question(raw: str, topic: str | None = None, exclude: list[str] | None = None, cleaned: bool = False) -> Verdict:
    q = raw.strip() if cleaned else clean_generation(raw)
    v = Verdict(question=q)
    if not q:
        v.reasons.append("empty")
        return v

    words = q.split()
    if len(q) > MAX_CHARS or len(words) > MAX_WORDS:
        v.reasons.append("too_long")
    if len(words) < MIN_WORDS or len(q) < 15:
        v.reasons.append("too_short")
    if _LEAK_MARKERS.search(q) or _TEMPLATE_ECHO.search(q):
        v.reasons.append("prompt_or_answer_leak")

    ends_ok = q.endswith("?") or q.endswith(".")
    starts_ok = words[0].lower().strip(",:") in _IMPERATIVE if words else False
    if not (q.endswith("?") or (starts_ok and ends_ok) or (starts_ok and len(words) >= 6)):
        v.reasons.append("invalid_format")
    if not q[0].isalnum() and q[0] not in "\"'(`":
        v.reasons.append("invalid_format")
    if q.count("?") > 2 or len(re.findall(r"[.?!](?:\s|$)", q)) > 3:
        v.reasons.append("rambling")

    lw = [w for w in re.findall(r"[a-z']+", q.lower())]
    if len(lw) >= 4 and (len(set(lw)) / len(lw) < 0.55 or any(lw[i] == lw[i + 1] and len(lw[i]) > 2 for i in range(len(lw) - 1))
                         or any(lw[i:i + 3] == lw[i + 3:i + 6] for i in range(len(lw) - 5))):
        v.reasons.append("repetition")

    if topic:
        vocab = topic_vocab().get(topic)
        if vocab and len(vocab) >= MIN_TOPIC_KEYWORDS and not (_keywords(q) & vocab):
            v.reasons.append("off_topic")

    if exclude:
        dup = is_duplicate(q, exclude)
        if dup:
            v.reasons.append(dup)
    return v
