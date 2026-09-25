"""
Step 3 - Build a CLEANED COPY of the data. The originals are only read.

    python training/clean_dataset.py

Sources
  kaggle   the downloaded Kaggle CSV (question + answer + category + difficulty)
  curated  the project's hand-written question set (ai-services/training/data/
           interview_questions/raw_dataset.json): balanced difficulty, no answers

Output
  data/processed/interview_cleaned.jsonl   one canonical record per unique question
  data/processed/interview_removed.jsonl   everything dropped, with the reason
  data/reports/cleaning_report.(txt|json)

What "cleaned" means here
  * whitespace / quote normalisation, encoding damage fixed by decoding the CSV correctly
  * DROPPED: empty, far-too-short (<15 chars or <4 words), far-too-long, unusable difficulty
  * DEDUPLICATED: exact and case/punctuation-insensitive duplicates (also across the two sources);
    the best information of the copies is merged (an answer is kept if any copy has one)
  * FLAGGED, not dropped: imperative task prompts ("Design a ..."), conflicting difficulty labels
    between copies (the label is then set to null rather than guessed), very short answers,
    near-duplicates (used later so look-alikes never straddle train/validation/test)
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from common import (CURATED_DEFAULT, DIFFICULTIES, KAGGLE_TOPIC_MAP, PATH_FILE, PROCESSED, REPORTS, ROOT,
                    clean_text, norm, similar, write_jsonl)

TASK_START = re.compile(r"^(design|implement|write|build|create|find|optimi[sz]e|develop|architect|develop|code)\b", re.I)
MOJIBAKE = re.compile(r"(â€|Ã.|ï¿½|�)")


def read_kaggle(path: Path) -> list[dict]:
    csv_files = [path] if path.is_file() else sorted(path.rglob("*.csv"))
    if not csv_files:
        raise SystemExit(f"No CSV found under {path}")
    rows = []
    for f in csv_files:
        raw = f.read_bytes()
        for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        import io
        reader = csv.DictReader(io.StringIO(text, newline=""))
        for i, r in enumerate(reader, start=1):
            rows.append({"_row": i, "_file": f.name, **{(k or "").strip(): v for k, v in r.items()}})
    return rows


def find_col(row: dict, *names: str) -> str | None:
    lowered = {k.lower(): k for k in row}
    for n in names:
        for low, orig in lowered.items():
            if n in low and "number" not in low:
                return orig
    return None


def norm_difficulty(value) -> str | None:
    v = str(value or "").strip().lower()
    return {"easy": "Easy", "medium": "Medium", "med": "Medium", "hard": "Hard", "difficult": "Hard"}.get(v)


def qtype(question: str, declared: str | None = None) -> str:
    if declared:
        return declared
    q = question.strip()
    if TASK_START.match(q):
        return "design" if re.match(r"^(design|architect)", q, re.I) else "task"
    return "conceptual"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kaggle", help="Kaggle dataset folder/file (default: location saved by download_dataset.py)")
    ap.add_argument("--curated", default=str(CURATED_DEFAULT), help="curated question JSON; use 'none' to skip")
    args = ap.parse_args()

    kaggle_path = Path(args.kaggle) if args.kaggle else Path(PATH_FILE.read_text(encoding="utf-8").strip())
    records: list[dict] = []
    removed: list[dict] = []
    report: dict = {"inputs": {}}

    def reject(rec: dict, reason: str) -> None:
        removed.append({**rec, "removed_reason": reason})

    # ── source 1: Kaggle
    rows = read_kaggle(kaggle_path)
    report["inputs"]["kaggle_rows"] = len(rows)
    for r in rows:
        qcol = find_col(r, "question")
        acol = find_col(r, "answer")
        ccol = find_col(r, "categor", "topic")
        dcol = find_col(r, "difficult")
        question = clean_text(r.get(qcol) or "") if qcol else ""
        answer = clean_text(r.get(acol) or "") if acol else ""
        cat = clean_text(r.get(ccol) or "") if ccol else ""
        topic, sub = KAGGLE_TOPIC_MAP.get(cat.lower(), (cat or "General Programming", ""))
        rec = {
            "source": "kaggle", "source_row": r["_row"], "topic": topic, "subtopic": sub, "category_original": cat,
            "difficulty": norm_difficulty(r.get(dcol)) if dcol else None, "question": question,
            "answer": answer or None, "flags": [],
        }
        if MOJIBAKE.search(question + answer):
            rec["flags"].append("encoding_damage")
        if not question:
            reject(rec, "empty question"); continue
        if len(question) < 15 or len(question.split()) < 4:
            reject(rec, "question too short"); continue
        if len(question) > 400:
            reject(rec, "question too long"); continue
        if rec["difficulty"] is None:
            rec["flags"].append("difficulty_missing")
        if answer and len(answer) < 20:
            rec["flags"].append("answer_too_short")
            rec["answer"] = None
        rec["question_type"] = qtype(question)
        records.append(rec)

    # ── source 2: the project's curated set (optional)
    if args.curated.lower() != "none" and Path(args.curated).exists():
        curated = json.loads(Path(args.curated).read_text(encoding="utf-8"))
        report["inputs"]["curated_rows"] = len(curated)
        for i, r in enumerate(curated, start=1):
            question = clean_text(r.get("question", ""))
            rec = {
                "source": "curated", "source_row": i, "topic": r.get("skill", "").strip(), "subtopic": r.get("topic", "").strip(),
                "category_original": r.get("skill", ""), "difficulty": norm_difficulty(r.get("difficulty")),
                "question": question, "answer": None, "flags": [], "question_type": qtype(question, r.get("question_type")),
            }
            if not question:
                reject(rec, "empty question"); continue
            if len(question) < 15 or len(question.split()) < 4:
                reject(rec, "question too short"); continue
            if rec["difficulty"] is None:
                reject(rec, "unusable difficulty"); continue
            records.append(rec)
    else:
        report["inputs"]["curated_rows"] = 0

    # ── exact / normalised duplicate removal, merging what the copies know
    groups: dict[str, list[dict]] = defaultdict(list)
    for rec in records:
        groups[norm(rec["question"])].append(rec)

    unique: list[dict] = []
    dup_dropped = 0
    conflicts = 0
    for key, copies in groups.items():
        keep = dict(copies[0])
        keep["dup_count"] = len(copies)
        keep["sources"] = sorted({c["source"] for c in copies})
        if len(keep["sources"]) > 1:
            keep["source"] = "both"
        # answer: first non-empty
        keep["answer"] = next((c["answer"] for c in copies if c.get("answer")), None)
        labels = [c["difficulty"] for c in copies if c["difficulty"]]
        distinct = set(labels)
        if len(distinct) > 1:
            common = Counter(labels).most_common()
            # a clear majority wins; a tie means we do not know -> null (never guess)
            if common[0][1] > common[1][1]:
                keep["difficulty"] = common[0][0]
            else:
                keep["difficulty"] = None
            keep["flags"] = sorted(set(keep["flags"]) | {"difficulty_conflict"})
            conflicts += 1
        elif labels:
            # curated labels are the balanced, deliberate ones: prefer them if a copy came from there
            cur = [c["difficulty"] for c in copies if c["source"] == "curated" and c["difficulty"]]
            keep["difficulty"] = cur[0] if cur else labels[0]
        else:
            keep["difficulty"] = None
        if len(copies) > 1:
            keep["flags"] = sorted(set(keep["flags"]) | {"had_duplicates"})
            for c in copies[1:]:
                dup_dropped += 1
                reject({**c, "duplicate_of_row": copies[0]["source_row"]}, "duplicate question")
        if not keep["question"].rstrip().endswith("?") and TASK_START.match(keep["question"]):
            keep["flags"] = sorted(set(keep["flags"]) | {"imperative_task"})
        unique.append(keep)

    # ── near-duplicate clusters (kept, but recorded so a split never separates look-alikes)
    n = len(unique)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    by_len: dict[int, list[int]] = defaultdict(list)
    for i, u in enumerate(unique):
        by_len[len(norm(u["question"])) // 8].append(i)
    near_pairs = 0
    for i, u in enumerate(unique):
        bucket = len(norm(u["question"])) // 8
        for b in (bucket - 1, bucket, bucket + 1):
            for j in by_len.get(b, []):
                if j > i and similar(u["question"], unique[j]["question"]):
                    ra, rb = find(i), find(j)
                    if ra != rb:
                        parent[rb] = ra
                    near_pairs += 1
    for i, u in enumerate(unique):
        u["cluster"] = find(i)

    # stable ids, ordered by source then original row
    unique.sort(key=lambda u: (u["source"] != "kaggle", u["source"], u["source_row"]))
    counters: Counter = Counter()
    for u in unique:
        prefix = {"kaggle": "kg", "curated": "cu", "both": "kg"}[u["source"]]
        counters[prefix] += 1
        u["id"] = f"{prefix}-{counters[prefix]:04d}"
        u["flags"] = sorted(set(u["flags"]))
    clusters = Counter(u["cluster"] for u in unique)
    for u in unique:
        u["cluster"] = f"c{u['cluster']}"

    PROCESSED.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    write_jsonl(PROCESSED / "interview_cleaned.jsonl", unique)
    write_jsonl(PROCESSED / "interview_removed.jsonl", removed)

    # ── report
    def dist(key: str) -> dict:
        return dict(Counter(str(u.get(key)) for u in unique).most_common())

    report.update({
        "records_after_basic_validation": len(records),
        "removed_total": len(removed),
        "removed_by_reason": dict(Counter(r["removed_reason"] for r in removed)),
        "unique_questions_kept": len(unique),
        "with_answer": sum(1 for u in unique if u["answer"]),
        "duplicate_copies_merged": dup_dropped,
        "difficulty_conflicts_set_to_null": sum(1 for u in unique if "difficulty_conflict" in u["flags"] and u["difficulty"] is None),
        "difficulty_conflicts_resolved_by_majority": sum(1 for u in unique if "difficulty_conflict" in u["flags"] and u["difficulty"] is not None),
        "near_duplicate_clusters_with_2plus": sum(1 for c in clusters.values() if c > 1),
        "imperative_task_prompts": sum(1 for u in unique if "imperative_task" in u["flags"]),
        "by_source": dist("source"), "by_difficulty": dist("difficulty"), "by_topic": dist("topic"), "by_question_type": dist("question_type"),
    })
    lines = ["CLEANING REPORT", "=" * 60]
    for k, v in report.items():
        lines.append(f"{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v}")
    (REPORTS / "cleaning_report.txt").write_text("\n".join(lines), encoding="utf-8")
    (REPORTS / "cleaning_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n".join(lines))
    print(f"\nWrote {len(unique)} records -> {(PROCESSED / 'interview_cleaned.jsonl').relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
