# Perubahan versi bersih

Project ini sudah dibersihkan agar alurnya mulai dari data kosong.

## Yang diperbaiki

- Data bawaan produk, kategori, brand, transaksi, dan invoice dikosongkan.
- File database SQLite bawaan hanya menyisakan akun admin development.
- Data/baris contoh di halaman Products, POS, dan Invoice Reports dihapus.
- POS sekarang mengambil produk dari database, bukan dari data statis.
- Saat pembayaran di POS, sistem membuat transaksi, mengurangi stok produk, dan membuat invoice otomatis.
- Dashboard sekarang menampilkan angka dari API/database, bukan angka contoh.
- Login email/password tetap tersedia.
- Login Google siap dipakai setelah `GOOGLE_CLIENT_ID` di `.env` diganti dengan Client ID asli.
- Bug JavaScript duplicate `const show` di filter tabel diperbaiki.
- Route pencarian produk berdasarkan SKU diperbaiki agar tidak tertabrak route detail produk.
- Script seed/clear dibuat aman untuk mengosongkan data aplikasi tanpa menghapus akun admin development.
- File gambar produk/kategori bawaan yang tidak dipakai ikut dibersihkan.

## Login development

Email: `admin@inventur.com`
Password: `admin123`

## Cara menjalankan

```bash
npm install
npx prisma generate
npm run seed
npm start
```

Buka:

```text
http://localhost:3001/pages/sign-in.html
```

## Catatan Google Login

Di `.env`, ganti nilai berikut dengan Client ID asli dari Google Cloud Console:

```env
GOOGLE_CLIENT_ID="CLIENT_ID_KAMU.apps.googleusercontent.com"
```

Kalau masih memakai placeholder, tombol Google tidak akan aktif dan aplikasi tetap bisa login lewat email/password development.

## Update tambahan

- Menambahkan halaman `pages/register.html` dari POS_Inventur.
- Menambahkan `assets/js/register.js` dan icon user untuk halaman register.
- Register email/password sekarang terhubung ke backend lewat `POST /api/auth/register`.
- Register/Login Google memakai tombol resmi Google Identity Services.
- Menambahkan script `npm run db:push` dan `npm run db:setup` untuk membuat tabel di Prisma/PostgreSQL.
- Mengubah Prisma datasource ke PostgreSQL + `DIRECT_URL` agar cocok dengan Prisma Console.
- Menghapus file SQLite lokal dan migration SQLite lama dari paket agar tidak bentrok dengan PostgreSQL cloud.
