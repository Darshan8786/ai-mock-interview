#!/usr/bin/env python
"""
Phase 2 - Dataset cleaning, validation, and train/val split.

Reads training/data/interview_questions/raw_dataset.json (produced by
build_raw_dataset.py), cleans it, converts it into instruction/output training
examples, splits it into train/val sets with a fixed seed, and writes a
dataset statistics report.

Usage (run from ai-services/):
    python training/prepare_dataset.py
"""

import difflib
import json
import os
import random
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

REQUIRED_FIELDS = ["skill", "topic", "difficulty", "question_type", "question"]
DIFFICULTY_ALIASES = {
    "easy": "Easy", "beginner": "Easy", "basic": "Easy", "e": "Easy",
    "medium": "Medium", "intermediate": "Medium", "moderate": "Medium", "m": "Medium",
    "hard": "Hard", "advanced": "Hard", "difficult": "Hard", "expert": "Hard", "h": "Hard",
}


def normalize_difficulty(value: str) -> str | None:
    if not isinstance(value, str):
        return None
    key = value.strip().lower()
    return DIFFICULTY_ALIASES.get(key)


def normalize_text(value: str) -> str:
    return " ".join(value.strip().split())


def normalize_for_dedup(question: str) -> str:
    """Aggressively normalized key used for exact/near-duplicate detection."""
    q = question.strip().lower()
    q = "".join(ch for ch in q if ch.isalnum() or ch.isspace())
    return " ".join(q.split())


def validate_and_clean(raw_records: list) -> tuple[list, dict]:
    """Removes empty/malformed records, validates required fields, normalizes
    difficulty labels, and removes exact + near-duplicate questions.
    Returns (clean_records, rejection_counts)."""
    rejections = Counter()
    seen_exact = set()
    cleaned = []

    for rec in raw_records:
        if not isinstance(rec, dict):
            rejections["not_an_object"] += 1
            continue

        if any(not rec.get(f) or not isinstance(rec.get(f), str) for f in REQUIRED_FIELDS):
            rejections["missing_or_empty_field"] += 1
            continue

        skill = normalize_text(rec["skill"])
        topic = normalize_text(rec["topic"])
        question_type = normalize_text(rec["question_type"]).lower()
        question = normalize_text(rec["question"])
        difficulty = normalize_difficulty(rec["difficulty"])

        if difficulty is None:
            rejections["invalid_difficulty"] += 1
            continue
        if len(question) < 12 or len(question) > 400:
            rejections["question_length_out_of_range"] += 1
            continue
        if not question.endswith("?") and not question.endswith("."):
            # Still valid content-wise, but flag obviously malformed fragments.
            if len(question.split()) < 4:
                rejections["malformed_question"] += 1
                continue

        dedup_key = normalize_for_dedup(question)
        if dedup_key in seen_exact:
            rejections["exact_duplicate"] += 1
            continue
        seen_exact.add(dedup_key)

        cleaned.append(
            {
                "skill": skill,
                "topic": topic,
                "difficulty": difficulty,
                "question_type": question_type,
                "question": question,
                "_dedup_key": dedup_key,
            }
        )

    # Near-duplicate check: only compare within the same (skill, topic) bucket
    # to keep this O(n * bucket_size) instead of O(n^2) over the whole set.
    buckets = defaultdict(list)
    for rec in cleaned:
        buckets[(rec["skill"], rec["topic"])].append(rec)

    to_drop = set()
    for bucket in buckets.values():
        for i in range(len(bucket)):
            if id(bucket[i]) in to_drop:
                continue
            for j in range(i + 1, len(bucket)):
                if id(bucket[j]) in to_drop:
                    continue
                ratio = difflib.SequenceMatcher(
                    None, bucket[i]["_dedup_key"], bucket[j]["_dedup_key"]
                ).ratio()
                if ratio >= config.NEAR_DUP_SIMILARITY_THRESHOLD:
                    to_drop.add(id(bucket[j]))
                    rejections["near_duplicate"] += 1

    final = [r for r in cleaned if id(r) not in to_drop]
    for r in final:
        del r["_dedup_key"]

    return final, dict(rejections)


