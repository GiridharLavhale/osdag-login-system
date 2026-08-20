const express = require("express");
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/me", authenticate, async (req, res) => {
  // req.userId comes from the verified+non-revoked session, NEVER from a
  // query param, body field, or header the client could tamper with. That's
  // what guarantees this route can only ever return the caller's own data.
  const { rows } = await pool.query(
    `SELECT id, email, full_name, display_name, bio, role, created_at
     FROM users WHERE id = $1`,
    [req.userId]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  res.json({
    id: user.id,
    email: user.email,
    profile: {
      fullName: user.full_name,
      displayName: user.display_name,
      bio: user.bio,
      role: user.role,
      createdAt: user.created_at,
    },
  });
});

module.exports = router;
