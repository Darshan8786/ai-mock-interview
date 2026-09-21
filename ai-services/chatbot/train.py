"""
Fine-tune a sentence encoder for the MindPrep study chatbot.

    python -m chatbot.train                       # defaults
    python -m chatbot.train --steps 600 --lr 3e-5

Objective: supervised contrastive learning. Phrasings of the same topic are
pulled together in embedding space and phrasings of different topics pushed
apart, so an unseen paraphrase lands nearest the right topic.

* Batches mix several "families" of related topics (apt-*, os-*, dsa-*, hr-*, ...)
  so most negatives are HARD (same subject area, different topic).
* Out-of-scope chit-chat is included with every example its own class: it is
  pushed away from all topics but never pulled towards other chit-chat.
* Text augmentation (character typos, word dropout) makes it robust to messy input.
* The checkpoint is chosen on the VALIDATION set. Test sets are only scored once
  at the end and never influence any decision.

No API key or network is needed at training time beyond the first download of
the base model from the Hugging Face hub.
"""
from __future__ import annotations

import argparse
import copy
import json
import random
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sentence_transformers import SentenceTransformer

from chatbot.evaluate import OOS, Index, evaluate_sets, load, print_results, tune_threshold

OUT_DIR = Path(__file__).parent / "model"


def family(target: str) -> str:
    if target == OOS:
        return OOS
    for sep in ("-", "_"):
        if sep in target:
            return target.split(sep)[0]
    return target


def augment(text: str, rng: random.Random) -> str:
    """Cheap, label-preserving noise: word dropout and character typos."""
    words = text.split()
    if len(words) > 3 and rng.random() < 0.25:
        words.pop(rng.randrange(len(words)))
    out = []
    for w in words:
        if len(w) > 4 and rng.random() < 0.08:
            i = rng.randrange(1, len(w) - 1)
            op = rng.choice(("swap", "drop", "dup"))
            if op == "swap":
                w = w[:i] + w[i + 1] + w[i] + w[i + 2:]
            elif op == "drop":
                w = w[:i] + w[i + 1:]
            else:
                w = w[:i] + w[i] + w[i:]
        out.append(w)
    return " ".join(out)


class BatchSampler:
    """Draws batches of K samples for each of several topics from a few families."""

    def __init__(self, train: list[dict], rng: random.Random, families=3, topics_per_family=6, per_topic=3, n_oos=16):
        self.rng = rng
        self.by_target = defaultdict(list)
        for t in train:
            self.by_target[t["target"]].append(t["text"])
        self.oos = self.by_target.pop(OOS, [])
        self.fam = defaultdict(list)
        for target in self.by_target:
            self.fam[family(target)].append(target)
        self.fam_names = [f for f, ts in self.fam.items() if len(ts) >= 2]
        self.families, self.tpf, self.per, self.n_oos = families, topics_per_family, per_topic, n_oos

    def sample(self):
        texts, labels = [], []
        for f in self.rng.sample(self.fam_names, min(self.families, len(self.fam_names))):
            for target in self.rng.sample(self.fam[f], min(self.tpf, len(self.fam[f]))):
                pool = self.by_target[target]
                picks = self.rng.sample(pool, self.per) if len(pool) >= self.per else self.rng.choices(pool, k=self.per)
                for p in picks:
                    texts.append(augment(p, self.rng))
                    labels.append(target)
        for i, o in enumerate(self.rng.sample(self.oos, min(self.n_oos, len(self.oos)))):
            texts.append(augment(o, self.rng))
            labels.append(f"{OOS}#{i}")  # each chit-chat message is its own class
        return texts, labels


def supcon_loss(emb: torch.Tensor, labels: list[str], temperature: float) -> torch.Tensor:
    lab = {l: i for i, l in enumerate(sorted(set(labels)))}
    y = torch.tensor([lab[l] for l in labels])
    sim = emb @ emb.T / temperature
    n = emb.size(0)
    eye = torch.eye(n, dtype=torch.bool)
    sim = sim.masked_fill(eye, -1e9)
    pos = (y[:, None] == y[None, :]) & ~eye
    log_prob = sim - torch.logsumexp(sim, dim=1, keepdim=True)
    has_pos = pos.sum(1) > 0
    loss = -(log_prob * pos).sum(1)[has_pos] / pos.sum(1)[has_pos]
    return loss.mean()


