#!/usr/bin/env python
"""
Phase 10 - Evaluation for the local interview-question generator.

Runs the fine-tuned model (via LocalQuestionGenerator, so this also exercises
the real fallback-to-bank path) over the validation set and over a fixed
showcase list, then reports:
  - non-empty rate, reasonable-length rate, invalid-output rate
  - duplicate rate across a generation batch
  - skill/topic keyword relevance (heuristic - see note below)
  - source used per question (model vs offline bank)
  - a bank-vs-model comparison for the showcase combinations

NOTE on "correct difficulty": there is no ground-truth difficulty classifier
available offline, so difficulty adherence is not auto-scored here - it is
left for human spot-checking in the saved report. This script does not
fabricate a difficulty-accuracy number it cannot actually measure.

NOTE on "existing API-generated questions": this repo does not persist any
historical Groq/OpenAI/Gemini output anywhere accessible offline (interviews
are stored per-user in MongoDB, which requires live DB credentials, and no
sample-output fixture exists in the repo). The 3-way comparison therefore
covers (1) local question bank and (2) fine-tuned model; the API column is
reported as "not available" rather than invented.

Usage (run from ai-services/):
    python training/evaluate.py
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
from local_question_generator import LocalQuestionGenerator, normalize_for_compare, QuestionBank  # noqa: E402

SHOWCASE_CASES = [
    {"skill": "Python", "topic": "Functions", "difficulty": "Easy"},
    {"skill": "Python", "topic": "OOP", "difficulty": "Medium"},
    {"skill": "Python", "topic": "Decorators and Generators", "difficulty": "Hard"},
    {"skill": "SQL", "topic": "Joins", "difficulty": "Easy"},
    {"skill": "SQL", "topic": "Transactions", "difficulty": "Medium"},
    {"skill": "DBMS", "topic": "Normalization", "difficulty": "Medium"},
    {"skill": "Data Structures", "topic": "Trees", "difficulty": "Hard"},
    {"skill": "Machine Learning", "topic": "Overfitting and Regularization", "difficulty": "Medium"},
    {"skill": "Java", "topic": "Collections", "difficulty": "Medium"},
]

STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "and", "or", "to", "for", "is", "are",
    "with", "vs", "versus", "what", "explain", "how", "why", "you", "your",
}


def is_relevant(question: str, skill: str, topic: str) -> bool:
    q = question.lower()
    keywords = set()
    for phrase in (skill, topic):
        for word in phrase.lower().replace("/", " ").split():
            word = word.strip("()")
            if len(word) > 2 and word not in STOPWORDS:
                keywords.add(word)
    return any(kw in q for kw in keywords) if keywords else True


def is_valid(question: str) -> bool:
    return bool(question) and 10 <= len(question) <= 300 and len(question.split()) >= 3


def load_val_set():
    if not os.path.exists(config.VAL_PATH):
        return []
    rows = []
    with open(config.VAL_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def evaluate_validation_set(generator: LocalQuestionGenerator, limit: int = 60) -> dict:
    val_rows = load_val_set()[:limit]
    results = []
    seen_norm = set()
    duplicates = 0

    for row in val_rows:
        result = generator.generate_question(
            skill=row["skill"], topic=row["topic"], difficulty=row["difficulty"],
            candidate_level=row.get("level", "Fresher"),
        )
        question = result["question"]
        norm = normalize_for_compare(question)
        is_dup = norm in seen_norm
        if is_dup:
            duplicates += 1
        seen_norm.add(norm)

        results.append(
            {
                "skill": row["skill"], "topic": row["topic"], "difficulty": row["difficulty"],
                "question": question, "source": result["source"],
                "valid": is_valid(question),
                "relevant": is_relevant(question, row["skill"], row["topic"]),
                "duplicate": is_dup,
                "generation_time_ms": result["generation_time_ms"],
            }
        )

    total = len(results) or 1
    valid_count = sum(1 for r in results if r["valid"])
    relevant_count = sum(1 for r in results if r["relevant"])
    model_sourced = sum(1 for r in results if r["source"] == "model")

    summary = {
        "total_evaluated": len(results),
        "non_empty_rate": sum(1 for r in results if r["question"]) / total,
        "reasonable_length_rate": valid_count / total,
        "invalid_output_rate": 1 - (valid_count / total),
        "skill_topic_relevance_rate": relevant_count / total,
        "duplicate_rate": duplicates / total,
        "model_source_rate": model_sourced / total,
        "bank_fallback_rate": 1 - (model_sourced / total),
        "avg_generation_time_ms": sum(r["generation_time_ms"] for r in results) / total,
    }
    return {"summary": summary, "details": results}


def run_showcase(generator: LocalQuestionGenerator) -> list:
    bank = QuestionBank()
    rows = []
    for case in SHOWCASE_CASES:
        t0 = time.time()
        model_result = generator.generate_question(
            skill=case["skill"], topic=case["topic"], difficulty=case["difficulty"], candidate_level="Fresher",
        )
        model_ms = round((time.time() - t0) * 1000, 1)

        bank_question = bank.pick(case["skill"], case["topic"], case["difficulty"], exclude=set())

        rows.append(
            {
                **case,
                "fine_tuned_model_question": model_result["question"],
                "fine_tuned_model_source": model_result["source"],
                "fine_tuned_model_time_ms": model_ms,
                "local_question_bank_question": bank_question,
                "external_api_question": "not available (no stored Groq/OpenAI/Gemini output samples in this repo)",
            }
        )
    return rows


def write_reports(val_eval: dict, showcase: list):
    os.makedirs(config.EVAL_RESULTS_DIR, exist_ok=True)
    json_path = os.path.join(config.EVAL_RESULTS_DIR, "evaluation_results.json")
    txt_path = os.path.join(config.EVAL_RESULTS_DIR, "evaluation_results.txt")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"validation_set_evaluation": val_eval, "showcase_comparison": showcase}, f, indent=2, ensure_ascii=False)

    lines = ["MindPrep-AI Local Question Generator - Evaluation Report", "=" * 60, ""]
    lines.append("Validation-set evaluation:")
    for k, v in val_eval["summary"].items():
        lines.append(f"  {k:28s} {v:.3f}" if isinstance(v, float) else f"  {k:28s} {v}")
    lines.append("")
    lines.append("Showcase questions (skill/topic/difficulty -> generated question):")
    for row in showcase:
        lines.append(f"\n[{row['skill']} / {row['topic']} / {row['difficulty']}]")
        lines.append(f"  Fine-tuned model ({row['fine_tuned_model_source']}): {row['fine_tuned_model_question']}")
        lines.append(f"  Local question bank:                    {row['local_question_bank_question']}")
        lines.append(f"  External API:                            {row['external_api_question']}")

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Saved: {json_path}")
    print(f"Saved: {txt_path}")


def main():
    generator = LocalQuestionGenerator()
    print("Evaluating on validation set...")
    val_eval = evaluate_validation_set(generator)
    print(json.dumps(val_eval["summary"], indent=2))

    print("\nGenerating showcase questions...")
    showcase = run_showcase(generator)
    for row in showcase:
        print(f"[{row['skill']}/{row['difficulty']}] ({row['fine_tuned_model_source']}) {row['fine_tuned_model_question']}")

    write_reports(val_eval, showcase)


if __name__ == "__main__":
    main()
