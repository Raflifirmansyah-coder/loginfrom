// server.js — Express server: serve frontend statis + REST API untuk auth & admin
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: 'nexus-demo-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 hari
    }
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function genId() {
  return crypto.randomBytes(8).toString('hex');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toPublicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.created_at
  };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Belum login.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Belum login.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Hanya admin yang boleh mengakses ini.' });
  }
  req.currentUser = user;
  next();
}

// ====================== AUTH ROUTES ======================

// Register
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body || {};

  const cleanUsername = (username || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter.' });
  }
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }

  const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (emailExists) {
    return res.status(409).json({ error: 'Email ini sudah terdaftar. Coba masuk, atau gunakan email lain.' });
  }
  const usernameExists = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername.toLowerCase());
  if (usernameExists) {
    return res.status(409).json({ error: 'Username sudah dipakai. Pilih username lain.' });
  }

  const id = genId();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, email, password, role, created_at)
    VALUES (?, ?, ?, ?, 'user', ?)
  `).run(id, cleanUsername, cleanEmail, password, createdAt);

  res.json({ ok: true, message: `Pendaftaran berhasil! Selamat datang, ${cleanUsername}.` });
});

// Login
app.post('/api/login', (req, res) => {
  const { identifier, password } = req.body || {};
  const cleanIdentifier = (identifier || '').trim().toLowerCase();

  if (!cleanIdentifier) {
    return res.status(400).json({ error: 'Masukkan username atau email.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Kata sandi tidak boleh kosong.' });
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE (email = ? OR LOWER(username) = ?)
  `).get(cleanIdentifier, cleanIdentifier);

  if (!user || user.password !== password) {
    const identifierExists = db.prepare(`
      SELECT id FROM users WHERE (email = ? OR LOWER(username) = ?)
    `).get(cleanIdentifier, cleanIdentifier);

    const message = identifierExists
      ? 'Kata sandi salah. Periksa kembali dan coba lagi.'
      : 'Username/email atau kata sandi tidak cocok dengan data terdaftar.';
    return res.status(401).json({ error: message });
  }

  req.session.userId = user.id;
  res.json({ ok: true, user: toPublicUser(user) });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Sesi saat ini (untuk cek status login saat halaman dimuat)
app.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sesi tidak valid.' });
  }
  res.json({ user: toPublicUser(user) });
});

// ====================== ADMIN ROUTES ======================

// Lihat semua user (termasuk password — hanya untuk admin)
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const users = rows.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    password: u.password,
    role: u.role,
    createdAt: u.created_at
  }));
  res.json({ users });
});

// Tambah user manual dari dashboard
app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { username, email, password, role } = req.body || {};
  const cleanUsername = (username || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanRole = role === 'admin' ? 'admin' : 'user';

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username minimal 3 karakter.' });
  }
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }

  const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (emailExists) return res.status(409).json({ error: 'Email sudah digunakan pengguna lain.' });
  const usernameExists = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername.toLowerCase());
  if (usernameExists) return res.status(409).json({ error: 'Username sudah dipakai.' });

  const id = genId();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, username, email, password, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, cleanUsername, cleanEmail, password, cleanRole, createdAt);

  res.json({ ok: true, message: `Pengguna ${cleanUsername} berhasil ditambahkan.` });
});

// Ubah role user
app.patch('/api/admin/users/:id/role', requireAdmin, (req, res) => {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  if (target.id === req.currentUser.id && target.role === 'admin') {
    const otherAdmins = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND id != ?`).get(id).c;
    if (otherAdmins === 0) {
      return res.status(400).json({ error: 'Tidak bisa menurunkan peran ini — minimal harus ada satu admin.' });
    }
  }

  const newRole = target.role === 'admin' ? 'user' : 'admin';
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, id);
  res.json({ ok: true, role: newRole });
});

// Hapus user
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

  if (target.role === 'admin') {
    const otherAdmins = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND id != ?`).get(id).c;
    if (otherAdmins === 0) {
      return res.status(400).json({ error: 'Tidak bisa menghapus admin terakhir.' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  const selfDeleted = req.session.userId === id;
  if (selfDeleted) {
    req.session.destroy(() => {
      res.json({ ok: true, username: target.username, selfDeleted: true });
    });
  } else {
    res.json({ ok: true, username: target.username, selfDeleted: false });
  }
});

// Fallback: serve index.html untuk semua route non-API (single page app)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Nexus app berjalan di http://localhost:${PORT}`);
});
