"""
Local, deterministic answer evaluation for the trained tech-question system.
No external API is called anywhere in this module - grading always happens
against the question's own stored correct answer (tech_question_engine's
`get_full_question`), never against a client-submitted claim of correctness.

Per question_type:
  MCQ                  -> exact match against the stored 0-based correct_option
  Output Prediction    -> normalized text match against the stored `answer`
  Debugging            -> similarity against `fixed_code` (if code-shaped) or
                          keyword coverage against `answer`/`explanation`
  Coding /
  Programming Problem /
  SQL Query            -> NOT executed (no sandboxed code-execution exists in
                          this project, and building one safely is out of
                          scope here - see explanation in the module docstring
                          below) - graded via similarity + required-keyword
                          coverage against `expected_solution`/`answer`,
                          always surfacing the real reference solution
  Technical /
  Conceptual /
  Scenario Based        -> concept-coverage against `keywords`, the same
                          technique already used by local_answer_evaluator.py
                          for the mock-interview free-text grading, for
                          consistency across the codebase

SAFETY NOTE ON CODING QUESTIONS: this project has no sandboxed code
execution environment (no container/subprocess resource-limiting harness).
Executing arbitrary submitted code server-side without one is a real
security risk (resource exhaustion, filesystem/network access), so this
evaluator deliberately does NOT `exec`/`eval`/`subprocess.run` the
candidate's submission. Instead it grades structurally (does the submission
resemble a correct solution) and always reveals the verified
`expected_solution` + explanation, which is what actually teaches the
candidate the correct approach.
"""

import difflib
import re

from tech_question_engine import get_engine

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "what", "how", "why", "do", "does",
    "did", "you", "your", "of", "in", "on", "for", "to", "and", "or", "explain",
    "describe", "tell", "me", "about", "with", "can", "would", "will", "between",
    "it", "its", "this", "that", "be", "by", "as", "at", "from", "not", "have", "has",
}

CODE_SHAPE_RE = re.compile(r"[{};()=]|def |function |class |SELECT |select ")


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _stem(word: str) -> str:
    for suffix in ("ing", "edly", "ed", "es", "s"):
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def _stemmed_tokens(text: str) -> set:
    words = re.findall(r"[a-z0-9']+", _normalize(text))
    return {_stem(w) for w in words if w not in _STOPWORDS}


def _similarity_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()


def _evaluate_mcq(record: dict, submitted) -> dict:
    try:
        selected = int(submitted)
    except (TypeError, ValueError):
        selected = -1
    correct = record.get("correct_option", -1)
    options = record.get("options", [])
    is_correct = selected == correct
    correct_text = options[correct] if 0 <= correct < len(options) else record.get("answer", "")
    return {
        "isCorrect": is_correct,
        "score": 100 if is_correct else 0,
        "correctAnswer": correct_text,
        "explanation": record.get("explanation", ""),
    }


def _evaluate_output_prediction(record: dict, submitted: str) -> dict:
    expected = record.get("answer", "")
    is_correct = _normalize(submitted) == _normalize(expected)
    return {
        "isCorrect": is_correct,
        "score": 100 if is_correct else 0,
        "correctAnswer": expected,
        "explanation": record.get("explanation", ""),
    }


def _evaluate_debugging(record: dict, submitted: str) -> dict:
    fixed_code = record.get("fixed_code", "")
    if fixed_code and CODE_SHAPE_RE.search(submitted or ""):
        ratio = _similarity_ratio(submitted, fixed_code)
        is_correct = ratio >= 0.80
        score = round(ratio * 100)
    else:
        expected_concepts = record.get("keywords", [])
        submitted_stems = _stemmed_tokens(submitted)
        matched = [c for c in expected_concepts if _stem(c.lower()) in submitted_stems or c.lower() in _normalize(submitted)]
        coverage = len(matched) / len(expected_concepts) if expected_concepts else 0.0
        is_correct = coverage >= 0.6
        score = round(coverage * 100)
    return {
        "isCorrect": is_correct,
        "score": score,
        "correctAnswer": record.get("answer", ""),
        "explanation": record.get("explanation", ""),
        "referenceFixedCode": fixed_code,
    }


def _evaluate_structural(record: dict, submitted: str, reference_field: str) -> dict:
    """Shared grading path for Coding/Programming Problem/SQL Query - see the
    module docstring for why this never executes the submission."""
    reference = record.get(reference_field) or record.get("answer", "")
    keywords = record.get("keywords", [])
    submitted_norm = _normalize(submitted)

    ratio = _similarity_ratio(submitted, reference)
    keyword_hits = sum(1 for k in keywords if k.lower() in submitted_norm)
    keyword_coverage = keyword_hits / len(keywords) if keywords else 0.0

    # Blend structural similarity with required-keyword coverage so a
    # correct solution phrased differently from the reference (different
    # variable names, equivalent SQL clause order) can still score well.
    score = round((0.5 * ratio + 0.5 * keyword_coverage) * 100)
    is_correct = score >= 65
    return {
        "isCorrect": is_correct,
        "score": score,
        "correctAnswer": reference,
        "explanation": record.get("explanation", ""),
        "testCases": record.get("test_cases", []),
    }


def _evaluate_concept_coverage(record: dict, submitted: str) -> dict:
    expected_concepts = record.get("keywords", [])
    submitted_stems = _stemmed_tokens(submitted)
    submitted_norm = _normalize(submitted)
    matched = [
        c for c in expected_concepts
        if _stem(c.lower()) in submitted_stems or c.lower() in submitted_norm
    ]
    coverage = len(matched) / len(expected_concepts) if expected_concepts else 0.0
    word_count = len((submitted or "").split())
    length_factor = 0.0 if word_count == 0 else (0.4 if word_count < 8 else (0.75 if word_count < 20 else 1.0))
    score = round(100 * (0.7 * coverage + 0.3 * length_factor))
    is_correct = coverage >= 0.5
    return {
        "isCorrect": is_correct,
        "score": score,
        "correctAnswer": record.get("answer", ""),
        "explanation": record.get("explanation", ""),
        "matchedKeywords": matched,
        "missedKeywords": [c for c in expected_concepts if c not in matched],
    }


def evaluate_tech_answer(question_id: str, submitted_answer) -> dict:
    """Looks up the question by id (server-side, from the local trained
    dataset - never from client input) and grades `submitted_answer`
    against its verified correct answer. Returns a dict always including
    isCorrect/score/correctAnswer/explanation, plus type-specific extras."""
    engine = get_engine()
    record = engine.get_full_question(question_id)
    if record is None:
        return {
            "isCorrect": False,
            "score": 0,
            "correctAnswer": "",
            "explanation": "",
            "error": f"Unknown question id: {question_id}",
        }

    qtype = record.get("question_type")
    submitted_text = "" if submitted_answer is None else str(submitted_answer)

    if qtype == "MCQ":
        return _evaluate_mcq(record, submitted_answer)
    if qtype == "Output Prediction":
        return _evaluate_output_prediction(record, submitted_text)
    if qtype == "Debugging":
        return _evaluate_debugging(record, submitted_text)
    if qtype in ("Coding", "Programming Problem"):
        return _evaluate_structural(record, submitted_text, "expected_solution")
    if qtype == "SQL Query":
        return _evaluate_structural(record, submitted_text, "answer")
    # Technical / Conceptual / Scenario Based
    return _evaluate_concept_coverage(record, submitted_text)
