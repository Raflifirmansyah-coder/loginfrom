# Nexus — Login/Register + Admin Dashboard (Node.js + SQLite)

Aplikasi login/register dengan dashboard admin. Data pengguna disimpan di **server** (SQLite), bukan di browser — jadi siapa pun yang register dari device manapun akan otomatis muncul di dashboard admin, dari device manapun admin login.

## Menjalankan secara lokal

Pastikan [Node.js](https://nodejs.org) (versi 18+) sudah terpasang, lalu:

```bash
cd nexus-app
npm install
npm start
```

Buka **http://localhost:3000** di browser.

Database `nexus.db` akan otomatis dibuat di folder ini saat pertama kali dijalankan, lengkap dengan akun admin default:

- **Username:** `Xiaoli`
- **Password:** `0507`

## Struktur project

```
nexus-app/
├── server.js        # Express server + semua REST API endpoint
├── database.js      # Setup SQLite (better-sqlite3) + seed admin
├── package.json
├── public/
│   └── index.html   # Frontend (auth, home, dashboard) — satu file
└── nexus.db          # Database (dibuat otomatis, jangan di-commit ke git)
```

## Cara kerja login lintas device

- Data user (`username`, `email`, `password`, `role`, `created_at`) disimpan di tabel `users` dalam file `nexus.db` di server.
- Saat user register/login dari device apa pun, request dikirim ke server lewat `fetch()` — server yang menyimpan & memvalidasi datanya, bukan browser.
- Sesi login disimpan via **cookie session** (`express-session`), jadi server tahu siapa yang sedang login tanpa perlu mengirim password berulang kali.
- Karena semua device bicara ke server yang sama, dashboard admin (`GET /api/admin/users`) selalu menunjukkan data terbaru dari **semua** user yang pernah register, dari device mana pun.

## Endpoint API

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/api/register` | Daftar akun baru |
| POST | `/api/login` | Login (body: `identifier`, `password`) |
| POST | `/api/logout` | Keluar |
| GET | `/api/me` | Cek sesi user yang sedang login |
| GET | `/api/admin/users` | Lihat semua user (admin only) |
| POST | `/api/admin/users` | Tambah user manual (admin only) |
| PATCH | `/api/admin/users/:id/role` | Ubah role user (admin only) |
| DELETE | `/api/admin/users/:id` | Hapus user (admin only) |

## Deploy ke hosting (agar bisa diakses publik)

Aplikasi ini butuh server Node.js yang terus berjalan (bukan hosting statis seperti Netlify/GitHub Pages). Opsi yang cocok dan punya tier gratis:

- **Render** (render.com) — paling mudah untuk Express + SQLite
- **Railway** (railway.app)
- **Fly.io**

Langkah umum di Render:
1. Push project ini ke repo GitHub.
2. Di Render, buat **Web Service** baru, hubungkan ke repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy — Render akan beri URL publik (misalnya `https://nexus-app.onrender.com`).

> Catatan: hosting gratis biasanya punya **ephemeral filesystem** (file `nexus.db` bisa hilang saat server di-restart/redeploy). Untuk produksi sungguhan, pertimbangkan database terkelola seperti PostgreSQL (Render/Railway menyediakan gratis) alih-alih SQLite.

## Catatan keamanan (penting untuk dibaca)

Project ini dibuat untuk **belajar/demo**, bukan untuk produksi nyata:

- Password disimpan **plain text** di database agar admin bisa melihatnya langsung di dashboard (sesuai permintaan). Di aplikasi sungguhan, password **selalu di-hash** (misalnya dengan `bcrypt`) dan **tidak pernah** ditampilkan ke siapa pun, termasuk admin.
- `session secret` di `server.js` masih nilai contoh (`'nexus-demo-secret-change-me'`) — ganti dengan string acak yang panjang sebelum dipublikasikan, dan simpan sebagai environment variable.
- Tidak ada rate-limiting untuk percobaan login — di produksi sebaiknya ditambahkan agar tidak rawan brute-force.
