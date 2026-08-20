const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 60 seconds
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// In-memory lockout tracker, keyed by email. Good enough for a single-instance
// dev/demo deployment (matches the mock client's behavior). For a real
// multi-instance production deployment this would move to a shared store
// (Redis, or a `login_attempts` table) — noted in the README as a next step.
const failedAttempts = new Map(); // email -> { count, lockedUntil }

router.post("/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const id = "usr_" + crypto.randomBytes(4).toString("hex");
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const displayName = email.split("@")[0];

  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, display_name, bio, role)
     VALUES ($1, $2, $3, '', $4, '', 'user')`,
    [id, email, passwordHash, displayName]
  );

  res.status(201).json({ id, email });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const GENERIC_ERROR = { error: "Invalid email or password" };

  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const lock = failedAttempts.get(email);
  if (lock && lock.lockedUntil && Date.now() < lock.lockedUntil) {
    return res.status(429).json({ error: "Too many failed attempts. Try again in a bit." });
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = rows[0];

  // Always run bcrypt.compare even when the user doesn't exist, against a
  // dummy hash, so response timing doesn't leak whether the email is
  // registered (a timing side-channel on top of the generic error message).
  const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO7Vy6PYb1Zj1XDl0PdOZlwZ6dJ2Q6y6O";
  const valid = user
    ? await bcrypt.compare(password, user.password_hash)
    : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

  if (!valid) {
    const entry = failedAttempts.get(email) || { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCKOUT_MS;
      entry.count = 0;
    }
    failedAttempts.set(email, entry);
    return res.status(401).json(GENERIC_ERROR);
  }

  failedAttempts.delete(email);

  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    "INSERT INTO sessions (token_id, user_id, expires_at) VALUES ($1, $2, $3)",
    [jti, user.id, expiresAt]
  );

  const token = jwt.sign({ sub: user.id, jti }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30m",
  });

  res.json({ token, user: { id: user.id, email: user.email } });
});

router.post("/logout", authenticate, async (req, res) => {
  // Server-side invalidation: mark this specific session revoked in the DB.
  // A stolen/cached copy of the JWT stops working immediately, even though
  // the JWT itself would otherwise still pass signature verification.
  await pool.query("UPDATE sessions SET revoked_at = now() WHERE token_id = $1", [req.tokenId]);
  res.json({ message: "Logged out" });
});

module.exports = router;
