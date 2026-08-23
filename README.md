# Secure Login System with User Details & File Access

Osdag Autumn Semester Long Internship 2026 — Task 4 screening submission.

Two independent implementations of the same login + file-access system,
both driven by the same provided test client:

- [`custom-backend/`](./custom-backend/README.md) — Node/Express + PostgreSQL
- [`appwrite-backend/`](./appwrite-backend/README.md) — Appwrite Cloud

See [`PROJECT-PLAN.md`](./PROJECT-PLAN.md) for the full requirements
checklist and current build status (both backends: built and verified).

## Quick start — custom backend

```bash
cd custom-backend
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET
npm install
npm run seed
npm run dev
```
Open http://localhost:3000, select "Custom REST backend" mode.

## Quick start — Appwrite backend

```bash
cd appwrite-backend
npm install
npx http-server public -p 3001 -c-1
```
Open http://localhost:3001, select "Appwrite" mode.

Both: log in with any of alice@example.com / bob@example.com /
carol@example.com, password `Password123!` for all three.
