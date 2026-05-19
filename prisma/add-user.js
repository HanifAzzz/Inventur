/**
 * Script untuk menambah user baru ke database
 * Jalankan: node prisma/add-user.js
 * 
 * Ganti email, password, name sesuai kebutuhan
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ─── GANTI INI SESUAI KEBUTUHAN ───────────────────────────────────────────────
const NEW_USER = {
  email:    "hanif@inventur.com",
  password: "hanif123",
  name:     "Hanif",
  initials: "HN",
};
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const exists = await prisma.user.findUnique({ where: { email: NEW_USER.email } });
  if (exists) {
    console.log("⚠️  Email sudah terdaftar:", NEW_USER.email);
    return;
  }

  const hashed = await bcrypt.hash(NEW_USER.password, 10);
  const user   = await prisma.user.create({
    data: {
      email:    NEW_USER.email,
      password: hashed,
      name:     NEW_USER.name,
      initials: NEW_USER.initials,
    },
  });

  console.log("✅ User berhasil ditambahkan!");
  console.log("   📧 Email    :", user.email);
  console.log("   🔑 Password :", NEW_USER.password);
  console.log("   👤 Nama     :", user.name);
  console.log("\n👉 Login sekarang di: http://localhost:3001/pages/sign-in.html");
}

main()
  .catch((e) => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
