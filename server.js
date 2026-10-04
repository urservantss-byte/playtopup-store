// Toko Game Digital - Backend
// Stack: Express + better-sqlite3 + bcryptjs + jsonwebtoken
// Env: PORT (default 3000), JWT_SECRET (default dev)
const express = require('express');
const compression = require('compression');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { makeDynamicQris, merchantName, looksLikeQris, isValidPayload } = require('./qris.js');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'toko.db');
const UPLOAD_DIR = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---- Schema ----
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'voucher' CHECK (category IN ('akun','voucher','topup')),
  tags TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  items_json TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  proof_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','proses','delivery','selesai','dibatalkan')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS wishlist (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS vouchers (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value REAL NOT NULL,
  min_total REAL NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS voucher_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'transfer' CHECK (kind IN ('qris','transfer')),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
// Seed metode pembayaran default (idempoten)
(function seedPayMethods() {
  const n = db.prepare('SELECT COUNT(*) c FROM payment_methods').get().c;
  if (n > 0) return;
  const wasOff = (id) => getSetting('pay_' + id) === '0' ? 0 : 1; // migrasi dari setting on/off lama
  const rows = [
    ['qris', '⚡ QRIS', 'Scan QR — nominal otomatis sesuai total', 'qris', wasOff('qris'), 0],
    ['transfer_bca', '🏦 Transfer BCA', 'BCA 8210 4567 89 PlayTopUp Store', 'transfer', wasOff('transfer_bca'), 1],
    ['transfer_mandiri', '🏦 Transfer Mandiri', 'Mandiri 8900 1234 5678 90 PlayTopUp Store', 'transfer', wasOff('transfer_mandiri'), 2],
    ['transfer_dana', '📱 DANA', 'DANA 0812 3456 7890 PlayTopUp Store', 'transfer', wasOff('transfer_dana'), 3],
  ];
  const ins = db.prepare('INSERT INTO payment_methods (id,label,details,kind,active,sort_order) VALUES (?,?,?,?,?,?)');
  for (const r of rows) ins.run(...r);
  console.log('[seed] payment_methods: 4 metode default');
})();
// ---- Kategori produk dinamis ----
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📦',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);
(function seedCategories() {
  const n = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  if (n > 0) return;
  const rows = [
    ['topup', 'Top Up Game', '⚡', 0],
    ['voucher', 'Voucher', '🎟️', 1],
    ['akun', 'Akun', '👤', 2],
  ];
  const ins = db.prepare('INSERT INTO categories (id,label,icon,active,sort_order) VALUES (?,?,?,1,?)');
  for (const r of rows) ins.run(...r);
  console.log('[seed] categories: 3 kategori default');
})();
function allCategories() {
  return db.prepare('SELECT id,label,icon,active,sort_order FROM categories ORDER BY sort_order,id').all();
}
function activeCategories() {
  return db.prepare("SELECT id,label,icon FROM categories WHERE active = 1 ORDER BY sort_order,id").all();
}
function categoryIds() { return allCategories().map(c => c.id); }
// Migrasi: hapus CHECK(category IN (...)) agar kategori bisa dinamis (rebuild tabel, idempoten)
(function migrateProductsCategory() {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get().sql || '';
  if (!sql.includes("CHECK (category IN (")) return;
  db.exec(`PRAGMA legacy_alter_table=ON;`);
  db.exec(`
    ALTER TABLE products RENAME TO products_old;
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'voucher',
      tags TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO products (id,name,description,price,image_url,category,tags,stock,created_at)
      SELECT id,name,description,price,image_url,category,tags,stock,created_at FROM products_old;
    DROP TABLE products_old;
  `);
  db.exec(`PRAGMA legacy_alter_table=OFF;`);
  console.log('[migrasi] products: CHECK kategori dihapus (kategori dinamis)');
})();
// Repair: kembalikan FK product_images/reviews/voucher_codes ke products
// (bug: RENAME products tanpa legacy_alter_table menulis ulang FK -> products_old)
(function repairProductFKs() {
  const defs = {
    product_images: ['id,product_id,path,sort_order,created_at', `CREATE TABLE product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`],
    reviews: ['id,product_id,user_id,order_id,rating,comment,created_at', `CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id)
    )`],
    voucher_codes: ['id,product_id,code,used,order_id,created_at', `CREATE TABLE voucher_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      order_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`],
    product_variants: ['id,product_id,label,price,stock,sort_order,created_at', `CREATE TABLE product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`],
    wishlist: ['user_id,product_id,created_at', `CREATE TABLE wishlist (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, product_id)
    )`],
  };
  for (const t of Object.keys(defs)) {
    const sql = (db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(t) || {}).sql || '';
    if (!sql.includes('products_old')) continue;
    const [cols, ddl] = defs[t];
    db.exec(`PRAGMA legacy_alter_table=ON;
      ALTER TABLE ${t} RENAME TO ${t}_fix;
      ${ddl};
      INSERT INTO ${t} (${cols}) SELECT ${cols} FROM ${t}_fix;
      DROP TABLE ${t}_fix;
      PRAGMA legacy_alter_table=OFF;`);
    console.log(`[repair] ${t}: FK dikembalikan ke products`);
  }
})();
// Kolom tambahan products (idempoten untuk DB lama)
for (const [col, def] of [['process_time', `TEXT NOT NULL DEFAULT ''`], ['discount', `REAL NOT NULL DEFAULT 0`]]) {
  try { db.exec(`ALTER TABLE products ADD COLUMN ${col} ${def}`); } catch {}
}
// Kolom tambahan orders (idempoten untuk DB lama)
for (const [col, def] of [['discount', 'REAL NOT NULL DEFAULT 0'], ['voucher_code', 'TEXT']]) {
  try { db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${def}`); } catch {}
}
// Sinkron awal: stok produk berkode ngikutin jumlah kode
try {
  for (const p of db.prepare('SELECT DISTINCT product_id FROM voucher_codes').all()) syncCodeStock(p.product_id);
} catch {}
// ---- Migrasi: kolom verifikasi email, reset password & avatar di users ----
// (dijalankan SEBELUM seed agar DB fresh tidak crash)
(function migrateUsers() {
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map(c => c.name);
  const add = (name, def) => {
    if (cols.includes(name)) return false;
    db.exec(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    return true;
  };
  const addedVerified = add('email_verified', `INTEGER NOT NULL DEFAULT 0`);
  add('avatar', `TEXT NOT NULL DEFAULT ''`);
  add('verify_token', `TEXT`);
  add('verify_expires', `TEXT`);
  add('reset_token', `TEXT`);
  add('reset_expires', `TEXT`);
  if (addedVerified) {
    db.exec(`UPDATE users SET email_verified = 1`); // user lama dianggap sudah terverifikasi
    console.log('[migrasi] kolom verifikasi/reset/avatar ditambahkan; user lama ditandai terverifikasi');
  }
})();
// ---- Seed ----
function seed() {
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount > 0) return;
  console.log('[seed] membuat data awal...');
  const insUser = db.prepare('INSERT INTO users (name,email,password_hash,role,email_verified) VALUES (?,?,?,?,1)');
  insUser.run('Admin PlayTopUp', 'admin@playtopup.id', bcrypt.hashSync('admin123', 10), 'admin');
  insUser.run('User Demo', 'user@playtopup.id', bcrypt.hashSync('user123', 10), 'user');

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const products = [
    // akun
    ['Akun Mobile Legends Sultan', 'Akun ML full skin epic+legend, rank mythic, bind moonton siap ganti.', 850000, 'akun', 'mlbb,moba,sultan,epic', 'ml-sultan'],
    ['Akun Genshin Impact AR60', 'AR60, 15 char B5, weapon sign, map 100% kecuali Natlan.', 1200000, 'akun', 'genshin,rpg,ar60,whale', 'genshin-ar60'],
    ['Akun Valorant Full Skin', 'Semua bundle Reaver, Prime, Glitchpop. Rank immortal.', 650000, 'akun', 'valorant,fps,skin,immortal', 'valo-skin'],
    // voucher
    ['Voucher Google Play 100rb', 'Kode voucher Google Play IDR 100.000, region Indonesia.', 105000, 'voucher', 'googleplay,voucher,pulsa', 'gp-100'],
    ['Voucher Steam Wallet 200rb', 'Steam wallet code IDR 200.000, langsung terkirim.', 212000, 'voucher', 'steam,voucher,pc', 'steam-200'],
    ['Voucher PSN 400rb', 'PlayStation Network wallet IDR 400.000 region Indonesia.', 425000, 'voucher', 'psn,playstation,voucher', 'psn-400'],
    // topup
    ['Topup Diamond ML 500', '500 diamond Mobile Legends, proses 5-15 menit via ID.', 125000, 'topup', 'mlbb,diamond,topup', 'ml-diamond'],
    ['Topup Genesis Crystal 980', '980 Genesis Crystal Genshin Impact via UID.', 240000, 'topup', 'genshin,crystal,topup', 'gi-crystal'],
    ['Topup Robux 800', '800 Robux via gamepass, aman & legal.', 165000, 'topup', 'roblox,robux,topup', 'rbx-800'],
  ];
  const insP = db.prepare(
    'INSERT INTO products (name,description,price,image_url,category,tags,stock) VALUES (?,?,?,?,?,?,?)');
  for (const [name, desc, price, cat, tags, slug] of products) {
    insP.run(name, desc, price, `https://picsum.photos/seed/${slug}/400/300`, cat, tags, rnd(5, 50));
  }
  console.log('[seed] selesai: 2 user, 9 produk');
}
seed();

// Seed katalog PlayTopUp (kategori game, produk+varian, banner, voucher, settings)
// saat database masih fresh — mis. deploy pertama di Railway.
// Penanda: voucher BONUS10 belum ada.
try {
  const hasCatalog = db.prepare("SELECT COUNT(*) c FROM vouchers WHERE code='BONUS10'").get().c > 0;
  if (!hasCatalog) require('./seed').runSeed(db);
} catch (e) { console.log('[seed] katalog skip:', e.message); }

// ---- Migrasi: backfill product_images dari image_url lama ----
(function migrateImages() {
  const rows = db.prepare(`SELECT p.id, p.image_url FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id
    WHERE pi.id IS NULL AND p.image_url <> ''`).all();
  const ins = db.prepare('INSERT INTO product_images (product_id, path, sort_order) VALUES (?,?,0)');
  for (const r of rows) ins.run(r.id, r.image_url);
  if (rows.length) console.log(`[migrasi] ${rows.length} produk di-backfill ke product_images`);
})();

// (migrateUsers sudah dipindah ke atas, sebelum seed)

