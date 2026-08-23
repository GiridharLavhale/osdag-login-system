# Appwrite Backend — Auth + Databases

Implements the same Secure Login System with User Details & File Access
task, this time on Appwrite Cloud instead of hand-rolled Express + Postgres.
The provided test client (`public/index.html`, unmodified except uncommenting
the two Appwrite `<script>` tags it already had a slot for) talks to Appwrite
directly through `public/appwrite-adapter.js` — there is no server for this
implementation; Appwrite *is* the backend.

## 1. What's already set up (in Appwrite Cloud Console)

- A project with **Email/Password Auth** enabled
- A **Web platform** registered for hostname `localhost`
- A database (`main`) with a **`files`** table:
  - Columns: `ownerId`, `fileName`, `mimeType`, `sizeBytes`, `uploadedAt`
  - **Row security** enabled
  - Each row seeded with `Permission.read(Role.user(ownerId))` — only its
    owner can read it via row-level permission
  - **Table-level Read permission also granted to role "Users"** (any
    logged-in user) — see the 403-vs-404 design note below for why
- 3 demo users seeded directly into Appwrite Auth, with extra profile fields
  (displayName/bio/role) stored in each user's **Preferences**

## 2. Run it

```bash
cd appwrite-backend
npm install
npx http-server public -p 3001 -c-1
```
Open **http://localhost:3001** (must be `localhost`, not `127.0.0.1` — that's
the exact hostname registered as an allowed platform in Appwrite). Select
**"Appwrite"** mode, click a quick-fill button, Login.

Demo accounts:
| Email | Password |
|---|---|
| alice@example.com | Password123! |
| bob@example.com | Password123! |
| carol@example.com | Password123! |

To re-seed from scratch (e.g. after wiping the table), see `scripts/seed.js`
— it needs a server API key with Users + Databases scopes in `.env`
(`cp .env.example .env`, fill in `APPWRITE_API_KEY`), then `npm run seed`.

## Design decisions (for the write-up)

**Sessions, no JWT:** Appwrite manages login sessions itself via a browser
cookie set the moment `account.createEmailPasswordSession()` succeeds — there
is no token for us to mint, store, or verify. The adapter still returns a
`token` field (the Appwrite session ID) so the test client's Token field
isn't empty, but it's cosmetic; every subsequent call is authenticated by the
browser automatically re-sending that cookie, the same way a normal website
login works. `POST /logout` calls `account.deleteSession('current')`, which
is a genuine server-side invalidation — Appwrite revokes that session
immediately.

**Profile data:** Appwrite Auth already stores `name` and `email` per user.
The extra fields this task's profile shape needs (`displayName`, `bio`,
`role`) don't have a first-class field, so they're stored in Appwrite's
built-in **user Preferences** (a per-user JSON blob) — no extra table needed.

**File isolation — and one deliberate trade-off:** Each file row's read
permission is scoped to its owner (`Permission.read(Role.user(ownerId))`),
enforced by Appwrite itself. `GET /files` uses `Query.equal('ownerId', ...)`
so a user only ever *lists* their own files. For `GET /files/:id`, though,
Appwrite has a documented anti-enumeration design: a permission-denied read
and a genuinely-missing row both come back as an identical 404 (see
[appwrite/appwrite#8664](https://github.com/appwrite/appwrite/issues/8664)) —
there's no error code to distinguish them. Since this task's spec explicitly
requires telling those two cases apart (403 vs 404), we grant **table-level**
read to any authenticated user and do the ownership comparison ourselves in
the adapter, exactly like the custom Express backend does. This is a
conscious, documented trade-off: we gave up Appwrite's stricter "hide
existence" default in exchange for meeting the spec's exact requirement.

**Login lockout:** handled automatically by Appwrite's own platform-level
abuse protection on the Auth API — nothing we configured. The adapter maps
Appwrite's rate-limit response to the same 429 shape the custom backend uses.

## What Appwrite handled automatically vs. what we configured manually

| Handled automatically | Configured manually |
|---|---|
| Password hashing | The `files` table schema (columns, types) |
| Session/cookie management | Row Security toggle + per-row read permissions |
| Login rate limiting / lockout | Table-level Read for "Users" (the 403/404 trade-off above) |
| Generic invalid-login error | Web platform registration (CORS/hostname allowlist) |
| — | Profile extra fields via Preferences (our choice, not required) |

## What I'd improve with more time

- Move the ownership check for `GET /files/:id` into an **Appwrite Function**
  (server-side, using an API key) instead of the client-side adapter — that
  would let us go back to strict per-row permissions (nothing readable
  without ownership) while still returning a distinguishable 403, since the
  function could check existence with elevated access before deciding.
- Real file storage via an Appwrite Storage bucket instead of placeholder
  download text (mirrors the same simplification made in the custom backend).
- A refresh mechanism / longer-lived session handling for a production app.
