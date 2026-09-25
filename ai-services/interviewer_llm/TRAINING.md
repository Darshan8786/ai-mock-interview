# Local interview-question LLM — training documentation

A small language model, fine-tuned **entirely on this machine**, generates the technical interview questions for
MindPrep AI's mock-interview feature. No OpenAI, Gemini, Claude, Groq, or NVIDIA NIM API is used anywhere in this
pipeline or at inference time — training and serving both run on local weights, with an all-local fallback chain
if the model is ever unavailable.

## 1. Dataset

**Source**: Kaggle [`syedmharis/software-engineering-interview-questions-dataset`](https://www.kaggle.com/datasets/syedmharis/software-engineering-interview-questions-dataset)
(200 rows: `Category`, `Question`, `Answer`, `Difficulty`), downloaded once with `training/download_dataset.py` via
`kagglehub` and never re-uploaded or modified. Merged with the 900 curated interview questions already in the
MindPrep repo (`training/data/interview_questions/raw_dataset.json`, no answers, no difficulty noise) to reach a
usable size and topic spread — the Kaggle set alone has only ~170 unique, difficulty-noisy questions, too few to
fine-tune a generator that has to cover ~20 topics at 3 difficulty levels.

`training/inspect_dataset.py` produced `data/reports/dataset_inspection.{txt,json}` (format, column roles, missing
values, duplicates, distributions) before any cleaning decision was made.

## 2. Cleaning (`training/clean_dataset.py`)

| step | result |
|---|---|
| dropped (empty / <15 chars / <4 words / >400 chars) | 1 |
| exact-duplicate copies merged (kept an answer if any copy had one; difficulty set to `null` on majority disagreement) | 50 |
| **unique questions kept** | **1049** |
| — with a reference answer (Kaggle pairs) | 174 |
| — curated only / Kaggle only / both | 875 / 170 / 4 |
| difficulty: Easy / Medium / Hard / unknown | 289 / 379 / 371 / 10 |

Output: `data/processed/interview_cleaned.jsonl` (+ `interview_removed.jsonl`, `data/reports/cleaning_report.{txt,json}`).

**Known data limitations** (read the metrics in section 6 with these in mind):
- Difficulty labels are noisy (10 records had disagreeing copies and are left unlabeled rather than guessed).
- Role is not a column in the source data; the prompt's `Role:` field is a **heuristic** mapping from topic to
  role (`training/common.py::ROLE_MAP`), not a ground-truth label.
- SDLC/Agile, OOP-as-a-topic and some System Design subtopics are thin (a handful of examples each).

## 3–4. Instruction format + 80/10/10 split (`training/prepare_splits.py`)

Two task types, tagged `task` in every example:
- **`qgen`** — `"Generate a software engineering interview question."` + `Role / Topic / Subtopic / Difficulty / Type`
  → the question. Training uses **2 randomly-varied prompts per question** (fields dropped ~50/75% of the time) so
  the model also answers a caller that supplies only a topic, or only a role + topic. Validation/test use **one
  fixed, fully-specified prompt** per record, so runs are comparable.
- **`qa`** — `"Answer the following software engineering interview question."` + the question → the reference
  answer. Only for the 174 Kaggle records that have one.

**Split unit is the near-duplicate cluster**, not the individual question — so two paraphrases of the same
question can never land in different splits — stratified by topic to ~80/10/10. A leakage check
(`check_no_leakage`) re-scans every cross-split pair for exact **or** near-duplicate questions and fails the split
if any are found (it passed). `test.jsonl` is then locked: `SPLIT_MANIFEST.json` stores its sha256, and both
`train.py` and `evaluate.py` refuse to run if that hash ever changes, so the test set cannot be trained on or
silently edited.

| split | records | qgen examples | qa examples |
|---|---|---|---|
| train | 836 | 1672 | 139 |
| validation | 107 | 107 | 16 |
| test (locked) | 106 | 106 | 19 |

## 5. Hardware & base-model choice

This machine: Intel i5-11320H, 7.8 GB RAM, **NVIDIA RTX 3050 Laptop, 4 GB VRAM**, driver 529.04 (CUDA 12.0).

- `Qwen/Qwen2.5-0.5B-Instruct` was chosen as the base model — small enough to fine-tune *and serve* inside the 4 GB
  VRAM budget (or on CPU, for the Flask service's non-CUDA venv), while still an instruction-tuned chat model so
  the existing prompt format (system + user + assistant, via its chat template) works out of the box.
- **GPU/driver compatibility issue, diagnosed and fixed**: the default PyTorch wheel (`torch==2.14.0+cu126`)
  installed and reported `cuda.is_available() == True`, but every CUDA context on this driver failed with
  `CUDA error: CUDA-capable device(s) is/are busy or unavailable`. A raw `ctypes` probe against `nvcuda.dll`
  confirmed the GPU and driver themselves were fine (`cuCtxCreate` succeeded, 3.24/4.00 GiB free) — the problem was
  specifically PyTorch's CUDA 12.6 runtime being incompatible with a CUDA-12.0 driver. Fix: a **separate** Python
  3.12 virtual environment (`.venv312/`, created with `uv`, kept alongside the original `.venv/` — nothing in the
  original environment was touched) with `torch==2.7.1+cu118`, which the same driver runs without error. All
  training commands below use `.venv312`.
- 4-bit NF4 QLoRA hit `CUDA out of memory` at the default micro-batch (4, grad-accum 4) on this 4 GB card, because
  bitsandbytes' own overhead on top of a mostly-idle 4 GB budget left too little headroom. Plain **bf16 + LoRA**
  (no quantization) at micro-batch 2 / grad-accum 8 uses only ~1.4 GB peak VRAM for this model size and was used
  for both the smoke test and full training — simpler and, for a 0.5B model, unnecessary to quantize at all.

## 6. Method

- **LoRA** (r=16, alpha=32, dropout=0.05, all linear layers), via HF `peft`, on top of the frozen base weights —
  ~8.8M trainable parameters (≈1.8% of the 0.49B total).
- **HF `Trainer`** (not TRL) — chosen for API stability; a `Collator` left-pads nothing, right-pads per batch, and
  **masks the prompt tokens with `label = -100`** so loss is computed only on the assistant's answer, never on the
  system/user turns it was given.
- Prompting is identical across training, evaluation and inference (`training/prompting.py`, imported by all
  three) — the exact same `SYSTEM_PROMPTS`, instruction strings and field order are used everywhere, so what the
  model was trained on is what it is asked at serve time.
- Early stopping on validation loss (patience 2, evaluated once per epoch, best checkpoint restored at the end).
- `train.py --smoke` (160/40 train/val examples, 1 epoch, 12 steps) is required to pass **before** a full run —
  this is enforced by convention (the spec's FINAL RULE), not by the script; it was run and inspected first.

Command used for the full run:
```bash
# from ai-services/interviewer_llm, using the CUDA-compatible venv
python training/train.py --no-4bit --batch-size 2 --grad-accum 8 \
    --final-dir models/software-engineering-interviewer
```
Outputs: `outputs/<run-name>/adapter` (every run, timestamped) **and** a copy at
`models/software-engineering-interviewer/adapter` + `training_info.json` (base model name, quantization flag,
final metrics) — the copy `inference.py` and the Flask service actually load.

`training/export_merged.py` optionally merges the adapter into the base weights (`models/.../merged/`, fp16
safetensors) so the model loads with plain `transformers` — no `peft`/`bitsandbytes` needed at serve time, which
matters because the Flask service's own venv (`ai-services/venv/`) does not have those packages installed.

## 7. Evaluation (`training/evaluate.py`)

Run against the **locked test split only**, hash-verified against the manifest before anything executes.

| metric | what it measures |
|---|---|
| `valid_rate` | fraction of sampled questions that pass `question_validator` (format, length, no leaked prompt/answer text, no repetition/rambling, on-topic) — the same gate used in production |
| `on_topic_rate` | passes specifically the topic-vocabulary check (topics with too little training vocabulary are excluded from this one, since the check can't be trusted for them) |
| `distinct_rate` | uniqueness among K samples per prompt (no server-side duplicate collapse) |
| `novel_rate` | not a near-copy of any **training** question (low = memorizing, not generating) |
| `matches_reference` | near-copy of the held-out reference question (informational — a hit is a bonus, not a requirement) |
| `difficulty_match` | a TF-IDF+LogisticRegression classifier (trained on `train.jsonl` questions) predicts the requested difficulty from the generated text; scored against the **same classifier's own accuracy on real test questions** as a ceiling, because the source difficulty labels are themselves noisy |
| `answers.token_f1` / `answers.rouge_l` | word-overlap / longest-common-subsequence overlap between a generated answer and the reference answer, for the 19 `qa` test pairs |

Hallucination for **questions** is operationalised as "fails validation" (off-topic, leaked template text,
repetition); for **answers**, only overlap with the reference is measured automatically — the report also writes
out generated samples (`outputs/eval/eval_<tag>_<split>.json`) for a human to read, since correctness of a free-text
technical answer can't be fully automated.

```bash
python training/evaluate.py                 # fine-tuned model
python training/evaluate.py --no-adapter     # base model, same prompts — baseline for comparison
```

## 8. Inference (`inference.py`)

```bash
python -m interviewer_llm.inference --topic SQL --difficulty Medium --count 5
python -m interviewer_llm.inference --role "Backend Developer" --count 5     # topics chosen from the role
```

`InterviewerLLM.generate_question()` / `.generate_questions()`:
1. Samples a batch of candidates from the model.
2. Runs each through `question_validator.validate_question()` (topic, format, duplicate checks against whatever
   the caller has already shown).
3. Retries (re-samples) on a bad candidate; after `max_retries` batches, falls back to the **verified local
   question bank** (`data/processed/interview_cleaned.jsonl` — the same cleaned dataset the model was trained on)
   filtered by topic/difficulty.
4. Never raises — a missing model directory, a CUDA error, or a generation timeout all degrade to the bank rather
   than breaking an interview.

## 9. MindPrep integration

The Flask AI service's existing fallback chain (`local_question_generator.py` → `interview_question_service.py`,
called from `server.py`'s `/generate-questions`) gained **one new first link**, everything after it unchanged:

```
fine-tuned interviewer LLM  →  original small local model (Phase 11)  →  offline question bank (Phase 7)  →  rule-based sentence
```

- `LocalQuestionGenerator.interviewer()` lazily constructs an `InterviewerLLM`; `warm_interviewer()` is called
  once, in a background thread, at process start (`server.py`), so the first real request doesn't pay the load
  cost — exactly like the existing small-model warm-up already did.
- The new model is only used for a request if it is **already loaded** (`llm.loaded`) — a slow/failed load never
  blocks or breaks a request; it just means this request falls through to the next link, same as any other
  failure.
- `job_role` (previously unused for question selection) is now passed through as the prompt's `Role:` field.
- The **global cross-user history store** (`question_history_store.py`, SQLite-backed, Rule 5/6 of the original
  mock-interview spec) is checked **inside** the model's own retry loop via a `reject_if` callback, so a
  history-duplicate triggers an immediate re-sample instead of a wasted round trip.
- `GET /model-status` now also reports `interviewer_llm: {enabled, trained_model_present, loaded, device,
  load_error, load_ms}`.
- `INTERVIEWER_LLM=off` (env var) disables the new step entirely and restores the exact pre-existing behaviour —
  used for a quick A/B or if the new model ever needs to be pulled out without a deploy.
- Nothing existing was deleted: the Phase 11 small model, the Phase 7 question bank, and the rule-based final
  fallback are all still in the chain, in the same order they were before.

## 10. Question validation (`question_validator.py`)

Pure Python, no ML dependency — shared by `inference.py`, the MindPrep integration, and `evaluate.py`, so the
production gate and the reported metric are the same code. Rejects: empty, too short/long, invalid format (not a
question or imperative task), leaked prompt/answer/template text, rambling (multiple questions), word-level
repetition, off-topic (no shared vocabulary with the topic — only enforced for topics with ≥10 known keywords,
built once from the **train** split by `training/build_topic_vocab.py`), and exact/near duplicates against a
caller-supplied exclude list. Verified against 1049 real cleaned questions (6.3% false-reject rate, entirely
`off_topic` cases on real questions using unusually generic wording for their topic, e.g. "Explain the concept of
recursion." tagged Data Structures) and a battery of deliberately-broken inputs (empty, leaked answers, repeated
phrases, off-topic content) — all correctly rejected.

## 11. What was NOT done (by design, per the original spec)

- No external AI API of any kind, at any step.
- The original Kaggle CSV was never modified or re-uploaded; only cleaned copies were written under
  `data/processed/`.
- No second, independent interview system — this plugs into the existing `/generate-questions` endpoint and
  `interview_question_service.py`, HR/Behavioral/Resume question generation is untouched.
- Full training was not started before the smoke test passed and was reviewed.
