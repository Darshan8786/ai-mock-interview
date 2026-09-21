"""
Fully local answer evaluation and final-feedback generation (Rules 3/4/8/9).

No external AI API (Groq, OpenAI, Gemini, Anthropic, NVIDIA NIM, HuggingFace
inference, or any other cloud LLM) is called anywhere in this module. Every
score is derived directly from:

  - the ACTUAL text of the candidate's answer, and
  - the expected concepts for the SPECIFIC question, drawn from the same
    local training data used to generate/select the question:
      * technical questions  -> training/data/interview_questions/topic_concepts.json
        (looked up by the skill/topic the question was generated for)
      * HR/Behavioral questions -> training/data/interview_questions/hr_behavioral_dataset.json
        (concept_tags looked up by the exact question text)
  - if neither lookup matches (e.g. the server-side static fallback bank was
    used because the ai-service was unreachable, so no skill/topic is known),
    a generic keyword set is extracted from the question text itself so a
    real - if less precise - evaluation is still produced instead of a
    made-up/generic score.

This intentionally does NOT claim to be a trained grammar/NLU model. Fluency,
grammar and confidence are scored with transparent, local text heuristics
(sentence structure, filler-word ratio, hedging language, lexical diversity).
That is a known precision limit versus a full local NLP model - see
ai-services/docs/MODEL_TRAINING.md for the honest accounting of it - but it
is real signal computed from the candidate's own answer, never a constant.
"""

import json
import os
import re

TRAINING_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training", "data", "interview_questions")
TOPIC_CONCEPTS_PATH = os.path.join(TRAINING_DIR, "topic_concepts.json")
HR_BEHAVIORAL_PATH = os.path.join(TRAINING_DIR, "hr_behavioral_dataset.json")

_TOPIC_CONCEPTS_CACHE = None
_HR_BEHAVIORAL_CONCEPTS_CACHE = None

_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "what", "how", "why", "do", "does",
    "did", "you", "your", "of", "in", "on", "for", "to", "and", "or", "explain",
    "describe", "tell", "me", "about", "with", "can", "would", "will", "between",
    "it", "its", "this", "that", "be", "by", "as", "at", "from", "not", "have", "has",
}

_HEDGING_PHRASES = [
    "i think", "i guess", "maybe", "i'm not sure", "im not sure", "not sure",
    "probably", "i don't know", "i dont know", "kind of", "sort of", "i suppose",
    "possibly", "not really sure",
]

_FILLER_WORDS = ["um", "uh", "like", "basically", "actually", "you know", "literally", "stuff", "things"]


def normalize_for_compare(text: str) -> str:
    t = text.strip().lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return " ".join(t.split())


def _stem(word: str) -> str:
    for suffix in ("ing", "edly", "ed", "es", "s"):
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def _tokenize(text: str) -> list:
    return normalize_for_compare(text).split()


def _stemmed_token_set(text: str) -> set:
    return {_stem(w) for w in _tokenize(text) if w not in _STOPWORDS}


def _load_topic_concepts() -> dict:
    global _TOPIC_CONCEPTS_CACHE
    if _TOPIC_CONCEPTS_CACHE is None:
        with open(TOPIC_CONCEPTS_PATH, "r", encoding="utf-8") as f:
            _TOPIC_CONCEPTS_CACHE = json.load(f)
    return _TOPIC_CONCEPTS_CACHE


def _load_hr_behavioral_concepts() -> dict:
    """question-normalized-text -> concept_tags list"""
    global _HR_BEHAVIORAL_CONCEPTS_CACHE
    if _HR_BEHAVIORAL_CONCEPTS_CACHE is None:
        with open(HR_BEHAVIORAL_PATH, "r", encoding="utf-8") as f:
            records = json.load(f)
        _HR_BEHAVIORAL_CONCEPTS_CACHE = {
            normalize_for_compare(r["question"]): r.get("concept_tags", []) for r in records
        }
    return _HR_BEHAVIORAL_CONCEPTS_CACHE


def _generic_concepts_from_question(question: str) -> list:
    """Fallback when we don't know the skill/topic (e.g. static fallback
    question bank was used): treat the meaningful words of the question
    itself as the expected concepts, so scoring still reflects whether the
    answer actually engages with what was asked."""
    tokens = [w for w in _tokenize(question) if w not in _STOPWORDS and len(w) > 2]
    # de-duplicate while preserving order
    seen = set()
    out = []
    for t in tokens:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:8]


