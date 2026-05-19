const router = require("express").Router();
const { prisma, bcrypt, jwt, SECRET } = require("../middleware");
const { OAuth2Client } = require("google-auth-library");

const rawGoogleClientId = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_ID = rawGoogleClientId.includes("GANTI_DENGAN") ? "" : rawGoogleClientId;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function makeInitials(name, email) {
  const safeName = name || (email ? email.split("@")[0] : "User");
  return safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || (email ? email[0].toUpperCase() : "U");
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: user.initials,
    avatarUrl: user.avatarUrl,
  };
}

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, initials: user.initials },
    SECRET,
    { expiresIn: "7d" }
  );
}


// GET /api/auth/config — kirim Google Client ID ke frontend
router.get("/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

// POST /api/auth/login — login dengan email & password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email dan password wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password)
      return res.status(401).json({ error: "Email atau password salah" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ error: "Email atau password salah" });

    const token = signUserToken(user);

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// POST /api/auth/register — buat akun email & password
router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
    }
    if (!email.includes("@")) {
      return res.status(400).json({ error: "Format email tidak valid" });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "Password minimal 4 karakter" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        initials: makeInitials(name, email),
      },
    });

    const token = signUserToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Email sudah terdaftar" });
    }
    res.status(500).json({ error: "Gagal membuat akun" });
  }
});

// POST /api/auth/google — login / register via Google OAuth
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ error: "Google credential tidak ditemukan" });

    if (!GOOGLE_CLIENT_ID)
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID belum dikonfigurasi di server" });

    // Verifikasi ID token dari Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: avatarUrl } = payload;

    if (!email)
      return res.status(400).json({ error: "Email tidak ditemukan di akun Google" });

    // Buat initials dari nama (maks 2 huruf kapital)
    const safeName = name || email.split("@")[0];
    const initials = makeInitials(safeName, email);

    // Upsert: cari user by googleId ATAU email, lalu update / buat baru
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      // Update info Google yang mungkin berubah
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl, name: safeName },
      });
    } else {
      // Buat user baru — tanpa password (Google user)
      user = await prisma.user.create({
        data: { email, name: safeName, initials, googleId, avatarUrl },
      });
    }

    const token = signUserToken(user);

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Verifikasi Google gagal: " + (err.message || "Unknown error") });
  }
});

// GET /api/auth/me — verifikasi token
router.get("/me", (req, res) => {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Tidak ada token" });
  try {
    const user = jwt.verify(token, SECRET);
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Token tidak valid" });
  }
});

module.exports = router;
