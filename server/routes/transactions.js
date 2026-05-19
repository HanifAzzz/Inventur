const router = require("express").Router();
const { sql, requireAuth } = require("../middleware");

function makeOrderId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = [
    now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()),
    pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds()),
  ].join("");
  return "ORD-" + stamp + "-" + Math.floor(Math.random() * 900 + 100);
}

// POST /api/transactions
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      customer     = "Walk In Customer",
      items        = [],
      discount     = 0,
      shipping     = 0,
      tax          = 0,
      payment      = "cash",
      createInvoice = true,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: "Items transaksi wajib diisi" });

    const normalizedItems = items
      .map((item) => ({ productId: Number(item.productId), qty: Number(item.qty) }))
      .filter((item) => item.productId && item.qty > 0);

    if (!normalizedItems.length)
      return res.status(400).json({ error: "Items transaksi tidak valid" });

    const productIds = normalizedItems.map((i) => i.productId);

    // Ambil produk
    const products = await sql`
      SELECT id, name, price, qty FROM products WHERE id = ANY(${productIds})
    `;
    const byId = new Map(products.map((p) => [p.id, p]));

    // Validasi stok
    for (const item of normalizedItems) {
      const product = byId.get(item.productId);
      if (!product) return res.status(404).json({ error: "Produk tidak ditemukan" });
      if (Number(product.qty) < item.qty)
        return res.status(400).json({ error: "Stok " + product.name + " tidak cukup" });
    }

    // Hitung total
    const subtotal = normalizedItems.reduce((sum, item) => {
      return sum + Number(byId.get(item.productId).price) * item.qty;
    }, 0);
    const discountAmount = subtotal * (Number(discount) / 100);
    const taxAmount      = subtotal * (Number(tax) / 100);
    const total          = Math.max(0, subtotal - discountAmount + Number(shipping || 0) + taxAmount);

    // Generate orderId unik
    let orderId = makeOrderId();
    for (let i = 0; i < 5; i++) {
      const exists = await sql`SELECT id FROM transactions WHERE order_id = ${orderId} LIMIT 1`;
      if (!exists[0]) break;
      orderId = makeOrderId();
    }

    // Insert transaksi
    const txRows = await sql`
      INSERT INTO transactions (order_id, total, discount, shipping, tax, payment, status, customer, user_id)
      VALUES (
        ${orderId}, ${total}, ${discountAmount},
        ${Number(shipping || 0)}, ${taxAmount},
        ${payment}, 'completed', ${customer}, ${req.user.id}
      )
      RETURNING *
    `;
    const transaction = txRows[0];

    // Insert transaction items & update stok
    const txItems = [];
    for (const item of normalizedItems) {
      const product = byId.get(item.productId);
      const itemRows = await sql`
        INSERT INTO transaction_items (transaction_id, product_id, qty, price)
        VALUES (${transaction.id}, ${item.productId}, ${item.qty}, ${Number(product.price)})
        RETURNING *
      `;
      txItems.push(itemRows[0]);

      await sql`
        UPDATE products SET qty = qty - ${item.qty} WHERE id = ${item.productId}
      `;
    }

    // Buat invoice
    let invoice = null;
    if (createInvoice) {
      const invRows = await sql`
        INSERT INTO invoices (invoice_number, amount, paid, due, status, customer, due_date, transaction_id)
        VALUES (${orderId}, ${total}, ${total}, 0, 'Paid', ${customer}, NOW(), ${transaction.id})
        RETURNING *
      `;
      invoice = mapInvoice(invRows[0]);
    }

    res.status(201).json({
      transaction: mapTransaction(transaction),
      items: txItems,
      invoice,
      orderId,
      subtotal,
      discountAmount,
      taxAmount,
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Gagal menyimpan transaksi" });
  }
});

function mapTransaction(r) {
  if (!r) return null;
  return {
    id:        r.id,
    orderId:   r.order_id,
    total:     Number(r.total),
    discount:  Number(r.discount),
    shipping:  Number(r.shipping),
    tax:       Number(r.tax),
    payment:   r.payment,
    status:    r.status,
    customer:  r.customer,
    createdAt: r.created_at,
    userId:    r.user_id,
  };
}

function mapInvoice(r) {
  if (!r) return null;
  return {
    id:            r.id,
    invoiceNumber: r.invoice_number,
    amount:        Number(r.amount),
    paid:          Number(r.paid),
    due:           Number(r.due),
    dueDate:       r.due_date,
    status:        r.status,
    customer:      r.customer,
    createdAt:     r.created_at,
    transactionId: r.transaction_id,
  };
}

module.exports = router;
