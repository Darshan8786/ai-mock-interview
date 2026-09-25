# MindPrep AI 🚀

**AI-powered Placement Preparation & Campus Recruitment Platform.** A complete career-prep suite (quizzes, aptitude tests, tech quizzes, AI mock interviews with live proctoring, resume analyzer + builder, job drives with eligibility screening, alumni network) for students, plus admin/college panels to run and manage it all.

The project is a **monorepo** with **four independent services**:

| Folder | Service | Stack | Default Port |
|---|---|---|---|
| `MindPrepAI-FE` | Frontend web app (student + admin UI) | React 18 + TypeScript + Vite 7 + Tailwind v4 | `5173` |
| `placement-prep-be` | Main backend API (auth, quizzes, mock interviews, resume, jobs, colleges) | Node.js + Express + TypeScript + MongoDB (Mongoose) | `5000`* |
| `placement-admin-be` | Alumni-network admin backend | Node.js + Express + TypeScript + MongoDB (Mongoose) | `5001` |
| `ai-services` | AI / proctoring / speech microservice(s) | Python + FastAPI + Flask + OpenCV + MediaPipe + YOLO + local LLM | `8000` (Flask) / `8001` (FastAPI) |

\* The frontend's default `BACKEND_URL` is `http://localhost:3001` — set `PORT=3001` in `placement-prep-be/.env` (see [Environment Variables](#environment-variables)) so the two agree, or override `VITE_BACKEND_URL` on the frontend instead.

---

## Table of Contents

