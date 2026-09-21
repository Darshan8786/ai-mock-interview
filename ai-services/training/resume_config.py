"""
Configuration for the local resume-content-enhancer training pipeline
(bullet-point rewriting + summary writing). Sibling to config.py (the
interview-question generator's config) - kept separate because it trains a
different model on a different dataset with different prompt templates.

Same hardware constraints as config.py apply: CPU-only, full fine-tune of a
tiny base model rather than a larger LLM + LoRA.
"""

import os

TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICES_DIR = os.path.dirname(TRAINING_DIR)

DATA_DIR = os.path.join(TRAINING_DIR, "data", "resume_enhancement")
RAW_DATASET_PATH = os.path.join(DATA_DIR, "raw_dataset.json")
CLEAN_DATASET_PATH = os.path.join(DATA_DIR, "clean_dataset.json")
TRAIN_PATH = os.path.join(DATA_DIR, "train.jsonl")
VAL_PATH = os.path.join(DATA_DIR, "val.jsonl")
STATS_JSON_PATH = os.path.join(DATA_DIR, "dataset_stats.json")
STATS_TXT_PATH = os.path.join(DATA_DIR, "dataset_stats.txt")

MODEL_OUTPUT_DIR = os.path.join(AI_SERVICES_DIR, "models", "resume-content-enhancer")
CHECKPOINT_DIR = os.path.join(TRAINING_DIR, "checkpoints_resume")
EVAL_RESULTS_DIR = os.path.join(TRAINING_DIR, "eval_results_resume")

# ── Reproducibility ─────────────────────────────────────────────────────────
SEED = 42
VAL_FRACTION = 0.15

# ── Prompt templates - two task types share one model ───────────────────────
BULLET_PROMPT = (
    "### Instruction:\nRewrite the following resume bullet point to be more professional, "
    "starting with a strong action verb and including quantifiable impact where possible.\n\n"
    "### Original:\n{weak}\n\n### Rewritten:\n"
)
SUMMARY_PROMPT = (
    "### Instruction:\nWrite a concise, professional 3-4 sentence resume summary for a candidate "
    "targeting the role of {role}, with skills in {skills}, and {years} years of experience.\n\n"
    "### Summary:\n"
)

# ── Model / training hyperparameters ────────────────────────────────────────
BASE_MODEL_NAME = "distilgpt2"
MAX_LENGTH = 128
NUM_EPOCHS = 6
TRAIN_BATCH_SIZE = 2
EVAL_BATCH_SIZE = 2
GRADIENT_ACCUMULATION_STEPS = 4
LEARNING_RATE = 5e-5
WEIGHT_DECAY = 0.01
WARMUP_STEPS = 10
LOGGING_STEPS = 10
# "no" eval/save DURING training (not "epoch"): this machine has very little
# free RAM, and repeated per-epoch checkpoint writes were segfaulting
# partway through a run. The dataset is tiny (55 train examples), so a
# single final save + a single final eval is both cheaper and sufficient -
# see train_resume_enhancer.py.
EVAL_STRATEGY = "no"
SAVE_STRATEGY = "no"
SAVE_TOTAL_LIMIT = 1
EARLY_STOPPING_PATIENCE = 3

# ── Generation defaults ──────────────────────────────────────────────────────
GEN_MAX_NEW_TOKENS = 90
GEN_TEMPERATURE = 0.7
GEN_TOP_P = 0.9
GEN_TOP_K = 50
GEN_REPETITION_PENALTY = 1.3
GENERATION_TIMEOUT_SECONDS = 8.0
