# Local AI Migration — Audit (Phase 1)

**Status: audit only. No source files were modified to produce this document.**

This audit covers all four services (`MindPrepAI-FE`, `placement-prep-be`, `placement-admin-be`, `ai-services`) and records every external-AI-provider touchpoint found by searching for the target env vars, SDK imports, and call sites. It is the required input to Phases 2+ of the local-AI migration; nothing here changes behavior.

---

## 1. Headline finding

**The Python side (`ai-services`) is already almost entirely local.** Mock-interview question generation, HR/behavioral question selection, resume-based question generation, answer evaluation, and resume content enhancement all run through locally fine-tuned models / deterministic logic with **zero external AI API calls** — this migration already happened there (see `interview_question_service.py`'s own docstring: *"replaces the old Groq / NVIDIA NIM / Ollama LLM-API chain... with the locally fine-tuned model"*, and `local_answer_evaluator.py`: *"No external AI API (Groq, OpenAI, Gemini, Anthropic, NVIDIA NIM, HuggingFace...)"*). `nim_service.py`, mentioned in the root README, **no longer exists in the repo** — it was already removed.

**Remaining external AI dependencies live almost entirely in `placement-prep-be` (the Node backend)**, in a small, isolated set of files — good news for how surgical Phase 2–4 can be.

**Most important/surprising finding:** `placement-prep-be/src/controllers/aiControllers/voiceEvaluationController.ts` hardcodes a `new OpenAI(...)` client and calls Whisper (`whisper-1`) + `gpt-4o-mini` directly, with **no local fallback at all** — but it is **dead code**: grepping every `routes/*.ts` file shows it is never imported or mounted, so none of its exported functions (`evaluateRoleAnswer`, `evaluateCompanyAnswer`, `evaluateSubjectAnswer`, `finalizeRoleInterview`, etc.) are reachable via the live API today. It's a landmine, not an active dependency — flag for removal or explicit gating in Phase 14, not urgent for Phase 2/3.

Second finding worth noting: `@langchain/groq`, `@langchain/openai`, and `@langchain/community` are declared as npm dependencies in `placement-prep-be/package.json` but **no source file imports them** — they appear to be unused/vestigial dependencies already, independent of this migration.

---

## 2. Startup-blocking dependency (Phase 2 target)

`placement-prep-be/src/config/env.ts:20-35`:

```ts
const required: (keyof EnvConfig)[] = [
  "MONGO_URI",
  "PINECONE_API_KEY",
  "GEMINI_API_KEY",
];
required.forEach((key) => {
  if (!process.env[key]) missing.push(key);
});
if (missing.length > 0) {
  console.error(`❌ CRITICAL: Missing Environment Variables: ${missing.join(", ")}`);
  process.exit(1);
}
```

- Confirmed exact lines: **22–26** (the required list) and **32–35** (the `process.exit(1)`).
- This is the **only** place startup is blocked — `config/gemini.ts` and `config/pinecone.ts` construct their SDK clients unconditionally at module load (`new GoogleGenerativeAI(env.GEMINI_API_KEY)`, `new Pinecone({ apiKey: env.PINECONE_API_KEY })`), but neither SDK constructor makes a network call or validates the key synchronously, so they would not themselves crash the process if `env.ts`'s explicit check were relaxed — the `process.exit(1)` in `env.ts` is the sole blocker.
- `JWT_SECRET` is **not** in the required list — it already has a fallback default (`"fallback-secret-change-me"`, line 50), contrary to the general assumption that it's hard-required. (Worth fixing separately — a fallback secret is a security smell — but out of scope for this AI-migration audit.)
- `AI_SERVICE_URL` also already has a safe default (`http://localhost:5001`, line 51) and is not in the required list.
- Two env vars already exist for a **local** embedding path: `OLLAMA_URL` (default `http://localhost:11434`) and `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`) — see §4.

**Phase 2 implication:** removing `PINECONE_API_KEY` and `GEMINI_API_KEY` from the `required` array in `env.ts` is sufficient to unblock startup. No other file enforces these at boot.

---

## 3. Full external-AI call-site table

