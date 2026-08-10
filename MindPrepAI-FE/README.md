# MindPrep AI — Frontend

Frontend for the **MindPrep AI** college placement preparation platform, built with React, TypeScript, Vite, and Tailwind CSS v4. Provides a responsive UI for both **students** and the **admin panel**.

## Tech Stack

- **Framework**: React 18 + Vite 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State/data**: TanStack React Query, axios
- **UI**: framer-motion, recharts, three / react-three-fiber, swiper, html2canvas-pro, jspdf
- **Exports**: xlsx (Excel), native CSV

## Features

### Student app

- Dashboard with 3D hero, notifications card, and feature grid
- Quiz preparation, aptitude practice & tests, mock interviews, performance analytics
- Resume analyzer / resume builder
- **Jobs**: browse active drives (search, filter, sort), job details with live eligibility status, reasons when not eligible, one-click apply
- **My Applications**: track applied → shortlisted → rejected → selected
- **Notification bell** in the navbar with unread badge, dropdown feed, and mark-read actions
- Profile editing (including CGPA, **backlogs**, department, skills)

### Admin panel

- Dashboard with placement statistics (jobs, applications, shortlisted, selected)
- **Jobs**: create / edit / delete / activate-deactivate / close; applications per job
- **Job Applications**: review applicants, shortlist / reject / select
- **Eligible Students** (`/admin/jobs/:id/eligibility`):
  - Stat cards (total / eligible / not eligible / applications / shortlisted / selected)
  - Tabs for eligible and not-eligible students with rejection **reasons**
  - **Notify eligible students** (deduped, skips inactive accounts)
  - **Export Excel (.xlsx)** and **Export CSV** of the eligible list
  - Manual recalculate of eligibility
- Student management, resume management, interview & quiz management, aptitude bank, reports, announcements, proctoring logs, settings

> Eligibility criteria are **CGPA, backlogs, and departments only** — set on the job form via CGPA, max backlogs, and department checkboxes.

## Getting Started

```bash
npm install
npm run dev          # http://localhost:5173
```

The app expects the backend at `BACKEND_URL` in `src/config/config.ts` (default `http://localhost:3001`).

## Scripts

| Command         | Description                 |
| --------------- | --------------------------- |
| `npm run dev`   | Start Vite dev server       |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run lint`  | ESLint                      |
| `npm run preview` | Preview the production build |

## Auth

Student tokens are stored in `localStorage` (`token`, `role`); admin panel uses `adminToken` / `adminRole`. Sign in as a student at `/signin` and as an admin via the admin sign-in page.

## Project Layout

```
src/
├── admin/            # Admin types, API client, mock data
├── components/       # Shared UI + admin components (Card, Table, Button, Modal, ...)
├── pages/            # Student pages + admin pages (jobs, eligibility, etc.)
├── services/         # Axios API services (auth, profile, jobs, notifications, ...)
├── config/           # BACKEND_URL config
├── App.tsx           # Routes
└── Layout.tsx        # Shared layout + notification bell
```
