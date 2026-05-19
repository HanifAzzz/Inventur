const router = require("express").Router();
const { prisma, requireAuth } = require("../middleware");

function makeOrderId() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = [
    now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()),
    pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds()),
  ].join("");
  return "ORD-" + stamp + "-" + Math.floor(Math.random() * 900 + 100);
}

// POST /api/transactions — simpan transaksi dari POS dan update stok
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      customer = "Walk In Customer",
      items = [],
      discount = 0,
      shipping = 0,
      tax = 0,
      payment = "cash",
      createInvoice = true,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items transaksi wajib diisi" });
    }

    const normalizedItems = items.map((item) => ({
      productId: Number(item.productId),
      qty: Number(item.qty),
    })).filter((item) => item.productId && item.qty > 0);

    if (!normalizedItems.length) {
      return res.status(400).json({ error: "Items transaksi tidak valid" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: normalizedItems.map((item) => item.productId) } },
      });
      const byId = new Map(products.map((product) => [product.id, product]));

      for (const item of normalizedItems) {
        const product = byId.get(item.productId);
        if (!product) throw Object.assign(new Error("Produk tidak ditemukan"), { status: 404 });
        if (product.qty < item.qty) {
          throw Object.assign(new Error("Stok " + product.name + " tidak cukup"), { status: 400 });
        }
      }

      const subtotal = normalizedItems.reduce((sum, item) => {
        const product = byId.get(item.productId);
        return sum + product.price * item.qty;
      }, 0);
      const discountAmount = subtotal * (Number(discount) / 100);
      const taxAmount = subtotal * (Number(tax) / 100);
      const total = Math.max(0, subtotal - discountAmount + Number(shipping || 0) + taxAmount);
      let orderId = makeOrderId();

      // Pastikan orderId unik walaupun ada tabrakan random kecil.
      for (let i = 0; i < 5; i += 1) {
        const exists = await tx.transaction.findUnique({ where: { orderId } });
        if (!exists) break;
        orderId = makeOrderId();
      }

      const transaction = await tx.transaction.create({
        data: {
          orderId,
          total,
          discount: discountAmount,
          shipping: Number(shipping || 0),
          tax: taxAmount,
          payment,
          status: "completed",
          customer,
          userId: req.user.id,
          items: {
            create: normalizedItems.map((item) => {
              const product = byId.get(item.productId);
              return { productId: item.productId, qty: item.qty, price: product.price };
            }),
          },
        },
        include: { items: true },
      });

      for (const item of normalizedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { qty: { decrement: item.qty } },
        });
      }

      let invoice = null;
      if (createInvoice) {
        invoice = await tx.invoice.create({
          data: {
            invoiceNumber: orderId,
            amount: total,
            paid: total,
            due: 0,
            status: "Paid",
            customer,
            dueDate: new Date(),
            transactionId: transaction.id,
          },
        });
      }

      return { transaction, invoice, orderId, subtotal, discountAmount, taxAmount, total };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Gagal menyimpan transaksi" });
  }
});

module.exports = router;
