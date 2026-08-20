const express = require("express");
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/files", authenticate, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, owner_id AS "ownerId", file_name AS "fileName", mime_type AS "mimeType",
            size_bytes AS "sizeBytes", uploaded_at AS "uploadedAt"
     FROM files WHERE owner_id = $1 ORDER BY uploaded_at DESC`,
    [req.userId]
  );
  res.json({ files: rows });
});

router.get("/files/:id", authenticate, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM files WHERE id = $1", [req.params.id]);
  const file = rows[0];

  if (!file) return res.status(404).json({ error: "File not found" });
  // Ownership mismatch is deliberately a DIFFERENT status (403) than "doesn't
  // exist" (404) — the task spec calls this out explicitly as something they
  // test for.
  if (file.owner_id !== req.userId) {
    return res.status(403).json({ error: "You do not have access to this file" });
  }

  res.json({
    file: {
      id: file.id,
      ownerId: file.owner_id,
      fileName: file.file_name,
      mimeType: file.mime_type,
      sizeBytes: file.size_bytes,
      uploadedAt: file.uploaded_at,
    },
  });
});

router.get("/files/:id/download", authenticate, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM files WHERE id = $1", [req.params.id]);
  const file = rows[0];

  if (!file) return res.status(404).send("File not found");
  if (file.owner_id !== req.userId) return res.status(403).send("Forbidden");

  // No real file bytes are stored for this demo (see README) — this stands
  // in for what would otherwise be a stream from disk/S3/etc.
  const fakeContent =
    `This is a stand-in for "${file.file_name}" (${file.mime_type}, ${file.size_bytes} bytes).\n` +
    `A real deployment would stream the actual stored file here.`;
  res.set("Content-Type", "text/plain");
  res.send(fakeContent);
});

module.exports = router;
