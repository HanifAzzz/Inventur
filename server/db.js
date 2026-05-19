const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { neon } = require("@neondatabase/serverless");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL tidak ditemukan di .env");
}

const sql = neon(process.env.DATABASE_URL);

module.exports = { sql };
