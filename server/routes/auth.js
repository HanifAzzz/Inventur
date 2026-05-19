const router = require("express").Router();
const { sql, bcrypt, jwt, SECRET } = require("../middleware");
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
    avatarUrl: user.avatar_url,
  };
}

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, initials: user.initials },
    SECRET,
    { expiresIn: "7d" }
  );
}

// GET /api/auth/config
router.get("/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email dan password wajib diisi" });

    const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    const user = rows[0];
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

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const name     = String(req.body.name     || "").trim();
    const email    = String(req.body.email    || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password)
      return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
    if (!email.includes("@"))
      return res.status(400).json({ error: "Format email tidak valid" });
    if (password.length < 4)
      return res.status(400).json({ error: "Password minimal 4 karakter" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const initials = makeInitials(name, email);

    const rows = await sql`
      INSERT INTO users (email, password, name, initials)
      VALUES (${email}, ${hashedPassword}, ${name}, ${initials})
      RETURNING *
    `;
    const user = rows[0];
    const token = signUserToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    if (err.code === "23505")
      return res.status(409).json({ error: "Email sudah terdaftar" });
    res.status(500).json({ error: "Gagal membuat akun" });
  }
});

// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ error: "Google credential tidak ditemukan" });

    if (!GOOGLE_CLIENT_ID)
      return res.status(500).json({ error: "GOOGLE_CLIENT_ID belum dikonfigurasi di server" });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: avatarUrl } = payload;

    if (!email)
      return res.status(400).json({ error: "Email tidak ditemukan di akun Google" });

    const safeName = name || email.split("@")[0];
    const initials = makeInitials(safeName, email);

    // Cari user berdasarkan google_id atau email
    let rows = await sql`
      SELECT * FROM users WHERE google_id = ${googleId} OR email = ${email} LIMIT 1
    `;
    let user = rows[0];

    if (user) {
      const updated = await sql`
        UPDATE users SET google_id = ${googleId}, avatar_url = ${avatarUrl}, name = ${safeName}
        WHERE id = ${user.id}
        RETURNING *
      `;
      user = updated[0];
    } else {
      const created = await sql`
        INSERT INTO users (email, name, initials, google_id, avatar_url)
        VALUES (${email}, ${safeName}, ${initials}, ${googleId}, ${avatarUrl})
        RETURNING *
      `;
      user = created[0];
    }

    const token = signUserToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Verifikasi Google gagal: " + (err.message || "Unknown error") });
  }
});

// GET /api/auth/me
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
