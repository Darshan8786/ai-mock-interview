#!/usr/bin/env python
"""
Phase 4 - Training pipeline for the local interview-question generator.

Full-fine-tunes (or LoRA fine-tunes, if config.USE_LORA=True) a small causal
LM on the instruction dataset produced by prepare_dataset.py.

Usage (run from ai-services/):
    python training/train.py
    python training/train.py --epochs 3 --batch-size 2 --lr 3e-5
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config

import torch
from torch.utils.data import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    set_seed,
)


class InstructionDataset(Dataset):
    """Tokenizes prompt+completion pairs, masking prompt tokens out of the
    loss so the model is only trained to predict the question text."""

    def __init__(self, jsonl_path: str, tokenizer, max_length: int):
        self.examples = []
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    self.examples.append(json.loads(line))
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        ex = self.examples[idx]
        prompt = ex["prompt"]
        completion = " " + ex["completion"] + self.tokenizer.eos_token

        prompt_ids = self.tokenizer(prompt, add_special_tokens=False)["input_ids"]
        completion_ids = self.tokenizer(completion, add_special_tokens=False)["input_ids"]

        input_ids = (prompt_ids + completion_ids)[: self.max_length]
        labels = ([-100] * len(prompt_ids) + completion_ids)[: self.max_length]

        pad_len = self.max_length - len(input_ids)
        attention_mask = [1] * len(input_ids) + [0] * pad_len
        input_ids = input_ids + [self.tokenizer.pad_token_id] * pad_len
        labels = labels + [-100] * pad_len

        return {
            "input_ids": torch.tensor(input_ids, dtype=torch.long),
            "attention_mask": torch.tensor(attention_mask, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
        }


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--epochs", type=int, default=config.NUM_EPOCHS)
    p.add_argument("--batch-size", type=int, default=config.TRAIN_BATCH_SIZE)
    p.add_argument("--grad-accum", type=int, default=config.GRADIENT_ACCUMULATION_STEPS)
    p.add_argument("--lr", type=float, default=config.LEARNING_RATE)
    p.add_argument("--max-length", type=int, default=config.MAX_LENGTH)
    p.add_argument("--use-lora", action="store_true", default=config.USE_LORA)
    p.add_argument("--base-model", type=str, default=config.BASE_MODEL_NAME)
    p.add_argument("--max-steps", type=int, default=None, help="Debug: cap optimizer steps for a smoke test")
    return p.parse_args()


def main():
    args = parse_args()
    set_seed(config.SEED)

    if not os.path.exists(config.TRAIN_PATH) or not os.path.exists(config.VAL_PATH):
        print("train.jsonl / val.jsonl not found. Run `python training/prepare_dataset.py` first.")
        sys.exit(1)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device} | torch {torch.__version__}")
    print(f"Base model: {args.base_model} | LoRA: {args.use_lora}")

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(args.base_model)
    model.resize_token_embeddings(len(tokenizer))
    model.to(device)

    if args.use_lora:
        from peft import LoraConfig, get_peft_model, TaskType

        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=config.LORA_R,
            lora_alpha=config.LORA_ALPHA,
            lora_dropout=config.LORA_DROPOUT,
            target_modules=config.LORA_TARGET_MODULES,
        )
        model = get_peft_model(model, lora_config)
        model.print_trainable_parameters()

    train_dataset = InstructionDataset(config.TRAIN_PATH, tokenizer, args.max_length)
    val_dataset = InstructionDataset(config.VAL_PATH, tokenizer, args.max_length)
    print(f"Train examples: {len(train_dataset)} | Val examples: {len(val_dataset)}")

    os.makedirs(config.CHECKPOINT_DIR, exist_ok=True)
    os.makedirs(config.MODEL_OUTPUT_DIR, exist_ok=True)

    training_args = TrainingArguments(
        output_dir=config.CHECKPOINT_DIR,
        num_train_epochs=args.epochs,
        max_steps=args.max_steps if args.max_steps else -1,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=config.EVAL_BATCH_SIZE,
        gradient_accumulation_steps=args.grad_accum,
        learning_rate=args.lr,
        weight_decay=config.WEIGHT_DECAY,
        warmup_steps=config.WARMUP_STEPS,
        logging_steps=config.LOGGING_STEPS,
        eval_strategy=config.EVAL_STRATEGY,
        save_strategy=config.SAVE_STRATEGY,
        seed=config.SEED,
        report_to=[],
        use_cpu=(device == "cpu"),
        dataloader_num_workers=0,
    )

    # No per-epoch eval/checkpointing (see config.py) -> no early stopping or
    # "load best" possible; train straight through then do one final eval below.
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
    )

    start = time.time()
    train_result = trainer.train()
    elapsed = time.time() - start

    eval_metrics = trainer.evaluate()

    if args.use_lora:
        model.save_pretrained(config.MODEL_OUTPUT_DIR)
    else:
        trainer.save_model(config.MODEL_OUTPUT_DIR)
    tokenizer.save_pretrained(config.MODEL_OUTPUT_DIR)

    meta = {
        "base_model": args.base_model,
        "use_lora": args.use_lora,
        "epochs_requested": args.epochs,
        "epochs_completed": train_result.metrics.get("epoch"),
        "train_runtime_seconds": elapsed,
        "train_loss": train_result.metrics.get("train_loss"),
        "eval_loss": eval_metrics.get("eval_loss"),
        "device": device,
        "seed": config.SEED,
        "train_examples": len(train_dataset),
        "val_examples": len(val_dataset),
    }
    with open(os.path.join(config.MODEL_OUTPUT_DIR, "training_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("=" * 60)
    print(f"Training completed in {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"Final train loss: {meta['train_loss']}")
    print(f"Final eval loss:  {meta['eval_loss']}")
    print(f"Model saved to:   {config.MODEL_OUTPUT_DIR}")


if __name__ == "__main__":
    main()
