"""
Downloads the three Kaggle resume datasets used to investigate a local
resume-screening/analysis training pipeline (see TRAINING_RESUME_MODEL.md,
once written). Uses kagglehub.dataset_download() exclusively - the returned
path is never hardcoded, since kagglehub's local cache location is
machine-specific (typically ~/.cache/kagglehub, but this script never assumes
that). Datasets are read-only once downloaded: nothing in this script or any
other script in resume_training/ ever writes into the kagglehub cache.

Requires Kaggle API credentials (a kaggle.json under ~/.kaggle/, or
KAGGLE_USERNAME + KAGGLE_KEY environment variables) - kagglehub raises if
these are absent, which this script reports clearly rather than papering over.
"""

import json
import os
import sys

DATASETS = [
    "rhythmghai/resume-screening-dataset-200k-candidates",
    "sonalshinde123/ai-driven-resume-screening-dataset",
    "snehaanbhawal/resume-dataset",
]

REPORT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "reports", "download_manifest.json")


def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def count_records(file_path: str) -> "int | None":
    """Cheap record count where determinable without a full schema-aware parse."""
    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == ".csv":
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return sum(1 for _ in f) - 1  # minus header
        if ext == ".json":
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                data = json.load(f)
            if isinstance(data, list):
                return len(data)
            return None
        if ext == ".jsonl":
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return sum(1 for _ in f)
    except Exception as e:  # noqa: BLE001
        print(f"    (record count failed: {e})")
        return None
    return None


def describe_dataset(slug: str) -> dict:
    import kagglehub

    print(f"\n{'=' * 70}\nDataset: {slug}\n{'=' * 70}")
    try:
        path = kagglehub.dataset_download(slug)
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        print(f"DOWNLOAD FAILED: {msg}")
        if "credentials" in msg.lower() or "401" in msg or "403" in msg or "authenticate" in msg.lower():
            print(
                "  -> This looks like a missing/invalid Kaggle API credential.\n"
                "     Set one of:\n"
                "       1) ~/.kaggle/kaggle.json  (download from https://www.kaggle.com/settings -> 'Create New Token')\n"
                "       2) KAGGLE_USERNAME and KAGGLE_KEY environment variables\n"
                "     This script cannot and will not fabricate credentials - please set one of the above and re-run."
            )
        return {"slug": slug, "status": "failed", "error": msg}

    print(f"Downloaded to: {path}")
    files_info = []
    for root, _dirs, files in os.walk(path):
        for fname in files:
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, path)
            size = os.path.getsize(fpath)
            records = count_records(fpath)
            files_info.append(
                {
                    "relative_path": rel,
                    "extension": os.path.splitext(fname)[1].lower() or "(none)",
                    "size_bytes": size,
                    "size_human": human_size(size),
                    "record_count": records,
                }
            )
            rec_str = f", ~{records} records" if records is not None else ""
            print(f"  - {rel}  [{os.path.splitext(fname)[1].lower() or '(none)'}, {human_size(size)}{rec_str}]")

    return {"slug": slug, "status": "ok", "path": path, "files": files_info}


def main():
    results = []
    for slug in DATASETS:
        results.append(describe_dataset(slug))

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nManifest written to {REPORT_PATH}")

    failures = [r for r in results if r["status"] != "ok"]
    if failures:
        print(f"\n{len(failures)}/{len(results)} dataset(s) failed to download - see messages above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
