"""
Strict validation of a structured (JSON) question for any of the three domains - interview, aptitude, tech.

Shared by the v2 dataset cleaner (training/build_multidomain_dataset.py) and the runtime question engine
(question_engine.py), so what is rejected from training data is exactly what is rejected before a student sees it.
Pure Python, no ML, no network.

    v = validate_structured(record, ctx, exclude=[...previous question texts...])
    v.ok, v.reasons, v.record (normalised), v.verification  ("deterministic" | "structural")
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

from .numeric_verifier import is_numeric_question, verify_numeric_mcq
from .question_validator import is_duplicate, normalize, validate_question

DIFFICULTIES = ("easy", "medium", "hard")
DIFFICULTY_ALIASES = {"beginner": "easy", "basic": "easy", "easy": "easy", "intermediate": "medium", "moderate": "medium",
                      "medium": "medium", "advanced": "hard", "difficult": "hard", "hard": "hard"}
APTITUDE_CATEGORIES = ("Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation")
TECHNOLOGIES = ("Python", "Java", "C", "C++", "SQL", "HTML", "CSS", "JavaScript", "React", "Node.js")
TECH_TYPES = ("mcq", "conceptual", "output_prediction", "debugging", "coding")
INTERVIEW_TYPES = ("technical", "hr", "behavioral", "scenario", "coding", "system_design", "project")
_LEAK = re.compile(r"<\|im_|\bcontext\s*:|\bschema\s*:|\[4 x str\]|question_type", re.I)
_CODE_LIKE = re.compile(r"[{}();=<>\[\]:]|\bdef\b|\bfunction\b|\bclass\b|\bSELECT\b|\bprint\b|#include", re.I)


def norm_difficulty(value) -> str | None:
    return DIFFICULTY_ALIASES.get(str(value or "").strip().lower())


def parse_json_output(text: str) -> dict | None:
    """The first balanced {...} object in a model generation, parsed; None if there is none / it is invalid JSON."""
    if not text:
        return None
    start = text.find("{")
    while start != -1:
        depth, in_str, esc = 0, False, False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        obj = json.loads(text[start:i + 1])
                        return obj if isinstance(obj, dict) else None
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None


def _opt_key(s: str) -> str:
    """Options compared case- and whitespace-insensitively ("QS RP" == "QSRP") but symbol-sensitively
    ("<<" != ">>", "(5)" != "(5,)")."""
    return re.sub(r"\s+", "", str(s).lower().replace("−", "-").replace("–", "-"))


def structure_signature(question: str) -> str:
    """Question with every number masked - two items that differ only in their numbers share a signature."""
    return re.sub(r"\d+(?:[.,]\d+)?", "#", normalize(question))


@dataclass
class StructuredVerdict:
    record: dict
    reasons: list[str] = field(default_factory=list)
    verification: str = "structural"          # deterministic | structural
    details: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.reasons


def _str_list(v) -> list[str] | None:
    if not isinstance(v, list):
        return None
    out = [str(x).strip() for x in v if isinstance(x, (str, int, float)) and str(x).strip()]
    return out


def _check_mcq(rec: dict, v: StructuredVerdict) -> None:
    opts = rec.get("options")
    if not isinstance(opts, list) or len(opts) != 4 or not all(isinstance(o, (str, int, float)) and str(o).strip() for o in opts):
        v.reasons.append("options_must_be_4_non_empty")
        return
    opts = [str(o).strip() for o in opts]
    rec["options"] = opts
    keys = [_opt_key(o) for o in opts]
    if len(set(keys)) != 4:
        v.reasons.append("duplicate_options")
    answer = str(rec.get("answer", "")).strip()
    if not answer:
        v.reasons.append("missing_answer")
        return
    hits = [i for i, o in enumerate(opts) if o == answer] or [i for i, k in enumerate(keys) if k == _opt_key(answer)]
    if len(hits) != 1:
        v.reasons.append("answer_not_exactly_one_option")
        return
    rec["answer"] = opts[hits[0]]
    rec["answer_index"] = hits[0]


def validate_structured(raw: dict, ctx: dict, exclude: list[str] | None = None, session_exclude: list[str] | None = None,
                        check_topic_vocab: bool = True) -> StructuredVerdict:
    """`ctx` = the generation context (domain, topic, technology/category, difficulty, question_type).
    `exclude` = questions this student has already seen (exact / near duplicate -> rejected).
    `session_exclude` = questions of the current session (also rejects same-template-different-numbers variants)."""
    rec = dict(raw or {})
    v = StructuredVerdict(rec)
    domain = ctx.get("domain")
    qtype = ctx.get("question_type", "mcq" if domain == "aptitude" else "")

    # ── context
    if domain not in ("interview", "aptitude", "tech"):
        v.reasons.append("bad_domain")
        return v
    if ctx.get("difficulty") and norm_difficulty(ctx["difficulty"]) is None:
        v.reasons.append("bad_difficulty")
    if not str(ctx.get("topic") or ctx.get("skill") or "").strip():
        v.reasons.append("missing_topic")
    if domain == "tech" and (ctx.get("technology") not in TECHNOLOGIES or qtype not in TECH_TYPES):
        v.reasons.append("bad_technology_or_type")
    if domain == "aptitude" and (ctx.get("category") not in APTITUDE_CATEGORIES or qtype != "mcq"):
        v.reasons.append("bad_category_or_type")

    # ── question text
    q = str(rec.get("question", "")).strip()
    rec["question"] = q
    if not q:
        v.reasons.append("empty_question")
        return v
    if len(q) < 10 or len(q.split()) < 3:
        v.reasons.append("question_too_short")
    if len(q) > (1200 if domain == "aptitude" else 700):
        v.reasons.append("question_too_long")
    if _LEAK.search(q) or _LEAK.search(str(rec.get("explanation", ""))):
        v.reasons.append("prompt_leak")
    words = re.findall(r"[a-z']+", q.lower())
    if len(words) >= 8 and len(set(words)) / len(words) < 0.4:
        v.reasons.append("repetition")

    # ── domain specific
    if domain == "interview":
        iv = validate_question(q, topic=ctx.get("skill") if check_topic_vocab else None, cleaned=True)
        v.reasons.extend(r for r in iv.reasons if r not in v.reasons)
        concepts = _str_list(rec.get("expected_concepts", []))
        rec["expected_concepts"] = (concepts or [])[:8]
    else:
        expl = str(rec.get("explanation", "")).strip()
        rec["explanation"] = expl
        if len(expl) < 4 or _opt_key(expl) == _opt_key(rec.get("answer", "")):
            v.reasons.append("missing_explanation")          # absent, or only restates the answer
        if domain == "aptitude" or qtype == "mcq":
            _check_mcq(rec, v)
        else:
            if not str(rec.get("answer", "")).strip():
                v.reasons.append("missing_answer")
        if domain == "tech":
            concepts = _str_list(rec.get("concepts"))
            if not concepts:
                v.reasons.append("missing_concepts")
            rec["concepts"] = (concepts or [])[:8]
            if qtype == "output_prediction" and not _CODE_LIKE.search(str(rec.get("code", ""))):
                v.reasons.append("missing_code")
            if qtype == "debugging":
                code, fixed = str(rec.get("code", "")).strip(), str(rec.get("fixed_code", "")).strip()
                if not code or not fixed or normalize(code) == normalize(fixed):
                    v.reasons.append("debugging_needs_buggy_and_fixed_code")
            if qtype == "coding" and not _CODE_LIKE.search(str(rec.get("answer", ""))):
                v.reasons.append("coding_answer_not_code")
        if domain == "aptitude" and not v.reasons and is_numeric_question(rec["options"], ctx.get("category", ""), ctx.get("topic", "")):
            nv = verify_numeric_mcq(q, rec["options"], rec["answer_index"], rec["explanation"], ctx.get("topic", ""))
            v.details.extend(nv.details)
            if nv.status == "contradicted":
                v.reasons.append("answer_key_contradicted")
                v.reasons.extend(nv.reasons)
            elif nv.status == "unverifiable":
                v.reasons.append("numeric_answer_unverifiable")
            else:
                v.verification = "deterministic"

    # ── duplicates
    if exclude:
        dup = is_duplicate(q, exclude)
        if dup:
            v.reasons.append(dup)
    if session_exclude:
        sig = structure_signature(q)
        if any(SequenceMatcher(None, sig, structure_signature(s)).ratio() >= 0.92 for s in session_exclude):
            v.reasons.append("same_template_in_session")
    return v
