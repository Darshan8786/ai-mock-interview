# MindPrep AI — Backend

REST API for the **MindPrep AI** college placement preparation platform. Built with Node.js, TypeScript, Express, and MongoDB (Mongoose).

> Note: no code comments were added per project style; this README is the primary documentation.

## Tech Stack

- **Runtime**: Node.js, TypeScript
- **Framework**: Express
- **Database**: MongoDB via Mongoose
- **Auth**: JWT (bcrypt password hashing)
- **AI**: OpenAI, GROQ, Google Gemini, Pinecone (vector search), NVIDIA NIM
- **Other**: multer (file uploads), pdfjs-dist (resume parsing), zod, cors, dotenv

## Features

- JWT authentication for **student** (`user`) and **admin** roles with role-based access control
- Student profiles (USN, department, CGPA, **backlogs**, skills, resume, etc.)
- **Job Posting & Application module**
  - Admin: create / edit / delete / activate / deactivate / close jobs
  - Students: browse open jobs, view details, apply
- **Automatic Eligibility & Notification System**
  - Eligibility is computed from **CGPA, backlogs, and departments only** (no graduation-year or status/deadline criteria)
  - Criteria are read entirely from the job's `eligibility` object — nothing is hardcoded, everything is re-verified on the backend
  - Eligibility snapshots are auto-recalculated on job **create** and **edit** (and via manual recalculate)
  - Eligible / not-eligible student lists per job, each with a clear **reason** for rejection
  - **Notify eligible students** — a single notification per (student, job) via a unique index, so duplicates are impossible; inactive accounts are skipped; only active, non-expired jobs can be notified
  - **Excel (.xlsx) / CSV export** of the eligible-student list is handled on the frontend
- Student notification feed with unread count and mark-read / mark-all-read
- Application workflow: applied → shortlisted → rejected → selected → withdrawn (duplicate applications blocked)
- Aptitude test bank, question banks, mock interviews, performance analytics, resume analyzer

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in your values
npm run dev            # or: npm run build && npm start
```

### Environment Variables

See `.env.example`. Required:

- `MONGO_URI` (also `MONGO_URL`)
- `JWT_SECRET`
- `PINECONE_API_KEY`, `GEMINI_API_KEY` (required at startup)
- `OPENAI_API_KEY`, `GROQ_API_KEY`, `NIM_API_URL`, `NIM_API_KEY` (AI features)

The server listens on **port 3001** by default (`PORT`).

## Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Run with hot reload (tsx)            |
| `npm run build`       | TypeScript compile to `dist/`        |
| `npm start`           | Run compiled `dist/index.js`         |
| `npm run lint`        | ESLint over `src/**/*.ts`            |
| `npm run seed:aptitude` | Seed aptitude question bank        |

## API Structure

All routes are under `/api/v1`.

| Method | Route | Description |
| ------ | ----- | ----------- |
| `POST` | `/auth/register`, `/auth/login` | Student auth |
| `GET/PATCH` | `/auth/me`, `/auth/profile` | Student profile |
| `GET` | `/jobs` | Available jobs + eligibility for the student |
| `GET` | `/jobs/:id` | Job detail + eligibility + applied state |
| `POST` | `/jobs/:id/apply` | Apply (eligibility re-validated server-side) |
| `GET` | `/applications/my` | Student's applications |
| `GET` | `/notifications/my` | Student notifications + unread count |
| `PATCH` | `/notifications/:id/read`, `/notifications/read-all` | Mark read |
| `DELETE` | `/notifications/:id` | Delete a notification |

### Admin (all `protect, restrictTo("admin")`)

| Method | Route | Description |
| ------ | ----- | ----------- |
| `GET/POST` | `/admin/jobs` | List / create jobs |
| `GET/PUT/DELETE` | `/admin/jobs/:id` | View / update / delete a job |
| `PATCH` | `/admin/jobs/:id/status` | Change job status |
| `GET` | `/admin/jobs/:id/applications` | Applications + stats for a job |
| `GET` | `/admin/jobs/:id/eligible-students` | Eligible student list |
| `GET` | `/admin/jobs/:id/ineligible-students` | Not-eligible list with reasons |
| `POST` | `/admin/jobs/:id/eligibility/recalculate` | Recompute eligibility snapshots |
| `POST` | `/admin/jobs/:id/notify-eligible` | Notify all eligible students (deduped) |
| `PATCH` | `/admin/applications/:id/status` | Shortlist / reject / select |

## Eligibility Model

Each job stores an `eligibility` object:

```ts
{
  minimumCGPA: number | null,   // blank/0 = no requirement
  maximumBacklogs: number,      // max allowed active backlogs (0 = none)
  allowedDepartments: string[]  // empty = all departments
}
```

`computeJobEligibility(job, student)` (in `src/utils/jobEligibility.ts`) compares the student record against these criteria and returns `{ eligible, reasons[] }`. Departments are normalized (e.g. `CSE` → `computer science`) so short codes and full names match.

Eligibility snapshots are stored in `JobEligibility` (one per student per job) and recalculated automatically whenever a job is created or edited.
