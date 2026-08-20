# Custom Backend — Node/Express + PostgreSQL

Implements the Secure Login System with User Details & File Access task using
your own Express server and a real Postgres database (Neon/Supabase-friendly).

The provided test client (`public/index.html`, unmodified) is served directly
by this server, so there's nothing else to run or configure on the frontend
side — just open the URL below.

## 1. Get a free Postgres database

Pick one, takes about 2 minutes:
- **Neon**: https://neon.tech → New Project → copy the connection string it gives you.
- **Supabase**: https://supabase.com → New Project → Settings → Database → Connection string (URI).

Either way you end up with something like:
```
postgresql://user:password@host/dbname?sslmode=require
```

## 2. Configure environment variables

```bash
cp .env.example .env
```
Open `.env` and paste your connection string into `DATABASE_URL`. Generate a
random `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Install, seed, run

```bash
npm install
npm run seed   # creates tables + inserts the 3 demo users with bcrypt-hashed passwords
npm run dev    # starts the server on http://localhost:3000
```

Open **http://localhost:3000** — that's the test client, already pointed at
this server. Select **"Custom REST backend"** mode, click one of the
**Quick-fill seeded test users** buttons, then Login.

Demo accounts (seeded from `public/seed-data.json`):
| Email | Password |
|---|---|
| alice@example.com | Password123! |
| bob@example.com | Password123! |
| carol@example.com | Password123! |

## Design decisions (for the write-up)

**JWT vs. session, and why a hybrid:** Sessions are issued as JWTs (matches
the Bearer-token flow the test client already expects), but every JWT's `jti`
is also recorded in a `sessions` table with an expiry and a `revoked_at`
column. Every protected route's `authenticate` middleware checks *both* the
JWT's signature/expiry (fast, stateless) *and* that its `jti` still has a
live row in `sessions` (one indexed lookup). This gets JWT's usual benefits
while still allowing **true server-side logout** — a plain JWT can't be
revoked once issued, but this hybrid can.

**Logout:** `POST /logout` sets `revoked_at = now()` on that token's session
row. The JWT itself would still verify, but the middleware's DB check now
rejects it — so it's dead the instant logout is called, not just removed from
the client.

**Data isolation:** `/me`, `/files`, `/files/:id` all derive the acting user
from `req.userId`, which comes only from the verified session — never from a
client-supplied ID. `/files/:id` explicitly distinguishes **403** (file
exists, belongs to someone else) from **404** (file doesn't exist), per spec.

**Password & login security:** bcrypt (cost 12) for hashing. Login always
runs a bcrypt compare (against a dummy hash if the email doesn't exist) so a
non-existent-email login takes the same time as a wrong-password login,
avoiding a timing side channel on top of the already-generic error message.
5 failed attempts locks that email out for 60 seconds.

**What's a demo stand-in:** `/files/:id/download` returns placeholder text
instead of real bytes — no file storage (S3/disk) is wired up, since the task
is about auth/access-control, not file storage.

**What I'd improve with more time:** move the in-memory login-lockout Map to
the database (or Redis) so it survives restarts and works across multiple
server instances; add refresh tokens so sessions don't need a 30-minute
re-login; add request validation (e.g. zod) on all bodies.
