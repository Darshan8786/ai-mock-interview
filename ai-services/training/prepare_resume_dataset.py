#!/usr/bin/env python
"""
Cleans/validates the raw resume-enhancement dataset (build_resume_dataset.py
output), converts it into instruction/completion training examples, splits
into train/val, and writes a stats report. Mirrors prepare_dataset.py's
structure for the interview-question dataset.

Usage (run from ai-services/):
    python training/prepare_resume_dataset.py
"""

import json
import os
import random
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import resume_config as config


def normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


def validate_and_clean(raw_records: list) -> tuple[list, dict]:
    rejections = Counter()
    seen_exact = set()
    cleaned = []

    for rec in raw_records:
        if not isinstance(rec, dict) or rec.get("task") not in ("bullet", "summary"):
            rejections["invalid_record"] += 1
            continue

        if rec["task"] == "bullet":
            weak = normalize_text(rec.get("weak", ""))
            strong = normalize_text(rec.get("strong", ""))
            if not weak or not strong or len(weak) < 8 or len(strong) < 8:
                rejections["bullet_missing_or_too_short"] += 1
                continue
            key = ("bullet", weak.lower())
            if key in seen_exact:
                rejections["exact_duplicate"] += 1
                continue
            seen_exact.add(key)
            cleaned.append({"task": "bullet", "weak": weak, "strong": strong})
        else:
            role = normalize_text(rec.get("role", ""))
            skills = rec.get("skills", [])
            years = rec.get("experience_years", 0)
            summary = normalize_text(rec.get("summary", ""))
            if not role or not skills or not summary or len(summary) < 30:
                rejections["summary_missing_or_too_short"] += 1
                continue
            key = ("summary", role.lower())
            if key in seen_exact:
                rejections["exact_duplicate"] += 1
                continue
            seen_exact.add(key)
            cleaned.append(
                {"task": "summary", "role": role, "skills": skills, "experience_years": years, "summary": summary}
            )

    return cleaned, dict(rejections)


def to_instruction_examples(records: list) -> list:
    examples = []
    for rec in records:
        if rec["task"] == "bullet":
            prompt = config.BULLET_PROMPT.format(weak=rec["weak"])
            completion = rec["strong"]
        else:
            prompt = config.SUMMARY_PROMPT.format(
                role=rec["role"], skills=", ".join(rec["skills"]), years=rec["experience_years"]
            )
            completion = rec["summary"]
        examples.append({"task": rec["task"], "prompt": prompt, "completion": completion})
    return examples


def split_train_val(examples: list, rng: random.Random):
    shuffled = examples[:]
    rng.shuffle(shuffled)
    val_size = max(1, int(len(shuffled) * config.VAL_FRACTION))
    return shuffled[val_size:], shuffled[:val_size]


def write_jsonl(path: str, rows: list):
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_stats(raw_count, rejections, clean_records, train, val):
    task_counts = Counter(r["task"] for r in clean_records)
    stats = {
        "total_raw_examples": raw_count,
        "rejected": rejections,
        "total_clean_examples": len(clean_records),
        "training_examples": len(train),
        "validation_examples": len(val),
        "examples_per_task": dict(task_counts),
        "seed": config.SEED,
        "val_fraction": config.VAL_FRACTION,
    }
    with open(config.STATS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    lines = [
        "MindPrep-AI Resume Enhancement Dataset - Statistics Report",
        "=" * 60,
        f"Total raw examples:        {raw_count}",
        f"Rejected during cleaning:  {sum(rejections.values())}",
    ]
    for reason, count in rejections.items():
        lines.append(f"  - {reason}: {count}")
    lines += [
        f"Total clean examples:      {len(clean_records)}",
        f"Training examples:         {len(train)}",
        f"Validation examples:       {len(val)}",
        "",
        "Examples per task:",
    ]
    for k, v in task_counts.items():
        lines.append(f"  {k:20s} {v}")
    with open(config.STATS_TXT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    if not os.path.exists(config.RAW_DATASET_PATH):
        print(f"Raw dataset not found at {config.RAW_DATASET_PATH}.")
        print("Run `python training/build_resume_dataset.py` first.")
        sys.exit(1)

    with open(config.RAW_DATASET_PATH, "r", encoding="utf-8") as f:
        raw_records = json.load(f)

    clean_records, rejections = validate_and_clean(raw_records)
    print(f"Cleaned {len(raw_records)} raw records -> {len(clean_records)} valid records")
    if rejections:
        print(f"Rejections: {rejections}")

    with open(config.CLEAN_DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(clean_records, f, indent=2, ensure_ascii=False)

    examples = to_instruction_examples(clean_records)
    rng = random.Random(config.SEED)
    train, val = split_train_val(examples, rng)

    os.makedirs(config.DATA_DIR, exist_ok=True)
    write_jsonl(config.TRAIN_PATH, train)
    write_jsonl(config.VAL_PATH, val)
    write_stats(len(raw_records), rejections, clean_records, train, val)

    print(f"Train examples: {len(train)} -> {config.TRAIN_PATH}")
    print(f"Val examples:   {len(val)} -> {config.VAL_PATH}")


if __name__ == "__main__":
    main()
