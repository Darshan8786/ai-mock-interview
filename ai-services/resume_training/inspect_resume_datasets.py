"""
Inspects the real contents of the three downloaded Kaggle datasets - no
column names or schemas are assumed; everything below was written after
actually loading each file (see the investigation that produced this
script). Reads only from the kagglehub cache (read-only); writes reports to
resume_training/data/reports/. Never modifies the source files.
"""

import json
import os
import re
import statistics
from collections import Counter

import kagglehub
import pandas as pd

REPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "reports")
PROCESSED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "processed")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")
URL_RE = re.compile(r"https?://[^\s]+|www\.[^\s]+")


def normalize_text(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip().lower())


def find_near_duplicates(texts: list, sample_cap: int = None) -> dict:
    """Exact-normalized-text duplicates (cheap, exact) plus a shingled-hash
    near-duplicate pass (5-gram word shingles -> a single minhash-lite
    signature via the min of a small set of hash functions is overkill at
    this scale; instead: bucket by a coarse fingerprint - first+last 40 chars
    of normalized text + rounded length - then confirm true near-duplicates
    within a bucket via a simple word-overlap (Jaccard) check >= 0.9. This is
    a documented, inspectable heuristic, not a claim of exhaustive dedup."""
    norm = [normalize_text(t) for t in texts]
    exact_counter = Counter(norm)
    exact_dupe_groups = sum(1 for c in exact_counter.values() if c > 1)
    exact_dupe_records = sum(c for c in exact_counter.values() if c > 1)

    buckets: dict = {}
    for i, t in enumerate(norm):
        if len(t) < 20:
            continue
        fp = (t[:40], t[-40:], round(len(t) / 50))
        buckets.setdefault(fp, []).append(i)

    near_dupe_pairs = 0
    checked = 0
    for idxs in buckets.values():
        if len(idxs) < 2:
            continue
        for a in range(len(idxs)):
            for b in range(a + 1, len(idxs)):
                checked += 1
                if sample_cap and checked > sample_cap:
                    continue
                wa, wb = set(norm[idxs[a]].split()), set(norm[idxs[b]].split())
                if not wa or not wb:
                    continue
                jaccard = len(wa & wb) / len(wa | wb)
                if jaccard >= 0.9:
                    near_dupe_pairs += 1

    return {
        "exact_duplicate_groups": exact_dupe_groups,
        "exact_duplicate_records": exact_dupe_records,
        "near_duplicate_pairs_found": near_dupe_pairs,
        "near_duplicate_method": "bucketed by (first 40 chars, last 40 chars, length/50) of normalized text, "
        "confirmed by word-set Jaccard >= 0.9 within a bucket",
    }


def pii_stats(texts: list) -> dict:
    n_email = sum(1 for t in texts if EMAIL_RE.search(t or ""))
    n_phone = sum(1 for t in texts if PHONE_RE.search(t or ""))
    n_url = sum(1 for t in texts if URL_RE.search(t or ""))
    return {
        "records_with_email": n_email,
        "records_with_phone_like_pattern": n_phone,
        "records_with_url": n_url,
        "note": "Name/address detection is not attempted here (no reliable regex) - "
        "flagged qualitatively per dataset instead.",
    }


def length_stats(texts: list) -> dict:
    lens = [len((t or "").split()) for t in texts]
    lens_sorted = sorted(lens)
    return {
        "min_words": min(lens) if lens else 0,
        "max_words": max(lens) if lens else 0,
        "mean_words": round(statistics.mean(lens), 1) if lens else 0,
        "median_words": statistics.median(lens) if lens else 0,
        "p5_words": lens_sorted[int(0.05 * len(lens_sorted))] if lens_sorted else 0,
        "p95_words": lens_sorted[int(0.95 * len(lens_sorted))] if lens_sorted else 0,
        "empty_or_near_empty_lt10_words": sum(1 for l in lens if l < 10),
        "extremely_short_lt30_words": sum(1 for l in lens if 10 <= l < 30),
        "extremely_long_gt1500_words": sum(1 for l in lens if l > 1500),
    }


