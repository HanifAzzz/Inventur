const router = require("express").Router();
const { prisma, requireAuth } = require("../middleware");

// GET /api/brands
router.get("/", async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil brand" });
  }
});

// POST /api/brands
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nama brand wajib diisi" });
    const brand = await prisma.brand.create({ data: { name } });
    res.status(201).json(brand);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Brand sudah ada" });
    res.status(500).json({ error: "Gagal membuat brand" });
  }
});

// PUT /api/brands/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const brand = await prisma.brand.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
    res.json(brand);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Brand tidak ditemukan" });
    res.status(500).json({ error: "Gagal update brand" });
  }
});

// DELETE /api/brands/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.brand.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Brand berhasil dihapus" });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Brand tidak ditemukan" });
    res.status(500).json({ error: "Gagal hapus brand" });
  }
});

module.exports = router;
