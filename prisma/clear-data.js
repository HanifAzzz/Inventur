/**
 * Script untuk mengosongkan data aplikasi.
 * Akun admin development tetap disimpan agar masih bisa login.
 * Jalankan: node prisma/clear-data.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Menghapus semua data aplikasi...\n");

  const items = await prisma.transactionItem.deleteMany();
  console.log("   ✅ TransactionItem dihapus:", items.count);

  const invoices = await prisma.invoice.deleteMany();
  console.log("   ✅ Invoice dihapus       :", invoices.count);

  const transactions = await prisma.transaction.deleteMany();
  console.log("   ✅ Transaction dihapus   :", transactions.count);

  const products = await prisma.product.deleteMany();
  console.log("   ✅ Product dihapus       :", products.count);

  const categories = await prisma.category.deleteMany();
  console.log("   ✅ Category dihapus      :", categories.count);

  const brands = await prisma.brand.deleteMany();
  console.log("   ✅ Brand dihapus         :", brands.count);

  const oldSeedUsers = await prisma.user.deleteMany({
    where: {
      email: { endsWith: "@inventur.com", not: "admin@inventur.com" },
      googleId: null,
    },
  });
  console.log("   ✅ User bawaan dihapus    :", oldSeedUsers.count);

  const users = await prisma.user.count();
  console.log("\n👤 User tersimpan          :", users);
  console.log("✅ Database kosong dan siap diisi manual.");
  console.log("👉 Buka http://localhost:3001/pages/sign-in.html\n");
}

main()
  .catch((e) => { console.error("❌ Error:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
