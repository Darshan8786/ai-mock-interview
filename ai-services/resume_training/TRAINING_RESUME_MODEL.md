# Local resume-category classifier — training documentation

**Status: trained, evaluated, and wired into `ai-services`/`placement-prep-be`.** This is a small, honest classical-ML model, not an LLM — the investigation phase (below) found the data doesn't support anything bigger, and building an LLM fine-tune for a task classical ML handles just as well would have burned this machine's 4 GB VRAM budget for no benefit. No external AI API is used anywhere in this pipeline, at training or inference time.

---

## 1. Dataset information

Three Kaggle datasets were requested and investigated (`ai-services/resume_training/download_resume_datasets.py`, `inspect_resume_datasets.py` — see `data/reports/resume_dataset_report.json` and `dataset_usage_report.md` for the full findings):

| Dataset | Verdict | Why |
|---|---|---|
| `rhythmghai/resume-screening-dataset-200k-candidates` | **Excluded — no resume text** | 200,000 synthetic rows of pre-computed numbers/categories (`programming_languages` is a *count*, not language names). No free-text field anywhere. A synthetic hire/no-hire toy dataset, not a resume dataset. |
| `sonalshinde123/ai-driven-resume-screening-dataset` | **Excluded — no resume text** | Same problem: 30,000 synthetic rows, purely numeric/categorical, no text field. A synthetic shortlist/no-shortlist toy dataset. |
| `snehaanbhawal/resume-dataset` | **Used — the only real dataset** | 2,484 real resumes (`Resume_str`) + matching PDFs, labeled with a genuine 24-class `Category` (job field: IT, HR, TEACHER, ADVOCATE, ...). Clean: 0 missing values, near-zero duplication, healthy length distribution (median 757 words). |

**Cross-dataset finding worth restating:** none of the three datasets contain a job-description field. Resume↔JD matching and skill-gap training (two of the six tasks originally scoped) cannot be built from this data at all, from any of the three sets, regardless of preprocessing effort. Only **resume classification** (text → job category) is supported by real labels.

## 2. Dataset merging strategy — not applicable

Only one dataset had usable data, so there was nothing to merge. The other two are excluded from this project entirely rather than forced into use — see `dataset_usage_report.md` for the full reasoning.

## 3. Preprocessing

`prepare_dataset.py`:
1. **Exact-duplicate removal**: 2 duplicate-text groups collapsed to one copy each.
2. **Near-duplicate handling**: near-duplicates are detected on the *original* (pre-anonymization) text — anonymization masks names of different lengths, which shifts a bucketing fingerprint enough to hide a genuine near-duplicate pair if detection runs after anonymization. One real near-duplicate cluster (after exact-dedup) was forced into the **train** split only, so no near-duplicate pair ever crosses a split boundary.
3. **Stratified 80/10/10 split by `Category`**, so every one of the 24 classes (ranging from 22 to 120 examples) appears in train/val/test.

## 4. PII handling

`anonymize.py` runs on a **copy**; the original kagglehub-cached CSV is never modified (verified by asserting its file mtime is unchanged after the pipeline runs).

- Emails → `<EMAIL>`, phone-like patterns → `<PHONE>`, URLs → `<URL>` — regex-based, reliable.
- Candidate names → a **best-effort heuristic** (capitalized word sequences in the first line/first ~10 tokens, where resume headers typically put a name). This is *not* exhaustive — no NER library (e.g. spaCy) is installed, and one wasn't added solely for this, to avoid a heavy new dependency for a best-effort feature. Do not treat this as a guarantee that no name survives anonymization.
- PII was **not** used as a predictive feature — anonymization runs before vectorization/training specifically so TF-IDF can't pick up names/emails/phone numbers as spurious high-signal tokens for particular categories.

## 5. Training format

No JSONL instruction-format files were produced (that format is for LLM fine-tuning; this is classical ML). Instead: `data/processed/{train,val,test}.csv`, each with `Resume_str` (anonymized) and `Category`.

## 6. Model selection

`train_resume_classifier.py` trains **both** TF-IDF+Logistic Regression and TF-IDF+Linear SVM (both `class_weight="balanced"`, given class sizes ranging 22–120) and picks whichever scores higher macro-F1 on the validation split:

| Model | Val accuracy | Val macro-F1 |
|---|---|---|
| Logistic Regression | 0.6371 | 0.5807 |
| **Linear SVM (chosen)** | **0.6815** | **0.6228** |

Vectorizer: TF-IDF, word n-grams (1,2), `min_df=2`, `max_df=0.9`, `max_features=50000`.

`LinearSVC` doesn't natively produce calibrated probabilities — its raw decision-function margins pushed through an ad-hoc softmax gave badly uncalibrated confidences (0.05–0.12 range, barely above the 24-class uniform baseline of ~0.042). The chosen model wraps `LinearSVC` in `CalibratedClassifierCV` (cv=3) instead, which gives real, usable `predict_proba` output — confirmed separating correctly (0.43–0.74 confidence on correct test predictions vs. 0.12–0.29 on misses).

## 7. Hardware requirements

