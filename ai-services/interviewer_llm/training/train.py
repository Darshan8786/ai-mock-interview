"""
Step 7 - LoRA / QLoRA fine-tuning of a local causal LM on the interviewer data.

    python training/train.py --smoke                     # small test run first (Step 8)
    python training/train.py                             # full run with the defaults below
    python training/train.py --model Qwen/Qwen2.5-0.5B-Instruct --no-4bit --epochs 4
    python training/train.py --resume-from-checkpoint auto

Everything is configurable (model, data, output dir, epochs, learning rate, batch size,
gradient accumulation, max length, LoRA rank/alpha/dropout, save/eval cadence, resume).
No GPU-specific assumptions: it uses CUDA if present (4-bit QLoRA by default), otherwise it
falls back to CPU full-precision LoRA (slow, but it runs). Nothing here calls any online AI
service; the only network use is downloading the open-weight base model from the Hugging Face hub.

Only the ANSWER part of each example contributes to the loss (the prompt is masked), which is
what makes a tiny dataset go further. Best checkpoint = lowest validation loss.
"""
from __future__ import annotations

import argparse
import inspect
import json
import math
import random
import sys
import time
from pathlib import Path

from common import PROCESSED, ROOT, read_jsonl, sha256
from prompting import build_messages

DEFAULT_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"   # small enough to SERVE on this machine (7.8 GB RAM, CPU-only Flask venv)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--config", help="optional JSON file whose keys override the defaults (CLI flags override the file)")
    p.add_argument("--model", default=DEFAULT_MODEL, help="Hugging Face model id or local path")
    p.add_argument("--data-dir", default=str(PROCESSED))
    p.add_argument("--output-dir", default=str(ROOT / "outputs" / "run"), help="checkpoints + logs go here")
    p.add_argument("--final-dir", default=None, help="also copy the final adapter here (e.g. models/software-engineering-interviewer)")
    p.add_argument("--tasks", default="qgen,qa", help="comma list of tasks to train on")
    p.add_argument("--epochs", type=float, default=4)
    p.add_argument("--lr", type=float, default=1.5e-4)
    p.add_argument("--batch-size", type=int, default=4, help="per-device micro-batch")
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--max-seq-len", type=int, default=256)
    p.add_argument("--lora-r", type=int, default=16)
    p.add_argument("--lora-alpha", type=int, default=32)
    p.add_argument("--lora-dropout", type=float, default=0.05)
    p.add_argument("--warmup-ratio", type=float, default=0.05)
    p.add_argument("--weight-decay", type=float, default=0.01)
    p.add_argument("--eval-steps", type=int, default=0, help="0 = evaluate once per epoch")
    p.add_argument("--save-total-limit", type=int, default=3)
    p.add_argument("--patience", type=int, default=2, help="early stopping patience in evaluations (0 = off)")
    p.add_argument("--no-4bit", action="store_true", help="do not quantise (plain LoRA); needs more VRAM")
    p.add_argument("--no-gradient-checkpointing", action="store_true")
    p.add_argument("--resume-from-checkpoint", default=None, help="path, or 'auto' for the latest in --output-dir")
    p.add_argument("--max-train-samples", type=int, default=0)
    p.add_argument("--max-eval-samples", type=int, default=0)
    p.add_argument("--max-steps", type=int, default=-1)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--smoke", action="store_true", help="tiny end-to-end check: 160 examples, 1 epoch, few steps, then sample outputs")
    p.add_argument("--sample-after", type=int, default=3, help="print this many generated questions when training ends")
    args, _ = p.parse_known_args()
    if args.config:
        overrides = json.loads(Path(args.config).read_text(encoding="utf-8"))
        cli_given = {a[2:].replace("-", "_").split("=")[0] for a in sys.argv[1:] if a.startswith("--")}
        for k, v in overrides.items():
            if k not in cli_given:
                setattr(args, k, v)
    if args.smoke:
        args.max_train_samples = args.max_train_samples or 160
        args.max_eval_samples = args.max_eval_samples or 40
        args.epochs = 1
        args.max_steps = 12 if args.max_steps < 0 else args.max_steps
        args.eval_steps = args.eval_steps or 6
        args.patience = 0
        if args.output_dir == str(ROOT / "outputs" / "run"):
            args.output_dir = str(ROOT / "outputs" / "smoke")
    return args


