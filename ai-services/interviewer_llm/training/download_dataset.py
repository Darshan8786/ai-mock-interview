"""
Step 1 - Download the Kaggle dataset used to fine-tune the local interviewer model.

    python training/download_dataset.py

Downloads  syedmharis/software-engineering-interview-questions-dataset  with
kagglehub, prints where it landed and lists every file.

* The path is whatever kagglehub reports - nothing is hardcoded.
* The original files are only READ by later steps; nothing here (or in any later
  script) modifies or deletes them. Cleaned/derived data goes to data/processed/.
* Nothing is uploaded anywhere. Public datasets need no Kaggle credentials; if
  your kagglehub version asks for them, run `kagglehub login` once.

The resolved path is also written to data/dataset_path.txt so the other scripts
(inspect / clean) find the same copy without re-downloading.
"""
from __future__ import annotations

import sys
from pathlib import Path

DATASET = "syedmharis/software-engineering-interview-questions-dataset"
ROOT = Path(__file__).resolve().parent.parent
PATH_FILE = ROOT / "data" / "dataset_path.txt"


def human(n: int) -> str:
    size = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:,.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{n} B"


def main() -> int:
    try:
        import kagglehub
    except ImportError:
        print("kagglehub is not installed. Run:  pip install kagglehub", file=sys.stderr)
        return 1

    print(f"Downloading {DATASET} ...")
    try:
        path = kagglehub.dataset_download(DATASET)
    except Exception as exc:  # noqa: BLE001 - surface the real reason to the user
        print(f"\nDownload failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        print("If this mentions authentication, run `kagglehub login` (or set KAGGLE_USERNAME / KAGGLE_KEY).", file=sys.stderr)
        return 1

    root = Path(path)
    print(f"\nPath to dataset files: {root}\n")

    files = sorted(p for p in root.rglob("*") if p.is_file())
    if not files:
        print("The dataset folder is empty.", file=sys.stderr)
        return 1

    total = 0
    print(f"{'size':>12}  file")
    print("-" * 60)
    for f in files:
        size = f.stat().st_size
        total += size
        print(f"{human(size):>12}  {f.relative_to(root)}")
    print("-" * 60)
    print(f"{human(total):>12}  total in {len(files)} file(s)")

    PATH_FILE.parent.mkdir(parents=True, exist_ok=True)
    PATH_FILE.write_text(str(root), encoding="utf-8")
    print(f"\nSaved the location to {PATH_FILE.relative_to(ROOT.parent)} for the next steps.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
