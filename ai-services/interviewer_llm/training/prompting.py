"""Prompt construction shared by training, evaluation and inference (they MUST match exactly)."""
from __future__ import annotations

SYSTEM_PROMPTS = {
    "qgen": "You are an experienced software engineering interviewer. Write one clear interview question that fits the requested role, topic and difficulty.",
    "qa": "You are an experienced software engineer answering interview questions accurately and concisely.",
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
