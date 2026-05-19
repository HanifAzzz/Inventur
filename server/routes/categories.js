const router = require("express").Router();
const { prisma, requireAuth } = require("../middleware");

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil kategori" });
  }
});

// POST /api/categories
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nama kategori wajib diisi" });
    const category = await prisma.category.create({ data: { name } });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Kategori sudah ada" });
    res.status(500).json({ error: "Gagal membuat kategori" });
  }
});

// PUT /api/categories/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { name },
    });
    res.json(category);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Kategori tidak ditemukan" });
    res.status(500).json({ error: "Gagal update kategori" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.category.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Kategori berhasil dihapus" });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Kategori tidak ditemukan" });
    res.status(500).json({ error: "Gagal hapus kategori" });
  }
});

module.exports = router;
