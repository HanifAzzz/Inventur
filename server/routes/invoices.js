const router = require("express").Router();
const { prisma, requireAuth } = require("../middleware");

// GET /api/invoices  — list invoice dengan filter
router.get("/", async (req, res) => {
  try {
    const { customer, status } = req.query;
    const where = {};
    if (customer && customer !== "All") where.customer = customer;
    if (status   && status   !== "All") where.status   = status;

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Hitung stats
    const all = await prisma.invoice.findMany();
    const stats = all.reduce(
      (acc, inv) => {
        acc.amount  += inv.amount;
        acc.paid    += inv.paid;
        acc.due     += inv.due;
        if (inv.status !== "Paid") acc.overdue += inv.due;
        return acc;
      },
      { amount: 0, paid: 0, due: 0, overdue: 0 }
    );

    res.json({ data: invoices, stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil invoice" });
  }
});

// GET /api/invoices/:id
router.get("/:id", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice tidak ditemukan" });
    res.json(invoice);
  } catch {
    res.status(500).json({ error: "Gagal mengambil invoice" });
  }
});

// POST /api/invoices  — buat invoice baru
router.post("/", requireAuth, async (req, res) => {
  try {
    const { invoiceNumber, amount, paid, dueDate, status, customer, transactionId } = req.body;
    if (!invoiceNumber || !amount || !customer)
      return res.status(400).json({ error: "invoiceNumber, amount, customer wajib diisi" });

    const due = Number(amount) - Number(paid || 0);

    // Buat transaksi terkait jika invoice dibuat manual
    let txId = transactionId;
    if (!txId) {
      const tx = await prisma.transaction.create({
        data: {
          orderId:  invoiceNumber,
          total:    Number(amount),
          status:   status === "Paid" ? "completed" : "pending",
          customer: customer,
          userId:   req.user.id,
        },
      });
      txId = tx.id;
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        amount: Number(amount),
        paid:   Number(paid || 0),
        due,
        status: status || "Unpaid",
        customer,
        dueDate: new Date(dueDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
        transactionId: txId,
      },
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") return res.status(409).json({ error: "Invoice number sudah ada" });
    res.status(500).json({ error: "Gagal membuat invoice" });
  }
});

// PUT /api/invoices/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { paid, status } = req.body;
    const current = await prisma.invoice.findUnique({ where: { id: Number(req.params.id) } });
    if (!current) return res.status(404).json({ error: "Invoice tidak ditemukan" });

    const newPaid = paid !== undefined ? Number(paid) : current.paid;
    const invoice = await prisma.invoice.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(paid   !== undefined && { paid: newPaid, due: current.amount - newPaid }),
        ...(status !== undefined && { status }),
      },
    });
    res.json(invoice);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Invoice tidak ditemukan" });
    res.status(500).json({ error: "Gagal update invoice" });
  }
});

module.exports = router;