// ---- Migrasi: kolom data delivery di orders ----
(function migrateOrders() {
  const cols = db.prepare(`PRAGMA table_info(orders)`).all().map(c => c.name);
  let added = 0;
  for (const [name, def] of [
    ['delivery_data', `TEXT`],          // JSON: [{product_id,name,category,qty,data?,proof_path?,trx_id?}]
    ['delivered_at', `TEXT`],           // waktu status -> delivery (untuk auto-complete 2 hari)
  ]) {
    if (!cols.includes(name)) { db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${def}`); added++; }
  }
  if (added) console.log(`[migrasi] ${added} kolom delivery ditambahkan ke orders`);
})();

// ---- Helpers email (verifikasi & reset password) ----
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

function smtpTransporter() {
  const host = getSetting('smtp_host') || process.env.SMTP_HOST;
  if (!host) return null;
  const nodemailer = require('nodemailer');
  const port = Number(getSetting('smtp_port') || process.env.SMTP_PORT || 587);
  const user = getSetting('smtp_user') || process.env.SMTP_USER || '';
  const pass = (getSetting('smtp_pass') || process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });
}
function smtpFrom() {
  return getSetting('smtp_from') || process.env.SMTP_FROM || getSetting('smtp_user') || process.env.SMTP_USER;
}
// Kirim email. Return true jika terkirim via SMTP, false jika SMTP belum dikonfigurasi.
async function sendBrevo(to, subject, html) {
  const key = getSetting('brevo_api_key') || process.env.BREVO_API_KEY || '';
  if (!key) return false;
  const senderEmail = getSetting('smtp_user') || process.env.SMTP_USER || getSetting('admin_email') || '';
  const senderName = getSetting('smtp_from') || process.env.SMTP_FROM || 'PlayTopUp Store';
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject, htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error('Brevo ' + res.status + ': ' + (await res.text().catch(() => '')).slice(0, 120));
  return true;
}
// Kirim email. Prioritas: Brevo API (HTTPS, lolos blokir SMTP Railway) -> SMTP.
async function sendMail(to, subject, html) {
  if (getSetting('brevo_api_key') || process.env.BREVO_API_KEY) {
    try { return await sendBrevo(to, subject, html); }
    catch (e) { console.log('[email] Brevo gagal, coba SMTP:', e.message); }
  }
  const tx = smtpTransporter();
  if (!tx) return false;
  await tx.sendMail({ from: smtpFrom(), to, subject, html });
  return true;
}
// Notifikasi email ke admin (mis. pesanan dikirim). Fire-and-forget.
function notifyAdmin(subject, html) {
  setImmediate(async () => {
    try {
      const to = getSetting('admin_email') || getSetting('smtp_user') || process.env.SMTP_USER;
      if (!to) { console.log('[notif-admin] admin_email belum dikonfigurasi'); return; }
      const ok = await sendMail(to, `🎮 PlayTopUp Store — ${subject}`, html);
      if (!ok) console.log('[notif-admin] SMTP belum dikonfigurasi, email dilewati');
    } catch (e) { console.log('[notif-admin] gagal:', e.message); }
  });
}
// Notifikasi status pesanan (fire-and-forget, gagal diam-diam)
function notifyOrder(orderId, title, msg) {
  setImmediate(async () => {
    try {
      const o = db.prepare(`SELECT o.*, u.email, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`).get(orderId);
      if (!o || !o.email) return;
      const ok = await sendMail(o.email, `🎮 PlayTopUp Store — ${title}`,
        `<div style="font-family:sans-serif;max-width:480px;margin:auto"><h3>Halo ${o.name || ''} 👋</h3><p>${msg}</p><p>Pesanan <b>#${o.id}</b> • Total <b>${rp0(o.total)}</b></p></div>`);
      if (!ok) console.log('[notif] SMTP belum dikonfigurasi, email dilewati');
    } catch (e) { console.log('[notif] gagal:', e.message); }
  });
}
/* Notifikasi in-app (disimpan di DB, dibaca lewat /api/notifications) */
function pushNotif(userId, title, message, link) {
  try {
    db.prepare('INSERT INTO notifications (user_id, title, message, link) VALUES (?,?,?,?)')
      .run(userId, String(title || '').slice(0, 120), String(message || '').slice(0, 500), String(link || '').slice(0, 200));
  } catch (e) { console.log('[pushNotif] gagal:', e.message); }
}
function issueToken() { return crypto.randomBytes(32).toString('hex'); }
function mailLayout(title, bodyHtml, ctaUrl, ctaLabel) {
  return `<div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:16px;overflow:hidden">`
    + `<div style="background:#4f46e5;color:#fff;padding:20px;font-size:18px;font-weight:bold">🎮 PlayTopUp Store</div>`
    + `<div style="padding:24px"><h2 style="margin:0 0 12px;font-size:18px">${title}</h2>${bodyHtml}`
    + (ctaUrl ? `<p style="margin:20px 0"><a href="${ctaUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold">${ctaLabel}</a></p>`
      + `<p style="font-size:12px;color:#888">Atau salin link ini:<br><span style="word-break:break-all">${ctaUrl}</span></p>` : '')
    + `</div></div>`;
}

// ---- Helpers foto produk ----
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 1 * 1024 * 1024; // 1MB per foto
const PHOTO_MIMES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
// Validasi magic bytes agar tidak hanya percaya header Content-Type
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  return null;
}
const PHOTO_DIR = path.join(UPLOAD_DIR, 'products');
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

function getImages(productId) {
  return db.prepare('SELECT id, path AS url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id')
    .all(productId).map(r => ({ id: r.id, url: r.url, sort_order: r.sort_order }));
}
function attachImages(p) {
  if (!p) return p;
  p.images = getImages(p.id);
  if (p.images.length) p.image_url = p.images[0].url;
  return p;
}
function effPrice(base, discount) {
  const d = Math.max(0, Math.min(100, Number(discount) || 0));
  return Math.round(Number(base) * (1 - d / 100));
}
function attachVariants(p) {
  if (!p) return p;
  try {
    p.variants = db.prepare('SELECT id, label, price, stock, sort_order FROM product_variants WHERE product_id = ? ORDER BY sort_order, id').all(p.id);
    // Stok produk mengikuti total stok varian
    if (p.variants.length) p.stock = p.variants.reduce((a, v) => a + (Number(v.stock) || 0), 0);
  } catch { p.variants = []; }
  return p;
}
function syncFirstImage(productId) {
  const imgs = getImages(productId);
  db.prepare('UPDATE products SET image_url = ? WHERE id = ?').run(imgs.length ? imgs[0].url : '', productId);
}

// Multipart parser multi-file untuk foto produk (field "photos")
function parseMultipartMulti(req, { maxFiles = MAX_PHOTOS } = {}) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const m = ct.match(/boundary=(.+)$/);
    if (!m) return reject(new Error('Bukan multipart'));
    const boundary = '--' + m[1];
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > 12 * 1024 * 1024) { aborted = true; req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (aborted) return reject(new Error('Total upload terlalu besar'));
      try {
        const buf = Buffer.concat(chunks);
        const parts = buf.toString('latin1').split(boundary);
        const fields = {};
        const files = [];
        for (const part of parts) {
          if (!part.includes('Content-Disposition')) continue;
          const nameM = part.match(/name="([^"]+)"/);
          const fileM = part.match(/filename="([^"]*)"/);
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd < 0) continue;
          let body = part.slice(headerEnd + 4);
          if (body.endsWith('\r\n')) body = body.slice(0, -2);
          const name = nameM && nameM[1];
          if (fileM && fileM[1]) {
            const typeM = part.match(/Content-Type:\s*([^\r\n;]+)/i);
            const mime = (typeM && typeM[1].trim().toLowerCase()) || '';
            if (!PHOTO_MIMES[mime]) { reject(new Error(`File "${fileM[1]}" bukan gambar (hanya jpeg/png/webp/gif)`)); return; }
            const data = Buffer.from(body, 'latin1');
            if (!detectImageType(data)) { reject(new Error(`File "${fileM[1]}" bukan gambar valid`)); return; }
            if (data.length > MAX_PHOTO_BYTES) { reject(new Error(`File "${fileM[1]}" melebihi 1MB`)); return; }
            files.push({ field: name, filename: fileM[1], mime, data });
          } else if (name) {
            fields[name] = body;
          }
        }
        if (files.length > maxFiles) return reject(new Error(`Maksimal ${maxFiles} file per upload`));
        resolve({ fields, files });
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---- Helpers ----
const app = express();
app.use(compression()); // gzip: HTML & JSON jauh lebih ringan
// Security headers dasar (tanpa dependensi helmet)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
});
app.use(express.json({ limit: '1mb' }));

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role,
    avatar: u.avatar || '', email_verified: !!u.email_verified, created_at: u.created_at };
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'Token tidak ditemukan' });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token tidak valid' });
  }
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Khusus admin' });
  next();
}

// Minimal multipart parser (field "bukti", tanpa dependensi tambahan)
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const m = ct.match(/boundary=(.+)$/);
    if (!m) return reject(new Error('Bukan multipart'));
    const boundary = '--' + m[1];
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 6 * 1024 * 1024) { reject(new Error('File terlalu besar (maks 5MB)')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const buf = Buffer.concat(chunks);
        const parts = buf.toString('latin1').split(boundary);
        const fields = {};
        let file = null;
        for (const part of parts) {
          if (!part.includes('Content-Disposition')) continue;
          const nameM = part.match(/name="([^"]+)"/);
          const fileM = part.match(/filename="([^"]*)"/);
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd < 0) continue;
          let body = part.slice(headerEnd + 4);
          if (body.endsWith('\r\n')) body = body.slice(0, -2);
          const name = nameM && nameM[1];
          if (fileM && fileM[1]) {
            const typeM = part.match(/Content-Type:\s*([^\r\n]+)/i);
            const mime = (typeM && typeM[1].trim()) || '';
            if (!mime.startsWith('image/')) { reject(new Error('Hanya file gambar yang diizinkan')); return; }
            const fdata = Buffer.from(body, 'latin1');
            if (!detectImageType(fdata)) { reject(new Error('File bukan gambar valid')); return; }
            file = { field: name, filename: fileM[1], mime, data: fdata };
          } else if (name) {
            fields[name] = body;
          }
        }
        resolve({ fields, file });
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---- Auth ----
async function sendVerificationEmail(user) {
  const token = issueToken();
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  db.prepare('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?').run(token, expires, user.id);
  const link = `${BASE_URL}/verify-email?token=${token}`;
  const sent = await sendMail(user.email, 'Verifikasi email PlayTopUp Store 📧',
    mailLayout('Verifikasi Email Kamu',
      `<p>Halo <b>${user.name}</b>! Klik tombol di bawah untuk verifikasi email dan mengaktifkan akun PlayTopUp Store kamu. Link berlaku 24 jam.</p>`,
      link, 'Verifikasi Email'));
  if (!sent) console.log(`[verify][dev] link verifikasi untuk ${user.email}: ${link}`);
  return { sent, link };
}

app.post('/api/auth/register', rateLimit({ max: 5, msg: 'Terlalu banyak pendaftaran. Coba lagi nanti.' }), async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password wajib diisi' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  const em = String(email).toLowerCase();
  const exists = db.prepare('SELECT * FROM users WHERE email = ?').get(em);
  if (exists && exists.email_verified)
    return res.status(400).json({ error: 'Email sudah terdaftar' });
  let user;
  if (exists) {
    // akun belum verifikasi: JANGAN timpa nama/password (cegah takeover via daftar ulang);
    // cukup kirim ulang link verifikasi ke email pemilik asli
    user = exists;
  } else {
    const info = db.prepare('INSERT INTO users (name,email,password_hash,role,email_verified) VALUES (?,?,?,?,0)')
      .run(name, em, bcrypt.hashSync(password, 10), 'user');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }
  const { sent, link } = await sendVerificationEmail(user);
  res.json({ ok: true, email_sent: sent, dev_link: sent ? undefined : link,
    message: 'Pendaftaran berhasil! Cek email kamu untuk verifikasi sebelum masuk.' });
});

