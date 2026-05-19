const router = require("express").Router();
const { sql, requireAuth } = require("../middleware");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const { search, category, brand } = req.query;
    const page  = Math.max(Number(req.query.page)  || 1, 1);
    const limit = Math.min(Number(req.query.limit)  || 10, 500);
    const offset = (page - 1) * limit;

    // Build filters dinamis
    let conditions = ["1=1"];
    let params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.item_code ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (category && category !== "All") {
      conditions.push(`c.name = $${idx}`);
      params.push(category);
      idx++;
    }
    if (brand && brand !== "All") {
      conditions.push(`b.name = $${idx}`);
      params.push(brand);
      idx++;
    }

    const where = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      WHERE ${where}
    `;

    const dataQuery = `
      SELECT
        p.*,
        json_build_object('id', c.id, 'name', c.name) AS category,
        json_build_object('id', b.id, 'name', b.name) AS brand,
        json_build_object('id', u.id, 'name', u.name, 'initials', u.initials) AS "createdBy"
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      JOIN users u ON p.created_by_id = u.id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const [countRows, dataRows] = await Promise.all([
      sql(countQuery, params),
      sql(dataQuery, [...params, limit, offset]),
    ]);

    const total = Number(countRows[0].total);
    const products = dataRows.map(mapProduct);

    res.json({ data: products, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data produk" });
  }
});

// GET /api/products/sku/:sku
router.get("/sku/:sku", async (req, res) => {
  try {
    const rows = await sql`
      SELECT
        p.*,
        json_build_object('id', c.id, 'name', c.name) AS category,
        json_build_object('id', b.id, 'name', b.name) AS brand,
        json_build_object('id', u.id, 'name', u.name, 'initials', u.initials) AS "createdBy"
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      JOIN users u ON p.created_by_id = u.id
      WHERE p.sku = ${req.params.sku}
      LIMIT 1
    `;
    if (!rows[0]) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json(mapProduct(rows[0]));
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil produk" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID produk tidak valid" });

    const rows = await sql`
      SELECT
        p.*,
        json_build_object('id', c.id, 'name', c.name) AS category,
        json_build_object('id', b.id, 'name', b.name) AS brand,
        json_build_object('id', u.id, 'name', u.name, 'initials', u.initials) AS "createdBy"
      FROM products p
      JOIN categories c ON p.category_id = c.id
      JOIN brands b ON p.brand_id = b.id
      JOIN users u ON p.created_by_id = u.id
      WHERE p.id = ${id}
      LIMIT 1
    `;
    if (!rows[0]) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json(mapProduct(rows[0]));
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil produk" });
  }
});

// POST /api/products
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      sku, itemCode, name, slug, description, price, unit, qty,
      imageUrl, store, warehouse, sellingType, subCategory,
      barcodeSymbology, taxType, discountType, warranty,
      categoryId, brandId,
    } = req.body;

    if (!sku || !itemCode || !name || price === undefined || price === "" || !categoryId || !brandId)
      return res.status(400).json({ error: "Field wajib: sku, itemCode, name, price, categoryId, brandId" });

    const finalSlug = slugify(slug || name);

    const rows = await sql`
      INSERT INTO products (
        sku, item_code, name, slug, description, price, unit, qty,
        image_url, store, warehouse, selling_type, sub_category,
        barcode_symbology, tax_type, discount_type, warranty,
        category_id, brand_id, created_by_id
      ) VALUES (
        ${sku}, ${itemCode}, ${name}, ${finalSlug}, ${description || null},
        ${Number(price)}, ${unit || "Pc"}, ${Number(qty) || 0},
        ${imageUrl || null}, ${store || null}, ${warehouse || null},
        ${sellingType || null}, ${subCategory || null},
        ${barcodeSymbology || null}, ${taxType || null},
        ${discountType || null}, ${warranty || null},
        ${Number(categoryId)}, ${Number(brandId)}, ${req.user.id}
      )
      RETURNING *
    `;

    const product = await getProductWithRelations(rows[0].id);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "SKU, item code, atau slug sudah digunakan" });
    if (err.code === "23503") return res.status(400).json({ error: "Kategori atau brand tidak valid" });
    res.status(500).json({ error: "Gagal menyimpan produk" });
  }
});

