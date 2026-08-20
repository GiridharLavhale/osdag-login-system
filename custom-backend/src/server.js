require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const meRoutes = require("./routes/me");
const fileRoutes = require("./routes/files");

const app = express();

app.use(cors()); // harmless if you open index.html straight from disk (file://) instead of via this server
app.use(express.json());

// Serves the unmodified test client at http://localhost:3000/ — its default
// Base URL field already points at http://localhost:3000, so no config
// needed on that page. Just select "Custom REST backend" mode.
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(authRoutes);
app.use(meRoutes);
app.use(fileRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Custom backend listening on http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to use the test client.`);
});
