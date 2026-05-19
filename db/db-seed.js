/**
 * db-seed.js — Isi data awal (user admin, category, brand)
 * Jalankan: node db/db-seed.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { neon } = require("@neondatabase/serverless");
const bcrypt   = require("bcryptjs");

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  console.log("⏳ Mengisi data awal...\n");

  // Admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const userRows = await sql`
    INSERT INTO users (email, password, name, initials)
    VALUES ('admin@inventur.com', ${hashedPassword}, 'Administrator', 'AD')
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, name
  `;
  if (userRows[0]) {
    console.log("✅ User admin dibuat:", userRows[0].email);
  } else {
    console.log("ℹ️  User admin sudah ada, dilewati.");
  }

  // Categories
  const categories = ["Electronics", "Clothing", "Food & Beverage", "Furniture", "Accessories"];
  for (const name of categories) {
    await sql`
      INSERT INTO categories (name) VALUES (${name})
      ON CONFLICT (name) DO NOTHING
    `;
  }
  console.log("✅ Kategori ditambahkan:", categories.join(", "));

  // Brands
  const brands = ["Samsung", "Apple", "Nike", "Adidas", "IKEA", "Generic"];
  for (const name of brands) {
    await sql`
      INSERT INTO brands (name) VALUES (${name})
      ON CONFLICT (name) DO NOTHING
    `;
  }
  console.log("✅ Brand ditambahkan:", brands.join(", "));

  console.log("\n🎉 Seed selesai!");
  console.log("   Login dengan: admin@inventur.com / admin123");
}

seed().catch((err) => {
  console.error("❌ Error seed:", err.message);
  process.exit(1);
});
