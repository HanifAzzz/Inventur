const router = require("express").Router();
const { prisma } = require("../middleware");

// GET /api/dashboard — data ringkasan untuk halaman dashboard
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProducts,
      totalCategories,
      totalBrands,
      productsValue,
      weekTx,
      monthTx,
      allTx,
      lowStockProducts,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.brand.count(),
      prisma.product.findMany({ select: { price: true, qty: true } }),
      prisma.transaction.findMany({ where: { createdAt: { gte: weekStart } } }),
      prisma.transaction.findMany({ where: { createdAt: { gte: monthStart } } }),
      prisma.transaction.findMany(),
      prisma.product.findMany({ where: { qty: { lt: 50 } }, orderBy: { qty: "asc" }, take: 5 }),
    ]);

    const sumTotal = (txs) => txs.reduce((s, t) => s + Number(t.total || 0), 0);
    const inventoryValue = productsValue.reduce((sum, product) => {
      return sum + Number(product.price || 0) * Number(product.qty || 0);
    }, 0);
    const totalStockUnits = productsValue.reduce((sum, product) => sum + Number(product.qty || 0), 0);

    res.json({
      totalProducts,
      totalCategories,
      totalBrands,
      totalTransactions: allTx.length,
      totalStockUnits,
      inventoryValue,
      earnings: {
        week: sumTotal(weekTx),
        month: sumTotal(monthTx),
        allTime: sumTotal(allTx),
      },
      sales: weekTx.length,
      purchases: totalProducts,
      lowStockProducts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data dashboard" });
  }
});

module.exports = router;
