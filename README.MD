# MindPrep AI 🚀

**AI-powered Placement Preparation Platform** — a complete career-prep suite with quizzes, AI interview practice with proctoring, resume analysis (ATS scoring + live job skill-gap), resume builder, and personalized reports.

The project is a **monorepo** with three independent services:

| Folder | Service | Stack | Port |
|---|---|---|---|
| `MindPrepAI-FE` | Frontend Web App | React + TypeScript + Vite + Tailwind v4 | 5173 |
| `placement-prep-be` | Backend API | Node.js + Express + TypeScript + MongoDB | 3000 |
| `ai-services` | AI / Proctoring Microservice | Python + FastAPI + OpenCV + MediaPipe + YOLO | 8000 |

---

## Table of Contents

1. [Architecture & How It Works](#architecture--how-it-works)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Step-by-Step Setup (pip to pip)](#step-by-step-setup)
   - [1. Clone the repo](#1-clone-the-repo)
   - [2. Start MongoDB](#2-start-mongodb)
   - [3. Backend setup (placement-prep-be)](#3-backend-setup)
   - [4. Frontend setup (MindPrepAI-FE)](#4-frontend-setup)
   - [5. AI services setup (ai-services)](#5-ai-services-setup-python)
   - [6. Run everything](#6-run-everything)
6. [Environment Variables](#environment-variables)
7. [API Endpoints](#api-endpoints)
8. [How Each Feature Works](#how-each-feature-works)
9. [Troubleshooting](#troubleshooting)
10. [Project Structure](#project-structure)

---

## Architecture & How It Works

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│  MindPrepAI-FE   │  ──►  │  placement-prep-be    │  ──►  │  MongoDB (Mongoose)  │
│  React + Vite    │ HTTP  │  Express + TypeScript │       └─────────────────────┘
│  (Browser, :5173)│       │  (:3000)              │  ──►  │  Pinecone (RAG)      │
└─────────────────┘        └──────────────────────┘       └─────────────────────┘
        │                            │
        │  WebSocket / HTTP          │  HTTP
        │  (proctoring frames,       │  (question generation, AI service key)
        │   voice → text)            ▼
        │                  ┌─────────────────────┐
        └─────────────────►│  ai-services         │
                           │  FastAPI + OpenCV    │
                           │  (:8000)             │
                           └─────────────────────┘
```

**Flow:**
- The **browser (React)** talks to the **backend (Express)** via REST APIs on port 3000.
- The backend talks to **MongoDB** (auth, quizzes, interviews, reports), **Pinecone** (semantic search / RAG for question lookup), and external AI providers (Groq, OpenAI, Gemini, NVIDIA NIM).
- The **ai-services** Python microservice handles **real-time interview proctoring** (face/eye tracking, object detection, phone detection) and **speech** (STT/TTS). It is called directly by the frontend for live proctoring and by the backend for question generation.

---

## Features

- 🔐 **JWT Authentication** — signup / login / protected routes.
- 📝 **Topic-wise Quizzes** — subject/role/company-based AI-generated questions with attempts, scoring, and history.
- 🎯 **AI Interview Practice (Mock Interview)** — role-specific questions, voice/text answers, per-question evaluation, live **proctoring** (face detection, eye tracking, phone/object detection, tab-switch warnings, auto-termination on violations).
- 📄 **Resume Analyzer** — upload a PDF, extracts text, computes **ATS score**, strengths/weaknesses, missing keywords, and shows **live jobs in Bengaluru** with **skill-gap analysis** and upskilling suggestions.
- 🛠️ **Resume Builder** — 3 templates (modern/classic/minimal), AI-assisted content generation, ATS evaluation, and **PDF download**.
- 📊 **Personalized Reports** — categorized weak areas with recommended learning resources and YouTube videos.
- 🧠 **RAG (Pinecone)** — embeddings + semantic retrieval to reuse stored questions and boost relevant answers.
- 🤖 **Voice Answers** — voice recording evaluated via AI (Whisper-style STT + LLM scoring).
- ⏱️ **Aptitude Tests** — timed aptitude questions with instant results.

---

## Tech Stack

### Frontend (`MindPrepAI-FE`)
React 18, TypeScript, Vite 7, Tailwind CSS v4, Framer Motion, React Router v7, React Query, Recharts, Swiper, Three.js (3D visuals), html2canvas-pro + jsPDF (PDF export), Axios.

### Backend (`placement-prep-be`)
Node.js, Express 4, TypeScript, Mongoose (MongoDB), JWT, Zod, Multer, pdfjs-dist, OpenAI + Groq (LangChain), Gemini, Pinecone, Axios.

### AI Services (`ai-services`)
Python 3.11+, FastAPI, Uvicorn, OpenCV, MediaPipe, Ultralytics (YOLO), InsightFace, ONNX Runtime, NumPy, Flask (legacy), Requests.

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **Python** ≥ 3.10 and **pip**
- **MongoDB** (local install or MongoDB Atlas URI)
- (Optional) **Pinecone** account for RAG features
- API keys for **Groq** (required for most AI features), OpenAI, Gemini, NVIDIA NIM, Adzuna (live jobs)

---

## Step-by-Step Setup

### 1. Clone the repo

```bash
git clone https://github.com/Darshan8786/ai-mock-interview.git
cd MindPrep-AI
```

### 2. Start MongoDB

```bash
# Option A: local MongoDB (default URI mongodb://localhost:27017/mindprep)
mongod --dbpath <your-data-dir>

# Option B: use MongoDB Atlas — set MONGO_URI in backend .env instead
```

### 3. Backend setup

```bash
cd placement-prep-be
npm install          # installs all Node dependencies
```

Create the **`.env`** file (copy from `.env.example`):

```bash
cp .env.example .env
# then edit .env and fill in your keys (see Environment Variables section)
```

> ⚠️ The backend **will not start** without `MONGO_URI`, `PINECONE_API_KEY`, and `GEMINI_API_KEY`. The `env.ts` config exits with an error if they are missing.

### 4. Frontend setup

```bash
cd ../MindPrepAI-FE
npm install
```

Verify the backend URL in `src/config/config.ts` is `http://localhost:3000` (default).

### 5. AI services setup (Python)

```bash
cd ../ai-services

# Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install all Python dependencies (pip to pip)
pip install -r requirements.txt
```

Create the **`.env`** file:

```bash
cp .env.example .env   # if present, otherwise create it manually
```

`.env` contents:
```
AI_SERVICE_PORT=8000
AI_SERVICE_KEY=mindprep-ai-key-2026
GROQ_API_KEY=your-groq-key
NIM_API_URL=https://api.nvcf.nvidia.com/v2/nvcf
NIM_API_KEY=
NIM_MODEL=meta/llama-3.1-405b-instruct
RIVA_ENABLED=false
RIVA_SERVER=localhost:50051
MONGO_URL=mongodb://localhost:27017/mindprep
```

> **Model download:** On first startup, the service auto-downloads the face-detection / YOLO / InsightFace model weights into `models/` and `weights/` (~900 MB). An internet connection is required the first time. These folders are gitignored.

### 6. Run everything

Open **three terminals**:

```bash
# Terminal 1 — Backend (port 3000)
cd placement-prep-be
npm run dev

# Terminal 2 — Frontend (port 5173)
cd MindPrepAI-FE
npm run dev

# Terminal 3 — AI Services (port 8000)
cd ai-services
python run.py
```

Then open **http://localhost:5173** in your browser.

**Default test login** (seeded in the app):

```
username: test
password: test@123
```

---

## Environment Variables

### `placement-prep-be/.env`

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` / `MONGO_URI` | ✅ | MongoDB connection string (default `mongodb://localhost:27017/mindprep`) |
| `JWT_SECRET` | ✅ | Secret used to sign auth tokens |
| `OPENAI_API_KEY` | ⚠️ | OpenAI key (AI answers/content) |
| `GROQ_API_KEY` | ⚠️ | Groq key — used for question generation, resume analysis, evaluations |
| `GEMINI_API_KEY` | ✅ | Google Gemini key |
| `PINECONE_API_KEY` | ✅ | Pinecone key for RAG |
| `PINECONE_ENVIRONMENT` | ⚠️ | e.g. `us-east-1` |
| `PINECONE_INDEX_NAME` | ⚠️ | e.g. `MindPrep-AI` |
| `AI_SERVICE_URL` | ⚠️ | URL of ai-services (default `http://localhost:5001`, **set to `http://localhost:8000`**) |
| `AI_SERVICE_KEY` | ⚠️ | Shared secret with ai-services |
| `NIM_API_URL` / `NIM_API_KEY` / `NIM_MODEL` | ⚠️ | NVIDIA NIM model access (falls back to Groq when empty) |
| `RIVA_ENABLED` / `RIVA_SERVER` | ⚠️ | NVIDIA Riva speech (optional) |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | ⚠️ | Adzuna API keys for **live jobs in Bengaluru** |

### `ai-services/.env`

| Variable | Required | Description |
|---|---|---|
| `AI_SERVICE_PORT` | ⚠️ | Port for FastAPI/Flask (default 8000) |
| `AI_SERVICE_KEY` | ⚠️ | Shared secret checked via `X-AI-Service-Key` header |
| `GROQ_API_KEY` | ⚠️ | Used to generate questions when `NIM_API_KEY` is empty |
| `NIM_API_URL` / `NIM_API_KEY` / `NIM_MODEL` | ⚠️ | NVIDIA NIM LLM access |
| `MONGO_URL` | ⚠️ | MongoDB URI |

---

## API Endpoints

All backend routes are under `http://localhost:3000/api/v1`.

### Auth
- `POST /auth/register` — register a new user
- `POST /auth/login` — login, returns JWT

### Quizzes / Questions
- `POST /questions/create-ai` — create an AI question
- `GET /questions/search?q=...` — search questions
- `POST /attempts` — submit an attempt
- `GET /reports/personalized` — personalized report (weak areas + resources)
- `GET /reports/subject/:subject` — subject-wise attempts

### AI Question Generation (subject / role / company)
- `GET /ai/subject?subject=...` — generate subject questions
- `GET /ai/role?role=...` — generate role questions
- `GET /ai/company?company=...` — generate company questions
- `POST /ai/questions/subject` / `POST /ai/questions/role` / `POST /ai/questions/company` — get stored/generated questions

### Mock Interview
- `POST /mock-interview/create` — create an interview (generates unique questions via Groq/AI-service)
- `GET /mock-interview/:id` — fetch interview
- `POST /mock-interview/:id/answer` — submit an answer (text/voice) for evaluation
- `POST /mock-interview/:id/skip` — skip current question
- `POST /mock-interview/:id/cheating` — report a proctoring violation
- `POST /mock-interview/:id/terminate` — end interview early
- `GET /mock-interview/report/:id` — final interview report
- `GET /mock-interview/dashboard` — interview history/stats

### Resume
- `POST /resume/parse` — upload PDF → extract text → analyze (ATS score + skill gap + live jobs)
- `POST /resume/enhance` — AI-improve resume section content
- `POST /resume/parse-to-json` — convert PDF into structured resume JSON
- `POST /resume/parse-from-text` — parse pasted resume text
- `POST /resume/auto-fix` — AI fixes ATS issues
- `POST /resume/evaluate-builder` — ATS evaluation of builder resume

### Jobs
- `GET /jobs/search?what=...&where=...&limit=...` — search live jobs via Adzuna

### Pinecone / RAG
- `POST /pinecone/sync` — sync attempts to vector DB
- `GET /pinecone/stats` — vector DB stats
- `POST /pinecone/rag-query` — semantic question retrieval

### Learning Resources
- `GET /resources?category=...` — fetch learning resources

---

## How Each Feature Works

### 🔐 Authentication
Frontend sends credentials to `/auth/login`; backend validates against MongoDB (bcrypt-hashed passwords), returns a **JWT**. The token is stored in `localStorage` and attached as `Authorization: Bearer <token>` on every protected request. Routes are wrapped in `<ProtectedRoute>` on the frontend.

### 🎯 Mock Interview + Proctoring
1. User configures role, experience, interview type, difficulty, and number of questions.
2. `POST /mock-interview/create` generates **unique, role-specific questions** — first tries the ai-services `/generate-questions` endpoint, falls back to **Groq** (`llama-3.3-70b-versatile`), then to a deduped/shuffled static pool.
3. In the interview room, the webcam stream is captured and frames are sent to ai-services `/analyze-frame` which runs **MediaPipe (face/eye/head pose)** + **YOLO (phone/object detection)**.
4. Violations (looking away, eyes closed, phone, tab-switch) increment a counter; **2 warnings → auto-terminate**, **3 violations → terminate**.
5. Answers are given via **voice** (recorded → transcribed) or **text**. Each answer is evaluated by AI (technical, communication, confidence, grammar, fluency, relevance).
6. Final report is saved and shown on the results page.

### 📄 Resume Analyzer (ATS + Skill Gap + Live Jobs)
1. User uploads a PDF; backend extracts text with **pdfjs-dist** (handles scanned/invalid XRef PDFs).
2. Groq analyzes the text into skills, experience, strengths, weaknesses, ATS issues, missing keywords, and an **ATS score**.
3. The backend fetches **live jobs from Adzuna** (Bengaluru, matching the top role).
4. For each job, skills are compared to the resume → **matched / missing skills**, a **fit score**, and per-skill **upskilling suggestions** (courses/resources) are generated.
5. The UI shows jobs with a fit summary and direct **"View & Apply"** links.

### 🛠️ Resume Builder
1. Multi-step form for personal info, education, experience, skills, projects, and summary.
2. **AI assist** buttons generate summaries / enhance bullets (via backend).
3. Live preview with 3 templates.
4. **ATS evaluation** shows a score and actionable issues.
5. **Download PDF**: the preview is captured with **html2canvas-pro** (Tailwind-v4–compatible, supports `oklch()` colors) and written to a PDF via **jsPDF**.

### 🧠 RAG with Pinecone
Attempts and questions are embedded and synced to a Pinecone index. When a similar question is asked, semantic search returns past Q&A to enrich AI answers.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend exits immediately | Missing `MONGO_URI`, `PINECONE_API_KEY`, or `GEMINI_API_KEY` in `placement-prep-be/.env` |
| Port 3000 busy | The backend auto-tries `3001`; also check `Get-NetTCPConnection` / `lsof` |
| Frontend can't reach backend | Check `MindPrepAI-FE/src/config/config.ts` → `BACKEND_URL=http://localhost:3000` |
| AI features return errors | Ensure `GROQ_API_KEY` is set in both `placement-prep-be/.env` and `ai-services/.env` |
| Proctoring doesn't connect | Start `ai-services` with `python run.py` (port 8000) and set `AI_SERVICE_URL=http://localhost:8000` in backend `.env` and `src/services/mockInterviewApi.ts` |
| PDF download fails | Fixed by `html2canvas-pro` — run `npm install` after pulling latest code; hard-refresh (Ctrl+Shift+R) |
| Models missing on AI service | Let the service auto-download on first run (needs internet, ~900 MB) |
| `npm install` peer-dependency errors | Use `npm install --legacy-peer-deps` |
| CORS errors | Backend uses `cors()` open by default; ai-services has `allow_origins=["*"]` |

---

## Project Structure

```
MindPrep-AI/
├── MindPrepAI-FE/                  # Frontend (React + Vite)
│   └── src/
│       ├── components/             # Chatbot, 3D visuals, interview & mock-interview components
│       ├── pages/                  # Dashboard, Quiz, Interview, Resume, Aptitude, Reports
│       ├── hooks/                  # useWebcam, useProctoring, useInterview, etc.
│       ├── services/               # mockInterviewApi.ts (backend + AI service calls)
│       └── config/config.ts        # BACKEND_URL
├── placement-prep-be/              # Backend (Express + TypeScript)
│   └── src/
│       ├── controllers/            # auth, questions, mock-interview, resume, jobs, reports
│       ├── routes/                 # /api/v1 route definitions
│       ├── models/                 # Mongoose schemas (User, Question, Interview, ...)
│       ├── middleware/             # auth, error handlers
│       └── config/                 # db, env, gemini, pinecone
└── ai-services/                    # Python AI + proctoring microservice
    ├── app/                        # FastAPI app (routes: proctor, health)
    │   ├── services/               # face_service, yolo_service, verification_service
    │   └── models/downloader.py    # auto-downloads model weights
    ├── server.py                   # Legacy Flask service (backward compatible)
    ├── nim_service.py              # LLM calls (NVIDIA NIM / Groq fallback)
    ├── riva_service.py             # NVIDIA Riva TTS/STT
    ├── face_detection.py           # frame analysis for proctoring
    └── requirements.txt            # pip dependencies
```

---

## License

This project is built for educational / placement-preparation purposes. Ensure you use your own API keys and follow each provider's terms of service.