// PUT /api/products/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      sku, itemCode, name, slug, description, price, unit, qty, imageUrl,
      store, warehouse, sellingType, subCategory,
      barcodeSymbology, taxType, discountType, warranty,
      categoryId, brandId,
    } = req.body;

    // Cek produk ada
    const existing = await sql`SELECT id FROM products WHERE id = ${id} LIMIT 1`;
    if (!existing[0]) return res.status(404).json({ error: "Produk tidak ditemukan" });

    // Build SET dinamis
    const sets = [];
    const vals = [];
    let i = 1;

    const push = (col, val) => { sets.push(`${col} = $${i++}`); vals.push(val); };

    if (sku         !== undefined) push("sku", sku);
    if (itemCode    !== undefined) push("item_code", itemCode);
    if (name)                      push("name", name);
    if (slug)                      push("slug", slugify(slug));
    if (description !== undefined) push("description", description);
    if (price       !== undefined) push("price", Number(price));
    if (unit)                      push("unit", unit);
    if (qty         !== undefined) push("qty", Number(qty));
    if (imageUrl    !== undefined) push("image_url", imageUrl);
    if (store       !== undefined) push("store", store);
    if (warehouse   !== undefined) push("warehouse", warehouse);
    if (sellingType !== undefined) push("selling_type", sellingType);
    if (subCategory !== undefined) push("sub_category", subCategory);
    if (barcodeSymbology !== undefined) push("barcode_symbology", barcodeSymbology);
    if (taxType     !== undefined) push("tax_type", taxType);
    if (discountType!== undefined) push("discount_type", discountType);
    if (warranty    !== undefined) push("warranty", warranty);
    if (categoryId)                push("category_id", Number(categoryId));
    if (brandId)                   push("brand_id", Number(brandId));

    if (sets.length === 0) return res.status(400).json({ error: "Tidak ada field yang diupdate" });

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    await sql(`UPDATE products SET ${sets.join(", ")} WHERE id = $${i}`, vals);

    const product = await getProductWithRelations(id);
    res.json(product);
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "SKU, item code, atau slug sudah digunakan" });
    if (err.code === "23503") return res.status(400).json({ error: "Kategori atau brand tidak valid" });
    res.status(500).json({ error: "Gagal update produk" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
    if (!rows[0]) return res.status(404).json({ error: "Produk tidak ditemukan" });
    res.json({ message: "Produk berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus produk" });
  }
});

// Helper: ambil produk beserta relasi
async function getProductWithRelations(id) {
  const rows = await sql`
    SELECT
      p.*,
      json_build_object('id', c.id, 'name', c.name) AS category,
      json_build_object('id', b.id, 'name', b.name) AS brand,
      json_build_object('id', u.id, 'name', u.name, 'initials', u.initials) AS "createdBy"
    FROM products p
    JOIN categories c ON p.category_id = c.id
    JOIN brands b ON p.brand_id = b.id
    JOIN users u ON p.created_by_id = u.id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return mapProduct(rows[0]);
}

// Helper: normalisasi nama kolom snake_case → camelCase
function mapProduct(row) {
  if (!row) return null;
  return {
    id:               row.id,
    sku:              row.sku,
    itemCode:         row.item_code,
    name:             row.name,
    slug:             row.slug,
    description:      row.description,
    price:            Number(row.price),
    unit:             row.unit,
    qty:              Number(row.qty),
    imageUrl:         row.image_url,
    store:            row.store,
    warehouse:        row.warehouse,
    sellingType:      row.selling_type,
    subCategory:      row.sub_category,
    barcodeSymbology: row.barcode_symbology,
    taxType:          row.tax_type,
    discountType:     row.discount_type,
    warranty:         row.warranty,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    categoryId:       row.category_id,
    brandId:          row.brand_id,
    createdById:      row.created_by_id,
    category:         row.category,
    brand:            row.brand,
    createdBy:        row.createdBy,
  };
}

module.exports = router;