def _narrow_to_question(question: str, concepts: list) -> list:
    """A (skill, topic) concept list covers ~9 different questions on that
    topic; grading one specific question against ALL of them unfairly
    punishes a complete, correct answer that simply wasn't asked about the
    other concepts. Narrow to the concepts this question actually implicates
    (its own wording overlaps the concept's wording); fall back to the full
    list only when nothing narrows (can't tell which concepts apply)."""
    q_stems = {_stem(w) for w in _tokenize(question) if w not in _STOPWORDS}
    relevant = []
    for c in concepts:
        c_stems = {_stem(w) for w in normalize_for_compare(c).split() if w not in _STOPWORDS}
        if q_stems & c_stems:
            relevant.append(c)
    return relevant if len(relevant) >= 2 else concepts


def _expected_concepts(question: str, interview_type: str, skill: str = "", topic: str = "") -> list:
    if interview_type in ("HR", "Behavioral"):
        tags = _load_hr_behavioral_concepts().get(normalize_for_compare(question))
        if tags:
            return tags
        return _generic_concepts_from_question(question)

    if skill and topic:
        concepts = _load_topic_concepts().get(skill, {}).get(topic)
        if concepts:
            return _narrow_to_question(question, concepts)
    return _generic_concepts_from_question(question)


def _single_concept_matched(concept: str, answer_stems: set, answer_norm: str) -> bool:
    concept_norm = normalize_for_compare(concept)
    if concept_norm and concept_norm in answer_norm:
        return True
    words = [w for w in concept_norm.split() if w not in _STOPWORDS]
    if not words:
        return False
    return all(_stem(w) in answer_stems for w in words)


def _concept_matched(concept: str, answer_stems: set, answer_norm: str) -> bool:
    # A concept may list interchangeable wordings as "a|b|c" (used by
    # resume-interview questions, where one idea - e.g. "scaling" - can be
    # expressed many ways). Matching any alternative counts as covering it.
    return any(_single_concept_matched(alt, answer_stems, answer_norm) for alt in concept.split("|"))


def _concept_label(concept: str) -> str:
    """Human-readable name for a concept in feedback text (first alternative)."""
    return concept.split("|")[0].strip()


def _length_factor(word_count: int) -> float:
    if word_count == 0:
        return 0.0
    if word_count < 5:
        return 0.2
    if word_count < 15:
        return 0.55
    if word_count < 40:
        return 0.85
    return 1.0


def _count_hedging(answer_lower: str) -> int:
    return sum(answer_lower.count(p) for p in _HEDGING_PHRASES)


def _count_fillers(tokens: list) -> int:
    return sum(1 for t in tokens if t in _FILLER_WORDS)


def _sentence_split(answer: str) -> list:
    parts = re.split(r"[.!?]+", answer)
    return [p.strip() for p in parts if p.strip()]


def _clip(value: float, lo: int = 0, hi: int = 100) -> int:
    return int(max(lo, min(hi, round(value))))


