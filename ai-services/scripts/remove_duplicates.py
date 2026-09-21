"""
Removes exact and near-duplicate questions from each technology's dataset
file, in place. Run after authoring/editing a dataset, before validation:

    python scripts/remove_duplicates.py [--dry-run]

Two duplicate signals, both purely local (same technique already used by
ai-services/question_history_store.py for the mock-interview question bank):
  1. Exact match on normalized (lowercased, punctuation-stripped) question text.
  2. Near-duplicate match via difflib.SequenceMatcher ratio, scoped to the
     same (topic, difficulty) bucket within a file, so two genuinely
     different questions on different topics are never falsely merged.

Keeps the FIRST occurrence of any duplicate group and re-numbers nothing
(ids are left as-is; a later prepare_dataset.py pass re-sequences ids
after removal so there are no gaps).
"""

import argparse
import difflib
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICES_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(AI_SERVICES_DIR, "training", "data", "tech_questions")

TECHNOLOGY_FILES = ["python", "java", "sql", "cpp", "c", "html", "css", "javascript", "react", "nodejs"]

NEAR_DUP_RATIO_THRESHOLD = 0.90


def normalize(text: str) -> str:
    t = (text or "").strip().lower()
    t = re.sub(r"[^a-z0-9\s]", "", t)
    return " ".join(t.split())


def dedupe_records(records: list) -> tuple:
    """Returns (kept_records, removed_ids)."""
    kept = []
    removed_ids = []
    seen_exact = set()
    # bucket by (topic, difficulty) for near-dup comparison
    buckets: dict = {}

    for r in records:
        norm = normalize(r.get("question", ""))
        if not norm:
            removed_ids.append(r.get("id", "?"))
            continue
        if norm in seen_exact:
            removed_ids.append(r.get("id", "?"))
            continue

        bucket_key = (r.get("topic", ""), r.get("difficulty", ""))
        bucket = buckets.setdefault(bucket_key, [])
        is_near_dup = False
        for existing_norm in bucket:
            if difflib.SequenceMatcher(None, norm, existing_norm).ratio() >= NEAR_DUP_RATIO_THRESHOLD:
                is_near_dup = True
                break
        if is_near_dup:
            removed_ids.append(r.get("id", "?"))
            continue

        seen_exact.add(norm)
        bucket.append(norm)
        kept.append(r)

    return kept, removed_ids


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="report only, don't write files")
    args = parser.parse_args()

    total_removed = 0
    for file_key in TECHNOLOGY_FILES:
        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if not os.path.exists(path):
            print(f"  {file_key}.json: not found, skipping")
            continue

        with open(path, "r", encoding="utf-8") as f:
            records = json.load(f)

        kept, removed_ids = dedupe_records(records)
        total_removed += len(removed_ids)

        if removed_ids:
            print(f"  {file_key}.json: removing {len(removed_ids)} duplicate(s): {removed_ids}")
            if not args.dry_run:
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(kept, f, indent=2, ensure_ascii=False)
        else:
            print(f"  {file_key}.json: no duplicates found ({len(records)} questions)")

    print(f"\nTotal duplicates {'found' if args.dry_run else 'removed'}: {total_removed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