1. [Architecture & How It Works](#architecture--how-it-works)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Step-by-Step Setup](#step-by-step-setup)
6. [Environment Variables](#environment-variables)
7. [API Endpoints](#api-endpoints)
8. [How Each Feature Works, A→Z](#how-each-feature-works-az)
9. [Custom Proctoring Model Training](#custom-proctoring-model-training)
10. [Local Interview-Question LLM](#local-interview-question-llm)
11. [Zero External AI by Default](#zero-external-ai-by-default)
12. [Troubleshooting](#troubleshooting)
13. [Project Structure](#project-structure)

---

## Architecture & How It Works

```
                                   ┌─────────────────────────┐
                         ┌────────►│  MongoDB (Mongoose)      │
                         │         │  + local vector store    │
                         │         │  (services/vectorStore)  │
┌──────────────────┐     │         └─────────────────────────┘
│   MindPrepAI-FE    │────┤         ┌─────────────────────────┐
│  React + Vite      │    ├ ─ ─ ─ ─►│  Pinecone (optional)     │
│  (Browser, :5173)  │    │         └─────────────────────────┘
└──────────┬─────────┘    │
           │ REST (JWT)    ▼
           │        ┌──────────────────────────┐
           ├───────►│  placement-prep-be         │  Main API — auth, quizzes, aptitude,
           │        │  Express + TS  (:5000/3001)│  mock interviews, resume, jobs, colleges
           │        └───────────┬───────────────┘
           │                    │ HTTP (question gen, resume analysis)
           │                    ▼
           │        ┌──────────────────────────┐
           ├───────►│  ai-services                │  Flask  (:8000) — LLM Q&A, resume, STT/TTS
           │        │  Python                    │  FastAPI (:8001) — live proctoring WebSocket
           │        └──────────────────────────┘
           │
           │ REST (open, no auth)
           └───────►┌──────────────────────────┐
                    │  placement-admin-be         │  Alumni network — CRUD + public openings
                    │  Express + TS  (:5001)     │
                    └──────────────────────────┘
```

**Flow:**
- The **browser (React)** is the only client. It talks to **`placement-prep-be`** for everything student/admin-facing (auth, quizzes, interviews, resume, jobs, colleges) and directly to **`ai-services`** for live webcam proctoring frames and voice.
- **`placement-prep-be`** talks to **MongoDB** (all core data, plus a local, MongoDB-backed vector store used for semantic search / RAG by default) and calls into **`ai-services`** (Flask, `:8000`) for AI question generation, resume analysis/enhancement, and answer evaluation — all of which run on local models with zero external AI API calls. **Pinecone is optional** (dotted line above): if `PINECONE_API_KEY` is set, it's used instead of the local vector store for the same RAG feature; if not (or if `LOCAL_ONLY=true`), the local store is used automatically. Nothing about vector search requires Pinecone.
- **`ai-services`** runs **two independent Python processes**: a **FastAPI** app (`run.py`, `:8001`) that accepts a WebSocket per interview session and runs real-time face/eye/head-pose tracking (MediaPipe) + phone/object detection (YOLO) on incoming webcam frames; and a **Flask** app (`server.py`, `:8000`) that serves question generation (via a **locally fine-tuned LLM**, no external API key required — see [Local Interview-Question LLM](#local-interview-question-llm)), resume enhancement, tech-quiz question selection, and **local** speech-to-text/text-to-speech (faster-whisper + pyttsx3/SAPI — see [Zero External AI by Default](#zero-external-ai-by-default)).
- **`placement-admin-be`** is a **separate, standalone Node service** for the **Alumni Network** feature only. It has no login (open endpoints) and is called directly by the frontend's admin **Alumni Management** pages via `ADMIN_API_URL`. It is not otherwise wired into the rest of the app.

---

## Features

### Student-facing
- 🔐 **JWT authentication** — signup / login / profile (USN, department, CGPA, backlogs, skills, resume).
- 📝 **Topic-wise quizzes** — subject / role / company-based AI-generated questions with attempts, scoring, and history.
- 🧮 **Aptitude tests** — timed test bank + free practice, per-topic/company filtering, progress tracking, history.
- 💻 **Tech quizzes** — technology-specific rapid-fire quiz mode with instant scoring.
- 🎯 **AI mock interviews** — role-specific questions (from a **local, self-hosted LLM** — no external API key), voice or text answers, per-question AI evaluation (technical / communication / confidence / grammar / fluency / relevance), and **live proctoring**:
  - Face/eye tracking + head-pose (looking away, eyes closed) via MediaPipe.
  - Phone / headset / object detection via a custom-trainable YOLO model.
  - Tab-switch detection and **fullscreen enforcement** (leaving fullscreen is tracked like a proctoring violation).
  - Escalating warnings → **auto-termination** after repeated violations (configurable, default 3).
- 🏫 **College interviews** — students can take interview templates **published by their own college's admin** (technical/HR/behavioral/coding/mixed, MCQ or subjective), shown alongside their regular AI mock interviews on the same dashboard and running through the exact same interview room, timer, proctoring, and report pipeline.
- 📄 **Resume analyzer** — upload a PDF → text extraction → **ATS score**, strengths/weaknesses, missing keywords, plus **live jobs in Bengaluru** (Adzuna) with per-job skill-gap analysis and upskilling suggestions.
- 🛠️ **Resume builder** — multi-step form, 3 templates, AI-assisted content generation, ATS evaluation, **PDF export**.
- 💼 **Jobs & applications** — browse open job drives, see live eligibility (or the exact reason you're not eligible), apply, and track application status (applied → shortlisted → rejected → selected).
- 🔔 **Notifications** — unread badge, feed, mark-read/mark-all-read (e.g. "you're eligible for X").
- 📊 **Personalized reports** — categorized weak areas with recommended resources/videos.
- 🤖 **Chatbot** — a fine-tuned Q&A assistant for platform/placement questions.
- 🧠 **RAG (local by default)** — embeddings (local, via Ollama) + semantic retrieval to reuse stored questions and enrich AI answers, backed by a local MongoDB vector store by default (Pinecone optional — see [Zero External AI by Default](#zero-external-ai-by-default)).

### Admin panel (`/admin`, part of the same frontend, `placement-prep-be`)
- Dashboard with platform-wide stats.
- Student management (view/edit/verify/reject, set placement status).
- Resume, interview, and aptitude oversight; aptitude question/topic/test bank CRUD.
- **Jobs**: create/edit/delete/activate/deactivate/close; per-job applications with shortlist/reject/select.
- **Eligibility & notifications**: eligibility computed purely from **CGPA, backlogs, and department** (see [Eligibility Model](#-jobs--eligibility)); eligible/not-eligible lists with reasons; one-click "notify eligible students" (deduped); Excel/CSV export.
- **College interviews**: create/edit/publish/close interview templates scoped to the admin's own college; author MCQ/technical/coding/behavioral/HR questions, reorder, duplicate.
- Announcements, reports/analytics, settings.

### Alumni network (`placement-admin-be`, separate service)
- Admin CRUD for alumni records (name, grad year, department, current company/role, LinkedIn) and any job **opening** they're referring.
- Public listing of current alumni openings, consumed by the frontend's Alumni pages (no login required for read).

---

## Tech Stack

### Frontend (`MindPrepAI-FE`)
React 18, TypeScript, Vite 7, Tailwind CSS v4, Framer Motion, React Router v7, TanStack React Query, Recharts, Swiper, Three.js / `@react-three/fiber` (3D visuals), `html2canvas-pro` + `jsPDF` (resume PDF export), `xlsx` (Excel export), Axios, `react-hot-toast`.

### Main backend (`placement-prep-be`)
Node.js, Express 4, TypeScript, Mongoose (MongoDB), JWT + bcrypt, Zod, Multer, `pdfjs-dist`, Axios. `@pinecone-database/pinecone` and the `openai` SDK are present but optional (see [Zero External AI by Default](#zero-external-ai-by-default)) — there is no Gemini or LangChain dependency in this backend at all.

### Alumni backend (`placement-admin-be`)
Node.js, Express 4, TypeScript, Mongoose (MongoDB), JWT (access + refresh) + bcryptjs, Zod, Helmet, `express-rate-limit`, Multer, Swagger (`swagger-jsdoc` + `swagger-ui-express`).

### AI services (`ai-services`)
Python 3.11+, FastAPI, Uvicorn, Flask (legacy but active — question/resume/speech endpoints), OpenCV, MediaPipe, Ultralytics (YOLO), InsightFace, ONNX Runtime, NumPy, PyTorch + Hugging Face `transformers`/`peft` (local LLM fine-tuning and inference), `faster-whisper` (local speech-to-text), `pyttsx3` + Windows SAPI (local text-to-speech), Requests.

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Python** ≥ 3.10 and **pip**
- **MongoDB** (local install or Atlas URI) — `placement-prep-be` and `placement-admin-be` can point at the same or different databases
- **No AI provider API key is required to run the app.** Interview/quiz question generation, answer evaluation, resume analysis/enhancement, the chatbot, proctoring, and speech (STT/TTS) all run on local models by default — see [Zero External AI by Default](#zero-external-ai-by-default). Pinecone and Adzuna are the only optional external services, and both are non-AI or easily-replaced-by-local, never required for startup.

---

## Step-by-Step Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd MindPrep-AI
```

### 2. Start MongoDB

```bash
mongod --dbpath <your-data-dir>
# or point MONGO_URI / MONGO_URI at a MongoDB Atlas connection string
```

### 3. Main backend — `placement-prep-be`

```bash
cd placement-prep-be
npm install
cp .env.example .env   # fill in the values — see Environment Variables
npm run dev            # http://localhost:<PORT>  (defaults to 5000; set PORT=3001 to match the FE default)
```

> ⚠️ The server **exits immediately** only if `MONGO_URI`/`MONGO_URL` is missing — `config/env.ts` validates it at startup. No AI provider key is required to start or to use any core feature.

Optional seed data:
```bash
npm run seed:aptitude              # aptitude question bank
npm run create:college-admin -- --college "ABC College" --name "Name" --email a@b.edu --password "..."
```

### 4. Alumni backend — `placement-admin-be`

```bash
cd ../placement-admin-be
npm install
cp .env.example .env   # PORT=5001 by default
npm run seed            # creates the default admin account
npm run dev             # http://localhost:5001  (Swagger docs at /api/docs)
```

### 5. Frontend — `MindPrepAI-FE`

```bash
cd ../MindPrepAI-FE
npm install
npm run dev             # http://localhost:5173
```

Backend URLs live in `src/config/config.ts` (overridable via `.env` / Vite env vars):

| Var | Default | Points at |
|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3001` | `placement-prep-be` |
| `VITE_ADMIN_API_URL` | `http://localhost:5001` | `placement-admin-be` (alumni) |
| `VITE_AI_SERVICE_URL` | `http://127.0.0.1:8000` | `ai-services` Flask app |
| `VITE_PROCTOR_WS_URL` | `ws://127.0.0.1:8001` | `ai-services` FastAPI proctoring WebSocket |
| `VITE_AI_SERVICE_KEY` | `mindprep-ai-key-2026` | shared secret sent as `X-AI-Service-Key` |

> Use `127.0.0.1`, not `localhost`, for the proctoring WebSocket on Windows — `localhost` resolves to `::1` first, and the ~2s IPv6 timeout before falling back to IPv4 is exactly the "proctoring takes forever to connect" symptom.

### 6. AI services — `ai-services` (Python)

```bash
cd ../ai-services
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cp .env.example .env           # if present, otherwise create it (see below)
```

`.env` contents (see `ai-services/.env.example` for the full annotated version):
```
AI_SERVICE_PORT=8000
PROCTOR_PORT=8001
AI_SERVICE_KEY=mindprep-ai-key-2026
WHISPER_MODEL_SIZE=base   # local speech-to-text (faster-whisper); tiny/base/small/medium/large-v3
RIVA_ENABLED=false        # optional managed speech service — local is the default and needs no key
RIVA_SERVER=localhost:50051
MONGO_URL=mongodb://localhost:27017/mindprep
GROQ_API_KEY=             # optional external fallback only — not needed for any core feature
```

> **Model downloads:** on first startup, YOLO/face-detection/InsightFace weights auto-download into `models/`/`weights/` (~900 MB, needs internet once); the first speech-to-text request downloads the `faster-whisper` model (~150 MB for `base`). Both are gitignored/cached outside the repo. The interview-question LLM weights are separately fine-tuned locally — see [Local Interview-Question LLM](#local-interview-question-llm).

### 7. Run everything

Open **five terminals**:

```bash
# 1 — Alumni backend (:5001)
cd placement-admin-be && npm run dev

# 2 — Main backend (:5000 or :3001 per PORT)
cd placement-prep-be && npm run dev

# 3 — Frontend (:5173)
cd MindPrepAI-FE && npm run dev

# 4 — AI services: proctoring WebSocket (FastAPI, :8001)
cd ai-services && python run.py

# 5 — AI services: LLM / resume / STT / TTS (Flask, :8000)
cd ai-services && python server.py
```

Then open **http://localhost:5173**.

---

## Environment Variables

### `placement-prep-be/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` / `MONGO_URI` | ✅ | MongoDB connection string — the **only** variable this backend requires to start |
| `JWT_SECRET` | ⚠️ | Signs student/admin auth tokens (has an insecure fallback default — always set this yourself) |
| `AI_SERVICE_URL` / `AI_SERVICE_KEY` | ⚠️ | URL + shared secret for `ai-services` (defaults work for local dev) |
| `LOCAL_ONLY` | ⚠️ | `true` forces zero external network calls: ignores a configured `PINECONE_API_KEY` outright (local vector store is used instead) and makes `npm run gen:aptitude` refuse to run. Default `false`. See [Zero External AI by Default](#zero-external-ai-by-default) |
| `PINECONE_API_KEY` / `PINECONE_ENVIRONMENT` / `PINECONE_INDEX_NAME` | ⚠️ | Optional managed-cloud vector store for RAG. Leave unset to use the built-in local, MongoDB-backed vector store instead — no functionality is lost |
| `GROQ_API_KEY` | ⚠️ | Used **only** by the offline `npm run gen:aptitude` authoring script — never called by the running app |
| `OLLAMA_URL` / `OLLAMA_EMBED_MODEL` | ⚠️ | Local embedding server for RAG (defaults: `http://localhost:11434`, `nomic-embed-text`) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | ⚠️ | Live job search (Bengaluru) — not an AI provider |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_COLLEGE` | ⚠️ | Seeded default college-admin account |
| `PORT` | ⚠️ | Listen port (default `5000`; set `3001` to match the FE default) |

### `placement-admin-be/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | ⚠️ | Default `5001` |
| `MONGO_URI` | ✅ | Can be the same or a different DB from the main backend |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✅ | Min 32 chars each |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | ⚠️ | Token lifetimes |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_PHONE` | ⚠️ | Seeded on `npm run seed` |
| `SWAGGER_UI` | ⚠️ | Docs path, default `/api/docs` |

### `ai-services/.env`

| Variable | Required | Description |
|---|---|---|
| `AI_SERVICE_PORT` / `PROCTOR_PORT` | ⚠️ | Flask port (8000) / FastAPI port (8001) |
| `AI_SERVICE_KEY` | ⚠️ | Checked via `X-AI-Service-Key` header |
| `WHISPER_MODEL_SIZE` | ⚠️ | Local speech-to-text model size (`tiny`/`base`/`small`/`medium`/`large-v3`), default `base` (~150 MB) |
| `RIVA_ENABLED` / `RIVA_SERVER` | ⚠️ | Optional managed NVIDIA Riva speech service. Default `false` — local `faster-whisper` (STT) and `pyttsx3`/SAPI (TTS) are used instead, no key needed |
| `GROQ_API_KEY` | ⚠️ | Optional external fallback only — not needed for any core feature |
| `MONGO_URL` | ⚠️ | Used by the question-history store |

### `MindPrepAI-FE/.env` (Vite)

See the table in [step 5](#5-frontend--mindprepai-fe) above (`VITE_BACKEND_URL`, `VITE_ADMIN_API_URL`, `VITE_AI_SERVICE_URL`, `VITE_PROCTOR_WS_URL`, `VITE_AI_SERVICE_KEY`).

---

## API Endpoints

### `placement-prep-be` — all routes under `/api/v1`

**Auth** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/profile`, `PATCH /auth/change-password`

**Questions / Quizzes** — `POST /questions/generate`, `POST /questions/search`

**Mock Interview** — `POST /mock-interview/create`, `GET /mock-interview/dashboard`, `GET /mock-interview/college-interviews`, `GET /mock-interview/college-interviews/:id`, `GET /mock-interview/:id`, `GET /mock-interview/:id/state`, `POST /mock-interview/:id/regenerate-questions`, `POST /mock-interview/:id/answer`, `POST /mock-interview/:id/skip`, `POST /mock-interview/:id/cheating`, `POST /mock-interview/:id/terminate`, `GET /mock-interview/:id/report`

**Resume** — `POST /resume/analyze`, `POST /resume/enhance`, `POST /resume/parse`, `POST /resume/parse-text`, `POST /resume/auto-fix`, `POST /resume/evaluate-builder`

**Aptitude** — `POST /aptitude/save-result`, `GET /aptitude/my-results`, `GET /aptitude/my-stats`, `GET /aptitude/topics`, `GET /aptitude/companies`, `GET /aptitude/tests[/:id]`, `GET /aptitude/tests/:id/questions`, `POST /aptitude/tests/:id/submit`, `GET /aptitude/practice`, `POST /aptitude/practice/submit`, `POST /aptitude/test/start`, `GET /aptitude/test/:attemptId`, `POST /aptitude/test/:attemptId/submit`, `GET /aptitude/progress`, `GET /aptitude/history[/:attemptId]`, `GET /aptitude/questions`

**Tech Quiz** — `GET /tech-quiz/technologies`, `POST /tech-quiz/start`, `POST /tech-quiz/:attemptId/answer`, `POST /tech-quiz/:attemptId/finish`, `GET /tech-quiz/history`

**Jobs / Applications** — `GET /jobs/search`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/apply`, `GET /applications/my`

**Notifications** — `GET /notifications/my`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`

**Colleges** — `GET /colleges`, `GET /colleges/me`, `PUT /colleges/me`

**Chatbot** — `GET /chatbot/info`, `POST /chatbot/chat`

**Analytics** — `GET /analytics/me`

**Admin** (`protect` + `restrictTo("admin")`) — dashboard, students, interviews, aptitude results + question/topic/test bank, notifications, announcements, jobs (CRUD + status + applications + eligible/ineligible students + recalculate + notify-eligible), application status, and **college interviews** (`/admin/college-interviews...` — CRUD, status, question CRUD, reorder, duplicate). Full list in `src/routes/adminRoutes.ts`.

### `placement-admin-be` — Alumni network, port 5001, no auth required for read

- `GET /api/alumni` — list alumni
- `POST /api/alumni` / `PATCH /api/alumni/:id` / `DELETE /api/alumni/:id` — admin CRUD
- `GET /api/alumni/openings` (public) — current job openings referred by alumni
- Swagger UI at `/api/docs` documents the full surface (this service also has broader student/job/interview/aptitude/company controllers scaffolded, but the frontend only consumes the alumni endpoints today).

### `ai-services` — Flask app, port 8000

`GET /health`, `GET /model-status`, `POST /generate-questions`, `POST /generate-quiz-question`, `POST /evaluate-answer`, `POST /generate-feedback`, `GET /resume-model-status`, `POST /enhance-resume-content`, `POST /text-to-speech`, `POST /speech-to-text`, `POST /analyze-frame`, `GET /tech-questions/technologies`, `POST /tech-questions/select`, `POST /tech-questions/evaluate`, `POST /cleanup`

> `/generate-quiz-question` backs the main backend's `POST /questions/generate` (topic + difficulty → one question) — it used to call Gemini directly; it now reuses the same local model chain as `/generate-questions`. No reference answer exists for a freshly generated question in the local question bank, so `answer` is returned as `""` rather than fabricated.

### `ai-services` — FastAPI app, port 8001

`WS /proctor/ws/{session_id}` — live proctoring frame analysis; `GET /health`

---

## How Each Feature Works, A→Z

### 🔐 Authentication
Frontend posts credentials to `/auth/login`; the backend checks the bcrypt-hashed password in MongoDB and returns a **JWT**. The token is stored in `localStorage` (`token` / `role` for students, `adminToken` / `adminRole` for admins) and sent as `Authorization: Bearer <token>` on every protected call. `<ProtectedRoute>` / `<AdminRoute>` gate the frontend routes accordingly.

### 🎯 AI Mock Interview + Proctoring
1. Student picks role, experience, interview type, difficulty, question count.
2. `POST /mock-interview/create` generates unique questions via `ai-services` `/generate-questions` — the **local fine-tuned LLM** (`interviewer_llm`), falling back internally to a smaller local model and then a deduped/shuffled offline question bank if needed (see [below](#local-interview-question-llm)). No external API call is made anywhere in this chain.
3. In the interview room, webcam frames stream to the `ai-services` FastAPI **WebSocket** (`/proctor/ws/{session_id}`), which runs MediaPipe (face/eye/head-pose) + YOLO (phone/object) per frame.
4. Violations tracked in parallel: **proctoring** (looking away, eyes closed, phone detected), **tab-switch**, and **fullscreen exit** (`useFullscreenMonitor` + `FullscreenGuardModal` — leaving fullscreen shows an escalating warning modal and is reported to the backend just like other violations). Each channel escalates independently; by default the 2nd occurrence warns and the 3rd terminates the interview (`POST /mock-interview/:id/cheating`, `.../terminate`).
5. Answers are given by voice (recorded, transcribed **locally** via `ai-services`' `faster-whisper` STT — no external call) or text, and each is scored by AI on technical accuracy, communication, confidence, grammar, fluency, and relevance.
6. A final report is generated and stored; visible on the results page and the mock-interview dashboard.

### 🏫 College Interviews
1. A **college admin** authors an interview template (`CollegeInterview` — role, type, language, difficulty, question count, time limit) and its questions (`CollegeInterviewQuestion` — MCQ / technical / coding / behavioral / HR, with an answer key that is never sent to the client) under `/admin/college-interviews`, scoped automatically to their own college.
2. Once **published**, it appears on the student's mock-interview dashboard (`CollegeInterviewsSection`) alongside their personal AI interviews, fetched from `/mock-interview/college-interviews`.
3. Starting one calls into the **same interview creation path** as a normal AI interview, tagged `source: "COLLEGE"` — it snapshots the authored questions (never the answer key) into a regular `Interview` session, so the existing timer, proctoring (webcam + tab-switch + fullscreen), scoring, and report all apply unchanged.
4. Grading for college-authored questions is done server-side by looking up the original `CollegeInterviewQuestion` document — the answer key/expected solution never leaves the backend.

### 📄 Resume Analyzer (ATS + Skill Gap + Live Jobs)
1. PDF uploaded → text extracted with `pdfjs-dist` (tolerant of scanned/invalid-XRef PDFs).
2. Text is parsed and analyzed **locally** (`src/services/localResumeParser.ts` + `localResumeAnalyzer.ts` — deterministic section/skill/experience extraction, no external AI call) into skills, experience, strengths/weaknesses, ATS issues, missing keywords, and a transparent **ATS score**; `ai-services`' local `resume_enhancer.py` model is used for AI-assisted rewriting of specific sections, not scoring.
3. Backend queries **Adzuna** for live jobs (Bengaluru) matching the top inferred role — optional, the app runs normally if unconfigured.
4. Per job: resume skills vs. job skills → matched/missing skills, a fit score, and locally-derived upskilling suggestions.
5. UI shows each job with its fit summary and a direct apply link.

### 🛠️ Resume Builder
Multi-step form (personal info, education, experience, skills, projects, summary) → optional AI-assisted content generation/enhancement → live preview across 3 templates → ATS evaluation → PDF export via `html2canvas-pro` (Tailwind v4/`oklch()`-compatible) + `jsPDF`.

### 💼 Jobs & Eligibility
Admin creates a job with an `eligibility` object: `{ minimumCGPA, maximumBacklogs, allowedDepartments[] }` (blank/empty = no restriction on that axis — **CGPA, backlogs, and department are the only criteria**, nothing else is hardcoded). `computeJobEligibility(job, student)` (`src/utils/jobEligibility.ts`) normalizes department names (e.g. `CSE` → `computer science`) and returns `{ eligible, reasons[] }`. A per-(student, job) `JobEligibility` snapshot is stored and **recalculated automatically** on job create/edit (and via manual recalculate); eligibility is **re-verified server-side** at apply time regardless of the snapshot. Admins can view eligible/not-eligible lists with reasons, export them (Excel/CSV, frontend-side), and **notify eligible students** — deduped via a unique `(student, job)` index so re-notifying never double-sends, and inactive accounts are skipped.

### 🎓 Alumni Network
Admin manages alumni records and any job **opening** they're referring, through the separate `placement-admin-be` service (own JWT, own DB collection, no relation to student accounts). The public "openings" list is read with no login and rendered on the frontend's Alumni pages.

### 🧠 RAG (local vector store, Pinecone optional)
Attempts and questions are embedded **locally** (Ollama, `nomic-embed-text`) and stored in a vector index for semantic retrieval, so similar past Q&A can enrich AI-generated answers and reduce duplicate question generation. The index itself is a local, MongoDB-backed store (`src/services/vectorStore.ts` + `src/models/VectorEmbedding.ts`, brute-force cosine similarity — plenty fast at this app's scale) by default; if `PINECONE_API_KEY` is set (and `LOCAL_ONLY` isn't `true`), Pinecone's managed index is used instead with the exact same calling code. See [Zero External AI by Default](#zero-external-ai-by-default).

### 🤖 Chatbot
A separately trained (`npm run train:chatbot` in `placement-prep-be`) intent/QA model answers platform and placement-process questions; `npm run eval:chatbot` / `chatbotUnanswered` / `evalHybrid` support iterating on its accuracy.

---

## Custom Proctoring Model Training

To detect mobile phones and headsets, train the YOLO model locally:

1. **Collect data**: `cd ai-services/training && python collect_data.py --output ../datasets/raw_images --count 100 --interval 1.0` (hold phones/wear headsets while it captures).
2. **Annotate**: upload `datasets/raw_images` to [Roboflow](https://roboflow.com/) or CVAT, box + label `mobile_phone` (class 0) / `headset` (class 1), export as **YOLOv8**, extract into `ai-services/datasets/mindprep_proctoring`.
3. **Train**: verify `ai-services/training/dataset.yaml` points at your dataset, then `python train_yolo.py --data dataset.yaml --epochs 50`. Weights land in `ai-services/models/proctor_yolo/weights/best.pt`.
4. **Validate**: `python test_yolo.py --model ../models/proctor_yolo/weights/best.pt`, then restart `ai-services` — `ProctoringEngine` auto-loads the custom `best.pt`.

## Local Interview-Question LLM

The mock-interview question generator is a **small language model fine-tuned entirely on-machine** (`ai-services/interviewer_llm/`) — no OpenAI/Gemini/Claude/Groq/NIM call is used in this pipeline, at training or inference time. The only place Groq is still used anywhere in the app is the developer-run-only `npm run gen:aptitude` script (see [Zero External AI by Default](#zero-external-ai-by-default)) — never this pipeline. Pipeline (see `ai-services/interviewer_llm/TRAINING.md` for full detail):

1. **Dataset**: Kaggle `syedmharis/software-engineering-interview-questions-dataset` (200 rows) merged with ~900 curated in-repo questions.
2. **Cleaning**: dedup + validity filtering → 1049 unique questions (`training/clean_dataset.py`).
3. **Splits**: 80/10/10 instruction-format train/val/test (`training/prepare_splits.py`).
4. **Fine-tuning + inference**: `interviewer_llm/inference.py` serves the fine-tuned model; `question_validator.py` sanity-checks generations before they reach a student. Weights/outputs are gitignored (`interviewer_llm/models/`, `interviewer_llm/outputs/`) — reproduce by following `TRAINING.md`.

---

## Zero External AI by Default

MindPrep AI runs with **no external AI inference API required** — every AI feature (interview/quiz question generation, answer evaluation, resume analysis and enhancement, the chatbot, proctoring, and speech-to-text/text-to-speech) uses a locally-run model or deterministic logic by default. This wasn't the original design — it's the result of an explicit migration, fully documented (audit trail, every call site, every decision, and how each change was verified) in **[`docs/LOCAL_AI_MIGRATION_AUDIT.md`](docs/LOCAL_AI_MIGRATION_AUDIT.md)**.

**What's local by default:**
- Mock-interview and quiz question generation — the fine-tuned `interviewer_llm` (see above), with an offline question-bank fallback.
- Answer evaluation and interview feedback — deterministic/local (`ai-services/local_answer_evaluator.py`).
- Resume parsing, ATS scoring, and skill-gap analysis — deterministic local logic (`localResumeParser.ts`/`localResumeAnalyzer.ts`); `resume_enhancer.py`'s local model only rewrites specific text sections, never the score.
- The chatbot — a locally trained intent/QA model.
- Proctoring — MediaPipe, YOLO, OpenCV, InsightFace, ONNX Runtime, all local.
- Speech — `faster-whisper` (STT) and `pyttsx3`/Windows SAPI (TTS), both offline.
- Vector search / RAG — a local, MongoDB-backed vector store by default (`src/services/vectorStore.ts`).

**What's still optionally external, and why:**
- **Pinecone** (`PINECONE_API_KEY`) — an optional managed-cloud alternative to the local vector store, used only if you explicitly configure it. Never required.
- **`npm run gen:aptitude`** (`placement-prep-be/src/scripts/generateAptitudeQuestions.ts`) — a developer-run-only CLI for bulk-authoring the aptitude question bank offline, using Groq. It is never invoked by the deployed app or any request.

**Enforcing zero network AI calls:** set `LOCAL_ONLY=true` in `placement-prep-be/.env`. This makes the backend ignore a configured `PINECONE_API_KEY` outright (vector search always uses the local store) and makes `npm run gen:aptitude` refuse to run instead of silently calling Groq. Nothing else needs gating — everything else already never makes an external AI call, flag or no flag.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Main backend exits immediately | Missing `MONGO_URI`/`MONGO_URL` in `placement-prep-be/.env` — it's the only variable that blocks startup |
| Frontend can't reach the main backend | Check `MindPrepAI-FE/src/config/config.ts` / `VITE_BACKEND_URL` matches the backend's actual `PORT` |
| Alumni pages fail to load | `placement-admin-be` isn't running on `:5001`, or `.env` wasn't seeded (`npm run seed`) |
| AI features (quiz/interview gen, resume) return errors | Check `ai-services` (`python server.py`) is up on `:8000` and `AI_SERVICE_URL`/`AI_SERVICE_KEY` match between backend and `ai-services` |
| Proctoring never connects, or takes ~2s every time | Use `127.0.0.1`, not `localhost`, for `PROCTOR_WS_URL`/`VITE_PROCTOR_WS_URL` (Windows IPv6-first resolution) |
| Interview questions look generic/repeated | The `interviewer_llm` weights may be missing — check `ai-services/interviewer_llm/models/`; falls back to a smaller local model, then the offline question bank, automatically (no external call at any step) |
| Voice answers aren't transcribed / STT errors | First request downloads the `faster-whisper` model (needs internet once, ~150 MB for `base`); check `ai-services` logs for the actual error |
| Vector search / RAG features error out | If `PINECONE_API_KEY` is set, verify it's valid; unset it (or set `LOCAL_ONLY=true`) to use the local MongoDB-backed vector store instead — no key needed |
| `npm run gen:aptitude` refuses to run | You have `LOCAL_ONLY=true` set — this script calls Groq by design; unset `LOCAL_ONLY` (or run without it) to use it |
| PDF download fails | `npm install` in `MindPrepAI-FE` for `html2canvas-pro`, then hard-refresh |
| Model weights missing on `ai-services` | Let it auto-download on first run (needs internet, ~900 MB) |
| `npm install` peer-dependency errors | `npm install --legacy-peer-deps` |
| CORS errors | `placement-prep-be`/`placement-admin-be` use `cors()`; `ai-services` uses `allow_origins=["*"]` — check the actual origin/port, not CORS config |

---

## Project Structure

```
MindPrep-AI/
├── docs/
│   └── LOCAL_AI_MIGRATION_AUDIT.md    # Full audit trail of the zero-external-AI migration
│
├── MindPrepAI-FE/                     # Frontend (React + Vite)
│   └── src/
│       ├── admin/                     # Admin API clients (jobs, alumni, college interviews) + types
│       ├── components/                # Shared UI, admin/, interview/, mock-interview/, resume-builder/, common/ (FullscreenGuardModal, ...)
│       ├── pages/                     # Student pages + admin/ pages
│       ├── hooks/                     # useInterview, useFullscreenMonitor, useTabSwitchMonitor, ...
│       ├── utils/                     # fullscreenTracker, ...
│       ├── services/                  # mockInterviewApi.ts and other backend clients
│       └── config/config.ts           # BACKEND_URL, ADMIN_API_URL, AI_SERVICE_URL, PROCTOR_WS_URL
│
├── placement-prep-be/                 # Main backend (Express + TypeScript)
│   └── src/
│       ├── controllers/               # auth, questions, mock-interview, resume, jobs, aptitude, tech-quiz, admin/
│       ├── routes/                    # /api/v1 route definitions (adminRoutes, collegeRoutes, mockInterviewRoutes, ...)
│       ├── models/                    # User, Interview, College, CollegeInterview, CollegeInterviewQuestion, Job, VectorEmbedding, ...
│       ├── services/                  # aiService, vectorStore (local RAG store), interviewRagService, localResumeParser/Analyzer, chatbot/
│       ├── scripts/                   # createCollegeAdmin, generateAptitudeQuestions (LOCAL_ONLY-gated), chatbot train/eval scripts
│       ├── middleware/                # auth, restrictTo, error handlers
│       └── config/                    # db, env (LOCAL_ONLY, no AI key required to boot), pinecone (optional)
│
├── placement-admin-be/                # Alumni-network backend (Express + TypeScript, standalone)
│   └── src/
│       ├── controllers/               # alumni, + scaffolded application/aptitude/company/interview/job/student
│       ├── routes/                    # alumni.routes.ts (the one actually consumed by the frontend), + others
│       ├── models/                    # Alumni, Admin, + scaffolded models
│       └── config/                    # db, env, swagger
│
└── ai-services/                       # Python AI + proctoring microservice(s)
    ├── app/                           # FastAPI app (proctoring)
    │   ├── routes/                    # proctor.py (WebSocket), health.py
    │   └── services/                  # face_service, yolo_service, proctoring_engine, verification_service
    ├── interviewer_llm/               # Local fine-tuned interview-question LLM (training + inference)
    ├── training/                      # YOLO phone/headset detector training pipeline
    ├── chatbot/                       # Chatbot model data/training
    ├── server.py                      # Flask app — question gen, resume, tech-quiz, STT/TTS
    ├── run.py                         # FastAPI entrypoint (proctoring WebSocket, :8001)
    ├── interview_question_service.py  # Question generation orchestration + local fallback chain
    ├── local_question_generator.py    # Local LLM-backed question generator
    ├── local_answer_evaluator.py      # Local answer scoring
    ├── resume_enhancer.py             # Resume content AI-enhancement (local model)
    ├── tech_question_engine.py        # Tech-quiz question selection
    ├── riva_service.py                # Local STT (faster-whisper) / TTS (pyttsx3+SAPI); optional NVIDIA Riva
    └── requirements.txt
```

---

## License

Built for educational / placement-preparation purposes. Use your own API keys and follow each provider's terms of service.
