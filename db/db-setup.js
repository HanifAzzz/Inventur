/**
 * db-setup.js — Buat semua tabel di Neon Postgres
 * Jalankan: node db/db-setup.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  console.log("⏳ Membuat tabel di Neon Postgres...\n");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      email       VARCHAR(255) UNIQUE NOT NULL,
      password    TEXT,
      name        VARCHAR(255) NOT NULL,
      initials    VARCHAR(10)  NOT NULL,
      google_id   VARCHAR(255) UNIQUE,
      avatar_url  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ Tabel users");

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ Tabel categories");

  await sql`
    CREATE TABLE IF NOT EXISTS brands (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ Tabel brands");

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id                 SERIAL PRIMARY KEY,
      sku                VARCHAR(255) UNIQUE NOT NULL,
      item_code          VARCHAR(255) UNIQUE NOT NULL,
      name               VARCHAR(255) NOT NULL,
      slug               VARCHAR(255) UNIQUE NOT NULL,
      description        TEXT,
      price              NUMERIC(15,2) NOT NULL DEFAULT 0,
      unit               VARCHAR(50)   NOT NULL DEFAULT 'Pc',
      qty                INTEGER       NOT NULL DEFAULT 0,
      image_url          TEXT,
      store              VARCHAR(255),
      warehouse          VARCHAR(255),
      selling_type       VARCHAR(100),
      sub_category       VARCHAR(100),
      barcode_symbology  VARCHAR(100),
      tax_type           VARCHAR(100),
      discount_type      VARCHAR(100),
      warranty           VARCHAR(100),
      category_id        INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      brand_id           INTEGER NOT NULL REFERENCES brands(id)     ON DELETE RESTRICT,
      created_by_id      INTEGER NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ Tabel products");

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id         SERIAL PRIMARY KEY,
      order_id   VARCHAR(100) UNIQUE NOT NULL,
      total      NUMERIC(15,2) NOT NULL DEFAULT 0,
      discount   NUMERIC(15,2) NOT NULL DEFAULT 0,
      shipping   NUMERIC(15,2) NOT NULL DEFAULT 0,
      tax        NUMERIC(15,2) NOT NULL DEFAULT 0,
      payment    VARCHAR(50)   NOT NULL DEFAULT 'cash',
      status     VARCHAR(50)   NOT NULL DEFAULT 'completed',
      customer   VARCHAR(255),
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ Tabel transactions");

  await sql`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id             SERIAL PRIMARY KEY,
      qty            INTEGER       NOT NULL,
      price          NUMERIC(15,2) NOT NULL,
      product_id     INTEGER NOT NULL REFERENCES products(id)     ON DELETE RESTRICT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE
    )
  `;
  console.log("✅ Tabel transaction_items");

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id             SERIAL PRIMARY KEY,
      invoice_number VARCHAR(100) UNIQUE NOT NULL,
      amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
      paid           NUMERIC(15,2) NOT NULL DEFAULT 0,
      due            NUMERIC(15,2) NOT NULL DEFAULT 0,
      due_date       TIMESTAMPTZ   NOT NULL,
      status         VARCHAR(50)   NOT NULL DEFAULT 'Unpaid',
      customer       VARCHAR(255)  NOT NULL,
      created_at     TIMESTAMPTZ   DEFAULT NOW(),
      transaction_id INTEGER UNIQUE NOT NULL REFERENCES transactions(id) ON DELETE CASCADE
    )
  `;
  console.log("✅ Tabel invoices");

  console.log("\n🎉 Semua tabel berhasil dibuat!");
}

setup().catch((err) => {
  console.error("❌ Error setup database:", err.message);
  process.exit(1);
});
