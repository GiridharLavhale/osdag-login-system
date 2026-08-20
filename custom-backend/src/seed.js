/**
 * Creates the schema (drops and recreates users/files/sessions) and inserts
 * the same 3 demo users used by the mock client, but this time with REAL
 * bcrypt password hashes stored in a REAL Postgres database.
 *
 * Run with: npm run seed
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const pool = require("./db");

const SALT_ROUNDS = 12;

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("Creating schema...");
  await pool.query(schema);

  const seedPath = path.join(__dirname, "..", "public", "seed-data.json");
  const seedData = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  console.log(`Seeding ${seedData.users.length} users...`);
  for (const u of seedData.users) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, display_name, bio, role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        u.id,
        u.email,
        passwordHash,
        u.profile.fullName,
        u.profile.displayName,
        u.profile.bio,
        u.profile.role,
        u.profile.createdAt,
      ]
    );

    for (const f of u.files) {
      await pool.query(
        `INSERT INTO files (id, owner_id, file_name, mime_type, size_bytes, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [f.id, f.ownerId, f.fileName, f.mimeType, f.sizeBytes, f.uploadedAt]
      );
    }
    console.log(`  - ${u.email} (${u.files.length} files) — plaintext password from seed-data.json: ${u.password}`);
  }

  console.log("\nDone. These 3 accounts are ready to log in with on the test client:");
  for (const u of seedData.users) {
    console.log(`  ${u.email} / ${u.password}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
