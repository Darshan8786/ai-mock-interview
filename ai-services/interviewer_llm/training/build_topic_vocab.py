"""
Build the per-topic vocabulary the question validator uses to reject off-topic generations.

    python training/build_topic_vocab.py

Input : data/processed/train.jsonl   (TRAIN split only - never validation/test, so evaluating topic
                                       consistency on the test set stays honest)
Output: data/topic_vocab.json        {topic: [keyword, ...]}

A keyword is a non-stopword that appears in the questions of that topic in at least two different
training questions (or is part of the topic / subtopic name). It is a plain data file, so the serving
code needs neither the dataset nor any ML library to use it.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict

from common import ROOT, PROCESSED, read_jsonl

STOP = set("""a an the of to in on for with and or is are was were be been being do does did what why how when where which
who whom whose can could should would will shall may might must this that these those it its as at by from into than then
there their them they you your yours we our us i me my not no yes if else so such between about over under out up down
each any all some more most other another one two use used using write explain describe difference differences
""".split())


def stem(word: str) -> str:
    for suffix in ("ing", "ed", "es", "s"):
        if len(word) > len(suffix) + 2 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def keywords(text: str) -> set[str]:
    return {stem(w) for w in re.findall(r"[a-z][a-z0-9+#.\-]*", text.lower()) if len(w) > 2 and w not in STOP}


def main() -> None:
    rows = [r for r in read_jsonl(PROCESSED / "train.jsonl") if r["task"] == "qgen"]
    seen_ids: set[tuple[str, str]] = set()
    df: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        key = (r["topic"], r["id"])                    # each training question counted once (it has 2 prompt variants)
        if key in seen_ids:
            continue
        seen_ids.add(key)
        for w in keywords(r["output"]):
            df[r["topic"]][w] += 1
        for w in keywords(r["topic"]):
            df[r["topic"]][w] += 2                     # the topic's own name always counts
    vocab = {t: sorted(w for w, n in c.items() if n >= 2) for t, c in sorted(df.items())}
    out = ROOT / "data" / "topic_vocab.json"
    out.write_text(json.dumps(vocab, indent=1), encoding="utf-8")
    print(f"topic vocabulary for {len(vocab)} topics -> {out.relative_to(ROOT.parent)}")
    for t, w in vocab.items():
        print(f"  {t:<24} {len(w):>4} keywords")


if __name__ == "__main__":
    main()
