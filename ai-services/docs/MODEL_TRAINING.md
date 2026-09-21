# Local Interview-Question Generator

This document describes the fully local (no external LLM API key) question-generation
system that replaced the Groq / OpenAI / Gemini calls previously used for mock-interview
technical questions.

All commands below are run **from the `ai-services/` directory**, using the project's
existing Python virtual environment (`../venv` relative to `ai-services/`, or your own venv
with `ai-services/requirements.txt` installed).

## 1. Dataset creation

The dataset is hand-curated, not scraped or LLM-generated, so it stays small and
high-quality instead of padded with near-duplicate filler. `training/build_raw_dataset.py`
contains a Python dict (`RAW_QUESTIONS`) of `skill -> topic -> difficulty -> [questions]`,
covering all 15 required skills (Python, Java, C, C++, JavaScript, SQL, DBMS, OOP, Data
Structures, Algorithms, Computer Networks, Operating Systems, Machine Learning, Artificial
Intelligence, Web Development), 5 topics per skill, 3 difficulty levels per topic, 3
questions per cell -> **675 hand-written questions**.

Run it to (re)generate the raw dataset JSON:

```
python training/build_raw_dataset.py
```

Writes `training/data/interview_questions/raw_dataset.json`.

## 2. Dataset format

Each raw record:

```json
{
  "skill": "Python",
  "topic": "Functions",
  "difficulty": "Medium",
  "question_type": "conceptual",
  "question": "Explain the difference between a normal function and a lambda function in Python."
}
```

`question_type` is auto-classified (`conceptual` / `scenario` / `practical`) from the
question's phrasing in `build_raw_dataset.py::classify_question_type`.

After `prepare_dataset.py` runs, each record becomes an instruction/output training
example:

```json
{
  "skill": "Python", "topic": "Functions", "difficulty": "Medium",
  "question_type": "conceptual", "level": "Fresher",
  "prompt": "### Instruction:\nGenerate a Medium-level Python interview question about Functions for a Fresher.\n\n### Question:\n",
  "completion": "Explain the difference between a normal function and a lambda function in Python."
}
```

Four different instruction phrasings (`config.INSTRUCTION_TEMPLATES`) are assigned
deterministically (seeded RNG) across records so the model generalizes over instruction
wording rather than memorizing one exact template.

## 3. Data preprocessing (`training/prepare_dataset.py`)

```
python training/prepare_dataset.py
```

Steps performed:
1. **Validation** - rejects records missing any required field, or with a question that's
   too short/long or malformed.
2. **Difficulty normalization** - maps aliases (`beginner`, `basic`, `advanced`, `expert`,
   etc.) onto the canonical `Easy` / `Medium` / `Hard`.
3. **Exact-duplicate removal** - via a normalized (lowercased, punctuation-stripped) key.
4. **Near-duplicate removal** - `difflib.SequenceMatcher` ratio >= 0.90, checked within each
   `(skill, topic)` bucket (kept out of the whole-dataset O(n^2) comparison for speed).
5. **Instruction-example construction** with a randomly (seeded) assigned candidate level
   (`Fresher` / `Intermediate` / `Experienced`) and instruction phrasing.
6. **Train/val split** - 88/12, shuffled with a fixed seed (`config.SEED = 42`).
7. **Statistics report** - written to `dataset_stats.json` and `dataset_stats.txt`.

Last run on this machine: **675 raw -> 671 clean -> 591 train / 80 val** (1 exact
duplicate + 3 near-duplicates were caught and dropped - see `dataset_stats.txt`).

## 4. Model selected and why

**Hardware inspected on this machine before choosing a model:**

| Resource | Value |
|---|---|
| CPU | Intel Core i5-11320H, 4 cores / 8 threads |
| RAM | 7.79 GB total - observed as low as **0.43 GB free** with normal apps (browser, IDE, Claude Code) open |
| GPU | NVIDIA RTX 3050 Laptop, 4 GB VRAM |
| PyTorch | CPU-only build installed (no CUDA torch); driver supports CUDA 12.0 |
| Disk | 129 GB free |

Given the RAM was frequently near-exhausted even before starting any ML workload, a large
LLM (even a "small" 1-3B instruct model run in 4-bit) was judged too risky - either it would
fail to load, or it would force heavy swapping and could freeze the machine while other
apps (including the active Claude Code session) were open. This tradeoff was confirmed with
the user directly rather than assumed.

