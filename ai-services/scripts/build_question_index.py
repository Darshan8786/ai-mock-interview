"""
Builds the consolidated, load-once index the runtime question engine reads
(tech_question_engine.py) - a single flattened file instead of the app
re-parsing 10 separate JSON files on every request, plus a small per-
technology metadata summary the frontend uses to populate technology/topic
pickers without shipping the full dataset (answers included) to the client.

    python scripts/build_question_index.py

Refuses to build (exits non-zero) if validation fails - the index must
never be built from an invalid dataset. Always run prepare_dataset.py first.
"""

import json
import os
import sys
import time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import validate_questions  # noqa: E402

DATA_DIR = validate_questions.DATA_DIR
INDEX_PATH = os.path.join(DATA_DIR, "_index.json")
META_PATH = os.path.join(DATA_DIR, "_technologies_meta.json")


def main() -> int:
    exit_code = validate_questions.main()
    if exit_code != 0:
        print("\nbuild_question_index.py: dataset is invalid - fix it (see problems above) before indexing.")
        return exit_code

    all_records = []
    meta = {}

    for file_key, technology in validate_questions.TECHNOLOGIES.items():
        path = os.path.join(DATA_DIR, f"{file_key}.json")
        if not os.path.exists(path):
            continue
        records = json.load(open(path, "r", encoding="utf-8"))

        topics = sorted({r["topic"] for r in records})
        by_difficulty = {}
        by_type = {}
        for r in records:
            by_difficulty[r["difficulty"]] = by_difficulty.get(r["difficulty"], 0) + 1
            by_type[r["question_type"]] = by_type.get(r["question_type"], 0) + 1

        meta[technology] = {
            "file_key": file_key,
            "total": len(records),
            "topics": topics,
            "by_difficulty": by_difficulty,
            "by_question_type": by_type,
        }
        all_records.extend(records)

    index = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(all_records),
        "questions": all_records,
    }

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"build_question_index.py: indexed {len(all_records)} questions -> {INDEX_PATH}")
    print(f"build_question_index.py: technology metadata -> {META_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
