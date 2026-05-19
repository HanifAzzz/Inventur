const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const jwt    = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SECRET = process.env.JWT_SECRET || "inventur-secret-key-2024";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token tidak ditemukan" });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid atau sudah kadaluarsa" });
  }
}

module.exports = { prisma, jwt, bcrypt, SECRET, requireAuth };