def verify_test_locked(data_dir: Path) -> None:
    manifest = data_dir / "SPLIT_MANIFEST.json"
    if not manifest.exists():
        raise SystemExit("SPLIT_MANIFEST.json missing - run training/prepare_splits.py first.")
    recorded = json.loads(manifest.read_text(encoding="utf-8"))["sha256"]
    for name in ("test", "train", "validation"):
        f = data_dir / f"{name}.jsonl"
        if sha256(f) != recorded[name]:
            raise SystemExit(f"{f.name} no longer matches SPLIT_MANIFEST.json - the split files must not be edited after creation.")


def pick(cls_or_fn, **candidates):
    """Pass only the kwargs this installed library version actually accepts (names drift between releases)."""
    accepted = set(inspect.signature(cls_or_fn).parameters)
    return {k: v for k, v in candidates.items() if k in accepted}


def tokenize_examples(rows: list[dict], tokenizer, max_len: int) -> tuple[list[dict], int]:
    out, truncated = [], 0
    for r in rows:
        msgs = build_messages(r["task"], r["instruction"], r["input"])
        # Render to text, then tokenize explicitly: apply_chat_template(tokenize=True) returns a BatchEncoding (not a
        # list) on recent transformers, which silently turned the whole prompt into two dict keys.
        prompt_text = tokenizer.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
        prompt_ids = tokenizer(prompt_text, add_special_tokens=False)["input_ids"]
        completion_ids = tokenizer(r["output"] + tokenizer.eos_token, add_special_tokens=False)["input_ids"]
        ids = list(prompt_ids) + completion_ids
        labels = [-100] * len(prompt_ids) + completion_ids     # loss on the answer only
        if len(ids) > max_len:
            truncated += 1
            ids, labels = ids[:max_len], labels[:max_len]
        if any(l != -100 for l in labels):
            out.append({"input_ids": ids, "labels": labels})
    return out, truncated