// Link verifikasi dari email -> halaman hasil (bisa dibuka dari aplikasi email)
app.get('/verify-email', (req, res) => {
  const token = String(req.query.token || '');
  const user = token ? db.prepare('SELECT * FROM users WHERE verify_token = ?').get(token) : null;
  let ok = false, msg;
  if (!user) msg = 'Link verifikasi tidak valid.';
  else if (user.email_verified) { ok = true; msg = 'Email kamu sudah terverifikasi sebelumnya. Silakan masuk.'; }
  else if (new Date(user.verify_expires) < new Date()) msg = 'Link verifikasi sudah kedaluwarsa. Minta kirim ulang dari halaman masuk.';
  else {
    db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL WHERE id = ?').run(user.id);
    ok = true; msg = `Email <b>${user.email}</b> berhasil diverifikasi! Akunmu sudah aktif.`;
  }
  res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi Email — PlayTopUp Store</title></head>`
  + `<body style="font-family:sans-serif;background:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;margin:0">`
  + `<div style="background:#fff;border-radius:20px;padding:32px;max-width:420px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)">`
  + `<div style="font-size:48px">${ok ? '✅' : '❌'}</div>`
  + `<h2 style="margin:12px 0">${ok ? 'Verifikasi Berhasil!' : 'Verifikasi Gagal'}</h2>`
  + `<p style="color:#555;font-size:14px;line-height:1.6">${msg}</p>`
  + `<a href="/" style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:bold">Kembali ke Toko 🎮</a>`
  + `</div></body></html>`);
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (user && !user.email_verified) {
    const { sent, link } = await sendVerificationEmail(user);
    return res.json({ ok: true, email_sent: sent, dev_link: sent ? undefined : link,
      message: 'Link verifikasi baru telah dikirim ke email kamu.' });
  }
  // selalu balas OK agar tidak membocorkan email yang terdaftar
  res.json({ ok: true, message: 'Jika email terdaftar dan belum diverifikasi, link baru telah dikirim.' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  let dev_link;
  if (user) {
    const token = issueToken();
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, user.id);
    const link = `${BASE_URL}/#resetpw/${token}`;
    const sent = await sendMail(user.email, 'Reset password PlayTopUp Store 🔑',
      mailLayout('Reset Password',
        `<p>Halo <b>${user.name}</b>! Klik tombol di bawah untuk membuat password baru. Link berlaku 1 jam. Abaikan pesan ini jika kamu tidak memintanya.</p>`,
        link, 'Reset Password'));
    if (!sent) { console.log(`[reset][dev] link reset untuk ${user.email}: ${link}`); dev_link = link; }
  }
  res.json({ ok: true, dev_link, message: 'Jika email terdaftar, link reset password telah dikirim.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token & password wajib diisi' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(String(token));
  if (!user) return res.status(400).json({ error: 'Link reset tidak valid' });
  if (new Date(user.reset_expires) < new Date())
    return res.status(400).json({ error: 'Link reset sudah kedaluwarsa. Minta yang baru.' });
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?')
    .run(bcrypt.hashSync(String(password), 10), user.id);
  res.json({ ok: true, message: 'Password berhasil diubah. Silakan masuk dengan password baru.' });
});

// Rate limiter sederhana (in-memory): cegah brute force login & spam register
const _rl = new Map(); // key -> { n, reset }
function rateLimit({ windowMs = 5 * 60 * 1000, max = 10, keyFn, msg = 'Terlalu banyak percobaan. Coba lagi nanti.' } = {}) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : req.ip) + ':' + (req.path || '');
    const now = Date.now();
    let e = _rl.get(key);
    if (!e || now > e.reset) e = { n: 0, reset: now + windowMs };
    e.n++;
    _rl.set(key, e);
    if (_rl.size > 5000) { for (const [k, v] of _rl) if (now > v.reset) _rl.delete(k); }
    if (e.n > max) return res.status(429).json({ error: msg });
    next();
  };
}

app.post('/api/auth/login', rateLimit({ max: 10, keyFn: r => r.ip + ':' + String((r.body || {}).email || '').toLowerCase() }), (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password wajib diisi' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Email atau password salah' });
  if (!user.email_verified)
    return res.status(403).json({ error: 'Email belum diverifikasi. Cek inbox email kamu.', need_verification: true });
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---- Profil user: lihat/ubah profil, upload foto, ganti password ----
app.get('/api/users/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});
app.put('/api/users/me', auth, (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nama wajib diisi' });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 100), req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});
app.post('/api/users/me/avatar', auth, async (req, res) => {
  let parsed;
  try { parsed = await parseMultipart(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.file) return res.status(400).json({ error: 'Field "avatar" wajib diisi file gambar' });
  if (parsed.file.data.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Foto maksimal 2MB' });
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[parsed.file.mime] || 'jpg';
  const fname = `avatar_${req.user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(AVATAR_DIR, fname), parsed.file.data);
  const old = req.user.avatar || '';
  if (old.startsWith('/uploads/avatars/')) { try { fs.unlinkSync(path.join(__dirname, old)); } catch {} }
  const rel = '/uploads/avatars/' + fname;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(rel, req.user.id);
  res.json({ ok: true, avatar: rel });
});
app.post('/api/users/me/password', auth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Password lama & baru wajib diisi' });
  if (String(new_password).length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current_password), user.password_hash))
    return res.status(400).json({ error: 'Password lama salah' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(String(new_password), 10), user.id);
  res.json({ ok: true, message: 'Password berhasil diubah' });
});

// ---- Products (public) ----
app.get('/api/products', (req, res) => {
  const { q = '', category = '', tag = '', sort = '' } = req.query;
  const conds = [];
  const params = [];
  if (q) { conds.push('(name LIKE ? OR description LIKE ? OR tags LIKE ?)'); const like = `%${q}%`; params.push(like, like, like); }
  if (category) { conds.push('category = ?'); params.push(category); }
  if (tag) { conds.push('tags LIKE ?'); params.push(`%${tag}%`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  let order = 'ORDER BY id DESC';
  if (sort === 'termurah') order = 'ORDER BY price ASC';
  else if (sort === 'termahal') order = 'ORDER BY price DESC';
  else if (sort === 'terbaru') order = 'ORDER BY id DESC';
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 60, 1), 200);
  const rows = db.prepare(`SELECT p.*, COALESCE(vs.total_stock, p.stock) AS stock, COALESCE(vs.cnt, 0) AS variant_count
    FROM products p LEFT JOIN (SELECT product_id, SUM(stock) total_stock, COUNT(*) cnt FROM product_variants GROUP BY product_id) vs
    ON vs.product_id = p.id ${where} ${order} LIMIT ?`).all(...params, limit);
  const aggStmt = db.prepare('SELECT COUNT(*) c, AVG(rating) a FROM reviews WHERE product_id = ?');
  const soldRows = db.prepare(`SELECT CAST(json_extract(j.value,'$.product_id') AS INTEGER) pid,
      SUM(CAST(json_extract(j.value,'$.qty') AS INTEGER)) sold
    FROM orders o, json_each(o.items_json) j WHERE o.status IN ('delivery','selesai') GROUP BY pid`).all();
  const soldMap = {}; for (const r of soldRows) soldMap[r.pid] = r.sold;
  const products = rows.map(p => {
    const agg = aggStmt.get(p.id);
    p.review_count = agg.c;
    p.avg_rating = agg.a ? Math.round(agg.a * 10) / 10 : 0;
    p.sold_count = soldMap[p.id] || 0;
    return attachImages(p);
  });
  res.json({ products });
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const agg = db.prepare('SELECT COUNT(*) c, AVG(rating) a FROM reviews WHERE product_id = ?').get(p.id);
  const sold = db.prepare(`SELECT SUM(CAST(json_extract(j.value,'$.qty') AS INTEGER)) s FROM orders o, json_each(o.items_json) j
    WHERE o.status IN ('delivery','selesai') AND CAST(json_extract(j.value,'$.product_id') AS INTEGER) = ?`).get(p.id);
  const prod = attachImages(p);
  prod.review_count = agg.c;
  prod.avg_rating = agg.a ? Math.round(agg.a * 10) / 10 : 0;
  prod.sold_count = sold.s || 0;
  attachVariants(prod);
  res.json({ product: prod });
});

app.get('/api/tags', (req, res) => {
  const rows = db.prepare('SELECT tags FROM products').all();
  const set = new Set();
  for (const r of rows) for (const t of String(r.tags).split(',')) { const x = t.trim(); if (x) set.add(x); }
  res.json({ tags: [...set].sort() });
});

// ---- Products (admin) ----
app.post('/api/products', auth, requireAdmin, (req, res) => {
  const { name, description = '', price = 0, image_url = '', category = 'voucher', tags = '', stock = 0, process_time = '', discount = 0 } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nama produk wajib diisi' });
  if (!categoryIds().includes(category)) return res.status(400).json({ error: 'Kategori tidak valid' });
  const disc = Math.max(0, Math.min(100, Number(discount) || 0));
  const info = db.prepare('INSERT INTO products (name,description,price,image_url,category,tags,stock,process_time,discount) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(name, description, Number(price) || 0, image_url, category, tags, Number(stock) || 0, String(process_time || ''), disc);
  res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
});

app.put('/api/products/:id', auth, requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const { name, description, price, image_url, category, tags, stock, process_time, discount } = req.body || {};
  if (category && !categoryIds().includes(category)) return res.status(400).json({ error: 'Kategori tidak valid' });
  const disc = discount === undefined ? null : Math.max(0, Math.min(100, Number(discount) || 0));
  db.prepare(`UPDATE products SET
    name=COALESCE(?,name), description=COALESCE(?,description), price=COALESCE(?,price),
    image_url=COALESCE(?,image_url), category=COALESCE(?,category), tags=COALESCE(?,tags),
    stock=COALESCE(?,stock), process_time=COALESCE(?,process_time), discount=COALESCE(?,discount) WHERE id=?`)
    .run(name ?? null, description ?? null, price ?? null, image_url ?? null,
      category ?? null, tags ?? null, stock ?? null, process_time ?? null, disc, req.params.id);
  syncCodeStock(req.params.id); // produk berkode: stok selalu ngikutin jumlah kode
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) });
});

// ---- Bulk edit stok produk (admin): set atau tambah stok banyak produk sekaligus ----
app.post('/api/admin/products/bulk-stock', auth, requireAdmin, (req, res) => {
  const { ids, mode, value } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Pilih produk dulu' });
  const n = Number(value);
  if (!(n >= 0) || !['set', 'add'].includes(mode)) return res.status(400).json({ error: 'Nilai tidak valid' });
  const clean = [...new Set(ids.map(Number).filter(x => x > 0))].slice(0, 500);
  if (!clean.length) return res.status(400).json({ error: 'ID produk tidak valid' });
  const upd = mode === 'set'
    ? db.prepare('UPDATE products SET stock = ? WHERE id = ?')
    : db.prepare('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?');
  db.transaction((list) => { for (const id of list) { upd.run(n, id); syncCodeStock(id); } })(clean);
  res.json({ message: `Stok ${clean.length} produk diperbarui ✅`, updated: clean.length });
});

// ---- Foto produk (admin): POST upload, DELETE hapus, PUT reorder ----
app.post('/api/products/:id/images', auth, requireAdmin, async (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const existing = db.prepare('SELECT COUNT(*) c FROM product_images WHERE product_id = ?').get(p.id).c;
  if (existing >= MAX_PHOTOS) return res.status(400).json({ error: `Maksimal ${MAX_PHOTOS} foto per produk` });
  let parsed;
  try { parsed = await parseMultipartMulti(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.files.length) return res.status(400).json({ error: 'Tidak ada file foto (field "photos")' });
  if (existing + parsed.files.length > MAX_PHOTOS)
    return res.status(400).json({ error: `Maksimal ${MAX_PHOTOS} foto per produk (saat ini ${existing})` });
  const dir = path.join(PHOTO_DIR, String(p.id));
  fs.mkdirSync(dir, { recursive: true });
  const startOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM product_images WHERE product_id = ?').get(p.id).n;
  const ins = db.prepare('INSERT INTO product_images (product_id, path, sort_order) VALUES (?,?,?)');
  const sharp = require('sharp');
  for (let i = 0; i < parsed.files.length; i++) {
    const f = parsed.files[i];
    // Auto-resize: samakan semua foto jadi 800x800 (cover/crop ala itemku) biar seragam
    let outBuf;
    try {
      outBuf = await sharp(f.data).resize(800, 800, { fit: 'cover', position: 'centre' }).jpeg({ quality: 82 }).toBuffer();
    } catch { outBuf = f.data; } // kalau gagal resize, pakai file asli
    const fname = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.jpg`;
    fs.writeFileSync(path.join(dir, fname), outBuf);
    ins.run(p.id, `/uploads/products/${p.id}/${fname}`, startOrder + i);
  }
  syncFirstImage(p.id);
  res.status(201).json({ images: getImages(p.id) });
});

app.delete('/api/products/:id/images/:image_id', auth, requireAdmin, (req, res) => {
  const img = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?')
    .get(req.params.image_id, req.params.id);
  if (!img) return res.status(404).json({ error: 'Foto tidak ditemukan' });
  db.prepare('DELETE FROM product_images WHERE id = ?').run(img.id);
  if (img.path.startsWith('/uploads/products/')) {
    try { fs.unlinkSync(path.join(__dirname, img.path)); } catch {}
  }
  syncFirstImage(req.params.id);
  res.json({ ok: true, images: getImages(req.params.id) });
});

app.put('/api/products/:id/images/reorder', auth, requireAdmin, (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order) || !order.length) return res.status(400).json({ error: 'order harus array berisi image_id' });
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  const valid = new Set(db.prepare('SELECT id FROM product_images WHERE product_id = ?').all(p.id).map(r => r.id));
  const upd = db.prepare('UPDATE product_images SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    order.forEach((id, i) => { const nid = Number(id); if (valid.has(nid)) upd.run(i, nid); });
  })();
  syncFirstImage(p.id);
  res.json({ images: getImages(p.id) });
});

app.delete('/api/products/:id', auth, requireAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  try { fs.rmSync(path.join(PHOTO_DIR, String(req.params.id)), { recursive: true, force: true }); } catch {}
  res.json({ ok: true });
});