def to_instruction_examples(records: list, rng: random.Random) -> list:
    examples = []
    for rec in records:
        level = rng.choice(config.CANDIDATE_LEVELS)
        template = rng.choice(config.INSTRUCTION_TEMPLATES)
        instruction = template.format(
            difficulty=rec["difficulty"], skill=rec["skill"], topic=rec["topic"], level=level
        )
        prompt = config.PROMPT_HEADER.format(instruction=instruction)
        examples.append(
            {
                "skill": rec["skill"],
                "topic": rec["topic"],
                "difficulty": rec["difficulty"],
                "question_type": rec["question_type"],
                "level": level,
                "prompt": prompt,
                "completion": rec["question"],
            }
        )
    return examples


def split_train_val(examples: list, rng: random.Random):
    shuffled = examples[:]
    rng.shuffle(shuffled)
    val_size = max(1, int(len(shuffled) * config.VAL_FRACTION))
    val = shuffled[:val_size]
    train = shuffled[val_size:]
    return train, val


def write_jsonl(path: str, rows: list):
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def build_stats(raw_count: int, rejections: dict, clean_records: list, train: list, val: list) -> dict:
    def counts_by(field):
        c = Counter(r[field] for r in clean_records)
        return dict(sorted(c.items(), key=lambda kv: (-kv[1], kv[0])))

    return {
        "total_raw_examples": raw_count,
        "rejected": rejections,
        "total_clean_examples": len(clean_records),
        "training_examples": len(train),
        "validation_examples": len(val),
        "questions_per_skill": counts_by("skill"),
        "questions_per_difficulty": counts_by("difficulty"),
        "questions_per_topic": counts_by("topic"),
        "questions_per_type": counts_by("question_type"),
        "seed": config.SEED,
        "val_fraction": config.VAL_FRACTION,
    }


def write_stats_report(stats: dict):
    with open(config.STATS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    lines = []
    lines.append("MindPrep-AI Interview Question Dataset - Statistics Report")
    lines.append("=" * 60)
    lines.append(f"Total raw examples:        {stats['total_raw_examples']}")
    lines.append(f"Rejected during cleaning:  {sum(stats['rejected'].values())}")
    for reason, count in stats["rejected"].items():
        lines.append(f"  - {reason}: {count}")
    lines.append(f"Total clean examples:      {stats['total_clean_examples']}")
    lines.append(f"Training examples:         {stats['training_examples']}")
    lines.append(f"Validation examples:       {stats['validation_examples']}")
    lines.append("")
    lines.append("Questions per skill:")
    for k, v in stats["questions_per_skill"].items():
        lines.append(f"  {k:20s} {v}")
    lines.append("")
    lines.append("Questions per difficulty:")
    for k, v in stats["questions_per_difficulty"].items():
        lines.append(f"  {k:20s} {v}")
    lines.append("")
    lines.append("Questions per topic:")
    for k, v in stats["questions_per_topic"].items():
        lines.append(f"  {k:40s} {v}")
    lines.append("")
    lines.append("Questions per question_type:")
    for k, v in stats["questions_per_type"].items():
        lines.append(f"  {k:20s} {v}")

    with open(config.STATS_TXT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    if not os.path.exists(config.RAW_DATASET_PATH):
        print(f"Raw dataset not found at {config.RAW_DATASET_PATH}.")
        print("Run `python training/build_raw_dataset.py` first.")
        sys.exit(1)

    with open(config.RAW_DATASET_PATH, "r", encoding="utf-8") as f:
        raw_records = json.load(f)

    clean_records, rejections = validate_and_clean(raw_records)
    print(f"Cleaned {len(raw_records)} raw records -> {len(clean_records)} valid records")
    if rejections:
        print(f"Rejections: {rejections}")

    with open(config.CLEAN_DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(clean_records, f, indent=2, ensure_ascii=False)

    rng = random.Random(config.SEED)
    examples = to_instruction_examples(clean_records, rng)

    rng2 = random.Random(config.SEED)
    train, val = split_train_val(examples, rng2)

    os.makedirs(config.DATA_DIR, exist_ok=True)
    write_jsonl(config.TRAIN_PATH, train)
    write_jsonl(config.VAL_PATH, val)

    stats = build_stats(len(raw_records), rejections, clean_records, train, val)
    write_stats_report(stats)

    print(f"Train examples: {len(train)} -> {config.TRAIN_PATH}")
    print(f"Val examples:   {len(val)} -> {config.VAL_PATH}")
    print(f"Stats report:   {config.STATS_JSON_PATH}, {config.STATS_TXT_PATH}")


if __name__ == "__main__":
    main()
