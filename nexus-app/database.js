// database.js — setup koneksi SQLite + schema + seed akun admin default
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'nexus.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Skema tabel users
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  )
`);

// Seed akun admin default: Xiaoli / 0507
function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get('xiaoli');
  if (!existing) {
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'admin-xiaoli',
      'Xiaoli',
      'xiaoli@nexus.local',
      '0507',
      'admin',
      new Date().toISOString()
    );
    console.log('[seed] Akun admin default "Xiaoli" dibuat.');
  }
}
seedAdmin();

module.exports = db;
