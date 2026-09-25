"""
PII anonymization for snehaanbhawal/resume-dataset's Resume_str column, on a
COPY only - the kagglehub-cached original is opened read-only and never
written to.

Reliable regex-based replacement:
    email -> <EMAIL>, phone-like pattern -> <PHONE>, URL -> <URL>

Candidate-name replacement is BEST-EFFORT ONLY: resume headers in this
dataset are dense, unspaced blocks (e.g. "Kpandipou    Koffi         Summary")
with no punctuation to anchor a name span, and no NER model is installed
(deliberately not adding spaCy/transformers-NER just for this). The heuristic
here looks at the first ~8 tokens for a run of 2-4 Title-Case alphabetic words
before the first known resume-section keyword (SUMMARY, EXPERIENCE, ...) and
masks that run as <NAME>. This will miss names that don't fit that shape and
will occasionally mask a non-name capitalized phrase. It is not exhaustive -
treat it as a partial mitigation, not a guarantee, exactly like the caveat
already recorded in data/reports/resume_dataset_report.json.
"""

import os
import re

import kagglehub
import pandas as pd

PROCESSED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "processed")

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b")
URL_RE = re.compile(r"https?://[^\s]+|www\.[^\s]+")

# First resume-section keyword found ends the "header/name zone" we scan for a name in.
SECTION_KEYWORDS = (
    "SUMMARY", "PROFILE", "OBJECTIVE", "EXPERIENCE", "EDUCATION",
    "SKILLS", "HIGHLIGHTS", "QUALIFICATIONS", "CAREER",
)
NAME_RUN_RE = re.compile(r"\b([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){1,3})\b")


def mask_name_best_effort(text: str) -> str:
    head = text[:200]
    cut = len(head)
    for kw in SECTION_KEYWORDS:
        idx = head.upper().find(kw)
        if idx != -1:
            cut = min(cut, idx)
    header_zone = head[:cut]
    m = NAME_RUN_RE.search(header_zone)
    if not m:
        return text
    return text[: m.start()] + "<NAME>" + text[m.end():]


def anonymize_text(text: str) -> str:
    if not text:
        return text
    t = EMAIL_RE.sub("<EMAIL>", text)
    t = URL_RE.sub("<URL>", t)
    t = PHONE_RE.sub("<PHONE>", t)
    t = mask_name_best_effort(t)
    return t


def main():
    os.makedirs(PROCESSED_DIR, exist_ok=True)

    src_root = kagglehub.dataset_download("snehaanbhawal/resume-dataset")
    src_path = os.path.join(src_root, "Resume", "Resume.csv")
    print(f"Reading original (read-only) from: {src_path}")
    df = pd.read_csv(src_path)
    original_mtime = os.path.getmtime(src_path)

    df["Resume_str_anonymized"] = df["Resume_str"].fillna("").map(anonymize_text)

    n_email = df["Resume_str"].fillna("").str.contains(EMAIL_RE).sum()
    n_url = df["Resume_str"].fillna("").str.contains(URL_RE).sum()
    n_phone = df["Resume_str"].fillna("").str.contains(PHONE_RE).sum()
    n_name_masked = df["Resume_str_anonymized"].str.contains("<NAME>").sum()

    out_path = os.path.join(PROCESSED_DIR, "resume_anonymized.csv")
    out_df = df[["ID", "Category", "Resume_str_anonymized"]].rename(
        columns={"Resume_str_anonymized": "Resume_str"}
    )
    out_df.to_csv(out_path, index=False)

    # Prove the original was not touched.
    new_mtime = os.path.getmtime(src_path)
    assert new_mtime == original_mtime, "Original kagglehub-cached file was modified!"

    print(f"Anonymized {len(df)} records -> {out_path}")
    print(f"  emails masked:  {n_email}")
    print(f"  urls masked:    {n_url}")
    print(f"  phones masked:  {n_phone}")
    print(f"  names masked (best-effort heuristic, not exhaustive): {n_name_masked} / {len(df)}")
    print(f"  original file mtime unchanged: {original_mtime} == {new_mtime}")


if __name__ == "__main__":
    main()
