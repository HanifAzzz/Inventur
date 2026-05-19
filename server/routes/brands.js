const router = require("express").Router();
const { sql, requireAuth } = require("../middleware");

// GET /api/brands
router.get("/", async (req, res) => {
  try {
    const rows = await sql`
      SELECT b.id, b.name, b.created_at,
        COUNT(p.id)::int AS "_count_products"
      FROM brands b
      LEFT JOIN products p ON p.brand_id = b.id
      GROUP BY b.id, b.name, b.created_at
      ORDER BY b.name ASC
    `;
    const brands = rows.map((r) => ({
      id:        r.id,
      name:      r.name,
      createdAt: r.created_at,
      _count:    { products: r._count_products },
    }));
    res.json(brands);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil brand" });
  }
});

// POST /api/brands
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nama brand wajib diisi" });

    const rows = await sql`
      INSERT INTO brands (name) VALUES (${name}) RETURNING *
    `;
    const r = rows[0];
    res.status(201).json({ id: r.id, name: r.name, createdAt: r.created_at });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Brand sudah ada" });
    res.status(500).json({ error: "Gagal membuat brand" });
  }
});

// PUT /api/brands/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const rows = await sql`
      UPDATE brands SET name = ${name} WHERE id = ${Number(req.params.id)} RETURNING *
    `;
    if (!rows[0]) return res.status(404).json({ error: "Brand tidak ditemukan" });
    const r = rows[0];
    res.json({ id: r.id, name: r.name, createdAt: r.created_at });
  } catch (err) {
    res.status(500).json({ error: "Gagal update brand" });
  }
});

// DELETE /api/brands/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      DELETE FROM brands WHERE id = ${Number(req.params.id)} RETURNING id
    `;
    if (!rows[0]) return res.status(404).json({ error: "Brand tidak ditemukan" });
    res.json({ message: "Brand berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus brand" });
  }
});

module.exports = router;
