const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in your Postgres connection string (e.g. from Neon or Supabase)."
  );
  process.exit(1);
}

// Neon/Supabase both require SSL. Most free-tier connection strings already
// include `sslmode=require`, but we set rejectUnauthorized: false as well
// since their certs aren't always in Node's default trust store.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

module.exports = pool;
