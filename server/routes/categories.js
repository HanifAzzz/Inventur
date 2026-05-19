const router = require("express").Router();
const { sql, requireAuth } = require("../middleware");

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const rows = await sql`
      SELECT c.id, c.name, c.created_at,
        COUNT(p.id)::int AS "_count_products"
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name, c.created_at
      ORDER BY c.name ASC
    `;
    const categories = rows.map((r) => ({
      id:        r.id,
      name:      r.name,
      createdAt: r.created_at,
      _count:    { products: r._count_products },
    }));
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil kategori" });
  }
});

// POST /api/categories
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nama kategori wajib diisi" });

    const rows = await sql`
      INSERT INTO categories (name) VALUES (${name}) RETURNING *
    `;
    const r = rows[0];
    res.status(201).json({ id: r.id, name: r.name, createdAt: r.created_at });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Kategori sudah ada" });
    res.status(500).json({ error: "Gagal membuat kategori" });
  }
});

// PUT /api/categories/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const rows = await sql`
      UPDATE categories SET name = ${name} WHERE id = ${Number(req.params.id)} RETURNING *
    `;
    if (!rows[0]) return res.status(404).json({ error: "Kategori tidak ditemukan" });
    const r = rows[0];
    res.json({ id: r.id, name: r.name, createdAt: r.created_at });
  } catch (err) {
    res.status(500).json({ error: "Gagal update kategori" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      DELETE FROM categories WHERE id = ${Number(req.params.id)} RETURNING id
    `;
    if (!rows[0]) return res.status(404).json({ error: "Kategori tidak ditemukan" });
    res.json({ message: "Kategori berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus kategori" });
  }
});

module.exports = router;