def make_encoder(model: SentenceTransformer):
    def encode(texts):
        model.eval()
        with torch.no_grad():
            return model.encode(texts, normalize_embeddings=True, convert_to_numpy=True, batch_size=64, show_progress_bar=False)
    return encode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="sentence-transformers/all-MiniLM-L6-v2")
    ap.add_argument("--steps", type=int, default=500)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--temperature", type=float, default=0.05)
    ap.add_argument("--eval-every", type=int, default=50)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(OUT_DIR))
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(max(1, torch.get_num_threads()))

    train, validation = load("train"), load("validation")
    sets = {"test1": load("test1"), "test2": load("test2"), "test3": load("test3")}
    print(f"train {len(train)} phrasings / {len(set(t['target'] for t in train))} classes | validation {len(validation)} | base {args.base}")

    model = SentenceTransformer(args.base, device="cpu")
    model.max_seq_length = 64

    def validate(tag):
        idx = Index(train, make_encoder(model))
        thr, bal = tune_threshold(idx, validation)
        print(f"  [{tag}] validation balanced accuracy {bal*100:.1f}% at threshold {thr}")
        return bal, thr

    base_bal, _ = validate("step 0 (zero-shot)")

    rng = random.Random(args.seed)
    sampler = BatchSampler(train, rng)
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=args.lr, weight_decay=0.01)
    warm = max(1, args.steps // 10)
    sched = torch.optim.lr_scheduler.LambdaLR(
        opt, lambda s: min(1.0, (s + 1) / warm) * max(0.05, 1 - s / args.steps)
    )

    best = {"bal": base_bal, "step": 0, "state": copy.deepcopy(model.state_dict())}
    t0 = time.time()
    running = []
    for step in range(1, args.steps + 1):
        model.train()
        texts, labels = sampler.sample()
        feats = model.tokenize(texts)
        emb = F.normalize(model(feats)["sentence_embedding"], dim=1)
        loss = supcon_loss(emb, labels, args.temperature)
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(params, 1.0)
        opt.step()
        sched.step()
        running.append(loss.item())
        if step % 10 == 0:
            print(f"  step {step:4d}/{args.steps}  loss {np.mean(running[-10:]):.4f}  ({time.time()-t0:.0f}s)")
        if step % args.eval_every == 0 or step == args.steps:
            bal, _ = validate(f"step {step}")
            if bal > best["bal"] + 1e-9:
                best = {"bal": bal, "step": step, "state": copy.deepcopy(model.state_dict())}

    print(f"\nbest validation checkpoint: step {best['step']} ({best['bal']*100:.1f}% vs zero-shot {base_bal*100:.1f}%)")
    model.load_state_dict(best["state"])

    encode = make_encoder(model)
    index = Index(train, encode)
    threshold, bal = tune_threshold(index, validation)
    results = evaluate_sets(index, threshold, sets)
    print_results("FINE-TUNED, held-out test sets", threshold, results, show_misses=True)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    model.save(str(out))
    (out / "train.json").write_text(json.dumps(train), encoding="utf-8")
    (out / "meta.json").write_text(
        json.dumps(
            {
                "base_model": args.base,
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "steps_run": args.steps,
                "best_step": best["step"],
                "threshold": threshold,
                "suggest_margin": 0.12,
                "validation_balanced_accuracy": round(bal, 4),
                "zero_shot_validation_balanced_accuracy": round(base_bal, 4),
                "held_out": {k: {m: round(v[m], 4) for m in ("top1", "helpful", "declined")} for k, v in results.items()},
                "phrasings": len(train),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nsaved model + meta to {out}")


if __name__ == "__main__":
    main()