// ---- Voucher promo ----
// Hitung diskon untuk kode voucher (return {discount} atau throw)
function calcVoucherDiscount(code, total) {
  const v = db.prepare('SELECT * FROM vouchers WHERE code = ?').get(String(code || '').toUpperCase().trim());
  if (!v || !v.active) throw { status: 400, msg: 'Kode voucher tidak valid' };
  if (v.expires_at && v.expires_at < new Date().toISOString().slice(0, 10)) throw { status: 400, msg: 'Voucher sudah kedaluwarsa' };
  if (v.max_uses > 0 && v.used_count >= v.max_uses) throw { status: 400, msg: 'Voucher sudah habis dipakai' };
  if (total < (v.min_total || 0)) throw { status: 400, msg: `Minimal belanja ${rp0(v.min_total)}` };
  let d = v.kind === 'percent' ? Math.round(total * v.value / 100) : Math.round(v.value);
  return { discount: Math.min(d, total), voucher: v };
}
function rp0(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }

app.post('/api/vouchers/validate', auth, (req, res) => {
  const { code, total } = req.body || {};
  try {
    const { discount, voucher } = calcVoucherDiscount(code, Number(total) || 0);
    res.json({ valid: true, discount, kind: voucher.kind, value: voucher.value });
  } catch (e) { res.status(e.status || 500).json({ error: e.msg || 'Gagal validasi' }); }
});
app.get('/api/admin/vouchers', auth, requireAdmin, (req, res) => {
  res.json({ vouchers: db.prepare('SELECT * FROM vouchers ORDER BY created_at DESC').all() });
});
app.post('/api/admin/vouchers', auth, requireAdmin, (req, res) => {
  const { code, kind, value, min_total, max_uses, expires_at } = req.body || {};
  const c = String(code || '').toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
  if (!c || c.length < 3) return res.status(400).json({ error: 'Kode minimal 3 karakter (A-Z, 0-9, -)' });
  if (!['percent', 'fixed'].includes(kind)) return res.status(400).json({ error: 'Jenis voucher tidak valid' });
  const val = Number(value);
  if (!(val > 0) || (kind === 'percent' && val > 100)) return res.status(400).json({ error: 'Nilai voucher tidak valid' });
  try {
    db.prepare('INSERT INTO vouchers (code, kind, value, min_total, max_uses, expires_at) VALUES (?,?,?,?,?,?)')
      .run(c, kind, val, Number(min_total) || 0, Number(max_uses) || 0, expires_at || null);
    res.status(201).json({ ok: true });
  } catch { res.status(400).json({ error: 'Kode sudah dipakai' }); }
});
app.delete('/api/admin/vouchers/:code', auth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM vouchers WHERE code = ?').run(req.params.code.toUpperCase());
  res.json({ ok: true });
});

// ---- Banner promo ----
app.get('/api/banners', (req, res) => {
  const rows = db.prepare('SELECT * FROM banners WHERE active = 1 ORDER BY sort_order, id').all();
  res.json({ banners: rows });
});
// Publik: daftar voucher promo aktif (kode memang untuk dibagikan)
app.get('/api/promos', (req, res) => {
  const rows = db.prepare(
    `SELECT code, kind, value, min_total FROM vouchers
     WHERE active = 1 AND (expires_at IS NULL OR expires_at = '' OR datetime(expires_at) > datetime('now'))
     AND (max_uses = 0 OR used_count < max_uses)
     ORDER BY created_at DESC LIMIT 20`
  ).all().map((v) => ({
    code: v.code,
    description: v.kind === 'percent' ? `${v.value}% off${v.min_total ? ` (min. ${rp0(v.min_total)})` : ''}` : `${rp0(v.value)} off${v.min_total ? ` (min. ${rp0(v.min_total)})` : ''}`,
  }));
  res.json({ promos: rows });
});
app.get('/api/admin/banners', auth, requireAdmin, (req, res) => {
  res.json({ banners: db.prepare('SELECT * FROM banners ORDER BY sort_order, id').all() });
});
app.post('/api/admin/banners', auth, requireAdmin, async (req, res) => {
  let parsed;
  try { parsed = await parseMultipart(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.file) return res.status(400).json({ error: 'Upload gambar banner dulu' });
  if (parsed.file.data.length > 2 * 1024 * 1024) return res.status(400).json({ error: 'Gambar maksimal 2MB' });
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[parsed.file.mime] || 'bin';
  const fname = `banner_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), parsed.file.data);
  const link = String((parsed.fields && parsed.fields.link_url) || '').trim().slice(0, 500);
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM banners').get().m;
  const info = db.prepare('INSERT INTO banners (image_url, link_url, sort_order) VALUES (?,?,?)')
    .run('/uploads/' + fname, link, maxSort + 1);
  res.status(201).json({ banner: db.prepare('SELECT * FROM banners WHERE id = ?').get(info.lastInsertRowid) });
});
app.patch('/api/admin/banners/:id', auth, requireAdmin, (req, res) => {
  const b = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Banner tidak ditemukan' });
  const { link_url, sort_order, active } = req.body || {};
  db.prepare('UPDATE banners SET link_url = COALESCE(?, link_url), sort_order = COALESCE(?, sort_order), active = COALESCE(?, active) WHERE id = ?')
    .run(link_url !== undefined ? String(link_url).slice(0, 500) : null,
         sort_order !== undefined ? parseInt(sort_order) || 0 : null,
         active !== undefined ? (active ? 1 : 0) : null, req.params.id);
  res.json({ banner: db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id) });
});
app.delete('/api/admin/banners/:id', auth, requireAdmin, (req, res) => {
  const b = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (b && b.image_url) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(b.image_url))); } catch {} }
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Tiket komplain ----
function ticketWithMessages(t) {
  const msgs = db.prepare(`SELECT m.*, u.name AS user_name FROM ticket_messages m
    JOIN users u ON u.id = m.user_id WHERE m.ticket_id = ? ORDER BY m.id`).all(t.id);
  const u = db.prepare('SELECT name, email FROM users WHERE id = ?').get(t.user_id);
  return { ...t, user_name: u && u.name, user_email: u && u.email, messages: msgs };
}
// User: buat tiket
app.post('/api/tickets', auth, (req, res) => {
  const { order_id, subject, message } = req.body || {};
  if (!subject || !String(subject).trim()) return res.status(400).json({ error: 'Subjek wajib diisi' });
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Pesan wajib diisi' });
  let oid = null;
  if (order_id) {
    const o = db.prepare('SELECT id FROM orders WHERE id = ? AND user_id = ?').get(order_id, req.user.id);
    if (!o) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    oid = o.id;
  }
  const info = db.prepare('INSERT INTO tickets (order_id, user_id, subject) VALUES (?,?,?)')
    .run(oid, req.user.id, String(subject).trim().slice(0, 200));
  db.prepare('INSERT INTO ticket_messages (ticket_id, user_id, is_admin, message) VALUES (?,?,0,?)')
    .run(info.lastInsertRowid, req.user.id, String(message).trim().slice(0, 2000));
  // Notifikasi email ke admin HANYA saat tiket dibuat (balasan tidak dikirim email)
  const tu = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);
  notifyAdmin(`Tiket komplain baru #${info.lastInsertRowid}`,
    `<p><b>${tu ? tu.name : 'User'} (${tu ? tu.email : '-'})</b> membuat tiket komplain:</p>` +
    `<p><b>Subjek:</b> ${String(subject).trim().slice(0, 200)}${oid ? `<br><b>Pesanan:</b> #${oid}` : ''}</p>` +
    `<p><b>Pesan:</b><br>${String(message).trim().slice(0, 500).replace(/\n/g, '<br>')}</p>` +
    `<p>Balas dari tab 🎫 Tiket di dashboard admin.</p>`);
  res.status(201).json({ ticket: ticketWithMessages(db.prepare('SELECT * FROM tickets WHERE id = ?').get(info.lastInsertRowid)) });
});
// User: daftar tiket miliknya
// ---- Notifikasi in-app ----
app.get('/api/notifications', auth, (req, res) => {
  const list = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c;
  res.json({ notifications: list, unread });
});
app.post('/api/notifications/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});
app.get('/api/tickets', auth, (req, res) => {
  const rows = db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS msg_count
    FROM tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC`).all(req.user.id);
  res.json({ tickets: rows });
});
// User: detail + balas (hanya miliknya, kecuali sudah closed)
app.get('/api/tickets/:id', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  res.json({ ticket: ticketWithMessages(t) });
});
app.post('/api/tickets/:id/reply', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  if (t.status === 'closed') return res.status(400).json({ error: 'Tiket sudah ditutup' });
  const { message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Pesan wajib diisi' });
  db.prepare('INSERT INTO ticket_messages (ticket_id, user_id, is_admin, message) VALUES (?,?,0,?)')
    .run(t.id, req.user.id, String(message).trim().slice(0, 2000));
  db.prepare(`UPDATE tickets SET status = 'open', updated_at = datetime('now') WHERE id = ?`).run(t.id);
  res.json({ ticket: ticketWithMessages(db.prepare('SELECT * FROM tickets WHERE id = ?').get(t.id)) });
});
// Admin: semua tiket
app.get('/api/admin/tickets', auth, requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT t.*, u.name AS user_name,
    (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS msg_count
    FROM tickets t JOIN users u ON u.id = t.user_id ORDER BY t.updated_at DESC`).all();
  res.json({ tickets: rows });
});
app.get('/api/admin/tickets/:id', auth, requireAdmin, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  res.json({ ticket: ticketWithMessages(t) });
});
app.post('/api/admin/tickets/:id/reply', auth, requireAdmin, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  const { message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Pesan wajib diisi' });
  db.prepare('INSERT INTO ticket_messages (ticket_id, user_id, is_admin, message) VALUES (?,?,1,?)')
    .run(t.id, req.user.id, String(message).trim().slice(0, 2000));
  db.prepare(`UPDATE tickets SET status = 'answered', updated_at = datetime('now') WHERE id = ?`).run(t.id);
  res.json({ ticket: ticketWithMessages(db.prepare('SELECT * FROM tickets WHERE id = ?').get(t.id)) });
});
app.patch('/api/admin/tickets/:id', auth, requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'answered', 'closed'].includes(status)) return res.status(400).json({ error: 'Status tidak valid' });
  db.prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  res.json({ ok: true });
});

