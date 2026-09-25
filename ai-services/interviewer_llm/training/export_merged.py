"""
Merge the trained LoRA adapter into the base weights so the model loads with plain `transformers`
(the MindPrep Flask service has no peft / bitsandbytes installed, and shouldn't need them).

    python training/export_merged.py                  # <final-dir>/adapter -> <final-dir>/merged

The base model is loaded in full precision on the CPU (NOT the 4-bit weights used for training - merging into quantised
weights would bake quantisation error in), merged, and saved as fp16 safetensors + tokenizer.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--final-dir", default=str(ROOT / "models" / "software-engineering-interviewer"))
    args = ap.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    final = Path(args.final_dir)
    info = json.loads((final / "training_info.json").read_text(encoding="utf-8"))
    base = info["base_model"]
    print(f"merging adapter into {base} ...")
    model = AutoModelForCausalLM.from_pretrained(base, dtype=torch.float16)
    model = PeftModel.from_pretrained(model, final / "adapter").merge_and_unload()
    out = final / "merged"
    model.save_pretrained(out, safe_serialization=True)
    AutoTokenizer.from_pretrained(base).save_pretrained(out)
    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file()) / 2**20
    print(f"saved {out}  ({size:.0f} MiB)")


if __name__ == "__main__":
    main()
