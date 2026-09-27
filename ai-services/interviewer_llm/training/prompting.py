"""Prompt construction shared by training, evaluation and inference (they MUST match exactly).

v1 (qgen / qa)            - the original interview-only model (plain-text question out).
v2 (qgen_<domain> / mcq_answer) - the combined interview + aptitude + tech model: the prompt carries a JSON context
                            (domain, topic, technology, difficulty, question type) and the expected output schema, and
                            the model answers with one JSON object.
"""
from __future__ import annotations

import json

SYSTEM_PROMPTS = {
    "qgen": "You are an experienced software engineering interviewer. Write one clear interview question that fits the requested role, topic and difficulty.",
    "qa": "You are an experienced software engineer answering interview questions accurately and concisely.",
    # ── v2 (combined model) ──
    "qgen_interview": "You are an experienced interviewer. Write one clear interview question that fits the given context. Reply with one JSON object only.",
    "qgen_aptitude": ("You set aptitude tests for campus placements. Write one correct multiple-choice question for the given context: "
                      "exactly four different options, exactly one correct, and an explanation that shows the working. Reply with one JSON object only."),
    "qgen_tech": ("You are a programming instructor. Write one technically correct practice question for the given context, with its "
                  "answer, explanation and the concepts it tests. Reply with one JSON object only."),
    "mcq_answer": "You solve aptitude and programming multiple-choice questions. Reply with the text of the single correct option only.",
}
QGEN_INSTRUCTION = "Generate a software engineering interview question."
QA_INSTRUCTION = "Answer the following software engineering interview question."


def user_message(instruction: str, input_text: str) -> str:
    return f"{instruction}\n\n{input_text}".strip()


def build_messages(task: str, instruction: str, input_text: str, output: str | None = None) -> list[dict]:
    msgs = [
        {"role": "system", "content": SYSTEM_PROMPTS[task]},
        {"role": "user", "content": user_message(instruction, input_text)},
    ]
    if output is not None:
        msgs.append({"role": "assistant", "content": output})
    return msgs


def qgen_input(role: str | None, topic: str, difficulty: str | None = None, subtopic: str | None = None, qtype: str | None = None) -> str:
    """Same field order/labels the training prompts use (see prepare_splits.qgen_input)."""
    lines = []
    if role:
        lines.append(f"Role: {role}")
    lines.append(f"Topic: {topic}")
    if subtopic:
        lines.append(f"Subtopic: {subtopic}")
    if difficulty:
        lines.append(f"Difficulty: {difficulty}")
    if qtype:
        lines.append(f"Type: {qtype}")
    return "\n".join(lines)


# ── v2: combined interview / aptitude / tech model ────────────────────────────────
QGEN_V2_INSTRUCTION = "Generate one question."
MCQ_ANSWER_INSTRUCTION = "Answer this multiple-choice question."
DOMAINS = ("interview", "aptitude", "tech")

# Output schema per (domain, question_type) - shown to the model in the prompt and enforced by structured_validator.
SCHEMAS: dict[tuple[str, str], list[str]] = {
    ("interview", "*"): ["question", "expected_concepts"],
    ("aptitude", "mcq"): ["question", "options", "answer", "explanation"],
    ("tech", "mcq"): ["question", "options", "answer", "explanation", "concepts"],
    ("tech", "conceptual"): ["question", "answer", "explanation", "concepts"],
    ("tech", "output_prediction"): ["question", "code", "answer", "explanation", "concepts"],
    ("tech", "debugging"): ["question", "code", "answer", "fixed_code", "explanation", "concepts"],
    ("tech", "coding"): ["question", "starter_code", "answer", "explanation", "concepts"],
}
_FIELD_HINT = {"question": "str", "options": "[4 x str]", "answer": "str", "explanation": "str", "concepts": "[str]",
               "expected_concepts": "[str]", "code": "str", "fixed_code": "str", "starter_code": "str"}
CONTEXT_KEYS = ("domain", "category", "technology", "skill", "role", "topic", "difficulty", "question_type")


def schema_fields(domain: str, question_type: str) -> list[str]:
    return SCHEMAS.get((domain, question_type)) or SCHEMAS.get((domain, "*")) or SCHEMAS[("tech", "conceptual")]


def schema_text(domain: str, question_type: str) -> str:
    fields = schema_fields(domain, question_type)
    hint = ", ".join(f'"{f}": {_FIELD_HINT[f]}' for f in fields)
    if domain != "interview" and "options" in fields:
        hint += " (answer is one of the options)"
    return "{" + hint + "}"


def context_json(ctx: dict) -> str:
    """Fixed key order, only keys that have a value - identical for training and inference."""
    return json.dumps({k: ctx[k] for k in CONTEXT_KEYS if ctx.get(k) not in (None, "")}, ensure_ascii=False)


def qgen_v2_input(ctx: dict) -> str:
    return f"Context: {context_json(ctx)}\nSchema: {schema_text(ctx['domain'], ctx.get('question_type', ''))}"


def qgen_v2_task(domain: str) -> str:
    return f"qgen_{domain}"


def mcq_answer_input(question: str, options: list[str]) -> str:
    return question.strip() + "\nOptions:\n" + "\n".join(f"- {o}" for o in options)


def output_json(record: dict, domain: str, question_type: str) -> str:
    return json.dumps({f: record[f] for f in schema_fields(domain, question_type)}, ensure_ascii=False)
