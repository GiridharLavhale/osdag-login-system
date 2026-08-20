# Secure Login System with User Details & File Access

Osdag Autumn Semester Long Internship 2026 — Task 4 screening submission.

Two independent implementations of the same login + file-access system,
both driven by the same provided test client:

- [`custom-backend/`](./custom-backend/README.md) — Node/Express + PostgreSQL
- `appwrite-backend/` — Appwrite (coming next)

See [`PROJECT-PLAN.md`](./PROJECT-PLAN.md) for the full requirements
checklist and current build status.

## Quick start (custom backend)

```bash
cd custom-backend
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm install
npm run seed
npm run dev
```
Open http://localhost:3000, select "Custom REST backend" mode, log in with
one of the quick-fill demo users.
