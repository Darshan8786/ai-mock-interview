"""
Evaluate the v2 combined model (interview + aptitude + tech) on the LOCKED v2 test split.

    python training/evaluate_v2.py                          # fine-tuned (models/v2_combined)
    python training/evaluate_v2.py --no-adapter              # base model, same prompts (baseline)
    python training/evaluate_v2.py --per-domain 40 --samples 2

Per domain, for each held-out context it samples K generations and reports:
  parse_rate            output is one valid JSON object
  valid_rate            passes structured_validator (the production gate: structure, options, answer, duplicates...)
  aptitude.numeric_verified_rate / contradicted_rate
                        among valid-structure numeric aptitude items: answer key proven by numeric_verifier / refuted
  novel_rate            valid outputs that are not a near-copy of any TRAIN question (low = memorising)
  mcq_answer_accuracy   greedy answer to held-out MCQs == key (the self-consistency check's reliability)
Nothing is invented: every number comes from generations written to outputs/eval/v2_eval_<tag>.json.
"""
from __future__ import annotations

import argparse
import collections
import json
import random
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent.parent))

from common import ROOT, read_jsonl, sha256, similar  # noqa: E402
import prompting  # noqa: E402
from interviewer_llm.numeric_verifier import is_numeric_question  # noqa: E402
from interviewer_llm.structured_validator import _opt_key, parse_json_output, validate_structured  # noqa: E402

DATA = ROOT / "data" / "v2_combined"
MODEL_DIR = ROOT / "models" / "v2_combined"


def verify_locked() -> None:
    recorded = json.loads((DATA / "SPLIT_MANIFEST.json").read_text(encoding="utf-8"))["sha256"]
    for name in ("test", "train"):
        if sha256(DATA / f"{name}.jsonl") != recorded[name]:
            raise SystemExit(f"{name}.jsonl does not match SPLIT_MANIFEST.json - refusing to evaluate.")


def ctx_from_input(inp: str) -> dict:
    return json.loads(inp.split("\n")[0][len("Context: "):])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-adapter", action="store_true")
    ap.add_argument("--per-domain", type=int, default=40)
    ap.add_argument("--samples", type=int, default=2)
    ap.add_argument("--mcq", type=int, default=120)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    verify_locked()

    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    info = json.loads((MODEL_DIR / "training_info.json").read_text(encoding="utf-8"))
    tok = AutoTokenizer.from_pretrained(info["base_model"])
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForCausalLM.from_pretrained(info["base_model"], torch_dtype=torch.float16 if device == "cuda" else torch.float32)
    tag = "base"
    if not args.no_adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, MODEL_DIR / "adapter")
        tag = "v2_combined"
    model = model.to(device).eval()

    def gen(task, inp, n, max_new, sample=True):
        text = tok.apply_chat_template(prompting.build_messages(task, prompting.QGEN_V2_INSTRUCTION if task != "mcq_answer" else prompting.MCQ_ANSWER_INSTRUCTION, inp),
                                       add_generation_prompt=True, tokenize=False)
        enc = tok(text, return_tensors="pt", add_special_tokens=False).to(device)
        kw = dict(do_sample=True, temperature=0.8, top_p=0.92, top_k=50, repetition_penalty=1.05) if sample else dict(do_sample=False)
        with torch.no_grad():
            out = model.generate(**enc, num_return_sequences=n, max_new_tokens=max_new, pad_token_id=tok.pad_token_id, eos_token_id=tok.eos_token_id, **kw)
        return [tok.decode(o[enc["input_ids"].shape[1]:], skip_special_tokens=True) for o in out]

    test = read_jsonl(DATA / "test.jsonl")
    train_q: dict[str, list[str]] = collections.defaultdict(list)
    for r in read_jsonl(DATA / "combined_clean.jsonl"):
        if r["split"] == "train":
            train_q[r["domain"]].append(r["question"])
    rng = random.Random(args.seed)
    t0 = time.time()
    results: dict = {"tag": tag, "model_dir": str(MODEL_DIR), "per_domain": {}, "samples": []}

    for domain in ("interview", "aptitude", "tech"):
        rows = [r for r in test if r["task"] == f"qgen_{domain}"]
        rng.shuffle(rows)
        rows = rows[: args.per_domain]
        c = collections.Counter()
        reasons = collections.Counter()
        for r in rows:
            ctx = ctx_from_input(r["input"])
            for raw in gen(f"qgen_{domain}", r["input"], args.samples, {"interview": 96, "aptitude": 300, "tech": 380}[domain]):
                c["generated"] += 1
                obj = parse_json_output(raw)
                if not obj:
                    c["unparseable"] += 1
                    reasons["unparseable"] += 1
                    results["samples"].append({"domain": domain, "ctx": ctx, "raw": raw[:500], "verdict": ["unparseable"]})
                    continue
                c["parsed"] += 1
                v = validate_structured(obj, ctx)
                numeric = domain == "aptitude" and isinstance(obj.get("options"), list) and len(obj["options"]) == 4 and \
                    is_numeric_question([str(o) for o in obj["options"]], ctx.get("category", ""), ctx.get("topic", ""))
                if numeric:
                    c["numeric"] += 1
                    if v.verification == "deterministic":
                        c["numeric_verified"] += 1
                    if "answer_key_contradicted" in v.reasons:
                        c["numeric_contradicted"] += 1
                if v.ok:
                    c["valid"] += 1
                    q = v.record["question"]
                    if not any(similar(q, t) for t in train_q[domain]):
                        c["novel"] += 1
                for x in v.reasons:
                    reasons[x] += 1
                results["samples"].append({"domain": domain, "ctx": ctx, "output": obj, "verdict": v.reasons or ["ok"], "verification": v.verification})
        g = max(1, c["generated"])
        results["per_domain"][domain] = {
            "contexts": len(rows), "generated": c["generated"], "parse_rate": round(c["parsed"] / g, 3), "valid_rate": round(c["valid"] / g, 3),
            "novel_rate_of_valid": round(c["novel"] / max(1, c["valid"]), 3), "rejection_reasons": dict(reasons.most_common(12)),
            **({"numeric_items": c["numeric"], "numeric_verified_rate": round(c["numeric_verified"] / max(1, c["numeric"]), 3),
                "numeric_contradicted_rate": round(c["numeric_contradicted"] / max(1, c["numeric"]), 3)} if domain == "aptitude" else {}),
        }
        print(domain, json.dumps(results["per_domain"][domain]), flush=True)

    mcq = [r for r in test if r["task"] == "mcq_answer"]
    rng.shuffle(mcq)
    hits = 0
    for r in mcq[: args.mcq]:
        got = gen("mcq_answer", r["input"], 1, 60, sample=False)[0].strip()
        hits += _opt_key(got) == _opt_key(r["output"])
    results["mcq_answer_accuracy"] = round(hits / max(1, min(len(mcq), args.mcq)), 3)
    results["mcq_answer_evaluated"] = min(len(mcq), args.mcq)
    results["seconds"] = round(time.time() - t0)
    print("mcq_answer_accuracy", results["mcq_answer_accuracy"], "on", results["mcq_answer_evaluated"])

    out = ROOT / "outputs" / "eval" / f"v2_eval_{tag}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
    print("written", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