class Collator:
    def __init__(self, pad_id: int):
        self.pad_id = pad_id

    def __call__(self, batch: list[dict]) -> dict:
        import torch

        n = max(len(b["input_ids"]) for b in batch)
        ids = torch.full((len(batch), n), self.pad_id, dtype=torch.long)
        lab = torch.full((len(batch), n), -100, dtype=torch.long)
        att = torch.zeros((len(batch), n), dtype=torch.long)
        for i, b in enumerate(batch):
            k = len(b["input_ids"])
            ids[i, :k] = torch.tensor(b["input_ids"])
            lab[i, :k] = torch.tensor(b["labels"])
            att[i, :k] = 1
        return {"input_ids": ids, "attention_mask": att, "labels": lab}


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir)
    verify_test_locked(data_dir)

    import torch
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, EarlyStoppingCallback, Trainer,
                              TrainingArguments, set_seed)

    set_seed(args.seed)
    random.seed(args.seed)
    use_cuda = torch.cuda.is_available()
    bf16_ok = use_cuda and torch.cuda.is_bf16_supported()
    use_4bit = use_cuda and not args.no_4bit
    dtype = torch.bfloat16 if bf16_ok else (torch.float16 if use_cuda else torch.float32)

    print("=" * 70)
    print(f"model            : {args.model}")
    print(f"device           : {'CUDA ' + torch.cuda.get_device_name(0) if use_cuda else 'CPU (slow)'}")
    if use_cuda:
        free, total = torch.cuda.mem_get_info()
        print(f"VRAM             : {free / 2**30:.2f} GiB free of {total / 2**30:.2f} GiB")
    print(f"precision        : {'4-bit NF4 QLoRA' if use_4bit else str(dtype).replace('torch.', '')} (compute {str(dtype).replace('torch.', '')})")
    print(f"LoRA             : r={args.lora_r} alpha={args.lora_alpha} dropout={args.lora_dropout} target=all linear layers")
    print(f"batch            : {args.batch_size} x accum {args.grad_accum} = {args.batch_size * args.grad_accum} | lr {args.lr} | epochs {args.epochs} | max_len {args.max_seq_len}")
    print("=" * 70)

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    tasks = {t.strip() for t in args.tasks.split(",") if t.strip()}
    train_rows = [r for r in read_jsonl(data_dir / "train.jsonl") if r["task"] in tasks]
    val_rows = [r for r in read_jsonl(data_dir / "validation.jsonl") if r["task"] in tasks]
    rng = random.Random(args.seed)
    if args.max_train_samples:
        rng.shuffle(train_rows)
        train_rows = train_rows[: args.max_train_samples]
    if args.max_eval_samples:
        rng.shuffle(val_rows)
        val_rows = val_rows[: args.max_eval_samples]

    train_ds, t_trunc = tokenize_examples(train_rows, tokenizer, args.max_seq_len)
    val_ds, v_trunc = tokenize_examples(val_rows, tokenizer, args.max_seq_len)
    lens = [len(x["input_ids"]) for x in train_ds]
    print(f"train examples   : {len(train_ds)} (truncated {t_trunc}) | validation examples: {len(val_ds)} (truncated {v_trunc})")
    print(f"sequence length  : mean {sum(lens) / len(lens):.0f}, max {max(lens)} tokens")
    if not train_ds or not val_ds:
        raise SystemExit("No training/validation examples after filtering.")

    # ── model
    quant = None
    if use_4bit:
        quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype)
    t0 = time.time()
    from_kwargs = {"quantization_config": quant} if quant is not None else {}
    try:
        model = AutoModelForCausalLM.from_pretrained(args.model, dtype=dtype, low_cpu_mem_usage=True, device_map={"": 0} if use_cuda else None, **from_kwargs)
    except TypeError:                                            # older releases call it torch_dtype
        model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=dtype, low_cpu_mem_usage=True, device_map={"": 0} if use_cuda else None, **from_kwargs)
    print(f"model loaded in {time.time() - t0:.0f}s | parameters {sum(p.numel() for p in model.parameters()) / 1e9:.2f}B")
    if use_cuda:
        print(f"VRAM after load  : {torch.cuda.memory_allocated() / 2**30:.2f} GiB")

    gc = not args.no_gradient_checkpointing
    if use_4bit:
        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=gc)
    elif gc:
        model.gradient_checkpointing_enable()
        model.enable_input_require_grads()
    model.config.use_cache = False

    lora = LoraConfig(r=args.lora_r, lora_alpha=args.lora_alpha, lora_dropout=args.lora_dropout, bias="none",
                      target_modules="all-linear", task_type="CAUSAL_LM")
    model = get_peft_model(model, lora)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"trainable params : {trainable / 1e6:.1f}M ({100 * trainable / sum(p.numel() for p in model.parameters()):.2f}% of the model)")

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    steps_per_epoch = max(1, math.ceil(len(train_ds) / (args.batch_size * args.grad_accum)))
    eval_steps = args.eval_steps or steps_per_epoch
    ta_kwargs = pick(
        TrainingArguments.__init__,
        output_dir=str(out_dir), num_train_epochs=args.epochs, max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size, per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum, learning_rate=args.lr, lr_scheduler_type="cosine",
        warmup_ratio=args.warmup_ratio, weight_decay=args.weight_decay, max_grad_norm=1.0,
        logging_steps=max(1, min(5, steps_per_epoch)), report_to="none", seed=args.seed,
        bf16=bf16_ok, fp16=use_cuda and not bf16_ok, use_cpu=not use_cuda, no_cuda=not use_cuda,
        eval_strategy="steps", evaluation_strategy="steps", eval_steps=eval_steps,
        save_strategy="steps", save_steps=eval_steps, save_total_limit=args.save_total_limit,
        load_best_model_at_end=True, metric_for_best_model="eval_loss", greater_is_better=False,
        remove_unused_columns=False, dataloader_pin_memory=False, gradient_checkpointing=False,
    )
    targs = TrainingArguments(**ta_kwargs)
    trainer_kwargs = pick(Trainer.__init__, model=model, args=targs, train_dataset=train_ds, eval_dataset=val_ds,
                          data_collator=Collator(tokenizer.pad_token_id), processing_class=tokenizer, tokenizer=tokenizer)
    if args.patience:
        trainer_kwargs["callbacks"] = [EarlyStoppingCallback(early_stopping_patience=args.patience)]
    trainer = Trainer(**trainer_kwargs)

    resume = args.resume_from_checkpoint
    if resume == "auto":
        cps = sorted(out_dir.glob("checkpoint-*"), key=lambda p: int(p.name.split("-")[1]))
        resume = str(cps[-1]) if cps else None
        print(f"resuming from    : {resume or '(no checkpoint found - starting fresh)'}")

    (out_dir / "training_config.json").write_text(json.dumps({**vars(args), "train_examples": len(train_ds), "val_examples": len(val_ds),
                                                             "quantized_4bit": use_4bit, "dtype": str(dtype)}, indent=2), encoding="utf-8")
    t0 = time.time()
    result = trainer.train(resume_from_checkpoint=resume)
    print(f"\ntraining finished in {time.time() - t0:.0f}s | final train loss {result.training_loss:.4f}")
    metrics = trainer.evaluate()
    if "eval_loss" in metrics:
        metrics["eval_perplexity"] = math.exp(min(metrics["eval_loss"], 20))
    print("validation       :", {k: round(v, 4) for k, v in metrics.items() if isinstance(v, float)})
    if use_cuda:
        print(f"peak VRAM        : {torch.cuda.max_memory_allocated() / 2**30:.2f} GiB")

    adapter_dir = out_dir / "adapter"
    trainer.model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)
    history = [h for h in trainer.state.log_history]
    (out_dir / "train_log.json").write_text(json.dumps({"history": history, "final_metrics": metrics}, indent=2), encoding="utf-8")
    print(f"adapter saved    : {adapter_dir}")
    if args.final_dir:
        import shutil

        final = Path(args.final_dir) / "adapter"
        final.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(adapter_dir, final, dirs_exist_ok=True)
        (Path(args.final_dir) / "training_info.json").write_text(json.dumps({"base_model": args.model, "quantized_4bit": use_4bit, "metrics": metrics,
                                                                            "lora": {"r": args.lora_r, "alpha": args.lora_alpha, "dropout": args.lora_dropout},
                                                                            "trained_examples": len(train_ds)}, indent=2), encoding="utf-8")
        print(f"final adapter    : {final}")

    # ── inference sanity check with the model that was just trained
    if args.sample_after:
        from prompting import QGEN_INSTRUCTION

        model.eval()
        model.config.use_cache = True
        print("\nsample generations:")
        for topic, diff, role in [("SQL", "Medium", "Backend Developer"), ("Operating Systems", "Easy", None), ("Java", "Hard", "Java Developer")][: args.sample_after]:
            inp = "\n".join(([f"Role: {role}"] if role else []) + [f"Topic: {topic}", f"Difficulty: {diff}"])
            ids = tokenizer.apply_chat_template(build_messages("qgen", QGEN_INSTRUCTION, inp), add_generation_prompt=True, return_tensors="pt", return_dict=True)
            ids = {k: v.to(model.device) for k, v in ids.items()}
            with torch.no_grad():
                gen = model.generate(**ids, max_new_tokens=60, do_sample=True, temperature=0.7, top_p=0.9, pad_token_id=tokenizer.pad_token_id)
            text = tokenizer.decode(gen[0][ids["input_ids"].shape[1]:], skip_special_tokens=True).strip()
            print(f"  [{topic} / {diff}] {text}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
