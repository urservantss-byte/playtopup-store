// Seed PlayTopUp Store: categories, products + variants, banner, voucher, settings
const path = require('path');
const Database = require('better-sqlite3');
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'toko.db');
const db = new Database(DB_FILE);

const CATS = [
  ['ml', 'Mobile Legends', '⚔️', 0],
  ['genshin', 'Genshin Impact', '✨', 1],
  ['pubg', 'PUBG Mobile', '🪖', 2],
  ['ff', 'Free Fire', '🔥', 3],
  ['roblox', 'Roblox', '🧱', 4],
  ['steam', 'Steam Wallet', '🎮', 5],
];
const insCat = db.prepare('INSERT OR REPLACE INTO categories (id,label,icon,active,sort_order) VALUES (?,?,?,1,?)');
for (const c of CATS) insCat.run(...c);
console.log('categories:', CATS.length);

// hapus produk seed bawaan (9 produk contoh TokoGame)
db.prepare("DELETE FROM products WHERE name LIKE 'Contoh%' OR name LIKE 'Sample%' OR tags LIKE '%seed%'").run();
const before = db.prepare('SELECT COUNT(*) c FROM products').get().c;
if (before > 0) {
  console.log('membersihkan', before, 'produk lama...');
  db.prepare('DELETE FROM product_variants').run();
  db.prepare('DELETE FROM products').run();
}

const PRODUCTS = [
  { name: 'Mobile Legends Diamonds', cat: 'ml', img: '/img/ml.webp', tags: 'mlbb,moba,diamond', desc: 'Top up Mobile Legends Diamonds instantly. Diamonds are delivered directly to your game account.', vars: [['86 Diamonds', 22000], ['172 Diamonds', 43000], ['344 Diamonds', 86000], ['514 Diamonds', 129000]] },
  { name: 'Genshin Impact Crystals', cat: 'genshin', img: '/img/genshin.webp', tags: 'genshin,rpg,crystal', desc: 'Genesis Crystals for Genshin Impact. Fast delivery, safe & official.', vars: [['60 Genesis Crystals', 16000], ['330 Genesis Crystals', 75000], ['1090 Genesis Crystals', 240000], ['1980 Genesis Crystals', 450000]] },
  { name: 'PUBG Mobile UC', cat: 'pubg', img: '/img/pubg.webp', tags: 'pubg,fps,uc', desc: 'Unknown Cash (UC) for PUBG Mobile. Instant delivery 24/7.', vars: [['60 UC', 15000], ['325 UC', 75000], ['660 UC', 150000]] },
  { name: 'Free Fire Diamonds', cat: 'ff', img: '/img/ff.webp', tags: 'freefire,ff,diamond', desc: 'Free Fire Diamonds top up. Instant process, 100% safe.', vars: [['100 Diamonds', 15000], ['310 Diamonds', 45000], ['520 Diamonds', 75000], ['1060 Diamonds', 150000]] },
  { name: 'Roblox Robux', cat: 'roblox', img: '/img/roblox.webp', tags: 'roblox,robux', desc: 'Robux for Roblox. Delivered fast to your account.', vars: [['80 Robux', 20000], ['400 Robux', 95000], ['800 Robux', 185000]] },
  { name: 'Steam Wallet IDR', cat: 'steam', img: '/img/steam.webp', tags: 'steam,wallet,pc', desc: 'Steam Wallet code IDR denomination. Redeem instantly.', vars: [['IDR 60.000', 68000], ['IDR 120.000', 134000], ['IDR 250.000', 278000]] },
];

const insP = db.prepare('INSERT INTO products (name,description,price,image_url,category,tags,stock) VALUES (?,?,?,?,?,?,?)');
const insV = db.prepare('INSERT INTO product_variants (product_id,label,price,stock,sort_order) VALUES (?,?,?,?,?)');
const insImg = db.prepare('INSERT INTO product_images (product_id,path,sort_order) VALUES (?,?,?)');
for (const p of PRODUCTS) {
  const minPrice = Math.min(...p.vars.map((v) => v[1]));
  const info = insP.run(p.name, p.desc, minPrice, p.img, p.cat, p.tags, 999);
  const pid = info.lastInsertRowid;
  p.vars.forEach((v, i) => insV.run(pid, v[0], v[1], 999, i));
  insImg.run(pid, p.img, 0);
}
console.log('products:', PRODUCTS.length);

// banner hero
db.prepare('DELETE FROM banners').run();
db.prepare("INSERT INTO banners (image_url,link_url,sort_order,active) VALUES (?,?,0,1)")
  .run('/img/hero.webp', '#/games');
console.log('banner ok');

// voucher promo
db.prepare("INSERT OR REPLACE INTO vouchers (code,kind,value,min_total,max_uses,used_count,active) VALUES ('BONUS10','percent',10,50000,100,0,1)").run();
console.log('voucher BONUS10 ok');

// settings
const set = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
set.run('store_name', 'PlayTopUp Store');
set.run('announcement', '🎉 Grand Opening: 10% BONUS for your first top-up with code BONUS10!');
set.run('announcement_on', '1');
console.log('settings ok');
console.log('SEED DONE');
