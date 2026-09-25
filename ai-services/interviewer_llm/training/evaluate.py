"""
Step 10 - evaluate the model on the LOCKED test split.

    python training/evaluate.py                          # fine-tuned model (adapter from the final dir)
    python training/evaluate.py --no-adapter             # the untrained base model, same prompts (baseline)
    python training/evaluate.py --limit 20               # quick look

Question generation (task "qgen", fixed prompt per test record: Role + Topic + Subtopic + Difficulty), K samples each:
  valid_rate            passes question_validator (format, length, no leak, no repetition, on-topic) - the production gate
  on_topic_rate         does not fail the topic-vocabulary check (only topics with a usable vocabulary are counted)
  distinct_rate         unique questions among all samples for the same prompt (1.0 = no repeats between samples)
  novel_rate            not a near-copy of any TRAIN question (a low value means memorisation, a high one means generation)
  matches_reference     near-copy of the held-out reference question (lucky overlap; informational)
  difficulty_match      a small TF-IDF classifier trained on TRAIN questions predicts the requested difficulty. The same
                        classifier is scored on the real test questions, and that number is the ceiling (the classifier is weak
                        because difficulty labels in the source data are noisy - read this metric as relative, not absolute)
Answer quality (task "qa", Kaggle pairs only): token-F1 and ROUGE-L against the reference answer, plus length ratio.
"hallucination" for questions is measured as off-topic / invalid output; for answers only overlap with the reference is
measurable automatically, so answers should also be read by a person (samples are written to the report).

The test set is hash-checked against SPLIT_MANIFEST.json before anything runs.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent))          # ai-services/  (for the interviewer_llm package)
sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import PROCESSED, read_jsonl                                  # noqa: E402
from interviewer_llm.question_validator import clean_generation, normalize, topic_vocab, validate_question  # noqa: E402
from prompting import build_messages                                       # noqa: E402
from train import verify_test_locked                                       # noqa: E402

NEAR = 0.85


def near_copy(a: str, b: str) -> bool:
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio() >= NEAR


def token_f1(pred: str, ref: str) -> float:
    p, r = re.findall(r"\w+", pred.lower()), re.findall(r"\w+", ref.lower())
    if not p or not r:
        return 0.0
    common = sum((Counter(p) & Counter(r)).values())
    if not common:
        return 0.0
    prec, rec = common / len(p), common / len(r)
    return 2 * prec * rec / (prec + rec)


def rouge_l(pred: str, ref: str) -> float:
    a, b = re.findall(r"\w+", pred.lower()), re.findall(r"\w+", ref.lower())
    if not a or not b:
        return 0.0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b, 1):
            cur.append(prev[j - 1] + 1 if x == y else max(prev[j], cur[j - 1]))
        prev = cur
    lcs = prev[-1]
    if not lcs:
        return 0.0
    p, r = lcs / len(a), lcs / len(b)
    return 2 * p * r / (p + r)


def difficulty_classifier(train_rows: list[dict]):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline

    seen, X, y = set(), [], []
    for r in train_rows:
        if r["task"] == "qgen" and r.get("difficulty") and r["id"] not in seen:
            seen.add(r["id"]); X.append(r["output"]); y.append(r["difficulty"])
    return make_pipeline(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=2), LogisticRegression(max_iter=2000, C=3.0)).fit(X, y)


def load_model(args):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    final = Path(args.final_dir)
    info = json.loads((final / "training_info.json").read_text(encoding="utf-8")) if (final / "training_info.json").exists() else {}
    base = args.model or info.get("base_model") or "Qwen/Qwen2.5-0.5B-Instruct"
    tok = AutoTokenizer.from_pretrained(base)
    kw = {}
    if torch.cuda.is_available() and not args.no_4bit:
        kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
                                                       bnb_4bit_compute_dtype=torch.float16)
        kw["device_map"] = {"": 0}
    else:
        kw["dtype"] = torch.float32
    model = AutoModelForCausalLM.from_pretrained(base, **kw)
    if not args.no_adapter:
        from peft import PeftModel
        adapter = Path(args.adapter) if args.adapter else final / "adapter"
        model = PeftModel.from_pretrained(model, adapter)
    if "quantization_config" not in kw:
        model.to("cuda" if torch.cuda.is_available() else "cpu")
    model.eval()
    return model, tok, base


def generate(model, tok, row: dict, k: int, greedy: bool = False, max_new: int = 96) -> list[str]:
    import torch

    text = tok.apply_chat_template(build_messages(row["task"], row["instruction"], row["input"]), add_generation_prompt=True, tokenize=False)
    enc = tok(text, return_tensors="pt", add_special_tokens=False).to(model.device)
    kw = dict(do_sample=False) if greedy else dict(do_sample=True, temperature=0.8, top_p=0.92, top_k=50, num_return_sequences=k)
    with torch.no_grad():
        out = model.generate(**enc, max_new_tokens=max_new, repetition_penalty=1.05, pad_token_id=tok.pad_token_id, eos_token_id=tok.eos_token_id, **kw)
    return [tok.decode(o[enc["input_ids"].shape[1]:], skip_special_tokens=True).strip() for o in out]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--final-dir", default=str(ROOT / "models" / "software-engineering-interviewer"))
    ap.add_argument("--adapter", help="adapter dir (default <final-dir>/adapter)")
    ap.add_argument("--model", help="base model id (default: from training_info.json)")
    ap.add_argument("--no-adapter", action="store_true", help="evaluate the untrained base model (baseline)")
    ap.add_argument("--no-4bit", action="store_true")
    ap.add_argument("--split", default="test", choices=["test", "validation"])
    ap.add_argument("--samples", type=int, default=3)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--tag", default=None)
    args = ap.parse_args()

    data_dir = ROOT / "data" / "processed"
    verify_test_locked(data_dir)
    rows = read_jsonl(data_dir / f"{args.split}.jsonl")
    train = read_jsonl(data_dir / "train.jsonl")
    train_q = [r["output"] for r in {r["id"]: r for r in train if r["task"] == "qgen"}.values()]
    clf = difficulty_classifier(train)
    vocab = topic_vocab()

    qgen = [r for r in rows if r["task"] == "qgen"][: args.limit]
    qa = [r for r in rows if r["task"] == "qa"][: args.limit]
    model, tok, base = load_model(args)
    tag = args.tag or ("baseline" if args.no_adapter else "finetuned")
    print(f"evaluating [{tag}] base={base} on {len(qgen)} question prompts + {len(qa)} answer prompts (split={args.split})")

    t0 = time.time()
    per, samples = [], []
    for i, r in enumerate(qgen, 1):
        gens = [clean_generation(g) for g in generate(model, tok, r, args.samples)]
        verdicts = [validate_question(g, topic=r["topic"], cleaned=True) for g in gens]
        has_vocab = len(vocab.get(r["topic"], ())) >= 10
        per.append({
            "valid": [v.ok for v in verdicts],
            "on_topic": [("off_topic" not in v.reasons) for v in verdicts] if has_vocab else [],
            "distinct": len({normalize(g) for g in gens}) / max(1, len(gens)),
            "novel": [not any(near_copy(g, t) for t in train_q) for g in gens],
            "ref_match": [near_copy(g, r["output"]) for g in gens],
            "diff_match": [clf.predict([g])[0] == r["difficulty"] for g in gens] if r.get("difficulty") else [],
            "reasons": [x for v in verdicts for x in v.reasons],
        })
        if i <= 12:
            samples.append({"prompt": r["input"], "reference": r["output"], "generated": gens, "valid": [v.ok for v in verdicts]})
        if i % 25 == 0:
            print(f"  {i}/{len(qgen)}")

    flat = lambda key: [x for p in per for x in p[key]]
    mean = lambda xs: round(sum(xs) / len(xs), 4) if xs else None
    ceiling = [clf.predict([r["output"]])[0] == r["difficulty"] for r in qgen if r.get("difficulty")]
    report = {
        "tag": tag, "base_model": base, "split": args.split, "questions_prompts": len(qgen), "samples_per_prompt": args.samples,
        "valid_rate": mean(flat("valid")), "on_topic_rate": mean(flat("on_topic")),
        "prompts_with_at_least_one_valid_sample": mean([any(p["valid"]) for p in per]),
        "distinct_rate": mean([p["distinct"] for p in per]), "novel_rate": mean(flat("novel")),
        "matches_reference": mean(flat("ref_match")),
        "difficulty_match": mean(flat("diff_match")), "difficulty_match_ceiling_on_real_questions": mean(ceiling),
        "rejection_reasons": dict(Counter(flat("reasons"))),
        "generation_seconds": round(time.time() - t0, 1),
    }

    if qa:
        f1s, rls, ratios, qa_samples = [], [], [], []
        for r in qa:
            ans = generate(model, tok, r, 1, greedy=True, max_new=160)[0]
            f1s.append(token_f1(ans, r["output"])); rls.append(rouge_l(ans, r["output"]))
            ratios.append(len(ans.split()) / max(1, len(r["output"].split())))
            if len(qa_samples) < 5:
                qa_samples.append({"question": r["input"], "reference": r["output"], "generated": ans})
        report["answers"] = {"n": len(qa), "token_f1": mean(f1s), "rouge_l": mean(rls), "length_ratio_median": round(statistics.median(ratios), 2),
                             "samples": qa_samples}

    report["samples"] = samples
    out_dir = ROOT / "outputs" / "eval"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"eval_{tag}_{args.split}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n=== " + tag.upper() + " ===")
    for k, v in report.items():
        if k not in ("samples", "answers"):
            print(f"  {k:<48} {v}")
    if "answers" in report:
        print("  answers:", {k: v for k, v in report["answers"].items() if k != "samples"})
    print(f"\nreport -> {(out_dir / f'eval_{tag}_{args.split}.json').relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
