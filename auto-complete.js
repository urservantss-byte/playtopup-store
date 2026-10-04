// Auto-complete pesanan delivery > 2 hari + hapus file bukti pembayaran (hemat disk)
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, 'toko.db'));
const UPLOAD_DIR = path.join(__dirname, 'uploads');

const rows = db.prepare(
  `SELECT id, proof_path FROM orders
   WHERE status = 'delivery' AND COALESCE(delivered_at, created_at) <= datetime('now', '-2 days')`
).all();

const r = db.prepare(
  `UPDATE orders SET status = 'selesai', proof_path = NULL
   WHERE status = 'delivery' AND COALESCE(delivered_at, created_at) <= datetime('now', '-2 days')`
).run();

for (const o of rows) {
  if (o.proof_path) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(o.proof_path))); } catch {}
  }
}

console.log('auto_completed=' + r.changes);