// ---- Login Google (OAuth2) ----
app.set('trust proxy', 1);
const googleOAuthState = new Map(); // state -> expiry
function googleCfg(req) {
  const cid = getSetting('google_client_id') || process.env.GOOGLE_CLIENT_ID || '';
  const csec = getSetting('google_client_secret') || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirect = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  return { cid, csec, redirect };
}
app.get('/api/auth/google', (req, res) => {
  const { cid, redirect } = googleCfg(req);
  if (!cid) return res.status(500).send('Login Google belum dikonfigurasi. Minta admin mengisi Google Client ID.');
  const state = crypto.randomBytes(16).toString('hex');
  googleOAuthState.set(state, Date.now() + 10 * 60 * 1000);
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: cid, redirect_uri: redirect, response_type: 'code',
    scope: 'openid email profile', state, prompt: 'select_account',
  });
  res.redirect(url.toString());
});
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const exp = googleOAuthState.get(state);
  googleOAuthState.delete(state);
  const fail = (m) => res.status(400).send(`<h3>Login Google gagal</h3><p>${m}</p><p><a href="/#/login">Kembali ke login</a></p>`);
  if (!code || !exp || exp < Date.now()) return fail('State tidak valid atau kedaluwarsa. Coba lagi.');
  const { cid, csec, redirect } = googleCfg(req);
  if (!cid || !csec) return fail('Konfigurasi Google belum lengkap.');
  try {
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(code), client_id: cid, client_secret: csec, redirect_uri: redirect, grant_type: 'authorization_code' }),
    });
    const tj = await tr.json();
    if (!tj.access_token) return fail('Gagal menukar kode: ' + (tj.error_description || tj.error || 'unknown'));
    const pr = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tj.access_token } });
    const p = await pr.json();
    if (!p.email) return fail('Email tidak didapat dari Google.');
    const email = String(p.email).toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      const info = db.prepare('INSERT INTO users (name, email, password_hash, email_verified) VALUES (?,?,?,1)')
        .run(String(p.name || email.split('@')[0]).slice(0, 100), email, 'google-oauth');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    } else if (!user.email_verified) {
      db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(user.id);
      user.email_verified = 1;
    }
    const token = signToken(user);
    res.redirect('/#/google/' + token);
  } catch (e) { fail(e.message); }
});
// Admin: simpan kredensial Google OAuth
app.get('/api/admin/google-settings', auth, requireAdmin, (req, res) => {
  res.json({ google_configured: !!getSetting('google_client_id'), google_client_id: getSetting('google_client_id') });
});
app.put('/api/admin/google-settings', auth, requireAdmin, (req, res) => {
  const { google_client_id, google_client_secret } = req.body || {};
  const set = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
  if (google_client_id !== undefined) set('google_client_id', String(google_client_id).trim());
  if (google_client_secret !== undefined && String(google_client_secret).trim()) set('google_client_secret', String(google_client_secret).trim());
  res.json({ ok: true, google_configured: !!getSetting('google_client_id') });
});
// Publik: apakah login Google tersedia
app.get('/api/settings/google-available', (req, res) => {
  res.json({ available: !!(getSetting('google_client_id') || process.env.GOOGLE_CLIENT_ID) });
});

// ---- Lacak pesanan publik (tanpa login) ----
app.get('/api/track', (req, res) => {
  const id = parseInt(req.query.order_id);
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!id || !email) return res.status(400).json({ error: 'ID pesanan dan email wajib diisi' });
  const o = db.prepare(`SELECT o.id, o.total, o.discount, o.status, o.payment_method, o.created_at, u.email
    FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`).get(id);
  if (!o || o.email.toLowerCase() !== email) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  let items = [];
  try { items = JSON.parse(db.prepare('SELECT items_json FROM orders WHERE id = ?').get(id).items_json).map(i => ({ name: i.name, qty: i.qty, price: i.price })); } catch {}
  delete o.email;
  res.json({ order: { ...o, items } });
});

// ---- Stok kode voucher (admin) ----
app.get('/api/admin/products/:id/codes', auth, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, code, used, order_id FROM voucher_codes WHERE product_id = ? ORDER BY id').all(req.params.id);
  res.json({ codes: rows, available: rows.filter(r => !r.used).length });
});
app.post('/api/admin/products/:id/codes', auth, requireAdmin, (req, res) => {
  const codes = String((req.body || {}).codes || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  if (!codes.length) return res.status(400).json({ error: 'Tidak ada kode' });
  const ins = db.prepare('INSERT INTO voucher_codes (product_id, code) VALUES (?, ?)');
  const tx = db.transaction(() => { for (const c of codes.slice(0, 500)) ins.run(req.params.id, c.slice(0, 200)); });
  tx();
  syncCodeStock(req.params.id);
  res.json({ ok: true, added: Math.min(codes.length, 500) });
});
app.delete('/api/admin/products/:id/codes/:cid', auth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM voucher_codes WHERE id = ? AND product_id = ? AND used = 0').run(req.params.cid, req.params.id);
  syncCodeStock(req.params.id);
  res.json({ ok: true });
});

// ---- Varian produk ----
app.get('/api/products/:id/variants', (req, res) => {
  try {
    res.json({ variants: db.prepare('SELECT id, label, price, stock, sort_order FROM product_variants WHERE product_id = ? ORDER BY sort_order, id').all(req.params.id) });
  } catch { res.json({ variants: [] }); }
});
app.post('/api/products/:id/variants', auth, requireAdmin, (req, res) => {
  const { label = '', price = 0, stock = 0 } = req.body || {};
  if (!label) return res.status(400).json({ error: 'Label varian wajib diisi' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM product_variants WHERE product_id = ?').get(req.params.id).m;
  const info = db.prepare('INSERT INTO product_variants (product_id,label,price,stock,sort_order) VALUES (?,?,?,?,?)')
    .run(req.params.id, String(label), Number(price) || 0, Number(stock) || 0, maxOrder + 1);
  res.status(201).json({ variant: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(info.lastInsertRowid) });
});
app.put('/api/products/:id/variants/:vid', auth, requireAdmin, (req, res) => {
  const { label, price, stock, sort_order } = req.body || {};
  const r = db.prepare(`UPDATE product_variants SET label=COALESCE(?,label), price=COALESCE(?,price),
    stock=COALESCE(?,stock), sort_order=COALESCE(?,sort_order) WHERE id = ? AND product_id = ?`)
    .run(label ?? null, price ?? null, stock ?? null, sort_order ?? null, req.params.vid, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Varian tidak ditemukan' });
  res.json({ variant: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(req.params.vid) });
});
app.delete('/api/products/:id/variants/:vid', auth, requireAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM product_variants WHERE id = ? AND product_id = ?').run(req.params.vid, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Varian tidak ditemukan' });
  res.json({ ok: true });
});

// Coba kirim otomatis: jika SEMUA item punya kode otomatis cukup (non-topup),
// claim kode + return array delivery. Return null jika butuh input manual.
function tryAutoDeliver(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  let items = [];
  try { items = JSON.parse(order.items_json); } catch {}
  if (!items.length) return null;
  const catStmt = db.prepare('SELECT category FROM products WHERE id = ?');
  const cats = items.map(it => (catStmt.get(it.product_id) || {}).category || 'voucher');
  if (cats.some(c => c === 'topup')) return null;
  for (const it of items) {
    const avail = db.prepare('SELECT COUNT(*) c FROM voucher_codes WHERE product_id = ? AND used = 0').get(it.product_id).c;
    if (avail < it.qty) return null;
  }
  const delivery = [];
  const tx = db.transaction(() => {
    const upd = db.prepare('UPDATE voucher_codes SET used = 1, order_id = ? WHERE id = ?');
    items.forEach((it, i) => {
      const rows = db.prepare('SELECT id, code FROM voucher_codes WHERE product_id = ? AND used = 0 ORDER BY id LIMIT ?')
        .all(it.product_id, it.qty);
      for (const r of rows) upd.run(orderId, r.id);
      delivery.push({ product_id: it.product_id, name: it.name, category: cats[i], qty: it.qty,
        data: rows.map(r => r.code).join('\n'), auto: true });
    });
  });
  tx();
  for (const it of items) syncCodeStock(it.product_id);
  return delivery;
}

// Ambil N kode otomatis untuk order (dipakai saat delivery)
function claimVoucherCodes(productId, orderId, qty) {
  const rows = db.prepare('SELECT id FROM voucher_codes WHERE product_id = ? AND used = 0 ORDER BY id LIMIT ?').all(productId, qty);
  if (rows.length < qty) return null;
  const upd = db.prepare('UPDATE voucher_codes SET used = 1, order_id = ? WHERE id = ?');
  const tx = db.transaction(() => { for (const r of rows) upd.run(orderId, r.id); });
  tx();
  const codes = db.prepare(`SELECT code FROM voucher_codes WHERE order_id = ? AND product_id = ? ORDER BY id`).all(orderId, productId).map(r => r.code);
  syncCodeStock(productId);
  return codes;
}

// Sinkron stok produk = kode belum terpakai - qty yg dipesan (pending/proses).
// Hanya untuk produk yg punya stok kode; produk lain pakai stok manual.
function hasVoucherCodes(productId) {
  return db.prepare('SELECT COUNT(*) c FROM voucher_codes WHERE product_id = ?').get(productId).c > 0;
}
function syncCodeStock(productId) {
  if (!hasVoucherCodes(productId)) return;
  const unused = db.prepare('SELECT COUNT(*) c FROM voucher_codes WHERE product_id = ? AND used = 0').get(productId).c;
  const reserved = db.prepare(`
    SELECT COALESCE(SUM(CAST(json_extract(j.value, '$.qty') AS INTEGER)), 0) r
    FROM orders o, json_each(o.items_json) j
    WHERE o.status IN ('pending','proses')
      AND CAST(json_extract(j.value, '$.product_id') AS INTEGER) = ?
  `).get(productId).r;
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(Math.max(0, unused - reserved), productId);
}

// ---- Orders ----
// Metode pembayaran dinamis (tabel payment_methods, dikelola dari admin)
// On/off tombol WA CS (default: nyala)
function allPayMethods() {
  return db.prepare('SELECT id, label, details, kind, active, sort_order FROM payment_methods ORDER BY sort_order, id').all();
}
function payMethodById(id) { return db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id); }
function enabledPayMethods() { return allPayMethods().filter(m => m.active); }
function waCsEnabled() { const v = getSetting('wa_cs_enabled'); return v === '' ? true : v !== '0'; }
const NEXT_STATUS = { pending: ['proses', 'dibatalkan'], proses: ['delivery'], delivery: ['selesai'], selesai: [], dibatalkan: [] };

