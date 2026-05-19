const router = require("express").Router();
const { sql } = require("../middleware");

// GET /api/dashboard
router.get("/", async (req, res) => {
  try {
    const now        = new Date();
    const weekStart  = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      countRows,
      productValues,
      weekTx,
      monthTx,
      allTx,
      lowStock,
    ] = await Promise.all([
      sql`
        SELECT
          (SELECT COUNT(*) FROM products)   AS total_products,
          (SELECT COUNT(*) FROM categories) AS total_categories,
          (SELECT COUNT(*) FROM brands)     AS total_brands
      `,
      sql`SELECT price, qty FROM products`,
      sql`SELECT total FROM transactions WHERE created_at >= ${weekStart}`,
      sql`SELECT total FROM transactions WHERE created_at >= ${monthStart}`,
      sql`SELECT total FROM transactions`,
      sql`SELECT id, name, sku, qty, price FROM products WHERE qty < 50 ORDER BY qty ASC LIMIT 5`,
    ]);

    const counts = countRows[0];
    const sumTotal = (txs) => txs.reduce((s, t) => s + Number(t.total || 0), 0);
    const inventoryValue = productValues.reduce(
      (sum, p) => sum + Number(p.price || 0) * Number(p.qty || 0), 0
    );
    const totalStockUnits = productValues.reduce(
      (sum, p) => sum + Number(p.qty || 0), 0
    );

    res.json({
      totalProducts:    Number(counts.total_products),
      totalCategories:  Number(counts.total_categories),
      totalBrands:      Number(counts.total_brands),
      totalTransactions: allTx.length,
      totalStockUnits,
      inventoryValue,
      earnings: {
        week:    sumTotal(weekTx),
        month:   sumTotal(monthTx),
        allTime: sumTotal(allTx),
      },
      sales:     weekTx.length,
      purchases: Number(counts.total_products),
      lowStockProducts: lowStock.map((p) => ({
        id:    p.id,
        name:  p.name,
        sku:   p.sku,
        qty:   Number(p.qty),
        price: Number(p.price),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data dashboard" });
  }
});

module.exports = router;
