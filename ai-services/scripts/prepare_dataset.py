"""
Full dataset preparation pass, run after authoring/editing questions and
before build_question_index.py:

    python scripts/prepare_dataset.py

Pipeline: dedupe -> re-sequence ids (closes gaps left by removed duplicates,
keeps original relative order) -> validate -> write per-technology and
overall stats.

Refuses to proceed (exits non-zero, writes no index) if validation still
fails after dedup/resequencing - the application must never be pointed at
an invalid dataset.
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from remove_duplicates import dedupe_records, TECHNOLOGY_FILES, DATA_DIR  # noqa: E402
import validate_questions  # noqa: E402

STATS_PATH = os.path.join(DATA_DIR, "dataset_stats.json")


def resequence_ids(file_key: str, records: list) -> list:
    for i, r in enumerate(records, start=1):
        r["id"] = f"{file_key}_{i:03d}"
    return records


def main() -> int:
    print("=== Step 1/3: Deduplicate ===")
    for file_key in TECHNOLOGY_FILES:
        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if not os.path.exists(path):
            print(f"  {file_key}.json: not found, skipping")
            continue
        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)
        kept, removed = dedupe_records(records)
        if removed:
            print(f"  {file_key}.json: removed {len(removed)} duplicate(s)")

        print(f"=== Step 2/3: Re-sequence ids ({file_key}) ===")
        kept = resequence_ids(file_key, kept)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(kept, f, indent=2, ensure_ascii=False)

    print("\n=== Step 3/3: Validate ===")
    exit_code = validate_questions.main()
    if exit_code != 0:
        print("\nprepare_dataset.py: validation failed after prep - fix the dataset and re-run.")
        return exit_code

    stats = {"by_technology": {}, "by_difficulty": {}, "by_question_type": {}, "by_topic": {}}
    total = 0
    for file_key, technology in validate_questions.TECHNOLOGIES.items():
        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if not os.path.exists(path):
            continue
        records = json.load(open(path, "r", encoding="utf-8"))
        stats["by_technology"][technology] = len(records)
        total += len(records)
        for r in records:
            stats["by_difficulty"][r["difficulty"]] = stats["by_difficulty"].get(r["difficulty"], 0) + 1
            stats["by_question_type"][r["question_type"]] = stats["by_question_type"].get(r["question_type"], 0) + 1
            key = f"{technology}::{r['topic']}"
            stats["by_topic"][key] = stats["by_topic"].get(key, 0) + 1
    stats["total"] = total

    with open(STATS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    print(f"\nprepare_dataset.py: done. {total} total questions. Stats written to {STATS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