// ---- Pengaturan QRIS (admin) ----
function getSetting(k) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
  return (r && r.value) || '';
}
function getQrisStatic() { return getSetting('qris_static'); }
app.get('/api/admin/settings', auth, requireAdmin, (req, res) => {
  const s = getQrisStatic();
  res.json({ qris_configured: !!s, qris_merchant: s ? merchantName(s) : '', wa_cs: getSetting('wa_cs'), wa_cs_enabled: waCsEnabled(), pay_methods: allPayMethods() });
});
app.put('/api/admin/settings', auth, requireAdmin, (req, res) => {
  const { qris_static, wa_cs, wa_cs_enabled, store_name, announcement, announcement_on, auto_complete_days, flash_sale_ends } = req.body || {};
  let merchant = '';
  if (qris_static !== undefined) {
    const s = String(qris_static || '').trim();
    if (s && !isValidPayload(s)) return res.status(400).json({ error: 'String QRIS tidak valid (cek lagi hasil scan, harus utuh & CRC benar)' });
    db.prepare("INSERT INTO settings (key, value) VALUES ('qris_static', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(s);
    merchant = s ? merchantName(s) : '';
  }
  if (wa_cs !== undefined) {
    const w = String(wa_cs || '').replace(/\D/g, '');
    db.prepare("INSERT INTO settings (key, value) VALUES ('wa_cs', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(w);
  }
  const set = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
  if (wa_cs_enabled !== undefined) set('wa_cs_enabled', wa_cs_enabled ? '1' : '0');
  if (store_name !== undefined) set('store_name', String(store_name).trim().slice(0, 40) || 'PlayTopUp Store');
  if (announcement !== undefined) set('announcement', String(announcement).trim().slice(0, 200));
  if (announcement_on !== undefined) set('announcement_on', announcement_on ? '1' : '0');
  if (auto_complete_days !== undefined) {
    const d = Math.max(1, Math.min(30, parseInt(auto_complete_days) || 2));
    set('auto_complete_days', String(d));
  }
  if (flash_sale_ends !== undefined) set('flash_sale_ends', String(flash_sale_ends || ''));
  res.json({ ok: true, qris_merchant: merchant, wa_cs: getSetting('wa_cs'), wa_cs_enabled: waCsEnabled(), pay_methods: allPayMethods() });
});
// GET pengaturan toko (admin)
app.get('/api/admin/store-settings', auth, requireAdmin, (req, res) => {
  res.json({
    store_name: getSetting('store_name') || 'PlayTopUp Store',
    announcement: getSetting('announcement') || '',
    announcement_on: getSetting('announcement_on') === '1',
    auto_complete_days: parseInt(getSetting('auto_complete_days')) || 2,
    flash_sale_ends: getSetting('flash_sale_ends') || '',
    categories: allCategories(),
  });
});
// ---- CRUD metode pembayaran (admin) ----
app.post('/api/admin/pay-methods', auth, requireAdmin, (req, res) => {
  const { id, label, details = '', kind = 'transfer' } = req.body || {};
  const rawId = id || label || '';
  const nid = String(rawId).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').slice(0, 40);
  if (!nid || nid.length < 3) return res.status(400).json({ error: 'ID minimal 3 karakter (huruf/angka/_)' });
  if (!label || !String(label).trim()) return res.status(400).json({ error: 'Label wajib diisi' });
  if (!['qris', 'transfer'].includes(kind)) return res.status(400).json({ error: 'Jenis tidak valid' });
  if (payMethodById(nid)) return res.status(400).json({ error: 'ID sudah dipakai' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM payment_methods').get().m;
  db.prepare('INSERT INTO payment_methods (id, label, details, kind, active, sort_order) VALUES (?,?,?,?,1,?)')
    .run(nid, String(label).trim().slice(0, 80), String(details).trim().slice(0, 200), kind, maxSort + 1);
  res.status(201).json({ method: payMethodById(nid) });
});
app.put('/api/admin/pay-methods/:id', auth, requireAdmin, (req, res) => {
  const m = payMethodById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Metode tidak ditemukan' });
  const { label, details, kind, active, sort_order } = req.body || {};
  if (label !== undefined && !String(label).trim()) return res.status(400).json({ error: 'Label wajib diisi' });
  if (kind !== undefined && !['qris', 'transfer'].includes(kind)) return res.status(400).json({ error: 'Jenis tidak valid' });
  if (active !== undefined && !active) {
    const others = db.prepare('SELECT COUNT(*) c FROM payment_methods WHERE active = 1 AND id != ?').get(m.id).c;
    if (!others) return res.status(400).json({ error: 'Minimal satu metode pembayaran harus aktif' });
  }
  db.prepare(`UPDATE payment_methods SET label = COALESCE(?, label), details = COALESCE(?, details),
    kind = COALESCE(?, kind), active = COALESCE(?, active), sort_order = COALESCE(?, sort_order) WHERE id = ?`)
    .run(label !== undefined ? String(label).trim().slice(0, 80) : null,
      details !== undefined ? String(details).trim().slice(0, 200) : null,
      kind ?? null, active !== undefined ? (active ? 1 : 0) : null,
      sort_order !== undefined ? Number(sort_order) || 0 : null, m.id);
  res.json({ method: payMethodById(m.id) });
});
app.delete('/api/admin/pay-methods/:id', auth, requireAdmin, (req, res) => {
  const m = payMethodById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Metode tidak ditemukan' });
  if (m.active) {
    const others = db.prepare('SELECT COUNT(*) c FROM payment_methods WHERE active = 1 AND id != ?').get(m.id).c;
    if (!others) return res.status(400).json({ error: 'Minimal satu metode pembayaran harus aktif' });
  }
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(m.id);
  res.json({ ok: true });
});
// ---- CRUD kategori produk (admin) ----
function catById(id) { return db.prepare('SELECT * FROM categories WHERE id = ?').get(id); }
app.post('/api/admin/categories', auth, requireAdmin, (req, res) => {
  const { id, label, icon = '📦' } = req.body || {};
  const rawId = id || label || '';
  const nid = String(rawId).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').slice(0, 40);
  if (!nid || nid.length < 3) return res.status(400).json({ error: 'ID minimal 3 karakter (huruf/angka/_)' });
  if (!label || !String(label).trim()) return res.status(400).json({ error: 'Label wajib diisi' });
  if (catById(nid)) return res.status(400).json({ error: 'ID sudah dipakai' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM categories').get().m;
  db.prepare('INSERT INTO categories (id,label,icon,active,sort_order) VALUES (?,?,?,1,?)')
    .run(nid, String(label).trim().slice(0, 40), String(icon).trim().slice(0, 8) || '📦', maxSort + 1);
  res.status(201).json({ category: catById(nid) });
});
app.put('/api/admin/categories/:id', auth, requireAdmin, (req, res) => {
  const c = catById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  const { label, icon, active, sort_order } = req.body || {};
  if (label !== undefined && !String(label).trim()) return res.status(400).json({ error: 'Label wajib diisi' });
  if (active !== undefined && !active) {
    const others = db.prepare('SELECT COUNT(*) c FROM categories WHERE active = 1 AND id != ?').get(c.id).c;
    if (!others) return res.status(400).json({ error: 'Minimal satu kategori harus aktif' });
  }
  db.prepare(`UPDATE categories SET label = COALESCE(?, label), icon = COALESCE(?, icon),
    active = COALESCE(?, active), sort_order = COALESCE(?, sort_order) WHERE id = ?`)
    .run(label !== undefined ? String(label).trim().slice(0, 40) : null,
      icon !== undefined ? String(icon).trim().slice(0, 8) || '📦' : null,
      active !== undefined ? (active ? 1 : 0) : null,
      sort_order !== undefined ? Number(sort_order) || 0 : null, c.id);
  res.json({ category: catById(c.id) });
});
app.delete('/api/admin/categories/:id', auth, requireAdmin, (req, res) => {
  const c = catById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  const used = db.prepare('SELECT COUNT(*) c FROM products WHERE category = ?').get(c.id).c;
  if (used) return res.status(400).json({ error: `Kategori dipakai ${used} produk — pindahkan dulu produknya` });
  if (c.active) {
    const others = db.prepare('SELECT COUNT(*) c FROM categories WHERE active = 1 AND id != ?').get(c.id).c;
    if (!others) return res.status(400).json({ error: 'Minimal satu kategori harus aktif' });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
  res.json({ ok: true });
});
// ---- Auto-complete pesanan delivery (cron server-side, proteksi CRON_SECRET) ----
app.post('/api/cron/auto-complete', (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret)
    return res.status(403).json({ error: 'Forbidden' });
  const days = Math.max(1, Math.min(30, parseInt(getSetting('auto_complete_days')) || 2));
  const cutoff = `-${days} days`;
  const rows = db.prepare(
    `SELECT id, proof_path FROM orders WHERE status = 'delivery' AND COALESCE(delivered_at, created_at) <= datetime('now', ?)`
  ).all(cutoff);
  const r = db.prepare(
    `UPDATE orders SET status = 'selesai', proof_path = NULL WHERE status = 'delivery' AND COALESCE(delivered_at, created_at) <= datetime('now', ?)`
  ).run(cutoff);
  for (const o of rows) {
    if (o.proof_path) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(o.proof_path))); } catch {}
    }
  }
  res.json({ ok: true, auto_completed: r.changes, days });
});
// Publik: nomor WA CS (untuk tombol chat)
app.get('/api/settings/public', (req, res) => {
  res.json({
    wa_cs: waCsEnabled() ? getSetting('wa_cs') : '',
    pay_methods: enabledPayMethods().map(m => ({ id: m.id, label: m.label, desc: m.details, kind: m.kind })),
    categories: activeCategories(),
    store_name: getSetting('store_name') || 'PlayTopUp Store',
    announcement: getSetting('announcement_on') === '1' ? getSetting('announcement') : '',
    flash_sale_ends: getSetting('flash_sale_ends') || '',
  });
});

// ---- Pengaturan email/SMTP (admin) ----
app.get('/api/admin/email-settings', auth, requireAdmin, (req, res) => {
  res.json({
    smtp_host: getSetting('smtp_host'), smtp_port: getSetting('smtp_port') || '587',
    smtp_user: getSetting('smtp_user'), smtp_from: getSetting('smtp_from'),
    admin_email: getSetting('admin_email'),
    smtp_pass_set: !!getSetting('smtp_pass'),
    brevo_api_key_set: !!(getSetting('brevo_api_key') || process.env.BREVO_API_KEY),
  });
});
app.put('/api/admin/email-settings', auth, requireAdmin, (req, res) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, admin_email, brevo_api_key } = req.body || {};
  const set = (k, v) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
  if (smtp_host !== undefined) set('smtp_host', String(smtp_host).trim());
  if (smtp_port !== undefined) set('smtp_port', String(smtp_port).trim() || '587');
  if (smtp_user !== undefined) set('smtp_user', String(smtp_user).trim());
  if (smtp_pass !== undefined && String(smtp_pass).trim()) set('smtp_pass', String(smtp_pass).trim());
  if (smtp_from !== undefined) set('smtp_from', String(smtp_from).trim());
  if (admin_email !== undefined) set('admin_email', String(admin_email).trim());
  if (brevo_api_key !== undefined && String(brevo_api_key).trim()) set('brevo_api_key', String(brevo_api_key).trim());
  res.json({ ok: true });
});
app.post('/api/admin/email-test', auth, requireAdmin, async (req, res) => {
  const to = getSetting('admin_email') || getSetting('smtp_user');
  if (!to) return res.status(400).json({ error: 'Isi admin_email / smtp_user dulu' });
  try {
    const ok = await sendMail(to, '🎮 PlayTopUp Store — Tes Email', '<p>Email notifikasi PlayTopUp Store berfungsi! ✅</p>');
    if (!ok) return res.status(400).json({ error: 'SMTP belum dikonfigurasi' });
    res.json({ ok: true, message: 'Email tes terkirim ke ' + to });
  } catch (e) { res.status(500).json({ error: 'Gagal kirim: ' + e.message }); }
});

// ---- QR dinamis per pesanan ----
app.get('/api/orders/:id/qris', auth, async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Bukan pesananmu' });
  const opm = payMethodById(order.payment_method);
  const isQrisOrder = order.payment_method === 'qris' || (opm && opm.kind === 'qris');
  if (!isQrisOrder) return res.status(400).json({ error: 'Pesanan ini bukan via QRIS' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Pesanan sudah diproses' });
  const statis = getQrisStatic();
  if (!statis) return res.status(400).json({ error: 'QRIS belum dikonfigurasi admin' });
  try {
    const payload = makeDynamicQris(statis, order.total);
    const qr = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
    res.json({ qr, amount: order.total, merchant: merchantName(statis) });
  } catch (e) { res.status(500).json({ error: e.message || 'Gagal membuat QR' }); }
});

// ---- Wishlist ----
app.get('/api/wishlist', auth, (req, res) => {
  try {
    const rows = db.prepare(`SELECT p.* FROM wishlist w JOIN products p ON p.id = w.product_id
      WHERE w.user_id = ? ORDER BY w.created_at DESC`).all(req.user.id);
    res.json({ products: rows.map(p => attachImages(p)) });
  } catch { res.json({ products: [] }); }
});
app.post('/api/wishlist/:pid', auth, (req, res) => {
  try {
    db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?,?)').run(req.user.id, req.params.pid);
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Gagal menambah wishlist' }); }
});
app.delete('/api/wishlist/:pid', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.pid);
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Gagal menghapus wishlist' }); }
});