def inspect_dataset_1() -> dict:
    """rhythmghai/resume-screening-dataset-200k-candidates"""
    path = kagglehub.dataset_download("rhythmghai/resume-screening-dataset-200k-candidates")
    fpath = os.path.join(path, "resume_dataset_200k_enhanced.csv")
    df = pd.read_csv(fpath)

    missing = {c: int(df[c].isna().sum()) for c in df.columns}
    dupe_rows = int(df.duplicated().sum())

    result = {
        "slug": "rhythmghai/resume-screening-dataset-200k-candidates",
        "file": "resume_dataset_200k_enhanced.csv",
        "format": "csv",
        "record_count": len(df),
        "columns": list(df.columns),
        "column_dtypes": {c: str(df[c].dtype) for c in df.columns},
        "missing_values_per_column": missing,
        "fully_duplicate_rows": dupe_rows,
        "example_records": df.sample(min(3, len(df)), random_state=42).to_dict(orient="records"),
        "has_resume_text_field": False,
        "has_job_description_field": False,
        "has_skill_name_list": False,
        "label_columns_found": ["hired"] if "hired" in df.columns else [],
        "critical_finding": (
            "This dataset contains NO resume text, NO skill names, and NO job description. Every field is a "
            "pre-computed numeric or categorical summary (e.g. 'programming_languages' is a COUNT like 2, not a "
            "list of language names; 'resume_length_words' is a number, not the resume). It is a synthetic, "
            "purely tabular hire/no-hire prediction dataset ('hired': 0/1), not a resume-text dataset at all."
        ),
    }
    return result


def inspect_dataset_2() -> dict:
    """sonalshinde123/ai-driven-resume-screening-dataset"""
    path = kagglehub.dataset_download("sonalshinde123/ai-driven-resume-screening-dataset")
    fpath = os.path.join(path, "ai_resume_screening.csv")
    df = pd.read_csv(fpath)

    missing = {c: int(df[c].isna().sum()) for c in df.columns}
    dupe_rows = int(df.duplicated().sum())

    result = {
        "slug": "sonalshinde123/ai-driven-resume-screening-dataset",
        "file": "ai_resume_screening.csv",
        "format": "csv",
        "record_count": len(df),
        "columns": list(df.columns),
        "column_dtypes": {c: str(df[c].dtype) for c in df.columns},
        "missing_values_per_column": missing,
        "fully_duplicate_rows": dupe_rows,
        "example_records": df.sample(min(3, len(df)), random_state=42).to_dict(orient="records"),
        "has_resume_text_field": False,
        "has_job_description_field": False,
        "has_skill_name_list": False,
        "label_columns_found": ["shortlisted"] if "shortlisted" in df.columns else [],
        "critical_finding": (
            "Same problem as dataset 1: NO resume text, NO skill names, NO job description. "
            "'skills_match_score' and 'resume_length' are bare numbers with no underlying text or skill list. "
            "This is a synthetic tabular shortlist/no-shortlist dataset ('shortlisted': Yes/No), not resume text."
        ),
    }
    return result


