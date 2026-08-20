const jwt = require("jsonwebtoken");
const pool = require("../db");

/**
 * Every protected route uses this SAME middleware, so token validation is
 * consistent everywhere (register/login are the only unauthenticated routes).
 *
 * Two checks happen, and both must pass:
 *   1. The JWT signature is valid and it hasn't expired (stateless, fast).
 *   2. Its `jti` still has a live, non-revoked row in the `sessions` table
 *      (stateful, one DB lookup). This second check is what makes logout a
 *      real server-side invalidation instead of "hope the client deletes it."
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { rows } = await pool.query(
    `SELECT user_id FROM sessions
     WHERE token_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [payload.jti]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  req.userId = rows[0].user_id;
  req.tokenId = payload.jti;
  next();
}

module.exports = { authenticate };