app.post('/api/orders', auth, (req, res) => {
  const { items, payment_method, voucher_code } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items wajib diisi' });
  const pm = payMethodById(payment_method);
  if (!pm) return res.status(400).json({ error: 'Metode pembayaran tidak valid' });
  if (!pm.active) return res.status(400).json({ error: 'Metode pembayaran ini sedang nonaktif' });

  const tx = db.transaction(() => {
    const snapshot = [];
    let total = 0;
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
      if (!p) throw { status: 400, msg: `Produk ${it.product_id} tidak ditemukan` };
      const qty = Math.max(1, parseInt(it.qty) || 1);
      const hasVar = db.prepare('SELECT COUNT(*) c FROM product_variants WHERE product_id = ?').get(p.id).c > 0;
      if (hasVar && !it.variant_id) throw { status: 400, msg: `Pilih varian untuk "${p.name}"` };
      const needGameId = String(p.category || '').toLowerCase() !== 'steam';
      if (needGameId && !String(it.game_id || '').trim()) throw { status: 400, msg: `ID Game wajib diisi untuk "${p.name}"` };
      let price = p.price, vlabel = '';
      if (it.variant_id) {
        const v = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?').get(it.variant_id, p.id);
        if (!v) throw { status: 400, msg: `Varian tidak ditemukan` };
        if (v.stock < qty) throw { status: 400, msg: `Stok varian "${v.label}" tidak cukup (sisa ${v.stock})` };
        db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ?').run(qty, v.id);
        price = effPrice(v.price, p.discount); vlabel = v.label;
      } else {
        if (p.stock < qty) throw { status: 400, msg: `Stok "${p.name}" tidak cukup (sisa ${p.stock})` };
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, p.id);
        price = effPrice(p.price, p.discount);
      }
      snapshot.push({ product_id: p.id, variant_id: it.variant_id || null, variant_label: vlabel, name: vlabel ? `${p.name} (${vlabel})` : p.name, price, qty, image_url: p.image_url, game_id: String(it.game_id || '').slice(0, 80) });
      total += price * qty;
    }
    let discount = 0, vcode = null;
    if (voucher_code) {
      const r = calcVoucherDiscount(voucher_code, total);
      discount = r.discount; vcode = r.voucher.code;
      db.prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE code = ?').run(vcode);
    }
    const info = db.prepare('INSERT INTO orders (user_id,items_json,total,payment_method,status,discount,voucher_code) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, JSON.stringify(snapshot), total - discount, payment_method, 'pending', discount, vcode);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
  });

  try {
    const order = tx();
    notifyOrder(order.id, 'Pesanan dibuat 🎉', 'Pesananmu sudah kami terima dan menunggu verifikasi pembayaran.');
    pushNotif(req.user.id, 'Pesanan dibuat 🎉', `Pesanan #${order.id} menunggu pembayaran sebesar ${rp0(order.total)}.`, '#/pay/' + order.id);
    res.status(201).json({ order });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.msg || 'Gagal membuat pesanan' });
  }
});

app.post('/api/orders/:id/proof', auth, async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Bukan pesananmu' });
  if (order.status === 'dibatalkan' || order.status === 'selesai')
    return res.status(400).json({ error: 'Pesanan sudah selesai/dibatalkan' });
  let parsed;
  try { parsed = await parseMultipart(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.file) return res.status(400).json({ error: 'Field "bukti" wajib diisi file gambar' });
  if (parsed.file.data.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'File maksimal 5MB' });
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[parsed.file.mime] || 'bin';
  const fname = `bukti_${order.id}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fname), parsed.file.data);
  if (order.proof_path) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(order.proof_path))); } catch {} }
  db.prepare('UPDATE orders SET proof_path = ? WHERE id = ?').run('/uploads/' + fname, order.id);
  res.json({ ok: true, proof_path: '/uploads/' + fname });
});

app.get('/api/orders', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ orders: rows.map(attachItems) });
});

app.get('/api/orders/all', auth, requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT o.*, u.name AS user_name, u.email AS user_email
    FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`).all();
  res.json({ orders: rows.map(attachItems) });
});

function attachItems(o) {
  try { o.items = JSON.parse(o.items_json); } catch { o.items = []; }
  try { o.delivery = JSON.parse(o.delivery_data || 'null'); } catch { o.delivery = null; }
  delete o.items_json;
  delete o.delivery_data;
  return o;
}

// Hapus file bukti pembayaran (dipanggil saat order dibatalkan / selesai agar uploads tidak menumpuk)
function purgeProof(order) {
  if (order && order.proof_path) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(order.proof_path))); } catch {}
    db.prepare('UPDATE orders SET proof_path = NULL WHERE id = ?').run(order.id);
  }
}

// Cek apakah semua item order sudah diulas -> tandai selesai otomatis
function tryAutoCompleteOrder(orderId, userId) {
  const ord = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!ord || ord.status !== 'delivery' || ord.user_id !== userId) return false;
  let items = [];
  try { items = JSON.parse(ord.items_json); } catch {}
  const all = items.length && items.every(it =>
    db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ?').get(userId, it.product_id));
  if (all) {
    db.prepare(`UPDATE orders SET status = 'selesai' WHERE id = ?`).run(orderId);
    purgeProof(ord);
    return true;
  }
  return false;
}

app.patch('/api/orders/:id/status', auth, requireAdmin, (req, res) => {
  const { status, force } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  const normalOk = NEXT_STATUS[order.status].includes(status);
  // Force-cancel khusus admin (salah input data): dari status apa pun kecuali selesai/dibatalkan
  const forceCancel = status === 'dibatalkan' && force === true && !['selesai', 'dibatalkan'].includes(order.status);
  if (!normalOk && !forceCancel)
    return res.status(400).json({ error: `Status tidak bisa diubah dari "${order.status}" ke "${status}"` });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  if (status === 'dibatalkan') purgeProof(order);
  // Auto-delivery: saat pending -> proses, jika semua item berkode otomatis -> langsung delivery
  let autoDelivered = false;
  if (status === 'proses' && order.status === 'pending') {
    const delivery = tryAutoDeliver(order.id);
    if (delivery) {
      db.prepare(`UPDATE orders SET delivery_data = ?, delivered_at = datetime('now'), status = 'delivery' WHERE id = ?`)
        .run(JSON.stringify(delivery), order.id);
      autoDelivered = true;
      // sync ulang: order sudah delivery (tidak lagi reserved)
      for (const pid of [...new Set(delivery.map(d => d.product_id))]) syncCodeStock(pid);
    }
  }
  if (status === 'dibatalkan') {
    const fromStatus = order.status;
    let items = [];
    try { items = JSON.parse(order.items_json); } catch {}
    // 1. Kembalikan kode otomatis yg sudah di-claim
    const affected = db.prepare('SELECT DISTINCT product_id FROM voucher_codes WHERE order_id = ?').all(order.id).map(r => r.product_id);
    if (affected.length) {
      db.prepare('UPDATE voucher_codes SET used = 0, order_id = NULL WHERE order_id = ?').run(order.id);
    }
    // 2. Kembalikan stok produk non-kode (kecuali sudah delivery = barang sudah dikirim)
    if (['pending', 'proses'].includes(fromStatus)) {
      for (const it of items) {
        if (it.variant_id) db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(it.qty, it.variant_id);
        else if (!hasVoucherCodes(it.product_id))
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.qty, it.product_id);
      }
    }
    // 3. Sync stok produk berkode
    const pids = [...new Set([...affected, ...items.filter(i => hasVoucherCodes(i.product_id)).map(i => i.product_id)])];
    for (const pid of pids) syncCodeStock(pid);
  }
  const finalOrder = attachItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
  const msgs = {
    proses: ['Pesanan diproses ⚙️', 'Pembayaranmu terverifikasi! Pesanan sedang disiapkan admin.'],
    delivery: ['Pesanan dikirim 📤', 'Data/akun/voucher pesananmu sudah dikirim. Cek halaman Pesanan ya!'],
    selesai: ['Pesanan selesai ✅', 'Terima kasih sudah belanja di PlayTopUp Store!'],
    dibatalkan: ['Pesanan dibatalkan ❌', 'Pesananmu dibatalkan. Hubungi CS jika ada pertanyaan.'],
  };
  const doneStatus = autoDelivered ? 'delivery' : status;
  if (msgs[doneStatus]) {
    notifyOrder(order.id, msgs[doneStatus][0], msgs[doneStatus][1]);
    pushNotif(order.user_id, msgs[doneStatus][0], msgs[doneStatus][1], '#/order/' + order.id);
  }
  if (doneStatus === 'delivery') {
    const o = db.prepare(`SELECT o.*, u.email, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`).get(order.id);
    if (o) notifyAdmin(`Pesanan #${o.id} dikirim 📤`,
      `<div style="font-family:sans-serif;max-width:480px"><p>Pesanan <b>#${o.id}</b> (${o.name} &lt;${o.email}&gt;, total <b>${rp0(o.total)}</b>) sudah dikirim ke pembeli.</p></div>`);
  }
  res.json({ order: finalOrder, autoDelivered });
});

// User: batalkan pesanan sendiri (hanya saat pending)
app.post('/api/orders/:id/cancel', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Bukan pesananmu' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Hanya pesanan menunggu yang bisa dibatalkan' });
  let items = [];
  try { items = JSON.parse(order.items_json); } catch {}
  const affected = db.prepare('SELECT DISTINCT product_id FROM voucher_codes WHERE order_id = ?').all(order.id).map(r => r.product_id);
  if (affected.length) db.prepare('UPDATE voucher_codes SET used = 0, order_id = NULL WHERE order_id = ?').run(order.id);
  for (const it of items) {
    if (it.variant_id) db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(it.qty, it.variant_id);
    else if (!hasVoucherCodes(it.product_id))
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.qty, it.product_id);
  }
  const pids = [...new Set([...affected, ...items.filter(i => hasVoucherCodes(i.product_id)).map(i => i.product_id)])];
  for (const pid of pids) syncCodeStock(pid);
  db.prepare(`UPDATE orders SET status = 'dibatalkan' WHERE id = ?`).run(order.id);
  purgeProof(order);
  res.json({ ok: true });
});

// Detail 1 pesanan (pemilik / admin), items diperkaya kategori produk
app.get('/api/orders/:id', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Bukan pesananmu' });
  const o = attachItems(order);
  const catStmt = db.prepare('SELECT category FROM products WHERE id = ?');
  const codeStmt = db.prepare('SELECT COUNT(*) c FROM voucher_codes WHERE product_id = ? AND used = 0');
  o.items = o.items.map(it => ({ ...it, category: (catStmt.get(it.product_id) || {}).category || 'voucher',
    auto_codes: codeStmt.get(it.product_id).c }));
  res.json({ order: o });
});