None beyond a normal Python environment — this is CPU-only classical ML, no GPU/VRAM needed at all. (The machine this was built on: i5-11320H, 7.79 GB RAM, RTX 3050 4 GB VRAM — the GPU was deliberately *not* used, since it isn't needed and the VRAM budget is better saved for the interview-question LLM.)

## 8. Installation

Uses `ai-services/venv` — `scikit-learn` and `joblib` are already in `ai-services/requirements.txt`. `kagglehub` and `pandas` were installed into that same venv for the dataset work (not a separate training venv, since this task never touches PyTorch/CUDA).

## 9. Running the pipeline

No CLI arguments — each script is self-contained and hardcodes its own input/output paths under `ai-services/resume_training/`. Run in order from `ai-services/`:

```bash
venv/Scripts/python.exe resume_training/download_resume_datasets.py
venv/Scripts/python.exe resume_training/inspect_resume_datasets.py
venv/Scripts/python.exe resume_training/anonymize.py
venv/Scripts/python.exe resume_training/prepare_dataset.py
venv/Scripts/python.exe resume_training/train_resume_classifier.py
venv/Scripts/python.exe resume_training/evaluate_resume_classifier.py
```

## 10. "Small test run" — not applicable in the way the original plan assumed

The original plan (written assuming an LLM fine-tune) called for a 100–500 record smoke test before full training. This model is classical ML on ~2,000 rows — training takes seconds, not hours, so there was no expensive full-training step to protect against; the train/val split itself serves the same "does this actually work before we trust it" purpose an LLM smoke test would.

## 11. Evaluation

`evaluate_resume_classifier.py`, run once against the held-out **test** split (never used for model selection):

| Metric | Value |
|---|---|
| Accuracy | 0.633 |
| Macro precision / recall / F1 | 0.625 / 0.599 / **0.599** |
| Weighted precision / recall / F1 | 0.644 / 0.633 / 0.626 |

Honest weak spots (small classes, expected given 22–120 examples/class over 24 classes): `BPO` (2 test examples, F1 0.00), `AGRICULTURE`/`ARTS`/`SALES` (F1 0.33–0.38). Strong classes (`AVIATION`, `ACCOUNTANT`, `AUTOMOBILE`) reach F1 0.71–0.82. Full per-class breakdown: `data/reports/resume_classifier_eval.json`; confusion matrix: `data/reports/resume_classifier_confusion_matrix.csv`.

Manual spot-check (via `inference.py`, real calls, not fixtures):
- "Certified public accountant... auditing, tax preparation..." → `ACCOUNTANT` (0.36 confidence) ✅
- "Registered nurse... ICU experience..." → `HEALTHCARE` (0.49 confidence) ✅
- "Licensed attorney... corporate law, litigation..." → `BUSINESS-DEVELOPMENT` (0.22 confidence) ❌ — a real miss illustrating the documented `ADVOCATE`-class weakness (F1 0.44), not a bug.

**Do not treat this model's output as authoritative** — it's a secondary, informational signal (see integration below), consistent with macro-F1 0.60 on a 24-way problem with limited training data per class.

## 12. Inference

`ai-services/resume_training/inference.py` — `classify_resume(text: str, top_k: int = 3) -> dict | None`. Lazy-loads the fitted vectorizer/model/class list once per process (same singleton pattern as `local_question_generator.py`/`resume_enhancer.py`). Returns `None` (never raises) if the model artifacts are missing, so any caller can fall back silently. Verified standalone (`python resume_training/inference.py`) and via a live HTTP round trip (below).

## 13. MindPrep integration

Reuses the existing architecture — no new/duplicate resume system:

```
Resume Upload (POST /resume/analyze)
      ↓
Existing local parser (localResumeParser.ts) — unchanged
      ↓
Existing local analyzer (localResumeAnalyzer.ts) — ATS score, skills, top_roles — unchanged
      ↓
NEW: classifyResumeCategory() → ai-services POST /classify-resume-category
      ↓ (additive only — never blocks or alters the above)
Response: { ..., analysis, liveJobs, predictedCategory }
```

- **`ai-services/server.py`**: new `POST /classify-resume-category` route (`X-AI-Service-Key` auth, same as every other endpoint), calling `resume_training/inference.py::classify_resume`. Returns `{"available": false}` (200, not an error) if the model isn't loaded, or `{"available": true, "category", "confidence", "top_3"}`.
- **`placement-prep-be/src/controllers/resumeController.ts`**: new `classifyResumeCategory()` helper, called from `analyzeResume` (`POST /resume/analyze`) alongside the existing live-jobs skill-gap call. Adds a `predictedCategory` field to the response (`null` if the classifier is unavailable for any reason — network error, ai-service down, model not loaded). **Never breaks or replaces `analysis.top_roles`** — that field stays exactly as it was, deterministic and tech-job-search-oriented; `predictedCategory` is a separate, broader (24-class, includes non-tech fields) signal.
- **Fallback chain, per the project's local-AI conventions**: local classifier → (on any failure) → `predictedCategory: null`, and the rest of the response is entirely unaffected. There is no external-API fallback anywhere in this chain — unlike some other MindPrep features, this one simply omits the field if the local model isn't available, rather than ever calling out to a paid provider.

**Verified end-to-end, not just unit-tested:** ran a live Flask instance and called `/classify-resume-category` directly (real classification returned, 400 on missing text, 401 on missing auth key), then ran the exact Node `axios` call from `resumeController.ts` against that live instance and got a real category back through the full contract.

## 14. Troubleshooting

| Problem | Fix |
|---|---|
| `predictedCategory` is always `null` | Check `ai-services` logs for `resume_training/inference.py` load errors — likely `models/resume_classifier/*.joblib` files are missing (re-run the training pipeline, step 9) |
| Retraining changes the chosen model unexpectedly | `meta.json` records which model won and why (`chosen_model`, both models' validation scores) — check it after retraining if results look different than before |
| Want better accuracy on small classes (e.g. `BPO`, `AGRICULTURE`) | The dataset genuinely only has 22–30 examples for these classes; more data for those specific categories would help more than model tuning |
| `ModuleNotFoundError: kagglehub` or `pandas` | Both were installed into `ai-services/venv` specifically for this pipeline — run `venv/Scripts/pip install kagglehub pandas` if missing |