def inspect_dataset_3() -> dict:
    """snehaanbhawal/resume-dataset - real resume text + category labels + matching PDFs"""
    path = kagglehub.dataset_download("snehaanbhawal/resume-dataset")
    fpath = os.path.join(path, "Resume", "Resume.csv")
    df = pd.read_csv(fpath)

    missing = {c: int(df[c].isna().sum()) for c in df.columns}
    dupe_rows_all_cols = int(df.duplicated().sum())
    dupe_resume_str = int(df.duplicated(subset=["Resume_str"]).sum()) if "Resume_str" in df.columns else None

    texts = df["Resume_str"].fillna("").tolist() if "Resume_str" in df.columns else []
    lens = length_stats(texts)
    dupes = find_near_duplicates(texts)
    pii = pii_stats(texts)

    category_counts = df["Category"].value_counts().to_dict() if "Category" in df.columns else {}

    # Count PDFs actually present on disk under data/data/<CATEGORY>/*.pdf
    pdf_root = os.path.join(path, "data", "data")
    pdf_counts_by_category = {}
    if os.path.isdir(pdf_root):
        for cat in os.listdir(pdf_root):
            cat_dir = os.path.join(pdf_root, cat)
            if os.path.isdir(cat_dir):
                pdf_counts_by_category[cat] = len([f for f in os.listdir(cat_dir) if f.lower().endswith(".pdf")])

    example_records = []
    for _, row in df.sample(min(3, len(df)), random_state=42).iterrows():
        example_records.append(
            {
                "ID": row.get("ID"),
                "Category": row.get("Category"),
                "Resume_str_preview": (str(row.get("Resume_str", ""))[:250] + "...") if row.get("Resume_str") else "",
            }
        )

    result = {
        "slug": "snehaanbhawal/resume-dataset",
        "file": "Resume/Resume.csv (+ 2484 matching PDFs under data/data/<CATEGORY>/)",
        "format": "csv + pdf",
        "record_count": len(df),
        "pdf_file_count_on_disk": sum(pdf_counts_by_category.values()),
        "columns": list(df.columns),
        "column_dtypes": {c: str(df[c].dtype) for c in df.columns},
        "missing_values_per_column": missing,
        "fully_duplicate_rows_all_columns": dupe_rows_all_cols,
        "duplicate_resume_str_rows": dupe_resume_str,
        "resume_text_length_stats_words": lens,
        "duplicate_analysis": dupes,
        "pii_stats": pii,
        "category_distribution": category_counts,
        "category_count_from_pdfs_on_disk": pdf_counts_by_category,
        "example_records": example_records,
        "has_resume_text_field": True,
        "resume_text_column": "Resume_str",
        "has_job_description_field": False,
        "has_skill_name_list": False,
        "label_columns_found": ["Category"],
        "critical_finding": (
            "The only one of the three datasets with real resume text. 'Category' (24 job-role categories, e.g. "
            "INFORMATION-TECHNOLOGY, HR, TEACHER, FINANCE) is a genuine ground-truth label suitable for a resume "
            "CLASSIFICATION task. It has NO explicit skills list, NO job description field, and NO ATS/quality "
            "score - skill lists would have to be derived by running the existing local skill-extraction taxonomy "
            "(placement-prep-be/src/data/resumeSkillsTaxonomy.ts) over Resume_str as weak/silver labels, not read "
            "as gold labels from this dataset. Resume_html is a formatted duplicate of Resume_str (same content, "
            "HTML markup) - not independently useful and not counted as a separate field for training."
        ),
    }
    return result


def main():
    os.makedirs(REPORT_DIR, exist_ok=True)
    print("Inspecting dataset 1 (rhythmghai)...")
    d1 = inspect_dataset_1()
    print("Inspecting dataset 2 (sonalshinde123)...")
    d2 = inspect_dataset_2()
    print("Inspecting dataset 3 (snehaanbhawal)...")
    d3 = inspect_dataset_3()

    report = {"datasets": [d1, d2, d3]}
    out_path = os.path.join(REPORT_DIR, "resume_dataset_report.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    print(f"\n{'=' * 70}\nSUMMARY (full detail in {out_path})\n{'=' * 70}")
    for d in report["datasets"]:
        print(f"\n--- {d['slug']} ---")
        print(f"  records: {d['record_count']}, columns: {d['columns']}")
        print(f"  has resume text: {d['has_resume_text_field']}, has JD: {d['has_job_description_field']}, has skill list: {d['has_skill_name_list']}")
        print(f"  labels found: {d['label_columns_found']}")
        print(f"  FINDING: {d['critical_finding']}")


if __name__ == "__main__":
    main()
