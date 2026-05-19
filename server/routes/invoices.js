const router = require("express").Router();
const { sql, requireAuth } = require("../middleware");

// GET /api/invoices
router.get("/", async (req, res) => {
  try {
    const { customer, status } = req.query;

    let conditions = ["1=1"];
    let params = [];
    let idx = 1;

    if (customer && customer !== "All") {
      conditions.push(`customer = $${idx++}`);
      params.push(customer);
    }
    if (status && status !== "All") {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.join(" AND ");

    const [invoices, allInvoices] = await Promise.all([
      sql(`SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC`, params),
      sql`SELECT amount, paid, due, status FROM invoices`,
    ]);

    const stats = allInvoices.reduce(
      (acc, inv) => {
        acc.amount  += Number(inv.amount);
        acc.paid    += Number(inv.paid);
        acc.due     += Number(inv.due);
        if (inv.status !== "Paid") acc.overdue += Number(inv.due);
        return acc;
      },
      { amount: 0, paid: 0, due: 0, overdue: 0 }
    );

    res.json({ data: invoices.map(mapInvoice), stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil invoice" });
  }
});

// GET /api/invoices/:id
router.get("/:id", async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM invoices WHERE id = ${Number(req.params.id)} LIMIT 1`;
    if (!rows[0]) return res.status(404).json({ error: "Invoice tidak ditemukan" });
    res.json(mapInvoice(rows[0]));
  } catch {
    res.status(500).json({ error: "Gagal mengambil invoice" });
  }
});

// POST /api/invoices
router.post("/", requireAuth, async (req, res) => {
  try {
    const { invoiceNumber, amount, paid, dueDate, status, customer, transactionId } = req.body;
    if (!invoiceNumber || !amount || !customer)
      return res.status(400).json({ error: "invoiceNumber, amount, customer wajib diisi" });

    const due = Number(amount) - Number(paid || 0);
    let txId = transactionId;

    if (!txId) {
      const txRows = await sql`
        INSERT INTO transactions (order_id, total, status, customer, user_id)
        VALUES (
          ${invoiceNumber},
          ${Number(amount)},
          ${status === "Paid" ? "completed" : "pending"},
          ${customer},
          ${req.user.id}
        )
        RETURNING id
      `;
      txId = txRows[0].id;
    }

    const finalDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const rows = await sql`
      INSERT INTO invoices (invoice_number, amount, paid, due, status, customer, due_date, transaction_id)
      VALUES (
        ${invoiceNumber}, ${Number(amount)}, ${Number(paid || 0)},
        ${due}, ${status || "Unpaid"}, ${customer},
        ${finalDueDate}, ${txId}
      )
      RETURNING *
    `;
    res.status(201).json(mapInvoice(rows[0]));
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "Invoice number sudah ada" });
    res.status(500).json({ error: "Gagal membuat invoice" });
  }
});

// PUT /api/invoices/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { paid, status } = req.body;

    const current = (await sql`SELECT * FROM invoices WHERE id = ${id} LIMIT 1`)[0];
    if (!current) return res.status(404).json({ error: "Invoice tidak ditemukan" });

    const newPaid = paid !== undefined ? Number(paid) : Number(current.paid);
    const newDue  = Number(current.amount) - newPaid;

    const sets = [];
    const vals = [];
    let i = 1;

    if (paid !== undefined) {
      sets.push(`paid = $${i++}`, `due = $${i++}`);
      vals.push(newPaid, newDue);
    }
    if (status !== undefined) {
      sets.push(`status = $${i++}`);
      vals.push(status);
    }

    if (sets.length === 0) return res.status(400).json({ error: "Tidak ada field yang diupdate" });

    vals.push(id);
    const rows = await sql(`UPDATE invoices SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals);

    res.json(mapInvoice(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal update invoice" });
  }
});

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
