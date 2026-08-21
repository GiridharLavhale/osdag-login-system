const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in your Postgres connection string (e.g. from Neon or Supabase)."
  );
  process.exit(1);
}

// Cloud databases (Neon/Supabase) require SSL; a local Postgres install
// normally doesn't have it enabled at all. Detect which one we're talking
// to from the connection string so the same code works for both.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

module.exports = pool;