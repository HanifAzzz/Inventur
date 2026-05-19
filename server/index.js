const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors    = require("cors");

const authRoutes      = require("./routes/auth");
const productRoutes   = require("./routes/products");
const categoryRoutes  = require("./routes/categories");
const brandRoutes     = require("./routes/brands");
const invoiceRoutes   = require("./routes/invoices");
const transactionRoutes = require("./routes/transactions");
const dashboardRoutes = require("./routes/dashboard");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(express.static(path.join(__dirname, "..")));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/products",   productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands",     brandRoutes);
app.use("/api/invoices",   invoiceRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard",  dashboardRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint tidak ditemukan" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start server (hanya jika jalan di lokal, bukan di Vercel) ────────────────
if (process.env.NODE_ENV !== "production") {
  const server = app.listen(PORT, () => {
    console.log("\n🚀 Inventur API server berjalan di http://localhost:" + PORT);
    console.log("   Frontend : http://localhost:" + PORT + "/pages/sign-in.html");
    console.log("   API Base : http://localhost:" + PORT + "/api");
    console.log("   Database : " + (process.env.DATABASE_URL ? "DATABASE_URL (.env)" : "belum dikonfigurasi") + "\n");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error("❌ Port " + PORT + " sudah digunakan. Coba port lain.");
    } else {
      console.error("❌ Server error:", err);
    }
    process.exit(1);
  });

  // Jaga process tetap hidup
  process.on("SIGINT",  () => { console.log("\n👋 Server dihentikan."); process.exit(0); });
  process.on("SIGTERM", () => { console.log("\n👋 Server dihentikan."); process.exit(0); });
}

// Export app untuk Vercel Serverless Function
module.exports = app;
