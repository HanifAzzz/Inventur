const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  "Computers",
  "Electronics",
  "Shoe",
  "Furniture",
  "Bags",
  "Phone",
];

const DEFAULT_BRANDS = [
  "Lenovo",
  "Apple",
  "Nike",
  "Beats",
  "Amazon",
  "Dior",
];

async function upsertNames(model, names) {
  for (const name of names) {
    await prisma[model].upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function main() {
  console.log("🌱 Menyiapkan database...");

  // Bersihkan data transaksi dan produk agar aplikasi tetap mulai dari produk kosong.
  // Master data Category/Brand tidak dihapus, supaya pilihan select tetap tersedia.
  await prisma.transactionItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();

  await upsertNames("category", DEFAULT_CATEGORIES);
  await upsertNames("brand", DEFAULT_BRANDS);

  // Satu akun admin tetap disediakan untuk login email/password saat development.
  // User Google akan otomatis dibuat saat login via Google.
  const admin = await prisma.user.upsert({
    where: { email: "admin@inventur.com" },
    update: {
      password: await bcrypt.hash("admin123", 10),
      name: "Admin Inventur",
      initials: "AI",
    },
    create: {
      email: "admin@inventur.com",
      password: await bcrypt.hash("admin123", 10),
      name: "Admin Inventur",
      initials: "AI",
    },
  });

  // Hapus user bawaan lama dari seed sebelumnya, tapi jangan hapus admin / user Google asli.
  await prisma.user.deleteMany({
    where: {
      email: { endsWith: "@inventur.com", not: admin.email },
      googleId: null,
    },
  });

  console.log("✅ Database siap: produk/invoice/transaksi kosong.");
  console.log("✅ Select Category & Brand sudah diisi master data awal.");
  console.log("🔑 Login dev: admin@inventur.com / admin123");
  console.log("👉 Atau isi GOOGLE_CLIENT_ID di .env untuk login via Google.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