// Admin: kirim data delivery (voucher/akun: data teks; topup: bukti gambar + TRX ID)
// -> status otomatis 'delivery'
app.post('/api/orders/:id/deliver', auth, requireAdmin, async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.status !== 'proses')
    return res.status(400).json({ error: 'Hanya pesanan berstatus "proses" yang bisa di-delivery' });
  let items = [];
  try { items = JSON.parse(order.items_json); } catch {}
  if (!items.length) return res.status(400).json({ error: 'Pesanan tidak memiliki item' });
  let parsed;
  try { parsed = await parseMultipartMulti(req, { maxFiles: 20 }); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const catStmt = db.prepare('SELECT category FROM products WHERE id = ?');
  const delivery = [];
  for (const it of items) {
    const cat = (catStmt.get(it.product_id) || {}).category || 'voucher';
    if (cat === 'topup') {
      const file = parsed.files.find(f => f.field === `proof_${it.product_id}`);
      const trx = String(parsed.fields[`trx_${it.product_id}`] || '').trim();
      if (!file) return res.status(400).json({ error: `Bukti topup (gambar) wajib diisi untuk "${it.name}"` });
      if (!trx) return res.status(400).json({ error: `TRX ID wajib diisi untuk "${it.name}"` });
      const fname = `topup_${order.id}_${it.product_id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${PHOTO_MIMES[file.mime]}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, fname), file.data);
      delivery.push({ product_id: it.product_id, name: it.name, category: cat, qty: it.qty,
        proof_path: '/uploads/' + fname, trx_id: trx.slice(0, 100) });
    } else {
      // Coba kode otomatis dulu (stok kode voucher)
      const autoCodes = claimVoucherCodes(it.product_id, order.id, it.qty);
      if (autoCodes) {
        delivery.push({ product_id: it.product_id, name: it.name, category: cat, qty: it.qty,
          data: autoCodes.join('\n'), auto: true });
      } else {
        const data = String(parsed.fields[`data_${it.product_id}`] || '').trim();
        if (!data) return res.status(400).json({ error: `Data pengiriman wajib diisi untuk "${it.name}"` });
        delivery.push({ product_id: it.product_id, name: it.name, category: cat, qty: it.qty, data: data.slice(0, 2000) });
      }
    }
  }
  db.prepare(`UPDATE orders SET delivery_data = ?, delivered_at = datetime('now'), status = 'delivery' WHERE id = ?`)
    .run(JSON.stringify(delivery), order.id);
  for (const pid of [...new Set(delivery.map(d => d.product_id))]) syncCodeStock(pid);
  notifyOrder(order.id, 'Pesanan dikirim 📤', 'Data/akun/voucher pesananmu sudah dikirim. Cek halaman Pesanan ya!');
  const adm = db.prepare(`SELECT o.*, u.email, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = ?`).get(order.id);
  if (adm) notifyAdmin(`Pesanan #${adm.id} dikirim 📤`,
    `<div style="font-family:sans-serif;max-width:480px"><p>Pesanan <b>#${adm.id}</b> (${adm.name} &lt;${adm.email}&gt;, total <b>${rp0(adm.total)}</b>) sudah dikirim ke pembeli.</p></div>`);
  res.json({ ok: true, message: 'Data terkirim, status pesanan -> delivery 📤' });
});

// User: tandai selesai (wajib semua item sudah diulas)
app.post('/api/orders/:id/complete', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: 'Bukan pesananmu' });
  if (order.status !== 'delivery')
    return res.status(400).json({ error: 'Pesanan belum bisa ditandai selesai' });
  let items = [];
  try { items = JSON.parse(order.items_json); } catch {}
  const missing = items
    .filter(it => !db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ?').get(req.user.id, it.product_id))
    .map(it => it.name);
  if (missing.length)
    return res.status(400).json({ error: 'Isi ulasan dulu untuk: ' + missing.join(', '), missing });
  db.prepare(`UPDATE orders SET status = 'selesai' WHERE id = ?`).run(order.id);
  purgeProof(order);
  notifyOrder(order.id, 'Pesanan selesai ✅', 'Terima kasih sudah belanja di PlayTopUp Store!');
  res.json({ ok: true, message: 'Pesanan selesai. Terima kasih! 🎉' });
});

// ---- Reviews ----
app.get('/api/products/:id/reviews', (req, res) => {
  const rows = db.prepare(
    `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? ORDER BY r.created_at DESC`
  ).all(req.params.id);
  res.json({ reviews: rows });
});

// Testimoni terbaru untuk beranda (rating 4-5, ada komentar)
app.get('/api/reviews/recent', (req, res) => {
  const rows = db.prepare(
    `SELECT r.rating, r.comment, r.created_at, u.name AS user_name, p.name AS product_name
     FROM reviews r JOIN users u ON u.id = r.user_id JOIN products p ON p.id = r.product_id
     WHERE r.rating >= 4 AND TRIM(r.comment) != '' ORDER BY r.created_at DESC LIMIT 10`
  ).all();
  res.json({ reviews: rows });
});

app.get('/api/reviews/eligible', auth, (req, res) => {
  // produk dari order delivery/selesai yang belum diulas user ini
  const rows = db.prepare(
    `SELECT DISTINCT p.id AS product_id, p.name AS product_name, o.id AS order_id
     FROM orders o, json_each(o.items_json) je
     JOIN products p ON p.id = json_extract(je.value, '$.product_id')
     LEFT JOIN reviews r ON r.user_id = o.user_id AND r.product_id = p.id
     WHERE o.user_id = ? AND o.status IN ('delivery','selesai') AND r.id IS NULL`
  ).all(req.user.id);
  res.json({ eligible: rows });
});

app.post('/api/products/:id/reviews', auth, (req, res) => {
  const { rating, comment, order_id } = req.body || {};
  const pid = Number(req.params.id);
  const r = Number(rating);
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'Rating harus 1-5' });
  const cmt = String(comment || '').trim();
  if (!cmt) return res.status(400).json({ error: 'Tulis ulasan dulu ya' });
  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(pid);
  if (!prod) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  // harus punya order delivery/selesai berisi produk ini
  const ok = db.prepare(
    `SELECT o.id FROM orders o, json_each(o.items_json) je
     WHERE o.user_id = ? AND o.status IN ('delivery','selesai')
       AND (o.id = ? OR ? IS NULL)
       AND json_extract(je.value, '$.product_id') = ? LIMIT 1`
  ).get(req.user.id, order_id || null, order_id || null, pid);
  if (!ok) return res.status(403).json({ error: 'Hanya bisa mengulas produk dari pesanan yang sudah selesai' });
  const exists = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, pid);
  if (exists) return res.status(400).json({ error: 'Kamu sudah mengulas produk ini' });
  const ins = db.prepare(
    'INSERT INTO reviews (product_id, user_id, order_id, rating, comment) VALUES (?,?,?,?,?)'
  ).run(pid, req.user.id, ok.id, r, cmt.slice(0, 1000));
  // kalau semua item order sudah diulas -> pesanan otomatis selesai
  const order_completed = order_id ? tryAutoCompleteOrder(ok.id, req.user.id) : false;
  res.status(201).json({ id: ins.lastInsertRowid, order_completed });
});

// ---- Admin: statistik realtime dari DB ----
// ---- Laporan penjualan ----
function salesReport(from, to) {
  const cond = `status != 'dibatalkan' AND date(created_at,'localtime') >= date(?) AND date(created_at,'localtime') <= date(?)`;
  const summary = db.prepare(`SELECT COUNT(*) orders, COALESCE(SUM(total),0) revenue,
    COALESCE(AVG(total),0) avg_order FROM orders WHERE ${cond}`).get(from, to);
  const byDay = db.prepare(`SELECT date(created_at,'localtime') d, COUNT(*) orders, COALESCE(SUM(total),0) revenue
    FROM orders WHERE ${cond} GROUP BY d ORDER BY d`).all(from, to);
  const topProducts = db.prepare(`SELECT CAST(json_extract(j.value,'$.product_id') AS INTEGER) pid,
      json_extract(j.value,'$.name') name, SUM(CAST(json_extract(j.value,'$.qty') AS INTEGER)) qty,
      SUM(CAST(json_extract(j.value,'$.price') AS INTEGER) * CAST(json_extract(j.value,'$.qty') AS INTEGER)) revenue
    FROM orders o, json_each(o.items_json) j WHERE ${cond}
    GROUP BY pid ORDER BY revenue DESC LIMIT 20`).all(from, to);
  const byPayment = db.prepare(`SELECT payment_method m, COUNT(*) orders, COALESCE(SUM(total),0) revenue
    FROM orders WHERE ${cond} GROUP BY m ORDER BY revenue DESC`).all(from, to);
  return { summary, byDay, topProducts, byPayment };
}
app.get('/api/admin/reports/sales', auth, requireAdmin, (req, res) => {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  res.json({ from, to, ...salesReport(from, to) });
});
app.get('/api/admin/reports/sales.csv', auth, requireAdmin, (req, res) => {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const from = req.query.from || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const r = salesReport(from, to);
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  let csv = 'Laporan Penjualan,' + from + ' s/d ' + to + '\n\nRingkasan\n';
  csv += `Total Pesanan,${r.summary.orders}\nTotal Omzet,${r.summary.revenue}\nRata-rata per Pesanan,${Math.round(r.summary.avg_order)}\n\n`;
  csv += 'Per Hari\nTanggal,Jumlah Pesanan,Omzet\n';
  for (const d of r.byDay) csv += `${d.d},${d.orders},${d.revenue}\n`;
  csv += '\nProduk Terlaris\nProduk,Terjual,Omzet\n';
  for (const p of r.topProducts) csv += `${esc(p.name)},${p.qty},${p.revenue}\n`;
  csv += '\nPer Metode Bayar\nMetode,Jumlah Pesanan,Omzet\n';
  for (const m of r.byPayment) csv += `${esc(m.m)},${m.orders},${m.revenue}\n`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-${from}_${to}.csv"`);
  res.send('﻿' + csv);
});

app.get('/api/admin/stats', auth, requireAdmin, (req, res) => {
  const revenue = db.prepare(
    `SELECT COALESCE(SUM(total),0) t FROM orders WHERE status != 'dibatalkan'`).get().t;
  const today = db.prepare(
    `SELECT COUNT(*) c, COALESCE(SUM(total),0) t FROM orders
     WHERE date(created_at) = date('now','localtime') AND status != 'dibatalkan'`).get();
  const pending = db.prepare(
    `SELECT COUNT(*) c FROM orders WHERE status = 'pending'`).get().c;
  const totalProducts = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const totalUsers = db.prepare(`SELECT COUNT(*) c FROM users WHERE role = 'user'`).get().c;
  const lowStock = db.prepare('SELECT COUNT(*) c FROM products WHERE stock < 5').get().c;
  const sales7d = db.prepare(
    `SELECT date(created_at,'localtime') d, COALESCE(SUM(total),0) t, COUNT(*) c
     FROM orders WHERE created_at >= datetime('now','-6 days','localtime')
       AND status != 'dibatalkan'
     GROUP BY d ORDER BY d`).all();
  const recent = db.prepare(
    `SELECT o.id, o.total, o.status, o.created_at, u.name AS user_name, u.email
     FROM orders o JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC LIMIT 5`).all();
  res.json({ revenue_total: revenue, orders_today: today.c, revenue_today: today.t,
    pending_orders: pending, total_products: totalProducts, total_users: totalUsers,
    low_stock: lowStock, sales_7d: sales7d, recent_orders: recent });
});

// ---- Admin: kelola user ----
app.get('/api/users', auth, requireAdmin, (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, email, role, email_verified, avatar, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users: rows });
});
app.patch('/api/users/:id/role', auth, requireAdmin, (req, res) => {
  const uid = Number(req.params.id);
  if (uid === req.user.id) return res.status(400).json({ error: 'Tidak bisa mengubah role sendiri' });
  const { role } = req.body || {};
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Role tidak valid' });
  const u = db.prepare('SELECT id FROM users WHERE id = ?').get(uid);
  if (!u) return res.status(404).json({ error: 'User tidak ditemukan' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, uid);
  res.json({ ok: true });
});
// File upload: nama file unik per upload -> aman di-cache lama oleh browser/CDN
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
// index.html adalah shell app yang sering berubah -> jangan di-cache; JS/CSS revalidasi tiap load (304 bila tak berubah)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders(res, p) {
    if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    else if (/\.(js|css)$/.test(p)) res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`[toko] jalan di http://localhost:${PORT}`));
