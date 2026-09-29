# MindPrep AI 🚀

**AI-powered Placement Preparation & Campus Recruitment Platform.** A complete career-prep suite (quizzes, aptitude tests, tech quizzes, AI mock interviews with live proctoring, resume analyzer + builder, job drives with eligibility screening, alumni network) for students, plus admin/college panels to run and manage it all.

The project is a **monorepo** with **four independent services**:

| Folder | Service | Stack | Default Port |
|---|---|---|---|
| `MindPrepAI-FE` | Frontend web app (student + admin UI) | React 18 + TypeScript + Vite 7 + Tailwind v4 | `5173` |
| `placement-prep-be` | Main backend API (auth, quizzes, mock interviews, resume, jobs, colleges) | Node.js + Express + TypeScript + MongoDB (Mongoose) | `5000`* |
| `placement-admin-be` | Placement-admin backend (alumni network + admin resources, admin-only) | Node.js + Express + TypeScript + MongoDB (Mongoose) | `5001` |
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
9. [AI Interview Performance & Improvement System (deep dive)](#ai-interview-performance--improvement-system-deep-dive)
10. [Live Proctoring, Pin to Pin](#live-proctoring-pin-to-pin)
11. [Reference: Frontend Routes, Backend Modules & Data Models](#reference-frontend-routes-backend-modules--data-models)
12. [Custom Proctoring Model Training](#custom-proctoring-model-training)
13. [Local Interview-Question LLM](#local-interview-question-llm)
14. [Zero External AI by Default](#zero-external-ai-by-default)
15. [Testing & Verification](#testing--verification)
16. [Troubleshooting](#troubleshooting)
17. [Project Structure](#project-structure)

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
           │ REST (admin JWT; SSO via MAIN_JWT_SECRET)
           └───────►┌──────────────────────────┐
                    │  placement-admin-be         │  Alumni network + admin resources (admin-only)
                    │  Express + TS  (:5001)     │  public: alumni openings list
                    └──────────────────────────┘
```

**Flow:**
- The **browser (React)** is the only client. It talks to **`placement-prep-be`** for everything student/admin-facing (auth, quizzes, interviews, resume, jobs, colleges) and directly to **`ai-services`** for live webcam proctoring frames and voice.
- **`placement-prep-be`** talks to **MongoDB** (all core data, plus a local, MongoDB-backed vector store used for semantic search / RAG by default) and calls into **`ai-services`** (Flask, `:8000`) for AI question generation, resume analysis/enhancement, and answer evaluation — all of which run on local models with zero external AI API calls. **Pinecone is optional** (dotted line above): if `PINECONE_API_KEY` is set, it's used instead of the local vector store for the same RAG feature; if not (or if `LOCAL_ONLY=true`), the local store is used automatically. Nothing about vector search requires Pinecone.
- **`ai-services`** runs **two independent Python processes**: a **FastAPI** app (`run.py`, `:8001`) that accepts a WebSocket per interview session and runs real-time face/eye/head-pose tracking (MediaPipe) + phone/object detection (YOLO) on incoming webcam frames; and a **Flask** app (`server.py`, `:8000`) that serves question generation (via a **locally fine-tuned LLM**, no external API key required — see [Local Interview-Question LLM](#local-interview-question-llm)), resume enhancement, tech-quiz question selection, and **local** speech-to-text/text-to-speech (faster-whisper + pyttsx3/SAPI — see [Zero External AI by Default](#zero-external-ai-by-default)).
- **`placement-admin-be`** is a **separate, standalone Node service**. The frontend's admin **Alumni Management** pages call it directly via `ADMIN_API_URL`. **Every admin resource requires an admin token** (dashboard, students, companies, jobs, applications, interviews, aptitude tests, alumni); only the student-facing alumni-openings list (`GET /api/alumni-openings`) is public. It accepts either its own admin login token or — **single sign-on** — the token of an admin signed in to the MindPrep admin panel (issued by `placement-prep-be`), verified with `MAIN_JWT_SECRET`. Student and forged tokens are rejected.

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
  - **Explainable feedback after every interview** — not just "Score: 72%": ten scored metrics per answer, a **"Why this score?"** drawer for each, answer-structure analysis (chosen per question type), speaking analysis and a quality timeline, question-wise verdicts, a recurring-weakness map, **Practice Again** with per-attempt storage and a before/after comparison, progress charts across interviews, and a **personalised next interview** built from your own history. See the [deep dive](#ai-interview-performance--improvement-system-deep-dive).
- 🏫 **College interviews** — students can take interview templates **published by their own college's admin** (technical/HR/behavioral/coding/mixed, MCQ or subjective), shown alongside their regular AI mock interviews on the same dashboard and running through the exact same interview room, timer, proctoring, and report pipeline.
- 📄 **Resume analyzer** — upload a PDF → text extraction → **ATS score**, strengths/weaknesses, missing keywords, plus **live jobs in Bengaluru** (Adzuna) with per-job skill-gap analysis and upskilling suggestions.
- 🛠️ **Resume builder** — multi-step form, 3 templates, AI-assisted content generation, ATS evaluation, **PDF export**.
- 💼 **Jobs & applications** — browse open job drives, see live eligibility (or the exact reason you're not eligible), apply, and track application status (applied → shortlisted → rejected → selected).
- 🔔 **Notifications** — unread badge, feed, mark-read/mark-all-read (e.g. "you're eligible for X").
- 📊 **Personalized reports** — categorized weak areas with recommended resources/videos.
- 🤖 **Chatbot** — a fine-tuned Q&A assistant for platform/placement questions.
- 🧠 **RAG (local by default)** — embeddings (local, via Ollama) + semantic retrieval to reuse stored questions and enrich AI answers, backed by a local MongoDB vector store by default (Pinecone optional — see [Zero External AI by Default](#zero-external-ai-by-default)).

### Admin panel (`/admin`, part of the same frontend, `placement-prep-be`)
- **Dashboard** with real platform-wide stats (students, interviews, resume analyses, jobs, average ATS score, placement readiness) and four charts (interview performance, ATS score distribution, placement readiness, student activity) — all computed from stored data, no placeholder numbers.
- **Reports & Analytics** (`GET /admin/reports?days=7|30|90|365`): KPIs, interview performance, ATS distribution, placement readiness, student activity and the **weakest aptitude / tech topics**, filtered by the selected date range; **export to PDF or Excel (CSV)**.
- Student management (view/edit/verify/reject, set placement status); the ATS column shows the student's latest saved Resume Analyzer score (or "Not analysed").
- Resume, interview, and aptitude oversight; aptitude question/topic/test bank CRUD.
- **Jobs**: create/edit/delete/activate/deactivate/close; per-job applications with shortlist/reject/select.
- **Eligibility & notifications**: eligibility computed purely from **CGPA, backlogs, and department** (see [Eligibility Model](#-jobs--eligibility)); eligible/not-eligible lists with reasons; one-click "notify eligible students" (deduped); Excel/CSV export.
- **Admin notifications** are delivered to each targeted student's notification feed; deleting one removes the students' copies too.
- **College interviews**: create/edit/publish/close interview templates scoped to the admin's own college; author MCQ/technical/coding/behavioral/HR questions, reorder, duplicate.
- Announcements and settings (admin display name/email).
- **UI**: a glossy two-colour theme (indigo + violet) — frosted-glass cards, tables and inputs over a soft indigo/violet backdrop, a dark-glass sidebar with grouped navigation, glossy page banners, stat tiles and buttons. Red is used only for errors, destructive actions and problem indicators. See [Admin Panel UI](#-admin-panel-ui).

### Alumni network (`placement-admin-be`, separate service)
- Admin-only CRUD for alumni records (name, grad year, department, current company/role, LinkedIn) and any job **opening** they're referring.
- Public listing of current alumni openings (`GET /api/alumni-openings`), consumed by the student-facing pages (no login required for read).

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
| `MAIN_JWT_SECRET` | ⚠️ | **Single sign-on with the MindPrep admin panel.** Set it to `placement-prep-be`'s `JWT_SECRET` so admins signed in to `/admin` can use the alumni pages with the same token. Leave empty to accept only this service's own admin tokens (the admin panel's Alumni pages will then get `401`) |
| `CLIENT_URL` | ⚠️ | Frontend origin allowed by CORS (default `http://localhost:5173`) |
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

**Mock Interview** — `POST /mock-interview/create`, `GET /mock-interview/dashboard`, `GET /mock-interview/college-interviews`, `GET /mock-interview/college-interviews/:id`, `GET /mock-interview/:id`, `GET /mock-interview/:id/state`, `POST /mock-interview/:id/regenerate-questions`, `POST /mock-interview/:id/answer`, `POST /mock-interview/:id/skip`, `POST /mock-interview/:id/cheating`, `POST /mock-interview/:id/terminate`, `GET /mock-interview/:id/report`, and the feedback-loop endpoints `GET /mock-interview/progress`, `GET /mock-interview/personalization?interviewType=`, `GET /mock-interview/:id/question/:questionId/history`, `POST /mock-interview/:id/question/:questionId/reattempt` (request/response shapes in the [deep dive](#api-reference-mock-interview-feedback))

**Resume** — `POST /resume/analyze`, `POST /resume/enhance`, `POST /resume/parse`, `POST /resume/parse-text`, `POST /resume/auto-fix`, `POST /resume/evaluate-builder`

**Aptitude** — `POST /aptitude/save-result`, `GET /aptitude/my-results`, `GET /aptitude/my-stats`, `GET /aptitude/topics`, `GET /aptitude/companies`, `GET /aptitude/tests[/:id]`, `GET /aptitude/tests/:id/questions`, `POST /aptitude/tests/:id/submit`, `GET /aptitude/practice`, `POST /aptitude/practice/submit`, `POST /aptitude/test/start`, `GET /aptitude/test/:attemptId`, `POST /aptitude/test/:attemptId/submit`, `GET /aptitude/progress`, `GET /aptitude/history[/:attemptId]`, `GET /aptitude/questions`

**Tech Quiz** — `GET /tech-quiz/technologies`, `POST /tech-quiz/start`, `POST /tech-quiz/:attemptId/answer`, `POST /tech-quiz/:attemptId/finish`, `GET /tech-quiz/history`

**Jobs / Applications** — `GET /jobs/search`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/apply`, `GET /applications/my`

**Notifications** — `GET /notifications/my`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`

**Colleges** — `GET /colleges`, `GET /colleges/me`, `PUT /colleges/me`

**Chatbot** — `GET /chatbot/info`, `POST /chatbot/chat`

**Analytics** — `GET /analytics/me`

**Admin** (`protect` + `restrictTo("admin")`) — dashboard (`GET /admin/dashboard`), **reports** (`GET /admin/reports?days=N`, also feeds the dashboard charts), students, interviews, aptitude results + question/topic/test bank, notifications (delivered to students' feeds), announcements, jobs (CRUD + status + applications + eligible/ineligible students + recalculate + notify-eligible), application status, and **college interviews** (`/admin/college-interviews...` — CRUD, status, question CRUD, reorder, duplicate). Full list in `src/routes/adminRoutes.ts`.

### `placement-admin-be` — port 5001, admin-only (except the public openings list)

- `POST /api/admin/login`, `POST /api/admin/refresh`, `POST /api/admin/logout`, `GET /api/admin/me` — this service's own admin login
- `GET|POST /api/admin/alumni`, `GET|PUT|DELETE /api/admin/alumni/:id` — alumni and their openings (**admin token required**)
- `/api/admin/dashboard`, `/students`, `/companies`, `/jobs`, `/applications`, `/interviews`, `/aptitude-tests` — admin resources (**admin token required**); the frontend currently consumes only the alumni endpoints
- `GET /api/alumni-openings` (**public**) — current job openings referred by alumni
- Accepted tokens: this service's own admin access token, or a `placement-prep-be` admin token when `MAIN_JWT_SECRET` is set. No token → `401`; student / forged token → `401`/`403`.
- Swagger UI at `/api/docs` documents the full surface.

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
6. A final report is generated and stored; visible on the results page and the mock-interview dashboard. The report now includes the full explainable-feedback layer — why each score was given, answer structure, speaking analysis, weaknesses, **Practice Again**, progress and a personalised next interview — described in [AI Interview Performance & Improvement System](#ai-interview-performance--improvement-system-deep-dive).

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
Admin manages alumni records and any job **opening** they're referring, through the separate `placement-admin-be` service (own DB collection, no relation to student accounts). The admin panel's Alumni pages send the admin's token (`adminToken`); `placement-admin-be` accepts it when `MAIN_JWT_SECRET` matches `placement-prep-be`'s `JWT_SECRET`. The public "openings" list is read with no login.

### 📈 Admin Reports & Analytics
`GET /admin/reports?days=N` (`controllers/admin/reportsController.ts`) aggregates **stored** data for the chosen window: interviews (taken, completed, terminated, average score), aptitude and tech-practice sessions, saved ATS scores, cheating events and job applications, plus per-day activity and the weakest aptitude/tech topics (topics with at least 5 answers). **Placement readiness** is the average of each student's own interview, aptitude, tech-practice and ATS scores (whichever exist); students with none count as "No activity yet". The Resume Analyzer saves each student's latest ATS score on the `User`, which feeds the ATS KPI, chart and Resume/Student Management. The page exports the same data to PDF (`jsPDF`) or CSV.

### 🎨 Admin Panel UI
The admin pages share a small component kit in `MindPrepAI-FE/src/components/admin/` (`AdminLayout`, `PageHeader`, `StatCard`, `Card`, `ChartCard`, `Table`, `Button`, `Inputs`, `Modal`, `Badge`, …):
- **Theme**: two colours only — indigo and violet (`gradients.ts`, `chartTheme.ts`), with slate neutrals; red only for errors, deletes and problem indicators.
- **Glossy finish**: `admin.css` defines `.admin-backdrop` (soft indigo/violet mesh), `.glass` / `.glass-strong` / `.glass-dark` (frosted surfaces) and `.gloss` / `.gloss-sm` (specular shine + hover sweep) used by banners, stat tiles, buttons and icon chips.
- **Layout**: dark-glass sidebar grouped into Overview, Students, Assessments, Placements and System, with the signed-in admin and logout at the bottom; sticky frosted top bar with a breadcrumb; responsive slide-in menu on phones.

### 🧠 RAG (local vector store, Pinecone optional)
Attempts and questions are embedded **locally** (Ollama, `nomic-embed-text`) and stored in a vector index for semantic retrieval, so similar past Q&A can enrich AI-generated answers and reduce duplicate question generation. The index itself is a local, MongoDB-backed store (`src/services/vectorStore.ts` + `src/models/VectorEmbedding.ts`, brute-force cosine similarity — plenty fast at this app's scale) by default; if `PINECONE_API_KEY` is set (and `LOCAL_ONLY` isn't `true`), Pinecone's managed index is used instead with the exact same calling code. See [Zero External AI by Default](#zero-external-ai-by-default).

### 🤖 Chatbot
A separately trained (`npm run train:chatbot` in `placement-prep-be`) intent/QA model answers platform and placement-process questions; `npm run eval:chatbot` / `chatbotUnanswered` / `evalHybrid` support iterating on its accuracy.

---

## AI Interview Performance & Improvement System (deep dive)

The mock-interview module does not stop at "Score: 72%". After every interview it explains **what went well, what went wrong, why each score was given, how to improve, what to practise, and whether you improved compared with earlier attempts** — and it feeds that knowledge back into your *next* interview. Everything runs on the existing **local** evaluator (`ai-services/local_answer_evaluator.py`); there is no OpenAI/Gemini/Claude/Groq dependency anywhere in this loop.

### The feedback loop

```
START MOCK INTERVIEW ──► QUESTION ──► ANSWER (text or voice) ──► LOCAL AI EVALUATION
        ▲                                                              │
        │                                                              ▼
 PERSONALISED NEXT ◄── UPDATE INTERVIEW ◄── BEFORE vs AFTER ◄── DETAILED FEEDBACK
   INTERVIEW              PROFILE           (attempts 1..n)     + "WHY THIS SCORE?"
        ▲                                                              │
        │                                                              ▼
        └───────────────  RE-EVALUATE  ◄───  PRACTICE AGAIN  ◄──  IDENTIFY WEAKNESS
```

| Loop step | Where it happens |
|---|---|
| Question, answer | `InterviewRoom.tsx` (proctored). Voice answers also send **audio measurements** (see [Speaking analysis](#speaking-analysis-and-what-is-never-invented)). |
| AI evaluation | `POST /mock-interview/:id/answer` → Flask `POST /evaluate-answer` → `evaluate_answer()`. Non-final answers are evaluated in the background; the last one inline. |
| Detailed feedback, Why this score, weaknesses | Report page (`InterviewResult.tsx`) built from `GET /mock-interview/:id/report` → `feedback`. |
| Practice Again, re-evaluate, before/after | Report page → `POST …/question/:questionId/reattempt`. |
| Update profile, personalise next interview | Derived from stored evaluations at read time (no separate profile collection); applied when the next interview is created. |

### What is produced for every answer

The evaluator returns the six original scores **unchanged** plus four new ones and a structured `analysis` object:

| Metric | How it is computed (all from the answer text, the question's expected concepts, and — for voice — measured audio) |
|---|---|
| **Technical Accuracy** | `20 × lengthFactor + 80 × conceptCoverage` (share of the question's expected concepts found in the answer) |
| **Relevance** | overlap between the answer's stemmed words and the question/concept vocabulary |
| **Fluency** | length factor + filler-word ratio + sentence-length sanity |
| **Grammar** | length factor + lexical variety, minus penalties (no ending punctuation, no capitals, repeated `!`/`?`) |
| **Communication** | `0.4 × Fluency + 0.3 × Grammar + 0.3 × Relevance` |
| **Confidence** | length factor + coverage, minus 10 per hedging phrase ("I think", "not sure", …) |
| **Answer Structure** *(new)* | weighted share of the structure elements the answer contains (see below) |
| **Completeness** *(new)* | `100 × (0.7 × coverage + 0.3 × min(1, words ÷ typical minimum length))` |
| **Clarity** *(new)* | starts at 85; minus hedging, very long sentences, run-ons (typed answers only), repeated phrases, fillers |
| **Conciseness** *(new)* | 100 minus over-length, filler, repetition and "main point arrived late" penalties; capped at 40 under 10 words (too short is *incomplete*, not concise) |

`lengthFactor` is 0 for no words, 0.2 under 5, 0.55 under 15, 0.85 under 40, else 1.

**Where the expected concepts come from** (reported in `analysis.conceptSource`): the question's own stored concepts (resume questions) → the `topic_concepts.json` entry for its skill/topic → the `hr_behavioral_dataset.json` tags → *last resort:* the meaningful words of the question itself (`question-words`). In that last case the feedback says so ("no stored answer key…") and the "main point"/"covered" claims are switched off, so weak evidence is never dressed up as strong evidence.

### "Why this score?"

Each score card has a **Why this score?** button that opens a drawer (right side on desktop, bottom sheet on phones; `Esc` closes it):

```
Technical Accuracy — 78%
✓ What was good      • Correctly covered: normalization, redundancy
✗ What was missing   • Did not mention: normal form, 1nf, 2nf
→ How to improve     • Review normal form, 1nf, 2nf …  • Practice more DBMS – Normalization questions
ℹ Note (only when relevant): no stored answer key existed, so scoring used the question's own wording
```

Every line is derived by `build_explanations()` in `ai-services/interview_feedback_analysis.py` from a measurement — matched/missing concepts, the actual hedging phrases found, filler counts, sentence length, structure elements, measured pauses. Nothing is written by a language model, so nothing is made up. Ten metrics → ten explanations, stored with the answer.

### Answer structure analysis

The structure is chosen **per question type**, never forced on every answer (`classify_question()`):

| Question type | Chosen when | Framework checked |
|---|---|---|
| `technical` | default for technical questions | Definition → Explanation → Example → Conclusion |
| `behavioral` | Behavioral interviews; HR questions with situational wording ("tell me about a time…", conflict, deadline…) | Situation → Task → Action → Result (STAR) |
| `project` | resume-interview project questions (`skill = "Project"`) or wording like "your project" | Problem → Technology → Implementation → Your contribution → Result |
| `hr` | other HR/opinion questions ("why should we hire you?") | Direct answer → Reason → Example → Link to the role |

Detection is **cue-based** (transparent phrase patterns such as "for example", "as a result", "my task was"). Each element found records the sentence fragment it matched, shown under "Where I found each part". The UI shows the score, found/missing elements, and a recommendation such as *"Start with the problem, explain your implementation, then clearly state your contribution and result."* A footnote states it shows what the answer *contains*, not whether it is correct — correctness is the Technical score's job. Positions are word-based, so unpunctuated voice transcripts still work.

### Speaking analysis (and what is never invented)

| Metric | Source | If it cannot be measured |
|---|---|---|
| Speaking duration | Real recording length (`speech.recordingSeconds`) | falls back to **"Time on question"**, labelled as including thinking time; never mixed with recording durations |
| Words, filler words, repeated phrases, hedging | Counted from the transcript / typed text | always available |
| Long pauses (≥ 2 s) | **Measured audio**: `useMicrophone` runs an energy-based silence detector on the same mic stream; silences ≥ 1 s *after speech began* are recorded, the backend counts those ≥ 2 s. Leading/trailing silence is ignored. | **"Not available"** for typed answers, or when the browser could not run the detector |
| Speaking rate | `words ÷ recorded minutes`, only with ≥ 8 s of audio and ≥ 10 words. Slow < 110, Normal 110–170, Fast > 170 wpm | **"Not available"** |
| Length verdict | words vs a per-type typical range (technical 35–160, behavioral 70–220, project 60–220, HR 40–180) | always available |

Honest caveats printed in the UI: filler counts on voice answers can under-report because speech recognition often drops "um/uh"; pause detection is approximate (a noisy room raises the noise floor).

### Answer-quality timeline

A track from the start to the end of the answer with 🟢 good / 🟡 watch / 🔴 missing markers (definition present, filler word "like", hedging "I think", long pause 3.4 s, missing conclusion, …). Rules that keep it honest:
- Markers are placed at their **real position in the transcript** (fraction of the words).
- **Clock times appear only for audio-measured pauses.** A typed answer has no timestamps at all, and the footnote says so.
- Items that are simply absent ("Missing conclusion") are listed as "not found in the answer" instead of being pinned somewhere.

### Practice Again, attempts, and Before vs After

1. Under any answered question, **Practice Again** opens a panel with the same question (type or speak).
2. `POST …/reattempt` stores a **new attempt** with its own answer, transcript, audio metrics, scores, feedback and timestamp. **Attempt 1 (the interview answer) and earlier attempts are never overwritten**, and practice **never changes the interview's official scores or its proctoring record**.
3. Attempts live in `Interview.questions[i].attempts[]` (attempt 1 stays in the existing `answer`/`evaluation` fields, so every old reader keeps working). Up to **10 attempts** per question; a guarded atomic push prevents two simultaneous requests from creating duplicate attempt numbers (`409` for the loser).
4. With ≥ 2 attempts the UI shows a **Before vs After** table and an "Improvement (attempt 1 → 5): Confidence +8 · Filler words −3" line. **Only metrics present on at least two attempts are shown**; filler words are "lower is better"; duration is compared only when every attempt measured the same thing.
5. Practice is available only **after the interview has finished**, so the proctored session is never touched. It is **disabled for college interviews** — their feedback names the answer key, and they are assessments.

### Question-wise feedback

The report lists every question with a verdict — **✓ Strong answer / ⚠ Needs improvement / 🔴 Weak technical explanation / ✓ Excellent project explanation / Skipped / Not evaluated** (question score = the mean of the six original metrics: ≥ 75 strong, ≥ 55 improve, otherwise weak). Clicking a question opens: your answer (labelled *transcript* for voice), the score cards with Why-this-score, structure card, speaking analysis, timeline, strengths / weaknesses / how to improve / topics to practise, attempts + comparison, and Practice Again. Questions chosen because of your history carry a **Targeted: DBMS – Transactions** badge.

### Overall performance summary & weakness map

- **Overall Interview Performance**: per-metric averages over the *evaluated* answers, **strongest area**, **needs most improvement**, and one **main recommendation** (for a weak structure score it names the framework you most often missed, e.g. "Focus on structuring your answers using Definition → Explanation → Example → Conclusion"). A newer metric is shown only if *every* evaluated answer has it, so old and new data are never averaged together misleadingly.
- **Weakness map**: buckets built only from real answers — **topics** (per skill, e.g. DBMS, or "Project explanation") and **skills** (Answer Structure, Communication, …). An answer is *weak* below 65. An area is listed when it was weak in **≥ 2 answers, or in ≥ 50 % of the answers that touched it**; bar length = frequency × how far below the threshold. **Strong areas** are those averaging ≥ 75 with no weak answer. Skipped, unanswered and un-evaluated answers are ignored.
- **Proctoring summary**: only what is actually stored — tab switches, full-screen exits, any other recorded events, and whether the interview was auto-terminated. Camera detections (face/gaze/phone) run live and are **not persisted**, so the card says so instead of claiming "no phone detected".

### Progress across interviews

`GET /mock-interview/progress` returns one point per finished AI/resume interview (last 30, oldest → newest). The report and the mock dashboard render **six small charts** — Technical, Communication, Confidence, Fluency, Relevance, Structure (Recharts; single axis, hover tooltips, current interview highlighted, and a **View as table** toggle) — plus "▲ +15 (61→76)" chips. Improvement is shown only when both ends have the metric, so no trend is fabricated. The dashboard also shows recurring weaknesses over the last 10 interviews.

### Personalised next interview

`GET /mock-interview/personalization?interviewType=Technical` (shown on the setup page) and `POST /mock-interview/create` both use your last **6 finished, non-college interviews**:
- A skill/topic becomes a **focus area** only if it was weak in **at least two answers** ("repeated struggle"; max 3 areas).
- For **Technical** and **Resume** interviews the AI service draws about **40 %** of the questions from those areas (only skills that exist in the local dataset are honoured); the interview stores what was planned and how many questions were actually targeted (`Interview.personalization`).
- Weak **project explanation** → in a Resume interview the project share rises to ~70 %; in other types you get a *suggestion* to try a Resume-based interview — never a false claim.
- **HR/Behavioral** questions cannot be steered by topic, and skills like *Answer Structure* can't be fixed by choosing questions — those appear as **coaching** ("Answer Structure was weak in 3 of 4 answers…"), clearly separate from "what will change".
- No history, or nothing repeatedly weak → the UI says so and changes nothing. Example message: *"Your previous interviews showed difficulty with DBMS: Transactions. Your next interview will include more DBMS: Transactions questions."*

### Failure behaviour (the interview never breaks)

- If the AI service is down or returns something invalid, the answer is **saved verbatim**, its evaluation is a **fixed neutral placeholder flagged `source: "fallback"`** (the old code used random numbers — removed), the UI says *"Automatic evaluation was unavailable… reopening this report retries"*, and **no explanation is shown for it**.
- **Opening a report retries**: fallback answers *and* interviews saved before this feature existed are (re)evaluated (bounded to ~10 s overall; college interviews excluded), aggregates and the stored `InterviewReport` are recomputed, and the analysis appears.
- Every AI response is validated with **zod** (scores clamped 0–100, strings and lists capped) before it is saved; an invalid `analysis` is dropped while the scores are kept. Incoming answers are validated too (`answerType` ∈ voice/text, `timeTaken` ≥ 0, answer ≤ 20 000 chars, audio metadata dropped if malformed or on a typed answer).

### Backward compatibility

New fields have **no defaults**, so older records simply lack them and the UI shows only what exists: an older answer shows its six scores plus its original AI feedback text and a note that detailed reasons weren't recorded (until the report upgrades it, see above). College interviews keep their own grading; their report renders, they get no personalization, and their questions are not practisable.

### API reference (mock-interview feedback)

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /mock-interview/:id/answer` | Submit an answer | Body `{ answer, answerType: "voice"｜"text", timeTaken, speech? }`. `speech = { recordingSeconds, speechSeconds?, pauseDetection?, pauses?: [{ startSeconds, durationSeconds }] }`. `400` on invalid input. |
| `GET /mock-interview/:id/report` | Classic report **plus** `feedback` | `feedback = { performance, weaknessMap, questions[], proctoring, nextInterview, progress, personalizationApplied }`. Triggers the retry/upgrade described above. |
| `GET /mock-interview/:id/question/:questionId/history` | All attempts + comparison | `{ questionId, questionIndex, question, attempts[], comparison }`. `400` while the interview is unfinished. |
| `POST /mock-interview/:id/question/:questionId/reattempt` | Practice Again | Body as `/answer`. `201 { attempt, attempts, comparison, summary }`. `400` unfinished / empty / max attempts / skipped question; `403` college; `404` unknown question; `409` concurrent attempt. |
| `GET /mock-interview/progress` | Cross-interview series | `{ points[], improvement[], weaknessMap }` |
| `GET /mock-interview/personalization?interviewType=` | Plan for the next interview | `{ hasHistory, basedOnInterviews, focusAreas[], message, coaching[], suggestions[] }` |
| Flask `POST /evaluate-answer` | Local evaluation | Extra optional inputs `answerType`, `speech`, `timeTaken`; returns the legacy fields + `structureScore`, `completenessScore`, `clarityScore`, `concisenessScore`, `analysis`. |
| Flask `POST /generate-questions` | Question generation | Extra optional input `focusAreas: [{ skill, topic }]`; targeted questions come back with `focusArea`. |

### Data model additions (`Interview`)

| Field | Purpose |
|---|---|
| `questions[].transcript`, `.speech`, `.answeredAt` | Spoken text, audio measurements, when attempt 1 was submitted |
| `questions[].evaluation.{structureScore, completenessScore, clarityScore, concisenessScore, source, analysis}` | New scores, `"local"｜"fallback"`, and the validated analysis object |
| `questions[].attempts[]` | `{ attemptNumber, answer, transcript, answerType, timeTaken, speech, evaluation, createdAt }` for attempts 2…n |
| `questions[].focusArea` | Which weak area this question was chosen to target |
| `personalization` | `{ basedOnInterviews, focusAreas[], message, targetedQuestions }` |

### Where the code lives

| Layer | Files |
|---|---|
| Analysis engine (Python) | `ai-services/interview_feedback_analysis.py` (structure, communication, timeline, explanations, summaries) · `ai-services/local_answer_evaluator.py` (scores + `_extended_analysis`) · `ai-services/interview_question_service.py` (focus areas) · `ai-services/server.py` (HTTP) |
| Backend | `placement-prep-be/src/services/mockInterviewFeedback.ts` (validation, AI call + fallback, comparison, weakness map, progress, personalisation) · `controllers/mockInterviewController.ts` · `routes/mockInterviewRoutes.ts` · `models/Interview.ts` |
| Frontend | `MindPrepAI-FE/src/components/mock-interview/feedback/` — `MetricScoreGrid`, `WhyScoreDrawer`, `AnswerStructureCard`, `CommunicationCard`, `AnswerTimeline`, `StrengthWeaknessCards`, `QuestionFeedbackAccordion`, `PracticeAgain`, `AttemptComparison`, `PerformanceSummaryCard`, `WeaknessMapCard`, `ProctoringSummaryCard`, `NextInterviewPlan`, `ProgressCharts` · `types/mockFeedback.ts` · `hooks/useMicrophone.ts` (audio measurement) · pages `InterviewResult`, `MockDashboard`, `InterviewSetup` |

---

## Live Proctoring, Pin to Pin

**Two transports, two responsibilities.**

1. **Camera frames → FastAPI WebSocket** (`ai-services`, `:8001`, `WS /proctor/ws/{session_id}`). `useProctoring` sends a webcam frame at **2 FPS** (base64 JPEG). The server decodes and analyses frames in a **worker thread** and keeps only the **newest frame** (a slow analysis skips the backlog instead of drifting). It replies with `{ faceCount, faceStatus, lookingAway, lookingDirection, mobilePhone, headset, cameraObstructed, violations[] }`. This endpoint is intentionally **unauthenticated and needs no API key**.
2. **Browser-level rules → REST** (`placement-prep-be`). Tab switches and full-screen exits are detected in the browser and posted to `POST /mock-interview/:id/cheating`, which stores a `CheatingEvent`, increments persisted counters and can terminate the interview.

**What the engine detects** (`app/services/proctoring_engine.py`):

| Violation | How | Must persist for |
|---|---|---|
| `CAMERA_OBSTRUCTED` | cheap pixel-variance check that runs *before* the heavy models; a near-uniform frame means a covered lens (inference is skipped for that frame) | 2 s |
| `NO_FACE` | MediaPipe `FaceLandmarker` finds no face | 2 s |
| `MULTIPLE_FACES` | `FaceLandmarker` (configured for up to 5 faces) finds more than one | 1 s |
| `LOOKING_AWAY` | head pose beyond **20°** left/right/up/down from face landmarks | 2 s |
| `MOBILE_PHONE`, `HEADSET` | your custom YOLO weights (`models/proctor_yolo/weights/best.pt`), confidence > **0.6** (only active if the weights file exists) | instant |

Frames are JPEG (quality 0.7) base64-encoded in the browser. A **5-second cooldown** after any violation stops one event being counted repeatedly. The per-session state lives in the engine (`sessions` dict, guarded by a lock because MediaPipe/YOLO are not thread-safe).

**Escalation:** warnings escalate; **the 3rd violation terminates** the interview. Tab switches (`useTabSwitchMonitor`) and full-screen exits (`useFullscreenMonitor`) have their **own** counters (persisted in `Interview.tabSwitchCount` / `fullScreenExitCount`, so a refresh resumes where you left off); the 3rd of either sets `terminationReason` (`TAB_SWITCH_LIMIT_EXCEEDED`, `FULLSCREEN_EXIT_LIMIT_EXCEEDED`). College interviews add `TIME_LIMIT_REACHED` (server-enforced with a 30 s grace).

**Design rules that must not be broken** (they exist because of past bugs):
- Proctoring is **independent of question generation** — a slow or failed question pipeline must never delay or restart the camera. Question generation runs in the background; the interview session and its id exist immediately and the client polls `/state`.
- The camera is "ready" only when the `<video>` really has a `MediaStream` and frames are flowing — not merely because `getUserMedia()` resolved.
- The proctoring WebSocket must never require `AI_SERVICE_KEY`, `NIM_API_KEY` or any provider key.
- The explainable-feedback system never modifies any of this: practice runs after the interview, outside the proctored room.

---

## Reference: Frontend Routes, Backend Modules & Data Models

### Frontend routes (`MindPrepAI-FE/src/App.tsx`)

| Area | Route → page |
|---|---|
| Public | `/signin`, `/signup`, `/admin/signin`; `/` redirects to `/dashboard` |
| Student (`ProtectedRoute`) | `/dashboard`, `/profile`, `/personalizedreport` (cross-module analytics), `/resume-analyzer`, `/resume-builder`, `/jobs`, `/jobs/:id`, `/my-applications` |
| Mock interview | `/mock-interview/setup` → `/mock-interview/room` (proctored) → `/mock-interview/result/:id` (report + feedback + practice); `/mock-interview/dashboard` (history, progress, weaknesses, college interviews) |
| Aptitude | `/aptitude`, `/aptitude/test/:testId`, `/aptitude/practice`, `/aptitude/session/:attemptId`, `/aptitude/progress`, `/aptitude/history`, `/aptitude/result` |
| Tech practice | `/tech-practice` → `/tech-practice/quiz` → `/tech-practice/result` |
| Admin (`AdminRoute`, layout `/admin`) | index dashboard, `students`, `resumes`, `interviews`, `college-interviews/new｜:id｜:id/edit｜:id/questions`, `aptitude`, `jobs`, `jobs/create｜:id/edit｜:id/applications｜:id/eligibility`, `alumni…`, `reports`, `announcements`, `settings` |

### Key hooks (`MindPrepAI-FE/src/hooks`)

| Hook | Responsibility |
|---|---|
| `useInterview` | create/resume an interview, poll `/state` for questions, submit/skip/terminate, fetch the report; remembers the active interview per tab |
| `useWebcam` | camera lifecycle with real-frame readiness checks and typed error kinds |
| `useProctoring` | 2 FPS frame capture, WebSocket lifecycle, warning/violation counters |
| `useTabSwitchMonitor`, `useFullscreenMonitor` | independent 3-strike monitors with persisted counts |
| `useMicrophone` | recording, browser speech recognition transcript, **silence/pause measurement** for the feedback system |

### Backend module map (`placement-prep-be/src/routes/index.ts`, all under `/api/v1`)

| Mount | Controller(s) |
|---|---|
| `/auth` | `authController` (register, login, me, profile, change-password) |
| `/questions` | `questionController` |
| `/mock-interview` | `mockInterviewController`, `collegeInterviewStudentController`; logic in `services/mockInterviewFeedback.ts`, `interviewRagService.ts` |
| `/resume` | `resumeController` + `localResumeParser/Analyzer`, `pdfTextExtractor`, `resumeValidator` |
| `/aptitude`, `/tech-quiz` | `aptitudeController`, `techQuizController` |
| `/jobs`, `/applications`, `/notifications`, `/colleges` | jobs/applications/notifications controllers, `eligibilityService` |
| `/chatbot`, `/analytics` | `chatbotController` (+ `services/chatbot/`), `analyticsController` / `analyticsService` |
| `/admin` | `controllers/admin/*` (dashboard, students, interviews, aptitude bank, jobs, announcements, notifications, college interviews) |

Cross-cutting: `middleware/auth.ts` (JWT `protect`), `restrictTo.ts` (role gate), `error.ts`; `utils/asyncHandler`, `utils/AppError`; `config/env.ts` validates env at boot (only `MONGO_URI` is mandatory).

### Data models (`placement-prep-be/src/models`)

| Model | Holds |
|---|---|
| `User` | identity + role, college, USN, department, CGPA, backlogs, skills, projects, certifications, profile links, placement status |
| `Interview` | one mock/college interview session: config, `source` (`AI`｜`RESUME`｜`COLLEGE`), questions with answers/evaluations/attempts, proctoring counters, `warnings`, `terminationReason`, aggregate scores, `personalization` |
| `InterviewReport` | frozen aggregate scores/strengths/weaknesses/final feedback per finished interview (refreshed if a report re-evaluation changes scores) |
| `CheatingEvent` | one stored proctoring event (`tab_switch`, `fullscreen_exit`, …) |
| `CollegeInterview`, `CollegeInterviewQuestion`, `College` | admin-authored interviews and their questions (with answer keys that never leave the server) |
| `Job`, `Application`, `JobEligibility` | job drives, applications (`applied → shortlisted → rejected → selected`), per-(student, job) eligibility snapshot |
| `Notification`, `StudentNotification`, `Announcement` | admin broadcasts and per-student notification feed |
| `AptitudeQuestion`, `AptitudeTopic`, `AptitudeTestConfig`, `AptitudeAttempt`, `AptitudeQuestionHistory` | aptitude bank, tests, attempts and per-user question-repeat tracking |
| `TechQuizAttempt`, `TechPerformanceProfile`, `TechQuestionHistory` | tech-practice attempts, adaptive difficulty profile, repeat tracking |
| `VectorEmbedding` | local MongoDB-backed vector store for RAG |
| `ChatbotUnanswered` | chatbot queries it could not answer (drives retraining) |

### AI service map (`ai-services`)

| File | Role |
|---|---|
| `server.py` (Flask `:8000`) | question generation, evaluation, feedback, resume enhancement, STT/TTS, tech-quiz selection/evaluation, chatbot |
| `run.py` → `app/` (FastAPI `:8001`) | proctoring WebSocket (`routes/proctor.py`), engine (`services/proctoring_engine.py`), face/YOLO/verification services |
| `interview_question_service.py`, `local_question_generator.py`, `interviewer_llm/` | question pipeline: fine-tuned interviewer LLM → smaller local model → offline bank; global no-repeat history (`question_history_store.py`, SQLite) |
| `local_answer_evaluator.py`, `interview_feedback_analysis.py` | evaluation and explainable feedback |
| `tech_question_engine.py`, `tech_answer_evaluator.py` | tech-practice question selection and per-type grading |
| `resume_enhancer.py`, `resume_training/` | local resume-rewrite model and resume-category classifier |
| `riva_service.py` | local `faster-whisper` STT and `pyttsx3`/SAPI TTS (optional Riva) |
| `chatbot/` | fine-tuned Q&A matcher |

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

## Testing & Verification

| What | Command | Covers |
|---|---|---|
| Feedback analysis (Python) | `cd ai-services && python tests/test_interview_feedback.py` | legacy scores unchanged, four new scores, structure choice per question type, STAR/project detection, speaking-rate/pause rules, "Not available" rules, timeline honesty, hostile audio input, missing-answer-key note |
| Personalised question focus | `cd ai-services && python tests/test_interview_focus_areas.py` | focus share, unknown skills ignored, topic fallback (mocks the generator and history store — never touches the real question history) |
| Feedback logic (TypeScript) | `cd placement-prep-be && npx tsx --test src/services/mockInterviewFeedback.test.ts` | validation/clamping, fallback flagging, comparison rows, verdicts, weakness thresholds, personalisation rules, progress, proctoring summary |
| Type checks | `cd placement-prep-be && npx tsc --noEmit -p .` · `cd MindPrepAI-FE && npx tsc -p tsconfig.app.json --noEmit` | (backend reports one long-standing stray-file error: `time_chain.ts` outside `rootDir`) |
| Production build | `cd MindPrepAI-FE && npm run build` | type check + Vite bundle |
| Proctoring engine | `cd ai-services && python -m unittest discover -s tests -p "test_proctoring.py"` | note: `test_12_cooldown` and `test_1_no_person` were failing when last run; this code is independent of the feedback system |
| Admin panel API sweep | `cd placement-prep-be && E2E_API=http://127.0.0.1:3002/api/v1 E2E_MONGO=mongodb://127.0.0.1:27018/mindprep_e2e npx tsx src/scripts/e2eAdminPanel.ts` | every `/admin` endpoint incl. reports, dashboard, notification delivery (refuses to run against a non-local DB) |
| Placement-admin API sweep | `cd placement-admin-be && E2E_API=http://127.0.0.1:5099 E2E_EMAIL=... E2E_PASSWORD=... [E2E_MAIN_TOKEN=<main admin JWT>] npx tsx src/scripts/e2eAdmin.ts` | auth on every admin resource, SSO token, rejected student/forged tokens, alumni CRUD, public openings |

**End-to-end check used during development** (worth repeating after big changes): run a *throwaway* MongoDB on another port (`mongod --dbpath <tmp> --port 27931`), start the backend with `MONGO_URI` pointing at it, `LOCAL_ONLY=true` and a blank `PINECONE_API_KEY` so nothing touches real data, point `AI_SERVICE_URL` at a service exposing the real `evaluate_answer`, then drive the flow over HTTP: create → answer (text + voice with audio metrics) → report → Practice Again ×N → history → personalisation → progress → a legacy record → a college record → tab-switch termination, and finally kill the AI service to confirm the interview survives and recovers on the next report open.

> ⚠️ Never point tests at your real `MONGO_URI` — `.env` may hold an Atlas connection string.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Report shows "Automatic evaluation was unavailable" | The AI service (`:8000`) was down when the answer was submitted. The answer is saved; start the service and reopen the report — it re-evaluates automatically |
| "Not available" for speaking rate / pauses | Expected for typed answers, recordings under 8 s / 10 words, or browsers where the Web Audio silence detector could not start. Never guessed |
| Older interview has no "Why this score?" content | It upgrades the next time its report opens (needs the AI service running); college interviews are never upgraded |
| Practice Again button missing | Interview not finished, question skipped/unanswered, college interview, or 10 attempts reached |
| "Personalised for you" never appears | Needs a topic that was weak in ≥ 2 answers across your last 6 finished AI/resume interviews, and a Technical or Resume interview type |
| Main backend exits immediately | Missing `MONGO_URI`/`MONGO_URL` in `placement-prep-be/.env` — it's the only variable that blocks startup |
| Frontend can't reach the main backend | Check `MindPrepAI-FE/src/config/config.ts` / `VITE_BACKEND_URL` matches the backend's actual `PORT` |
| Alumni pages fail to load | `placement-admin-be` isn't running on `:5001`, or `.env` wasn't seeded (`npm run seed`) |
| Admin Alumni pages return `401` | Set `MAIN_JWT_SECRET` in `placement-admin-be/.env` to the same value as `JWT_SECRET` in `placement-prep-be/.env`, restart it, and sign in to `/admin` again |
| Reports & Analytics / dashboard charts are empty | They only show stored activity — no interviews, aptitude/tech sessions or resume analyses in the selected range means empty charts. Widen the range (e.g. 90 days) |
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
│       │   └── admin/                 # Admin UI kit: AdminLayout, PageHeader, StatCard, Card, Table, ... + admin.css (glossy theme), gradients.ts, chartTheme.ts
│       │   └── mock-interview/feedback/   # Explainable-feedback UI: score grid, Why-this-score drawer, structure, speaking, timeline, Practice Again, comparison, weakness map, progress charts
│       ├── types/                     # mockFeedback.ts (feedback API types)
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
│       ├── services/                  # aiService, vectorStore (local RAG store), interviewRagService, localResumeParser/Analyzer, chatbot/,
│       │                              # mockInterviewFeedback.ts (+ .test.ts) — validation, comparison, weakness map, progress, personalisation
│       ├── scripts/                   # createCollegeAdmin, generateAptitudeQuestions (LOCAL_ONLY-gated), chatbot train/eval scripts
│       ├── middleware/                # auth, restrictTo, error handlers
│       └── config/                    # db, env (LOCAL_ONLY, no AI key required to boot), pinecone (optional)
│
├── placement-admin-be/                # Placement-admin backend (Express + TypeScript, standalone, admin-only)
│   └── src/
│       ├── controllers/               # alumni, application, aptitude, company, interview, job, student, dashboard
│       ├── routes/                    # alumni.routes.ts (consumed by the frontend; + public openings router), + others
│       ├── middleware/                # auth.middleware.ts — requireAdmin (own token or MindPrep SSO via MAIN_JWT_SECRET)
│       ├── models/                    # Alumni, Admin, + others
│       ├── scripts/                   # e2eAdmin.ts — endpoint/auth sweep
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
    ├── local_answer_evaluator.py      # Local answer scoring (+ extended analysis hook)
    ├── interview_feedback_analysis.py # Structure / speaking / timeline / "why this score" engine
    ├── tests/                         # test_proctoring.py, test_interview_feedback.py, test_interview_focus_areas.py
    ├── resume_enhancer.py             # Resume content AI-enhancement (local model)
    ├── tech_question_engine.py        # Tech-quiz question selection
    ├── riva_service.py                # Local STT (faster-whisper) / TTS (pyttsx3+SAPI); optional NVIDIA Riva
    └── requirements.txt
```

---

## License

Built for educational / placement-preparation purposes. Use your own API keys and follow each provider's terms of service.
