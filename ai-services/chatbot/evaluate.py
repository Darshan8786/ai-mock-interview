"""
Shared data loading and evaluation for the neural study chatbot.

Mirrors the decision logic of the TypeScript engine (placement-prep-be/src/
services/chatbot/matcher.ts): the query is compared to every training phrasing,
each target keeps its best similarity, and the top target is answered, offered
as a suggestion, or declined (the trained out-of-scope class, or too low a score).

Held-out test sets are only ever used by `evaluate_sets`; thresholds are tuned
on the validation set only.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Callable

import numpy as np

DATA_DIR = Path(__file__).parent / "data"
OOS = "__out_of_scope__"
SUGGEST_MARGIN = 0.12  # suggest when score is within this much below the answer threshold

Encoder = Callable[[list[str]], np.ndarray]  # texts -> L2-normalised embeddings


def load(name: str):
    return json.loads((DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))


class Index:
    """Nearest-phrasing index: best cosine per target for any query."""

    def __init__(self, train: list[dict], encode: Encoder):
        self.targets = np.array([t["target"] for t in train])
        self.vecs = encode([t["text"] for t in train])
        self.unique = sorted(set(self.targets.tolist()))
        self.groups = {u: np.where(self.targets == u)[0] for u in self.unique}
        self.encode = encode

    def rank_vecs(self, qvecs: np.ndarray) -> list[list[tuple[str, float]]]:
        sims = qvecs @ self.vecs.T  # (queries, train)
        out = []
        for row in sims:
            best = {u: float(row[idx].max()) for u, idx in self.groups.items()}
            out.append(sorted(best.items(), key=lambda kv: -kv[1]))
        return out

    def rank(self, texts: list[str]) -> list[list[tuple[str, float]]]:
        return self.rank_vecs(self.encode(texts))


def decide(ranked: list[tuple[str, float]], threshold: float):
    top_t, top_s = ranked[0]
    if top_t == OOS:
        return "decline", None
    if top_s >= threshold:
        return "answer", top_t
    if top_s >= threshold - SUGGEST_MARGIN:
        cands = [t for t, s in ranked if t != OOS and s >= threshold - SUGGEST_MARGIN][:3]
        return "suggest", cands
    return "decline", None


def tune_threshold(index: Index, validation: list[dict]) -> tuple[float, float]:
    """Pick the answer threshold maximising mean(in-scope correct, off-topic declined)."""
    ranked = index.rank([c["q"] for c in validation])
    best_t, best_bal, ties = 0.3, -1.0, []
    for t in np.arange(0.20, 0.96, 0.01):
        acc = rej = n_in = n_off = 0
        for c, r in zip(validation, ranked):
            kind, val = decide(r, float(t))
            if c["expect"] is None:
                n_off += 1
                rej += kind != "answer"
            else:
                n_in += 1
                acc += kind == "answer" and val == c["expect"]
        bal = (acc / n_in + rej / n_off) / 2
        if bal > best_bal + 1e-9:
            best_bal, ties = bal, [t]
        elif abs(bal - best_bal) <= 1e-9:
            ties.append(t)
    best_t = float(ties[len(ties) // 2])
    return round(best_t, 2), best_bal


def evaluate_sets(index: Index, threshold: float, sets: dict[str, list[dict]], verbose=False) -> dict:
    results = {}
    for name, cases in sets.items():
        ranked = index.rank([c["q"] for c in cases])
        n_in = top1 = helpful = n_off = declined = 0
        misses = []
        for c, r in zip(cases, ranked):
            kind, val = decide(r, threshold)
            if c["expect"] is None:
                n_off += 1
                declined += kind != "answer"
                if kind == "answer":
                    misses.append(f'[off-topic answered] "{c["q"]}" -> {val} ({r[0][1]:.2f})')
                continue
            n_in += 1
            ok = kind == "answer" and val == c["expect"]
            top1 += ok
            helpful += ok or (kind == "suggest" and c["expect"] in val)
            if not ok:
                misses.append(f'"{c["q"]}" expected {c["expect"]}, got {r[0][0]} ({r[0][1]:.2f}) [{kind}]')
        results[name] = {
            "top1": top1 / n_in,
            "helpful": helpful / n_in,
            "declined": declined / n_off if n_off else 1.0,
            "n_in": n_in,
            "n_off": n_off,
            "misses": misses,
        }
    return results


def print_results(title: str, threshold: float, results: dict, show_misses=False):
    print(f"\n=== {title} (threshold {threshold}) ===")
    for name, r in results.items():
        print(
            f"  {name:<6} exact {r['top1']*100:5.1f}% | answer-or-suggestion {r['helpful']*100:5.1f}% "
            f"| off-topic declined {r['declined']*100:5.1f}%   (n={r['n_in']}+{r['n_off']})"
        )
        if show_misses:
            for m in r["misses"]:
                print("      x", m)
