# Project Plan — Secure Login System with User Details & File Access

Source: Osdag Autumn Semester Long Internship 2026, Task 4 (Web.docx).
This file is the single source of truth for what "done" means. Every
checkbox here maps directly to something the reviewers test.

## What this repo must contain

Two independent implementations of the SAME behavior, clearly separated:

| Folder | Stack | Status |
|---|---|---|
| `custom-backend/` | Node/Express + PostgreSQL | ✅ Built, needs your DB + a run-through |
| `appwrite-backend/` | Appwrite (Cloud) | ⏳ Not started yet |

Both are driven by the SAME frontend: the provided `index.html` test client
(not to be replaced — the doc explicitly says use this page only, no new
GUI). It already has a mode switch for Mock / Custom REST / Appwrite.

`mock-api.js` and `seed-data.json` are **reference/demo only** — they show
the exact contract (routes, request/response shapes, status codes) both real
backends must match, but neither backend is allowed to just call into them.

## Functional requirements checklist

**Auth**
- [x] `POST /register` — email + password, hashed, no duplicate emails
- [x] `POST /login` — returns a session (JWT, in our case), generic error on
      failure, doesn't reveal whether the email exists
- [x] `POST /logout` — invalidated **server-side** (not just cleared client-side)

**User data**
- [x] `GET /me` — returns only the caller's own profile, derived from the
      verified session, never from a client-supplied ID

**Files**
- [x] `GET /files` — only the caller's own files
- [x] `GET /files/:id` — **403** if it belongs to someone else, **404** if it
      doesn't exist at all (these must be different codes — explicitly tested)
- [x] `GET /files/:id/download` — same 403/404 distinction

**Multi-user & security**
- [x] 3+ seeded users, each with their own files (alice/bob/carol)
- [x] Passwords hashed (bcrypt), never stored/logged in plaintext
- [x] Rate limiting / lockout after repeated failed logins (5 attempts → 60s lock)
- [x] Every protected route uses the same auth-checking logic (no route
      accidentally skipping validation)

**Docs & submission**
- [x] Top-level `README.md` linking both implementations
- [x] `custom-backend/README.md` — JWT vs session reasoning, logout
      mechanism, data isolation approach, what I'd improve
- [x] `appwrite-backend/README.md` — same, plus what Appwrite handled
      automatically vs what needed manual config
- [ ] Short screen-recorded video showing both backends working (silent OK)
- [ ] Report (PDF)
- [ ] Everything zipped for the submission form, alongside resume + NOC

## Architecture decisions already made (custom backend)

- **Sessions**: JWT (Bearer token, matches the test client's Token field) +
  a `sessions` table recording each token's `jti`. Logout revokes that row,
  so it's a real server-side invalidation, not just "forget the JWT."
- **Passwords**: bcrypt, cost 12. Login always runs a bcrypt compare (even
  against a dummy hash for unknown emails) so timing doesn't leak whether an
  email is registered.
- **DB**: Postgres via Neon (free, no local install). Schema: `users`,
  `files`, `sessions`.
- **Lockout**: in-memory Map, 5 failed attempts → 60s lock per email
  (mirrors the mock client's behavior for consistency).

## Remaining build order

1. ~~**You**: get `custom-backend/` running end-to-end against real Postgres.~~ ✅ Done
2. ~~**You**: click through every button in the test client against the
   custom backend, confirm 403 vs 404 works, confirm lockout kicks in after
   5 bad logins.~~ ✅ Done — verified 403 (other user's file), 404 (missing
   file), 401 (post-logout), 429 (lockout after 5 failed logins).
3. ~~**Us**: build `appwrite-backend/` — Appwrite Console setup + adapter.~~
   ✅ Done — Auth, database, `files` table, seeded 3 users + 6 files.
4. ~~**Us**: test the Appwrite mode the same way.~~ ✅ Done — verified 200
   on /me and /files, 403 on another user's file, 404 on a missing file,
   401 after logout.
5. ~~**Us**: write the top-level README and the Appwrite README.~~ ✅ Done
6. **You**: revoke the Appwrite API key that was pasted in chat and create a
   fresh one (only needed again if you re-run the seed script).
7. **You**: push everything to GitHub (see chat for exact commands).
8. **You**: record the demo video, write the report, submit. ← **current step**

## Non-goals (explicitly out of scope, don't spend time here)

- No new/custom frontend — `index.html` is fixed and provided.
- No real file storage/streaming — `/files/:id/download` returns placeholder
  text by design (task is about auth/access-control, not file storage).
- No production-grade infra (multi-instance lockout store, refresh tokens,
  etc.) — those are listed as "what I'd improve," not requirements.
