"""
Steps 4 + 5 - Build instruction-tuning examples and split 80 / 10 / 10.

    python training/prepare_splits.py [--seed 42]

Input : data/processed/interview_cleaned.jsonl   (already de-duplicated by clean_dataset.py)
Output: data/processed/train.jsonl, validation.jsonl, test.jsonl, SPLIT_MANIFEST.json

Two kinds of example, tagged by `task`:
  qgen  "Generate a software engineering interview question."
        input : Role / Topic / Subtopic / Difficulty / Type  (whichever are known)
        output: the interview question
  qa    "Answer the following software engineering interview question."
        input : the question             output: the reference answer  (Kaggle pairs only)

Format decisions taken from the REAL data, not assumed:
  * The data has Category + Difficulty (+ Answer for the Kaggle part) but NO role column, so the
    role in the prompt is derived from the topic (common.ROLE_MAP) - a documented heuristic.
  * Difficulty is unknown (null) for records whose copies disagreed; those prompts simply omit it.
  * Training prompts are varied (fields randomly dropped, deterministically) so the model also
    works when a caller supplies only a topic, or only a role + topic. Validation/test use ONE
    fixed, fully-specified prompt per record so results are comparable between runs.

Leakage control: the split unit is a whole near-duplicate CLUSTER, so look-alike questions can
never sit in different splits. After splitting, this script re-checks every cross-split pair and
fails if any exact or near-duplicate question is found. test.jsonl is hashed into the manifest;
train.py / evaluate.py refuse to run if it changed.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter, defaultdict

from common import (PROCESSED, ROLE_MAP, ROOT, SUBTOPIC_ROLE, norm, read_jsonl, sha256, similar, stable_int, write_jsonl)

QGEN_INSTRUCTION = "Generate a software engineering interview question."
QA_INSTRUCTION = "Answer the following software engineering interview question."


def roles_for(rec: dict) -> list[str]:
    roles = list(ROLE_MAP.get(rec["topic"], ["Software Engineer"]))
    extra = SUBTOPIC_ROLE.get(rec.get("subtopic", ""))
    return ([extra] + [r for r in roles if r != extra]) if extra else roles


def qgen_input(rec: dict, variant: int | None) -> str:
    """variant None = the fixed, fully-specified evaluation prompt; 0/1 = varied training prompts."""
    roles = roles_for(rec)
    if variant is None:
        role, use_role, use_sub, use_type = roles[0], True, True, False
    else:
        h = stable_int(f"{rec['id']}:{variant}")
        role = roles[h % len(roles)]
        use_role = (h >> 3) % 4 != 0          # ~75% mention a role
        use_sub = (h >> 5) % 2 == 0           # ~50% mention the subtopic
        use_type = (h >> 7) % 2 == 0          # ~50% state the question type
    lines = []
    if use_role:
        lines.append(f"Role: {role}")
    lines.append(f"Topic: {rec['topic']}")
    if rec.get("subtopic") and use_sub:
        lines.append(f"Subtopic: {rec['subtopic']}")
    if rec.get("difficulty"):
        lines.append(f"Difficulty: {rec['difficulty']}")
    if use_type and rec.get("question_type"):
        lines.append(f"Type: {rec['question_type']}")
    return "\n".join(lines)


def examples_for(rec: dict, training: bool) -> list[dict]:
    base = {"id": rec["id"], "source": rec["source"], "topic": rec["topic"], "difficulty": rec.get("difficulty")}
    out = []
    for variant in ((0, 1) if training else (None,)):
        out.append({**base, "task": "qgen", "instruction": QGEN_INSTRUCTION,
                    "input": qgen_input(rec, variant), "output": rec["question"]})
    if rec.get("answer"):
        out.append({**base, "task": "qa", "instruction": QA_INSTRUCTION, "input": rec["question"], "output": rec["answer"]})
    return out


def split_clusters(records: list[dict], seed: int) -> dict[str, str]:
    """cluster id -> 'train' | 'validation' | 'test', stratified by topic (~80/10/10 by record count)."""
    rng = random.Random(seed)
    by_topic: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for r in records:
        by_topic[r["topic"]][r["cluster"]].append(r)

    assignment: dict[str, str] = {}
    for topic in sorted(by_topic):
        clusters = sorted(by_topic[topic].items())
        total = sum(len(v) for _, v in clusters)
        rng.shuffle(clusters)
        if total < 8:                       # too small to hold anything out and still learn from it
            for cid, _ in clusters:
                assignment[cid] = "train"
            continue
        want_test = max(1, round(total * 0.10))
        want_val = max(1, round(total * 0.10))
        got = {"test": 0, "validation": 0}
        for cid, members in clusters:
            if got["test"] < want_test:
                assignment[cid] = "test"; got["test"] += len(members)
            elif got["validation"] < want_val:
                assignment[cid] = "validation"; got["validation"] += len(members)
            else:
                assignment[cid] = "train"
    return assignment


def check_no_leakage(splits: dict[str, list[dict]]) -> list[str]:
    problems = []
    keys = {name: {norm(r["question"]) for r in rs} for name, rs in splits.items()}
    names = list(splits)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            both = keys[a] & keys[b]
            if both:
                problems.append(f"{len(both)} identical question(s) in both {a} and {b}, e.g. {next(iter(both))!r}")
    # near-duplicates across splits (length-bucketed to stay fast)
    by_len: dict[int, list[tuple[str, dict]]] = defaultdict(list)
    for name, rs in splits.items():
        for r in rs:
            by_len[len(norm(r["question"])) // 8].append((name, r))
    for bucket, items in by_len.items():
        pool = items + by_len.get(bucket + 1, [])
        for i, (na, ra) in enumerate(items):
            for nb, rb in pool[i + 1:]:
                if na != nb and similar(ra["question"], rb["question"]):
                    problems.append(f"near-duplicate across {na}/{nb}: {ra['question']!r} ~ {rb['question']!r}")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    manifest_path = PROCESSED / "SPLIT_MANIFEST.json"
    test_path = PROCESSED / "test.jsonl"
    if manifest_path.exists() and test_path.exists():
        print("A split already exists and test.jsonl is locked. Delete data/processed/SPLIT_MANIFEST.json and the split files "
              "deliberately if you really want to re-split (that invalidates any earlier evaluation).", file=sys.stderr)
        return 1

    records = read_jsonl(PROCESSED / "interview_cleaned.jsonl")
    assignment = split_clusters(records, args.seed)
    splits: dict[str, list[dict]] = {"train": [], "validation": [], "test": []}
    for r in records:
        splits[assignment[r["cluster"]]].append(r)

    problems = check_no_leakage(splits)
    if problems:
        print("LEAKAGE CHECK FAILED:\n  " + "\n  ".join(problems[:10]), file=sys.stderr)
        return 2

    manifest = {"seed": args.seed, "records": {}, "examples": {}, "sha256": {}, "leakage_check": "passed: no exact or near-duplicate question across splits",
                "note": "test.jsonl is locked; its hash is verified by train.py and evaluate.py."}
    for name, rs in splits.items():
        rows = []
        for r in sorted(rs, key=lambda x: x["id"]):
            rows.extend(examples_for(r, training=(name == "train")))
        path = PROCESSED / f"{name}.jsonl"
        write_jsonl(path, rows)
        manifest["records"][name] = len(rs)
        manifest["examples"][name] = dict(Counter(e["task"] for e in rows))
        manifest["sha256"][name] = sha256(path)
        print(f"{name:<11} records {len(rs):>5}   examples {dict(Counter(e['task'] for e in rows))}")

    total = len(records)
    print(f"\n{total} unique questions -> " + " / ".join(f"{n} {len(rs)} ({len(rs) / total:.0%})" for n, rs in splits.items()))
    print("Leakage check: passed (no exact or near-duplicate question across splits)")
    for name, rs in splits.items():
        print(f"  {name:<11} sources {dict(Counter(r['source'] for r in rs))}  difficulty {dict(Counter(str(r.get('difficulty')) for r in rs))}")
    print("  topics in test:", dict(Counter(r["topic"] for r in splits["test"]).most_common()))

    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nManifest (with file hashes) written to {manifest_path.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
