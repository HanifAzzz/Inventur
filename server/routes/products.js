const router = require("express").Router();
const { prisma, requireAuth } = require("../middleware");

const include = {
  category:  { select: { id: true, name: true } },
  brand:     { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, initials: true } },
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// GET /api/products  — list semua produk (dengan filter & search)
router.get("/", async (req, res) => {
  try {
    const { search, category, brand, page = 1, limit = 10 } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name:     { contains: search } },
        { sku:      { contains: search } },
        { itemCode: { contains: search } },
      ];
    }
    if (category && category !== "All") where.category = { name: category };
    if (brand    && brand    !== "All") where.brand    = { name: brand };

    const take = Math.min(Number(limit) || 10, 500);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, include, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.product.count({ where }),
    ]);

    res.json({ data: products, total, page: Number(page), limit: take });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data produk" });
  }
});

// GET /api/products/sku/:sku — harus didefinisikan sebelum /:id
router.get("/sku/:sku", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { sku: req.params.sku },
      include,
    });
    if (!product) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil produk" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID produk tidak valid" });
    const product = await prisma.product.findUnique({ where: { id }, include });
    if (!product) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil produk" });
  }
});

// POST /api/products  — tambah produk baru
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      sku, itemCode, name, slug, description, price, unit, qty,
      imageUrl, store, warehouse, sellingType, subCategory,
      barcodeSymbology, taxType, discountType, warranty,
      categoryId, brandId,
    } = req.body;

    if (!sku || !itemCode || !name || price === undefined || price === "" || !categoryId || !brandId) {
      return res.status(400).json({ error: "Field wajib: sku, itemCode, name, price, categoryId, brandId" });
    }

    const product = await prisma.product.create({
      data: {
        sku,
        itemCode,
        name,
        slug: slugify(slug || name),
        description,
        price: Number(price),
        unit: unit || "Pc",
        qty: Number(qty) || 0,
        imageUrl,
        store,
        warehouse,
        sellingType,
        subCategory,
        barcodeSymbology,
        taxType,
        discountType,
        warranty,
        categoryId: Number(categoryId),
        brandId: Number(brandId),
        createdById: req.user.id,
      },
      include,
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") return res.status(409).json({ error: "SKU, item code, atau slug sudah digunakan" });
    if (err.code === "P2003") return res.status(400).json({ error: "Kategori atau brand tidak valid" });
    res.status(500).json({ error: "Gagal menyimpan produk" });
  }
});

// PUT /api/products/:id  — update produk
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      sku, itemCode, name, slug, description, price, unit, qty, imageUrl,
      store, warehouse, sellingType, subCategory,
      barcodeSymbology, taxType, discountType, warranty,
      categoryId, brandId,
    } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(sku         !== undefined && { sku }),
        ...(itemCode    !== undefined && { itemCode }),
        ...(name        && { name }),
        ...(slug        && { slug: slugify(slug) }),
        ...(description !== undefined && { description }),
        ...(price       !== undefined && { price: Number(price) }),
        ...(unit        && { unit }),
        ...(qty         !== undefined && { qty: Number(qty) }),
        ...(imageUrl    !== undefined && { imageUrl }),
        ...(store       !== undefined && { store }),
        ...(warehouse   !== undefined && { warehouse }),
        ...(sellingType !== undefined && { sellingType }),
        ...(subCategory !== undefined && { subCategory }),
        ...(barcodeSymbology !== undefined && { barcodeSymbology }),
        ...(taxType     !== undefined && { taxType }),
        ...(discountType!== undefined && { discountType }),
        ...(warranty    !== undefined && { warranty }),
        ...(categoryId  && { categoryId: Number(categoryId) }),
        ...(brandId     && { brandId: Number(brandId) }),
      },
      include,
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    if (err.code === "P2025") return res.status(404).json({ error: "Produk tidak ditemukan" });
    if (err.code === "P2002") return res.status(409).json({ error: "SKU, item code, atau slug sudah digunakan" });
    if (err.code === "P2003") return res.status(400).json({ error: "Kategori atau brand tidak valid" });
    res.status(500).json({ error: "Gagal update produk" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Produk berhasil dihapus" });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.status(500).json({ error: "Gagal hapus produk" });
  }
});

module.exports = router;
