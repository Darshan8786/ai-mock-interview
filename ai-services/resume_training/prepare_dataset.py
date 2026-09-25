"""
Dedup + stratified 80/10/10 split of the anonymized resume dataset.

Policy:
  - Exact-duplicate Resume_str: keep only the first occurrence.
  - Near-duplicate clusters (same heuristic as the original inspection: bucket
    by (first 40 chars, last 40 chars, length/50) of normalized text, confirm
    with word-Jaccard >= 0.9) are never split across train/val/test - every
    member of a near-duplicate cluster is forced into TRAIN. This guarantees
    zero leakage into the held-out val/test sets, at the cost of a handful of
    records not being eligible for evaluation.
  - Everything else is split 80/10/10, stratified by Category so every class
    appears in all three splits (classes range 22-118 records; even the
    smallest, BPO at ~21 after dedup, yields >=2 per split).

IMPORTANT: near-duplicate detection is run on the ORIGINAL (kagglehub, read-
only) Resume_str, not the anonymized copy. Anonymization masks names/emails
of differing lengths in the header, which shifts the (first-40-chars) bucket
fingerprint enough to hide genuine near-duplicate pairs - confirmed directly:
detecting on anonymized text found 0 clusters, detecting on the original
found 1 (IDs 87520378 / 58879993), consistent with the original investigation
report's "3 near-duplicate pairs" (2 of those 3 were the exact-duplicate pairs,
which trivially have Jaccard=1.0; this is the 1 genuinely distinct pair left
after exact-dedup). Cluster membership is computed by ID on the original text,
then applied to the anonymized rows we actually split.
"""

import os
import re
from collections import Counter, defaultdict

import kagglehub
import pandas as pd
from sklearn.model_selection import train_test_split

PROCESSED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "processed")
SRC_PATH = os.path.join(PROCESSED_DIR, "resume_anonymized.csv")


def normalize_text(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip().lower())


def find_near_duplicate_clusters(texts: list[str]) -> list[set[int]]:
    norm = [normalize_text(t) for t in texts]
    buckets: dict = defaultdict(list)
    for i, t in enumerate(norm):
        if len(t) < 20:
            continue
        fp = (t[:40], t[-40:], round(len(t) / 50))
        buckets[fp].append(i)

    parent = list(range(len(texts)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for idxs in buckets.values():
        if len(idxs) < 2:
            continue
        for a in range(len(idxs)):
            wa = set(norm[idxs[a]].split())
            if not wa:
                continue
            for b in range(a + 1, len(idxs)):
                wb = set(norm[idxs[b]].split())
                if not wb:
                    continue
                jaccard = len(wa & wb) / len(wa | wb)
                if jaccard >= 0.9:
                    union(idxs[a], idxs[b])

    clusters: dict = defaultdict(set)
    for i in range(len(texts)):
        clusters[find(i)].add(i)
    return [c for c in clusters.values() if len(c) > 1]


def main():
    df = pd.read_csv(SRC_PATH)
    n_before = len(df)

    norm_text = df["Resume_str"].fillna("").map(normalize_text)
    df = df.loc[~norm_text.duplicated(keep="first")].reset_index(drop=True)
    n_after_exact_dedup = len(df)
    print(f"Exact-duplicate rows removed: {n_before - n_after_exact_dedup} ({n_before} -> {n_after_exact_dedup})")

    # Detect near-duplicates on the ORIGINAL text (see module docstring), then
    # map cluster membership onto the anonymized rows by ID.
    orig_root = kagglehub.dataset_download("snehaanbhawal/resume-dataset")
    orig_df = pd.read_csv(os.path.join(orig_root, "Resume", "Resume.csv"))
    orig_norm = orig_df["Resume_str"].fillna("").map(normalize_text)
    orig_deduped = orig_df.loc[~orig_norm.duplicated(keep="first")].reset_index(drop=True)
    clusters = find_near_duplicate_clusters(orig_deduped["Resume_str"].fillna("").tolist())
    forced_train_ids = set()
    for c in clusters:
        forced_train_ids |= {int(orig_deduped.iloc[i]["ID"]) for i in c}
    print(f"Near-duplicate clusters found (on original text): {len(clusters)}, "
          f"records forced into TRAIN: {len(forced_train_ids)} (IDs: {sorted(forced_train_ids)})")

    df["_forced_train"] = df["ID"].isin(forced_train_ids)

    forced = df[df["_forced_train"]].drop(columns=["_forced_train"])
    free = df[~df["_forced_train"]].drop(columns=["_forced_train"])

    # Stratified 80/10/10 on the free (non-forced) records only.
    class_counts = Counter(free["Category"])
    too_small = [c for c, n in class_counts.items() if n < 10]
    if too_small:
        print(f"NOTE: classes with <10 free records (val/test may get very few): {too_small}")

    train_free, temp = train_test_split(
        free, test_size=0.2, stratify=free["Category"], random_state=42
    )
    val_free, test_free = train_test_split(
        temp, test_size=0.5, stratify=temp["Category"], random_state=42
    )

    train_df = pd.concat([forced, train_free], ignore_index=True)
    val_df = val_free.reset_index(drop=True)
    test_df = test_free.reset_index(drop=True)

    for name, split_df in (("train", train_df), ("val", val_df), ("test", test_df)):
        split_df.to_csv(os.path.join(PROCESSED_DIR, f"{name}.csv"), index=False)

    print(f"\nFinal split sizes: train={len(train_df)} ({len(forced)} forced + {len(train_free)} sampled), "
          f"val={len(val_df)}, test={len(test_df)}")
    print(f"Classes in train: {train_df['Category'].nunique()}, val: {val_df['Category'].nunique()}, "
          f"test: {test_df['Category'].nunique()} (of {df['Category'].nunique()} total)")

    missing_from_val = set(df["Category"].unique()) - set(val_df["Category"].unique())
    missing_from_test = set(df["Category"].unique()) - set(test_df["Category"].unique())
    if missing_from_val:
        print(f"  WARNING: categories absent from val: {missing_from_val}")
    if missing_from_test:
        print(f"  WARNING: categories absent from test: {missing_from_test}")


if __name__ == "__main__":
    main()
