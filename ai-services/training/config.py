"""
Central, machine-independent configuration for the interview-question
generator training pipeline. All paths are derived from this file's location
so the pipeline works regardless of where the repo is checked out.

Hardware this was tuned for (inspected at authoring time):
  CPU: Intel Core i5-11320H (4 cores / 8 threads)
  RAM: 7.79 GB total (frequently <1 GB free with normal apps open)
  GPU: NVIDIA RTX 3050 Laptop (4 GB VRAM) - torch installed as CPU-only build
  -> Base model deliberately kept tiny (see BASE_MODEL_NAME) and trained with
     full fine-tuning on CPU rather than a larger LLM + LoRA, since the free
     RAM on this machine could not reliably hold a bigger model plus
     optimizer/activation memory alongside the user's normal workload.
"""

import os

# ── Paths (all relative to this file, no machine-specific absolute paths) ──
TRAINING_DIR = os.path.dirname(os.path.abspath(__file__))
AI_SERVICES_DIR = os.path.dirname(TRAINING_DIR)

DATA_DIR = os.path.join(TRAINING_DIR, "data", "interview_questions")
RAW_DATASET_PATH = os.path.join(DATA_DIR, "raw_dataset.json")
CLEAN_DATASET_PATH = os.path.join(DATA_DIR, "clean_dataset.json")
TRAIN_PATH = os.path.join(DATA_DIR, "train.jsonl")
VAL_PATH = os.path.join(DATA_DIR, "val.jsonl")
STATS_JSON_PATH = os.path.join(DATA_DIR, "dataset_stats.json")
STATS_TXT_PATH = os.path.join(DATA_DIR, "dataset_stats.txt")

MODEL_OUTPUT_DIR = os.path.join(AI_SERVICES_DIR, "models", "interview-question-generator")
CHECKPOINT_DIR = os.path.join(TRAINING_DIR, "checkpoints")
EVAL_RESULTS_DIR = os.path.join(TRAINING_DIR, "eval_results")

# ── Reproducibility ─────────────────────────────────────────────────────────
SEED = 42

# ── Dataset ──────────────────────────────────────────────────────────────
VAL_FRACTION = 0.12
DIFFICULTIES = ["Easy", "Medium", "Hard"]
CANDIDATE_LEVELS = ["Fresher", "Intermediate", "Experienced"]
NEAR_DUP_SIMILARITY_THRESHOLD = 0.90  # difflib ratio, checked within same skill+topic

# Instruction phrasings — several wordings per record (chosen deterministically
# by seeded RNG) so the model generalizes over instruction wording instead of
# memorizing one exact template.
INSTRUCTION_TEMPLATES = [
    "Generate a {difficulty}-level {skill} interview question about {topic} for a {level}.",
    "Ask a {difficulty} {skill} interview question on the topic of {topic}, suitable for a {level} candidate.",
    "Create one {difficulty} difficulty interview question testing {skill} knowledge on {topic}, aimed at a {level} candidate.",
    "You are interviewing a {level} candidate. Generate a {difficulty} {skill} question about {topic}.",
]

PROMPT_HEADER = "### Instruction:\n{instruction}\n\n### Question:\n"

# ── Model / training hyperparameters ────────────────────────────────────────
# DistilGPT-2 (82M params): small enough to fully fine-tune (no LoRA needed)
# in the RAM budget available on this machine, while still being a real
# instruction-following capable causal LM after SFT on our dataset.
BASE_MODEL_NAME = "distilgpt2"
USE_LORA = False  # flip to True (and set below) if training on a machine with more headroom
LORA_R = 8
LORA_ALPHA = 16
LORA_DROPOUT = 0.05
LORA_TARGET_MODULES = ["c_attn"]  # GPT-2 style attention projection

MAX_LENGTH = 128
NUM_EPOCHS = 6
TRAIN_BATCH_SIZE = 4
EVAL_BATCH_SIZE = 4
GRADIENT_ACCUMULATION_STEPS = 4  # effective batch size = 16
LEARNING_RATE = 5e-5
WEIGHT_DECAY = 0.01
WARMUP_STEPS = 20
LOGGING_STEPS = 20
# "no" eval/save DURING training (not "epoch"): on this machine, free RAM is
# frequently under 1GB, and repeated per-epoch checkpoint writes reliably
# segfault mid-run on a larger dataset (see the resume-enhancer training
# postmortem in resume_config.py for the same fix). A single final save +
# eval is cheaper and was what actually completed successfully.
EVAL_STRATEGY = "no"
SAVE_STRATEGY = "no"
SAVE_TOTAL_LIMIT = 1
EARLY_STOPPING_PATIENCE = 2  # epochs without eval_loss improvement

# ── Generation defaults (used by inference + evaluate) ──────────────────────
GEN_MAX_NEW_TOKENS = 48
GEN_TEMPERATURE = 0.85
GEN_TOP_P = 0.92
GEN_TOP_K = 50
GEN_REPETITION_PENALTY = 1.3
GENERATION_TIMEOUT_SECONDS = 8.0  # LocalQuestionGenerator falls back to the bank past this

# ── Question-bank fallback (Phase 7) ────────────────────────────────────────
# Reuses the same curated question set as a guaranteed-offline fallback source
# when the fine-tuned model is unavailable or produces invalid output.
QUESTION_BANK_PATH = RAW_DATASET_PATH