def evaluate_answer(
    question: str,
    answer: str,
    interview_type: str,
    difficulty: str,
    job_role: str,
    skill: str = "",
    topic: str = "",
    concepts: list = None,
) -> dict:
    """Locally evaluates ONE answer against the expected concepts for THIS
    question. Never calls any network service. Returns the same schema the
    frontend/report already expect.

    `concepts`, when given, are the question's own expected concepts (stored
    with the question when it was generated - used by resume-based interview
    questions, which are built from the candidate's own projects and so have
    no entry in the static topic/HR concept files)."""
    answer = (answer or "").strip()
    word_count = len(answer.split())
    explicit_concepts = [str(c) for c in (concepts or []) if str(c).strip()]

    def _concepts_for_question() -> list:
        return explicit_concepts or _expected_concepts(question, interview_type, skill, topic)

    if word_count == 0:
        return {
            "technicalScore": 0,
            "communicationScore": 0,
            "confidenceScore": 0,
            "grammarScore": 0,
            "fluencyScore": 0,
            "relevanceScore": 0,
            "feedback": (
                "No answer was provided for this question, so it cannot be scored. "
                "Missing concepts: " + ", ".join(_concept_label(c) for c in _concepts_for_question()[:5]) + "."
            ),
        }

    answer_norm = normalize_for_compare(answer)
    answer_tokens = _tokenize(answer)
    answer_stems = _stemmed_token_set(answer)
    length_factor = _length_factor(word_count)

    concepts = _concepts_for_question()
    matched = [c for c in concepts if _concept_matched(c, answer_stems, answer_norm)]
    missing = [c for c in concepts if c not in matched]
    coverage = (len(matched) / len(concepts)) if concepts else 0.0

    # --- technical / topical correctness ---------------------------------
    technical_score = _clip(20 * length_factor + 80 * coverage)

    # --- relevance: does the answer actually engage with the question? ---
    question_concept_tokens = {
        _stem(w) for c in concepts for alt in c.split("|") for w in normalize_for_compare(alt).split() if w not in _STOPWORDS
    }
    question_tokens = {_stem(w) for w in _tokenize(question) if w not in _STOPWORDS}
    relevance_universe = question_concept_tokens | question_tokens
    relevance_overlap = len(answer_stems & relevance_universe) / len(relevance_universe) if relevance_universe else 0.5
    relevance_score = _clip(15 * length_factor + 85 * min(1.0, relevance_overlap * 1.6))

    # --- structure / fluency / grammar heuristics (local, transparent) ---
    sentences = _sentence_split(answer)
    filler_count = _count_fillers(answer_tokens)
    filler_ratio = filler_count / word_count
    unique_ratio = len(set(answer_tokens)) / word_count if word_count else 0
    avg_sentence_len = (word_count / len(sentences)) if sentences else word_count

    fluency_score = _clip(
        60 * length_factor
        + 25 * (1 - min(1.0, filler_ratio * 6))
        + 15 * (1 if 4 <= avg_sentence_len <= 30 else 0.4)
    )

    grammar_penalty = 0
    if not re.search(r"[.!?]$", answer) and word_count > 12:
        grammar_penalty += 10
    if answer == answer.lower() and word_count > 8:
        grammar_penalty += 10
    if re.search(r"[!?]{2,}", answer):
        grammar_penalty += 5
    grammar_score = _clip(55 * length_factor + 45 * unique_ratio - grammar_penalty + 20)

    communication_score = _clip(0.4 * fluency_score + 0.3 * grammar_score + 0.3 * relevance_score)

    # --- confidence: hedging language vs. assertive, substantive answers -
    hedge_count = _count_hedging(answer.lower())
    confidence_score = _clip(35 * length_factor + 65 * coverage - hedge_count * 10 + 15)

    feedback = _build_feedback(
        matched, missing, technical_score, word_count, hedge_count, filler_count, interview_type
    )

    return {
        "technicalScore": technical_score,
        "communicationScore": communication_score,
        "confidenceScore": confidence_score,
        "grammarScore": grammar_score,
        "fluencyScore": fluency_score,
        "relevanceScore": relevance_score,
        "feedback": feedback,
    }


def _build_feedback(matched, missing, technical_score, word_count, hedge_count, filler_count, interview_type) -> str:
    lines = []
    if matched:
        lines.append(
            "Strengths: your answer correctly touched on " + ", ".join(_concept_label(c) for c in matched[:5]) + "."
        )
    else:
        lines.append("Strengths: none of the key concepts for this question were clearly present in your answer.")

    if missing:
        lines.append("Missing concepts: " + ", ".join(_concept_label(c) for c in missing[:5]) + ".")

    if word_count < 15:
        lines.append("Your answer was quite short - expanding it with a concrete example would strengthen it.")
    if hedge_count > 0:
        lines.append("Try to state your answer more confidently; phrases like 'I think' or 'not sure' weaken it.")
    if filler_count > 2:
        lines.append("Reduce filler words (like, basically, actually) for a cleaner, more fluent answer.")

    if technical_score >= 80:
        lines.append("Overall this is a strong, well-covered answer.")
    elif technical_score >= 50:
        lines.append("Overall this is a reasonable answer but leaves room to cover more of the expected concepts.")
    else:
        lines.append("Overall this answer needs significantly more depth on the concepts this question is testing.")

    return " ".join(lines)


def generate_feedback(scores: dict, strengths: list, weaknesses: list, job_role: str) -> str:
    """Deterministic, local, template-based synthesis of the final-report
    narrative from the candidate's own aggregate scores/strengths/weaknesses.
    No external API call. This is rule-based text synthesis, not a claim of
    an AI-authored paragraph."""
    overall = scores.get("overall", 0)
    strengths_text = ", ".join(s.lower() for s in strengths[:3]) if strengths else "consistent effort throughout the interview"
    weaknesses_text = ", ".join(w.lower() for w in weaknesses[:3]) if weaknesses else "minor gaps in a few answers"

    if overall >= 80:
        tone = (
            f"Excellent performance in this {job_role} interview. Your {strengths_text} stood out across "
            f"multiple answers."
        )
    elif overall >= 60:
        tone = (
            f"Solid performance in this {job_role} interview, with good {strengths_text}."
        )
    elif overall >= 40:
        tone = (
            f"A moderate performance in this {job_role} interview. You showed some {strengths_text}, "
            f"but there is clear room to grow."
        )
    else:
        tone = (
            f"This {job_role} interview highlighted significant gaps to work on, though it is a useful "
            f"starting point for focused practice."
        )

    return (
        f"{tone} To improve further, focus on {weaknesses_text}. Reviewing the concept-by-concept "
        f"feedback on each question and revisiting the underlying fundamentals will help close these gaps "
        f"before your next mock interview."
    )