| # | File | Function / Route | Purpose | External dependency | Current fallback | Proposed local replacement | Startup-required? |
|---|---|---|---|---|---|---|---|
| 1 | `placement-prep-be/src/config/gemini.ts:1-6` | Module init (`geminiModel`) | Instantiates Gemini `gemini-1.5-flash` client | `@google/generative-ai`, `GEMINI_API_KEY` | none (throws if key invalid at call time, not at init) | N/A (client construction) — see #2 for actual usage | **Yes**, via `env.ts` |
| 2 | `placement-prep-be/src/services/aiService.ts:5-21` (`generateQuestion`) | Called only by `questionController.ts::createAIQuestion` → `POST /api/v1/questions/generate` | Generates one AI quiz question (topic+difficulty → JSON question/answer) | Gemini | **None** — throws `AppError` on failure | Route to `ai-services` Flask `/generate-questions` (already used by the mock-interview path) or a new lightweight local generator using the existing `interviewer_llm` model / the static aptitude/tech question banks | No (only hit when this specific route is called) |
| 3 | `placement-prep-be/src/config/pinecone.ts:1-11` | Module init (`index`) | Pinecone client + default index handle | `@pinecone-database/pinecone`, `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` | none | See §4 (FAISS/Chroma) | **Yes**, via `env.ts` |
| 4 | `placement-prep-be/src/services/pineconeService.ts:4-29` (`upsertVector`, `queryVectors`) | Used by `questionController.ts` (`createAIQuestion`, `searchQuestions` → `POST /questions/generate`, `POST /questions/search`) | Vector upsert/query for the quiz-question RAG feature | Pinecone (storage only — vectors are embedded locally, see #6) | **None** — throws `AppError` | Local vector store (FAISS/Chroma) — see §4 | No |
| 5 | `placement-prep-be/src/services/interviewRagService.ts:1-96` (`syncInterviewToVectorDB`, `getInterviewContext`) | Called from mock-interview flow to store/retrieve past-performance context | Pinecone (storage only) | **Already graceful**: both functions wrap in `try/catch` and log-and-continue (`getInterviewContext` returns `""` on any failure, including a 3s internal timeout) | Local vector store (FAISS/Chroma) | No |
| 6 | `placement-prep-be/src/services/embeddingService.ts:1-29` (`embedText`) | Used by `aiService.ts::getEmbedding`, `interviewRagService.ts` | Generates the embedding vector itself | **Already local** — calls a local Ollama server (`OLLAMA_URL`, default `http://localhost:11434`, model `nomic-embed-text`) | Throws if Ollama isn't running — no fallback to a remote embedding API today (good: it never silently calls an external one) | Already local; only remaining risk is "Ollama not installed/running" — could bundle `sentence-transformers` as an in-process alternative so no separate server is required | No |
| 7 | `placement-prep-be/src/controllers/aiControllers/voiceEvaluationController.ts:1-333` | `evaluateRoleAnswer`, `evaluateCompanyAnswer`, `evaluateSubjectAnswer`, `finalizeRoleInterview`, `finalizeCompanyInterview`, `finalizeSubjectInterview` | Voice-answer transcription (Whisper) + LLM scoring (GPT-4o-mini) for an apparent legacy "role/company/subject" interview mode | `openai` SDK, `OPENAI_API_KEY` | **None** | **Not currently reachable — no route file imports this controller.** If ever wired up: swap Whisper → local speech-to-text (Phase 10), GPT scoring → `ai-services`' local answer evaluator | No (dead code, unrouted) |
| 8 | `placement-prep-be/src/scripts/generateAptitudeQuestions.ts:3,17,19,59` | One-off CLI script (`npm run gen:aptitude`), not part of the running server | Bulk-generates aptitude question bank content offline | Groq, via the OpenAI SDK pointed at `https://api.groq.com/openai/v1` | **None** (script fails if key missing) | Route through the same local `interviewer_llm`/question-bank generation approach, or accept this stays an offline authoring tool with an optional external key (it never runs at request time) | No (dev-time script only) |
| 9 | `ai-services/interview_question_service.py` (all functions) | `generate_questions()` — the single entry point `server.py` calls for `/generate-questions` | Mock-interview + resume-based + HR/behavioral question generation | **Already local** (`local_question_generator.py` / `LocalQuestionGenerator`, offline question bank fallback) | N/A — already the target state | N/A | No |
| 10 | `ai-services/local_answer_evaluator.py` | Backs `/evaluate-answer`, `/generate-feedback` | Interview answer scoring | **Already local** (keyword/concept matching + local logic per its own docstring) | N/A | N/A | No |
| 11 | `ai-services/resume_enhancer.py` | Backs `/enhance-resume-content` | Resume content improvement | **Already local** — loads a Hugging Face `AutoModelForCausalLM` via `transformers`/`torch` directly, no HTTP call to any provider | N/A | N/A | No |
| 12 | `ai-services/server.py` | Various route handlers | Only references to Groq/OpenAI/Gemini/NIM found are **comments explaining their removal** (e.g. "no Groq/OpenAI/Gemini/NIM API key required") | None live | N/A | N/A | No |
| 13 | `placement-prep-be/src/controllers/jobController.ts:6-78` | `searchJobs` | Live job search (Bengaluru) | Adzuna (`ADZUNA_APP_ID`/`ADZUNA_APP_KEY`) | **Already graceful** — `hasAdzunaConfig()` gate returns a clear "not configured" error instead of crashing; app itself still starts fine without these | N/A — **not an AI provider**, keep as an optional live-data integration per Phase 12 | No |

**Chatbot** (`placement-prep-be/src/services/chatbot/*`, `POST /chatbot/chat`): confirmed **already fully local**. The only text matches for "openai"/"groq"/"gemini" inside `services/chatbot/` are training-data strings (a canned intent *"do you use openai"* with a canned local answer) — not real API calls.

**Resume analyzer** (`placement-prep-be/src/controllers/resumeController.ts`, `src/services/localResumeAnalyzer.ts`, `src/services/localResumeParser.ts`): confirmed **no direct Gemini/OpenAI/Groq calls** in `resumeController.ts` itself — it already delegates to local parser/analyzer services and/or the `ai-services` Flask endpoints (`/enhance-resume-content`, which is itself local per #11). This is much further along than Phase 4 of the plan assumes; Phase 4 work should focus on verifying/extending `localResumeAnalyzer.ts`'s scoring coverage against the 15-point checklist in the migration plan, not building it from scratch.

**Frontend** (`MindPrepAI-FE`): no AI provider keys are ever present — only service **URLs** (`VITE_BACKEND_URL`, `VITE_ADMIN_API_URL`, `VITE_AI_SERVICE_URL`, `VITE_PROCTOR_WS_URL`) and the shared internal `VITE_AI_SERVICE_KEY` secret. `ResumeBuilder.tsx`'s match on the search pattern was incidental (no actual key/provider reference). No frontend changes needed for this migration.

**`placement-admin-be`**: zero matches for any AI provider env var or SDK import. This service only handles the alumni network; nothing to migrate.

---

## 4. Dependency map

```
MindPrepAI-FE (browser)
   │
   ├─► placement-prep-be  (Node/Express, :5000 or :3001)
   │       │
   │       ├─► MongoDB                                  [local infra, not AI]
   │       │
   │       ├─► Gemini API  ◄── config/gemini.ts ◄── services/aiService.ts
   │       │       used only by  questionController.ts (POST /questions/generate)
   │       │
   │       ├─► Pinecone (vector STORAGE only)  ◄── config/pinecone.ts
   │       │       used by  pineconeService.ts (questionController.ts)
   │       │       and      interviewRagService.ts (mock-interview context sync/lookup)
   │       │
   │       ├─► Ollama (local, :11434)  ◄── embeddingService.ts
   │       │       embeds text for BOTH of the Pinecone call sites above — already local
   │       │
   │       ├─► Adzuna API  ◄── jobController.ts (non-AI, live job search, already optional)
   │       │
   │       ├─► [DEAD CODE, unrouted] OpenAI (Whisper + GPT-4o-mini)
   │       │       ◄── controllers/aiControllers/voiceEvaluationController.ts
   │       │
   │       ├─► [dev-time script only] Groq (via OpenAI-compatible endpoint)
   │       │       ◄── scripts/generateAptitudeQuestions.ts (npm run gen:aptitude)
   │       │
   │       └─► ai-services Flask (:8000)  — AI_SERVICE_URL
   │               called by mockInterviewController.ts (question gen, answer eval, feedback)
   │               and techQuizController.ts (tech question select/evaluate)
   │               → these calls are already 100% local end-to-end (see below)
   │
   ├─► ai-services FastAPI (:8001) — proctoring WebSocket
   │       MediaPipe + YOLO + OpenCV + InsightFace + ONNX — already 100% local
   │
   └─► placement-admin-be (Node/Express, :5001) — alumni network only, no AI, no external deps
```

Inside **ai-services Flask (:8000)**, every endpoint (`/generate-questions`, `/evaluate-answer`, `/generate-feedback`, `/enhance-resume-content`, `/tech-questions/*`) is backed by local models/logic — confirmed by direct code inspection, not just by comments. `/text-to-speech` and `/speech-to-text` were **not yet inspected in this audit pass** (Phase 10 territory) — flagged as open in §5.

---

## 5. Cannot yet be locally replaced today (honest gaps)

1. **Pinecone vector storage** — embeddings are already computed locally (Ollama), but the vectors themselves are stored and queried in Pinecone's managed cloud index. No local vector store (FAISS/Chroma/etc.) is wired in yet. This is the single largest remaining piece of real migration work identified in this audit (Phase 7).
2. **Gemini question generation** (`aiService.ts::generateQuestion`, used only by `POST /questions/generate`) — no local model is currently wired into this specific path. It is a small, isolated function, but it is a real, live external call today, unlike almost everything else in the app.
3. **Speech-to-text / text-to-speech** — `ai-services/server.py` exposes `/text-to-speech` and `/speech-to-text`, and there is a `riva_service.py` (NVIDIA Riva, optional/disabled by default via `RIVA_ENABLED=false`). This audit did **not** trace whether the default (non-Riva) path already uses a local engine (e.g. an offline TTS/STT library) or silently depends on something external — needs a dedicated Phase 10 inspection pass before claiming it's done.
4. **Dead OpenAI code** (`voiceEvaluationController.ts`) has no local equivalent built for it — but since it's unrouted, there's no urgency; the honest gap is just "if someone wires this up, it will require an OpenAI key with zero fallback."
5. **`generateAptitudeQuestions.ts` admin script** still assumes Groq for bulk offline authoring. Not request-time, not startup-blocking, but not yet migrated either.
6. **No local embedding fallback if Ollama is absent** — `embeddingService.ts` throws rather than degrading; worth deciding whether Phase 7's local vector store work should also bundle an in-process embedding model (e.g. `sentence-transformers`) so a separate Ollama server isn't a hard requirement.

---

## 6. Rough resource estimates

| Component | Status | Approx. size | RAM (inference) | GPU? |
|---|---|---|---|---|
| Existing local interview-question LLM (`ai-services/interviewer_llm/`) | **Already built & in use** | Fine-tuned small LLM (base model + LoRA/PEFT adapter per `TRAINING.md`); exact weight size wasn't discoverable in this audit pass — weights are gitignored (`interviewer_llm/models/`) and not present on disk to measure directly | Typically 1–4 GB for a small (≤1–3B param) base model in fp16/int8 | No — CPU-capable, GPU speeds it up |
| Existing local resume enhancer (`resume_enhancer.py`) | **Already built & in use** | Loads via `AutoModelForCausalLM`/`transformers` — same order of magnitude as above (not measured directly; model name not confirmed in this pass) | ~1–4 GB | No (works CPU-only per its own fallback-oriented design), GPU optional |
| Local embeddings (Ollama `nomic-embed-text`, already in use) | **Already built & in use** | ~270 MB model file | <500 MB | No — CPU fine |
| Future local vector store (FAISS or Chroma, to replace Pinecone) | Not yet built | Library only (few MB); index size scales with your data (thousands of question/interview vectors × 768 floats ≈ low tens of MB) | Negligible (<200 MB for this dataset scale) | No |
| Future local question-generation replacement for `aiService.ts::generateQuestion` | Not yet built | Could reuse the existing `interviewer_llm` model — no new model needed | Same as row 1 | No |
| Future local technical-question model (Phase 6, if a model beyond question banks is wanted) | Not yet built | A small (~1–3B) instruction model, similar class to the interviewer LLM | 2–6 GB fp16 / ~1–3 GB int8 | Optional — CPU works, slower |
| Local speech-to-text (`faster-whisper`, if the current STT path turns out external) | Status unconfirmed (§5.3) | `base`/`small` model: 75–500 MB | ~1 GB | No — CPU-capable, real-time-ish on `base`/`small` |
| Local text-to-speech (Piper, if needed) | Status unconfirmed (§5.3) | Per-voice model: 20–100 MB | <500 MB | No |

**Overall**: nothing identified in this audit requires a GPU to run acceptably; everything either already runs CPU-only or has a CPU-only local option. The only genuinely new infrastructure needed is a local vector store (FAISS/Chroma) for Pinecone replacement — everything else is either already local or is a small, isolated call site that can point at infrastructure the repo already has (the local `interviewer_llm` model, or the already-local `ai-services` Flask endpoints).

---

## 7. Suggested order of work

1. **Phase 2 — DONE.** `env.ts` no longer requires `PINECONE_API_KEY`/`GEMINI_API_KEY` to boot (only `MONGO_URI` is required now); both print a one-line warning instead. `config/gemini.ts` and `config/pinecone.ts` now construct their clients conditionally (`geminiModel`/`pinecone`/`index` are `null` when the key is absent) instead of unconditionally at import time. All three call sites (`aiService.ts::generateQuestion`, `pineconeService.ts::upsertVector`/`queryVectors`, `interviewRagService.ts::syncInterviewToVectorDB`/`getInterviewContext`) now check for `null` and either throw a clear 503 `AppError` (the two Pinecone/Gemini request-time features) or silently no-op (the two best-effort RAG helpers, which already had that shape). Verified: `npx tsc --noEmit` on the 6 changed files reports zero new errors (two pre-existing, unrelated errors remain in untouched `time_chain.ts` and `evalHybrid.ts`), and the server was booted locally with `GEMINI_API_KEY=` and `PINECONE_API_KEY=` explicitly empty — it logs both warnings, connects to MongoDB, and listens normally. `.env.example` updated to mark these as optional/local-only with explanatory comments.
2. **Phase 7 — DONE.** Pinecone's vector storage is now replaced by a local, MongoDB-backed vector store (`src/models/VectorEmbedding.ts` + `src/services/vectorStore.ts`), chosen over FAISS/hnswlib specifically to avoid a native-compiled dependency (painful to build on Windows) — brute-force cosine similarity is appropriate at this app's scale (thousands, not millions, of vectors; the audit already estimated low tens of MB). `pineconeService.ts` and `interviewRagService.ts` now delegate to `vectorStore.ts`, which keeps using managed Pinecone when `PINECONE_API_KEY` is configured (fallback preserved, unchanged) and otherwise transparently uses the local store — callers' function signatures are unchanged, so `questionController.ts` and `mockInterviewController.ts` needed no edits. Namespacing (Pinecone's per-user `namespace()`) is preserved via a `namespace` field on `VectorEmbedding`, so the interview-RAG per-user isolation still works. Embeddings themselves were already local (Ollama `nomic-embed-text`) since before this migration. **Verified, not just written:** `tsc --noEmit` shows zero new errors; a real round-trip test (embed two semantically different questions via the live local Ollama server, upsert both into a local namespace, embed a query, and search) correctly ranked the semantically closer question first (cosine score 0.906 vs 0.351) with `PINECONE_API_KEY` unset — confirmed against real local infrastructure, not mocked. Test data and the temporary test script were cleaned up afterward; no leftover test rows remain in the `vectorembeddings` collection.
3. **DONE.** `aiService.ts::generateQuestion` (`POST /questions/generate`) no longer calls Gemini — it now calls a new `POST /generate-quiz-question` endpoint added to `ai-services/server.py`, which reuses the exact same local generation chain as the mock-interview path (`get_generator().generate_question()`: fine-tuned `interviewer_llm` → small local model → offline question bank, in that order, never raising). One deliberate honesty tradeoff: the runtime question bank (`training/data/interview_questions/raw_dataset.json`, 900 records) carries `skill/topic/difficulty/question` only — no `answer` field exists for any record at runtime (confirmed by direct inspection: 0 of 900 records have a non-empty `answer`). Rather than fabricate a reference answer, the new endpoint returns `answer: ""` explicitly, per the spec's "do not fabricate" safety principle. This route has **zero frontend callers today** (confirmed by grepping `MindPrepAI-FE/src` for `questions/generate` and `questions/search` — no match; the quiz feature was superseded by the separate, already-local Aptitude and Tech-Quiz features), so the practical impact is limited, but it removes what was genuinely the last live external-AI call in the whole app. `config/gemini.ts` and the `@google/generative-ai` package are now fully unused — left in place per the phased plan (not deleted until Phase 14 dependency cleanup) but flagged as a removal candidate. **Verified, not just written:** ran the new Flask endpoint directly (`POST /generate-quiz-question` on a throwaway port) — returned a real, on-topic local question (`"Explain how consistent hashing works..."`, `source: "bank"`) with the shared-secret auth enforced (`{"error":"Unauthorized"}` without the header) and `tsc --noEmit` clean on the Node side. Test process was stopped afterward; the user's own already-running `ai-services` instance on port 8000 was left untouched.
4. **Phase 10 — DONE.** Inspected `riva_service.py`'s default (`RIVA_ENABLED=false`) path directly, not just its comments, and found real problems beyond the original audit's scope (its keyword search couldn't catch this — no API key is involved):
   - **TTS was already fine**: `_fallback_tts()` uses `pyttsx3` or Windows SAPI (`win32com`) — both fully offline. No external call.
   - **STT was silently external AND broken**: the old `_fallback_stt()` took **no arguments** — it never touched the uploaded `audio_bytes` at all. Instead it called `speech_recognition.Microphone()` (recording from **the server's own microphone**, not the candidate's audio) and then `recognize_google(...)`, Google's free cloud Web Speech API — a real external network call the original keyword audit couldn't find, since it uses no API key. On top of that, `speech_recognition`, `pyttsx3`, and `pywin32` were **not even declared in `requirements.txt`** — confirmed by directly trying to import all three in the project's own venv, and all three failed (`ModuleNotFoundError`). Voice-interview transcription was non-functional in this exact dev environment, not just "in theory on a fresh install."
   - **Fix**: added `faster-whisper` (CPU, int8, model size configurable via `WHISPER_MODEL_SIZE`, default `base` ≈150MB — chosen by the user over `tiny`/`small`) as the new local STT engine; `_fallback_stt(audio_bytes)` now actually decodes and transcribes the given audio via `WhisperModel.transcribe()`, which uses PyAV internally (no system `ffmpeg` install needed). `speech_to_text()`'s three call sites (Riva-disabled path, Riva-exception path, Riva-no-results path) all now correctly pass `audio_bytes` through. Added `faster-whisper`, `pyttsx3`, `pywin32` (Windows-only marker) to `requirements.txt`, and created `ai-services/.env.example` (none existed before) documenting `WHISPER_MODEL_SIZE` and separating required/local/optional-external vars.
   - **Verified, not just written** (three separate real tests, no mocking): (1) generated real speech locally via `text_to_speech()`, fed the WAV bytes into the new `speech_to_text()` — correct transcript. (2) Transcoded that audio to actual **webm/opus** (the exact format `MindPrepAI-FE/src/hooks/useMicrophone.ts`'s `MediaRecorder` produces) via PyAV, fed that in — correct transcript, confirming the real production audio format decodes correctly. (3) Full HTTP round trip against a live Flask instance (`POST /text-to-speech` → `POST /speech-to-text`, both base64-encoded exactly as the frontend does it) — `200`, correct transcript. All test server processes were stopped afterward.
5. **DONE — deleted.** `voiceEvaluationController.ts` (and the now-empty `controllers/aiControllers/` directory it was the sole occupant of) was removed outright rather than gated: re-confirmed zero references anywhere else in the codebase (only self-references within the file itself) before deleting, and its functionality (voice-answer evaluation) is already fully covered by the live, routed pipeline (`ai-services`' local answer evaluator). It's recoverable from git history if ever needed. `tsc --noEmit` clean after removal.
6. **DONE — decided to keep as-is, documented.** `generateAptitudeQuestions.ts` is a ~400-line, developer-run-only CLI (`npm run gen:aptitude`) for bulk-authoring the aptitude question bank; it never runs as part of the deployed app and requires an operator to explicitly supply `GROQ_API_KEY`. Migrating it would mean building a full local MCQ-with-options-and-answer-key generation pipeline for a script nothing in the running system ever invokes — disproportionate to its actual footprint. Left as-is, but added a header comment explicitly documenting this as a deliberate, scoped exception (not an oversight) with a pointer to this audit doc.
7. **Phase 14 — DONE.** See §8 below for the full dependency-cleanup report.

## 8. Phase 14 — Dependency Cleanup & Build Validation (final report)

### A. Removed packages
- `@google/generative-ai` (placement-prep-be) — zero usages after Gemini was fully redirected to the local `ai-services` path in the earlier `generateQuestion` migration; confirmed via repo-wide search before removal.
- `@langchain/community`, `@langchain/groq`, `@langchain/openai` (placement-prep-be) — confirmed **zero imports anywhere in the repo** (not just the obvious entry points — searched all of `src/`) prior to removal. These were vestigial; nothing in this codebase was ever built on LangChain.

### B. Packages intentionally retained
- `@pinecone-database/pinecone` — still a legitimate optional path (managed-cloud vector store), gated by both "is `PINECONE_API_KEY` set" and the new `LOCAL_ONLY` flag in `config/pinecone.ts`. Local MongoDB-backed store (`services/vectorStore.ts`) is the default/primary path either way.
- `openai` (npm package) — still imported by `scripts/generateAptitudeQuestions.ts`, the intentionally-kept, developer-run-only aptitude-question authoring CLI (talks to Groq's OpenAI-compatible endpoint, not OpenAI itself). Now gated behind `LOCAL_ONLY`.

### C. Why retained
See B — both are genuinely optional, request-time-only, non-default paths, not part of the app's required runtime dependency graph. Removing them would delete real (if optional) functionality rather than dead code.

### D. Removed source files/code
- `placement-prep-be/src/config/gemini.ts` — deleted outright (zero importers after the earlier Gemini→local redirect; this was missed at the time and caught now).
- `placement-prep-be/src/controllers/aiControllers/voiceEvaluationController.ts` + the now-empty `aiControllers/` directory — deleted in the prior turn (unrouted dead code, hardcoded OpenAI Whisper/GPT-4o-mini, zero references anywhere else).
- `EnvConfig`'s `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `NIM_API_URL`, `NIM_API_KEY`, `NIM_MODEL` fields removed from `config/env.ts` — confirmed none of them were ever read via `env.X` anywhere in the codebase (only `process.env.GROQ_API_KEY`, read directly by the intentionally-kept script, bypassing this config object entirely). The stale "GEMINI_API_KEY not set" startup warning was also removed — it referenced a code path (`POST /questions/generate`) that no longer touches Gemini at all, so it had become actively misleading, not just dead.

### E. Remaining external AI integrations, if any
Exactly one, and it's non-default/gated: `scripts/generateAptitudeQuestions.ts` → Groq (via the `openai` SDK pointed at Groq's endpoint). Developer-run only (`npm run gen:aptitude`), never invoked by the deployed app or any request, and now refuses to run at all when `LOCAL_ONLY=true`.

### F. Remaining Pinecone usage, if any
Optional only, via `config/pinecone.ts` → `services/vectorStore.ts`. Used only if `PINECONE_API_KEY` is set **and** `LOCAL_ONLY` is not `true`. Default behavior (no key, or `LOCAL_ONLY=true`) is the local MongoDB-backed vector store — functionally equivalent, verified working in the Phase 7 round-trip test.

### G. Remaining OpenAI usage, if any
None calling the real OpenAI API. The only `openai` npm package usage left in the repo is `generateAptitudeQuestions.ts`'s Groq client (see E) — it uses OpenAI's *SDK* against Groq's *endpoint*, not OpenAI's service.

### H. LOCAL_ONLY status
Implemented and verified this phase (new — did not exist before):
- `placement-prep-be`: `LOCAL_ONLY=true` forces `config/pinecone.ts`'s `pinecone`/`index` to `null` regardless of a configured `PINECONE_API_KEY` (verified: booted with a fake key set + `LOCAL_ONLY=true`, got the "will be ignored" warning, app ran normally), and makes `generateAptitudeQuestions.ts` refuse to run with a clear error instead of silently calling Groq.
- `ai-services` (Python): no gate was added because none was needed — every runtime code path there (question generation, answer evaluation, resume enhancement, chatbot, STT/TTS, proctoring) was already confirmed local with zero live external-AI calls in this and prior phases; `LOCAL_ONLY` would have nothing to gate.
- Default is `LOCAL_ONLY=false` (preserves prior behavior for anyone who has a real `PINECONE_API_KEY` configured) — it is an explicit opt-in enforcement/verification mode, not (yet) the default posture.

### I. `npm install` result
Removed 29 packages, 0 errors. `npm ls` afterward shows a clean tree — no `UNMET DEPENDENCY`, no invalid or duplicate entries. (One harmless artifact: an empty `node_modules/@langchain/` scope folder left behind by npm; not a real dependency, ignored/regenerated normally.)

### J. `npm build` result
`npm run build` (`tsc`) fails — but on a **pre-existing, unrelated** issue: a stray `time_chain.ts` file at the repo root (tracked since the initial commit, predates this entire migration) violates the committed `tsconfig.json`'s `rootDir: "src"`. This was already broken before Phase 14 (and before Phase 2) — confirmed by running `tsc --noEmit --rootDir .` (a workaround that sidesteps that specific conflict) instead, which shows **zero errors**, including zero errors introduced by this phase's package removals, file deletions, or `env.ts`/`pinecone.ts` rewrites. Not fixed here per "fix only errors caused by the dependency cleanup, do not introduce unrelated changes" — flagged as a blocker in M.

### K. TypeScript/test result
`tsc --noEmit --rootDir .`: clean, zero errors. No test suite exists in `placement-prep-be` (`npm test` is a stub: `"echo \"Error: no test specified\" && exit 1"`) — nothing to run.

### L. Warnings
- `npm install` reports 13 pre-existing vulnerabilities (2 low/3 moderate/7 high/1 critical) via `npm audit` — pre-existing, unrelated to this cleanup, not addressed (out of scope; `npm audit fix --force` risks breaking changes and wasn't requested).
- The `time_chain.ts` / `rootDir` conflict (see J) blocks the ordinary `npm run build` command; use `tsc --noEmit --rootDir .` in the meantime, or move/remove that file (not done here — unrelated to this task).

### M. Remaining blockers
1. `npm run build` doesn't run as-is, due to the pre-existing `time_chain.ts` rootDir conflict (unrelated to AI migration). Recommend deciding whether to delete/move that file, or add it to `tsconfig.json`'s `exclude`.
2. STT (Phase 10) requires a one-time faster-whisper model download (~150MB) on first use in any new environment — not a blocker exactly, but worth knowing for deployment/offline-first setups.
3. No automated tests exist for any of the changed logic (dependency wiring, `LOCAL_ONLY` gating, vector store) — all verification in this migration was manual/scripted, not committed as a regression-preventing test suite.

### N. Exact files changed (this phase)
- `placement-prep-be/package.json` — removed 4 packages.
- `placement-prep-be/src/config/gemini.ts` — deleted.
- `placement-prep-be/src/config/env.ts` — removed 6 dead fields, removed stale Gemini warning, added `LOCAL_ONLY`.
- `placement-prep-be/src/config/pinecone.ts` — added `LOCAL_ONLY` gate.
- `placement-prep-be/src/scripts/generateAptitudeQuestions.ts` — added `LOCAL_ONLY` guard.
- `placement-prep-be/.env.example` — removed dead vars, documented `LOCAL_ONLY`, clarified `GROQ_API_KEY` scope.
- `docs/LOCAL_AI_MIGRATION_AUDIT.md` — this report.

### O. Recommended next step
Decide the fate of the pre-existing `time_chain.ts`/`rootDir` build blocker (item M.1) so `npm run build` works normally again — that's unrelated to this migration but is the only thing standing between this repo and a fully clean build. After that, the local-AI migration itself has no more open phases from the original plan except genuinely-optional, already-documented exceptions (Pinecone, the aptitude-authoring script) and the informational items already noted (STT model download size, lack of automated tests).