**Model chosen: [`distilgpt2`](https://huggingface.co/distilgpt2) (82M parameters).**
- Small enough to fully fine-tune (no quantization, no LoRA needed) within the available
  RAM, without needing the user to close other applications.
- A real causal language model (distilled GPT-2), not a toy - after supervised fine-tuning
  on the 591-example instruction dataset it reliably produces skill/topic/difficulty-
  conditioned questions (see `training/eval_results/`).
- No download of a multi-gigabyte model; the base checkpoint is ~330MB.

This is a deliberate, hardware-matched choice, not a compromise hidden from the user - a
larger instruction-tuned model (e.g. `Qwen2.5-0.5B-Instruct` with LoRA) would likely produce
higher-quality questions and is wired up as a config-level option (see below) for anyone
running this on a machine with more free RAM.

## 5. Fine-tuning method

**Full fine-tuning** (all 82M parameters), not LoRA/QLoRA, because:
- The model is already small enough that full fine-tuning fits in the available RAM budget.
- LoRA exists in the pipeline as an opt-in (`config.USE_LORA = True` and pass `--use-lora` to
  `train.py`) for anyone re-running this on a larger base model, but forcing LoRA onto an
  82M model adds complexity and a `peft` dependency for no real memory benefit.

Training runs on CPU (`torch.cuda.is_available()` is `False` on this machine since the
installed PyTorch build has no CUDA support). `train.py` auto-detects CUDA and will use the
GPU automatically if a CUDA-enabled torch build is installed later.

## 6. Training configuration (`training/config.py`)

| Parameter | Value | Notes |
|---|---|---|
| Base model | `distilgpt2` | |
| Max sequence length | 128 tokens | Prompts + questions are short |
| Epochs | 6 | With early stopping |
| Train batch size | 4 | Per-device |
| Gradient accumulation | 4 | Effective batch size 16 |
| Learning rate | 5e-5 | AdamW (Trainer default optimizer) |
| Weight decay | 0.01 | |
| Warmup steps | 20 | |
| Eval / save strategy | every epoch | `load_best_model_at_end=True`, metric = `eval_loss` |
| Early stopping patience | 2 epochs | Via `EarlyStoppingCallback` |
| Seed | 42 | Used for dataset split, RNG, and `transformers.set_seed` |

Labels are masked (`-100`) over the instruction/prompt tokens so the loss only trains the
model to predict the question text itself, not to reproduce the instruction.

## 7. How to train

```
python training/prepare_dataset.py      # writes train.jsonl / val.jsonl / stats
python training/train.py                # full run, ~35-45 min on this CPU
```

Useful flags on `train.py`:

```
python training/train.py --epochs 3 --batch-size 2 --lr 3e-5
python training/train.py --max-steps 3 --epochs 1   # fast smoke test, does not overwrite a good model meaningfully
python training/train.py --use-lora --base-model Qwen/Qwen2.5-0.5B-Instruct   # larger machine
```

Output: the fine-tuned model (weights + tokenizer + `training_metadata.json` with the
actual measured train/eval loss and wall-clock time) is written to
`../models/interview-question-generator/` (i.e. `ai-services/models/interview-question-generator/`).
Checkpoints during training live in `training/checkpoints/` (kept to the 2 most recent,
`config.SAVE_TOTAL_LIMIT`).

**No training result is ever fabricated** - `training_metadata.json` records the metrics
`Trainer` actually returned; if a run is interrupted before the model is saved, there is no
model directory (or the previous one is left untouched) and this is visible directly on
disk.

## 8. How to evaluate

```
python training/evaluate.py
```

Runs the model (through the same `LocalQuestionGenerator` the application uses, so the
real fallback path is exercised too) over the validation set and over 9 fixed showcase
combinations (Python/Easy, Python/Medium, Python/Hard, SQL/Easy, SQL/Medium, DBMS/Medium,
Data Structures/Hard, Machine Learning/Medium, Java/Medium). Reports:

- non-empty rate, reasonable-length rate, invalid-output rate
- skill/topic keyword relevance rate (heuristic keyword-overlap check - there is no offline
  ground-truth classifier for "is this really about topic X", so this is documented as an
  approximation, not fabricated as exact)
- duplicate rate across the generated batch
- source used per question (`model` vs `bank` fallback)
- average generation latency

Results are written to `training/eval_results/evaluation_results.json` and `.txt`.

**On the 3-way comparison requested (API vs bank vs fine-tuned model):** this repository
does not persist any historical Groq/OpenAI/Gemini output anywhere accessible offline
(interview questions are stored per-user in MongoDB behind live credentials, and no
sample-output fixture exists in the repo). The evaluation report is honest about this: the
"external API" column is marked `not available` rather than invented. The bank-vs-model
comparison is real and included for every showcase case.

## 9. How to generate questions locally

```
python inference/generate_question.py --skill Python --topic Functions --difficulty Medium --level Fresher
python inference/generate_question.py --skill SQL --topic Joins --difficulty Easy --level Fresher --verbose
```

With `--verbose`, also prints the source (`model` or `bank`), model load time, and
generation time. Without it, prints only the question text (for scripting).

## 10. How to integrate with the application

```
Candidate skills (User.skills / resume)
        |
        v
Node.js: mockInterviewController.generateQuestionsForInterview()
        | POST /generate-questions  (AI_SERVICE_URL, Flask, ai-services/server.py)
        v
Python: interview_question_service.generate_questions()
        |  Technical  -> LocalQuestionGenerator.generate_question() per question
        |  HR/Behavioral -> static curated pools (no LLM needed either way)
        v
LocalQuestionGenerator (ai-services/local_question_generator.py)
        |  loads models/interview-question-generator/ ONCE, reused for every request
        v
Generated question -> Node persists to Interview.questions -> Mock Interview UI
```

- `LocalQuestionGenerator` (singleton, `local_question_generator.get_generator()`) is the
  `LocalQuestionGenerator` class requested by the spec; call
  `generator.generate_question(skill, topic, difficulty, candidate_level, resume_skills=..., exclude_questions=...)`.
- The Flask app (`server.py`) starts loading the model in a background thread at process
  startup (`threading.Thread(..., daemon=True).start()`), so the first real interview
  request doesn't pay the load cost, and the model is loaded once and reused for the life
  of the process (Phase 11).
- `GET /model-status` reports whether the model is loaded, any load error, and load time -
  useful for ops/debugging without needing an API key.
- The frontend never talks to the model directly - only the existing Node backend does,
  through the existing `AI_SERVICE_URL` Flask call. No new frontend code was added.
- Resume skills: `User.skills` (already populated by the existing resume-parsing feature)
  is passed through `createInterview` / `regenerateQuestions` -> `resumeSkills` in the
  `/generate-questions` payload -> used to bias which skill/topic combinations are asked
  about (see `interview_question_service.RESUME_SKILL_ALIASES`).

## 11. How fallback works

Three independent layers, each able to fail without external API calls anywhere:

1. **Model generation** (`LocalQuestionGenerator.generate_question`) - runs in a worker
   thread with an 8-second timeout (`config.GENERATION_TIMEOUT_SECONDS`). Any exception,
   timeout, or invalid output (empty, too short/long, or a duplicate of an
   already-asked question) triggers a retry (up to `max_retries=3`), then falls through.
2. **Local question bank** (`QuestionBank`, backed by the same curated
   `raw_dataset.json`) - tries an exact `(skill, topic, difficulty)` match, then
   `(skill, topic)`, then `skill`, then the whole bank; always excludes already-asked
   questions where possible.
3. **Node-side static bank** (`placement-prep-be/src/data/interviewQuestionBank.ts`,
   pre-existing) - if the whole Python `ai-service` call fails, times out
   (`QUESTION_DEADLINE_MS = 14s`), or is unreachable, `generateFallbackQuestions()` in
   `mockInterviewController.ts` serves questions from this bank instead. This was already
   in place before this change and required no modification.

At no point does any of this call Groq, OpenAI, Gemini, or NVIDIA NIM for question
generation. (HR/Behavioral question generation, and the separate answer-evaluation /
feedback endpoints, are out of scope for this change and are documented as such - see the
integration report for exactly what was left untouched.)

## 12. How to add new training data

Edit `training/build_raw_dataset.py`:
- To add a topic to an existing skill, add a new key under that skill's dict with
  `Easy` / `Medium` / `Hard` lists of real questions.
- To add a new skill, add a new top-level key following the same
  `{topic: {difficulty: [questions, ...]}}` shape.
- Keep questions specific and non-duplicate - `prepare_dataset.py` will reject exact and
  near-duplicates automatically, but quality still depends on what you write.

Then re-run:

```
python training/build_raw_dataset.py
python training/prepare_dataset.py
```

Check `training/data/interview_questions/dataset_stats.txt` to confirm the new
questions/topics/skills show up with the expected counts before retraining.

## 13. How to retrain the model

```
python training/prepare_dataset.py
python training/train.py
python training/evaluate.py
```

Retraining overwrites `models/interview-question-generator/` only after a full successful
`Trainer.save_model()` call. If training crashes partway, the previous model directory (if
any) is left untouched, since the save only happens at the end of `train.py::main()`.

## Performance measurement

```
python training/measure_performance.py
```

Measures (fresh process, so load time is not pre-warmed): model load time, RSS memory
before/after load, GPU memory if CUDA is available, and generation latency (min/max/mean/
median) over 10 sample skill/topic/difficulty combinations. Written to
`training/eval_results/performance_report.json`.

## 14. Hardware requirements

**To run inference only** (no training): ~1-2 GB free RAM, any modern CPU, no GPU
required. Model directory is ~320 MB on disk.

**To retrain from scratch on this dataset size (~670 examples) with the default
`distilgpt2` config:** ~2-3 GB free RAM, CPU-only is fine (~35-45 minutes for 6 epochs on
a 4-core/8-thread laptop CPU). A GPU is not required but will be used automatically if a
CUDA-enabled PyTorch build is installed (`torch.cuda.is_available()`).

**To use the optional larger-model path** (`Qwen2.5-0.5B-Instruct` + LoRA, via
`--use-lora --base-model Qwen/Qwen2.5-0.5B-Instruct`): recommend at least 4 GB free RAM
(or a GPU with >=4 GB free VRAM) - this was the option explicitly declined for the initial
training run on this machine due to RAM pressure, and is left in the pipeline for a
better-resourced machine or CI runner.
