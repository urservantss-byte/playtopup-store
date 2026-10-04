/* ===== PlayTopUp Store — DESKTOP views (khusus desktop, terpisah dari mobile) ===== */

function dActiveKey() {
  const h = location.hash || '#/';
  if (/^#\/games|^#\/game\//.test(h)) return 'games';
  if (/^#\/orders|^#\/order\//.test(h)) return 'orders';
  if (/^#\/wallet/.test(h)) return 'wallet';
  if (/^#\/track/.test(h)) return 'track';
  return 'home';
}

function dHeader() {
  const u = store.user;
  const ak = dActiveKey();
  const nav = [
    ['home', 'Home', '#/'], ['games', 'Games', '#/games'],
    ['track', 'Lacak Pesanan', '#/track'], ['wallet', 'Wallet', '#/wallet'],
  ];
  const initial = u ? u.name.trim()[0].toUpperCase() : '?';
  return `
  <header class="d-header"><div class="d-header-inner">
    <a class="d-logo" href="#/">
      <span class="logo-badge">🎮</span>
      <span class="logo-text"><b>PLAYTOPUP</b><span>STORE</span></span>
    </a>
    <div class="d-search"><span style="font-size:17px">🔍</span>
      <input id="d-q" placeholder="Cari diamond, UC, Robux, voucher…" onkeydown="if(event.key==='Enter')dSearchGo()">
    </div>
    <nav class="d-nav">${nav.map(([k, lb, h]) => `<a href="${h}" class="${k === ak ? 'active' : ''}">${lb}</a>`).join('')}</nav>
    <button class="d-hbtn" onclick="go('#/cart')" title="Keranjang">🛒${store.cartCount() ? `<span class="badge">${store.cartCount()}</span>` : ''}</button>
    ${u ? `<button class="d-hbtn" onclick="go('#/notif')" title="Notifikasi">🔔${window._unread ? `<span class="badge">${window._unread > 9 ? '9+' : window._unread}</span>` : ''}</button>` : ''}
    <button class="d-hbtn" onclick="toggleTheme()" title="Mode terang/gelap">${themeIcon()}</button>
    ${u ? `
    <div class="d-userwrap">
      <button class="d-avatar" onclick="toggleDMenu(event)">${esc(initial)}</button>
      <div class="d-dropdown" id="d-dropdown" style="display:none">
        <div class="dd-head"><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>
        <a onclick="go('#/profile')">👤 Profil Saya</a>
        <a onclick="go('#/orders')">📦 Pesananku</a>
        <a onclick="go('#/wishlist')">❤️ Wishlist</a>
        <a onclick="go('#/wallet')">💰 Wallet Saya</a>
        <a onclick="go('#/tickets')">🎫 Bantuan / Tiket</a>
        ${u.role === 'admin' ? `<a onclick="go('#/admin')">🛠️ Admin Panel</a>` : ''}
        <a class="danger" onclick="store.logout()">🚪 Keluar</a>
      </div>
    </div>` : `<button class="btn sm purple" style="padding:12px 26px" onclick="go('#/auth')">Masuk</button>`}
  </div></header>`;
}

function refreshDChrome() {
  const hdr = document.querySelector('.d-header');
  if (hdr) hdr.outerHTML = dHeader();
}
function toggleDMenu(e) {
  e.stopPropagation();
  const dd = document.getElementById('d-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', () => {
  const dd = document.getElementById('d-dropdown');
  if (dd) dd.style.display = 'none';
});
function dSearchGo() {
  const q = document.getElementById('d-q').value.trim();
  if (q) go('#/search/' + encodeURIComponent(q));
}

function dFooter() {
  return `
  <footer class="d-footer"><div class="d-footer-inner">
    <div class="d-brand">
      <a class="d-logo" href="#/" style="margin-bottom:6px"><span class="logo-badge">🎮</span>
        <span class="logo-text"><b style="color:#fff">PLAYTOPUP</b><span style="color:#fff">STORE</span></span></a>
      <p>Top up game favoritmu secara instan, aman, dan terpercaya. Pembayaran QRIS & transfer bank, support 24/7.</p>
      ${payStripHTML()}
    </div>
    <div><h4>Belanja</h4>
      <a onclick="go('#/games')">Semua Game</a><a onclick="go('#/track')">Lacak Pesanan</a><a onclick="go('#/wishlist')">Wishlist</a>
    </div>
    <div><h4>Akun</h4>
      <a onclick="go('#/profile')">Profil</a><a onclick="go('#/orders')">Pesanan</a><a onclick="go('#/wallet')">Wallet</a><a onclick="go('#/tickets')">Bantuan</a>
    </div>
    <div><h4>Bantuan</h4>
      <a onclick="go('#/tickets')">Hubungi CS</a><a onclick="go('#/track')">Lacak Tanpa Login</a><a onclick="go('#/faq')">FAQ</a>
    </div>
  </div><div class="d-footer-bottom">© 2026 PlayTopUp Store — Instant • Safe • 24/7</div></footer>`;
}

/* ---------- HOME desktop ---------- */
let dBannerIdx = 0, dBannerTimer = null;
async function dHome(el) {
  el.innerHTML = `
    <div class="d-hero" style="margin-top:26px"><div class="skel" style="aspect-ratio:16/5.2;border-radius:26px"></div></div>
    <div class="d-sec"><div class="d-sec-head"><h2><span class="dot"></span>Kategori Game</h2><a href="#/games">Lihat Semua ›</a></div>
      <div class="d-catrow" id="d-cats">${'<div class="skel" style="height:130px"></div>'.repeat(6)}</div></div>
    <div class="d-sec"><div class="d-sec-head"><h2><span class="dot"></span>Popular Top-Ups</h2><a href="#/games">Lihat Semua ›</a></div>
      <div class="d-pgrid" id="d-pop">${'<div class="skel" style="height:300px"></div>'.repeat(5)}</div></div>
    <div id="d-flash-slot"></div>
    ${(() => { const r = getRecent(); return r.length ? `<div class="d-sec"><div class="d-sec-head"><h2><span class="dot"></span>🕐 Terakhir Dilihat</h2></div><div class="d-pgrid">${r.slice(0, 5).map((p) => productCard(p)).join('')}</div></div>` : ''; })()}
    <div class="d-sec"><div class="card" style="display:flex;align-items:center;gap:18px;background:linear-gradient(120deg,#6d28d9,#8b5cf6);color:#fff;border:none">
      <div style="font-size:44px">🎟️</div>
      <div class="grow"><div style="font-weight:900;font-size:19px">Kode voucher: BONUS10</div>
      <div style="opacity:.9;font-size:14px">Diskon 10% untuk belanja minimal Rp50.000 — otomatis di checkout.</div></div>
      <button class="btn" style="background:var(--card2);color:var(--ink)" onclick="go('#/games')">Belanja →</button>
    </div></div>`;

  /* Ketiga API dipanggil paralel agar halaman desktop lebih cepat tampil */
  const [bRes, sRes, pRes] = await Promise.allSettled([
    api.get('/api/banners'),
    api.get('/api/settings/public'),
    api.get('/api/products?limit=60'),
  ]);

  // banners
  const hero = el.querySelector('.d-hero');
  if (bRes.status === 'fulfilled' && hero) {
    const banners = (bRes.value.banners || []).filter((x) => x.image_url);
    if (banners.length) {
      if (dBannerTimer) clearInterval(dBannerTimer);
      dBannerIdx = 0;
      hero.innerHTML = `
        <div class="d-hero-track" id="d-hero-track">${banners.map((x) => `
          <div class="d-hero-slide"><img src="${esc(imgUrl(x.image_url))}" alt="Promo" loading="lazy" decoding="async"></div>`).join('')}</div>
        ${banners.length > 1 ? `
        <button class="d-hero-arrow prev" onclick="dBannerMove(-1)">‹</button>
        <button class="d-hero-arrow next" onclick="dBannerMove(1)">›</button>
        <div class="d-hero-dots" id="d-hero-dots">${banners.map((_, i) => `<button class="${i === 0 ? 'on' : ''}" onclick="dBannerGo(${i})"></button>`).join('')}</div>` : ''}`;
      window._dBanners = banners;
      if (banners.length > 1) dBannerTimer = setInterval(() => dBannerMove(1), 5000);
    } else {
      hero.outerHTML = `
      <div class="d-hero-fallback" style="margin-top:26px">
        <div><h1>Top Up Like<br>Never Before.</h1>
        <p>⚡ Instant delivery • 🛡️ 100% Safe • 🕐 24/7 Support</p>
        <button class="btn" style="background:var(--card2);color:var(--ink);padding:14px 34px;font-size:16px" onclick="go('#/games')">Top Up Sekarang →</button></div>
        <img src="/img/hero.webp?v=2" alt="PlayTopUp mascots" fetchpriority="high" decoding="async">
      </div>`;
    }
  }

  // categories
  const catBox = document.getElementById('d-cats');
  if (catBox) {
    if (sRes.status === 'fulfilled') {
      cachePayMethods(sRes.value);
      const cats = sRes.value.categories || [];
      const imgs = { ml: '/img/ml.webp', genshin: '/img/genshin.webp', pubg: '/img/pubg.webp', ff: '/img/ff.webp', roblox: '/img/roblox.webp', steam: '/img/steam.webp' };
      catBox.innerHTML = cats.map((c) => `
      <div class="d-cat" onclick="go('#/game/${esc(c.id)}')">
        <div class="imgph" style="border-radius:18px"><img src="${imgUrl(imgs[c.id] || '/img/steam.webp')}" alt="${esc(c.label)}" loading="lazy" decoding="async" onload="imgLd(this)" style="width:74px;height:74px;object-fit:cover;border-radius:18px;margin-bottom:10px"></div>
        <b>${esc(c.icon || '')} ${esc(c.label)}</b>
      </div>`).join('') || `<div class="d-empty">Belum ada kategori.</div>`;
    } else catBox.innerHTML = '';
  }

  // popular products
  const popBox = document.getElementById('d-pop');
  if (popBox) {
    if (pRes.status === 'fulfilled') {
      const items = (pRes.value.products || []).sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 10);
      popBox.innerHTML = items.length ? items.map(productCard).join('')
        : `<div class="d-empty" style="grid-column:1/-1"><div class="big">🎮</div>Belum ada produk.</div>`;
      if (sRes.status === 'fulfilled') renderFlashSale('d-flash-slot', pRes.value.products, sRes.value.flash_sale_ends, true);
    } else {
      popBox.innerHTML = `<div class="d-empty" style="grid-column:1/-1">Gagal memuat produk.</div>`;
    }
  }
}
function dBannerMove(dir) {
  const n = (window._dBanners || []).length;
  if (!n) return;
  dBannerIdx = (dBannerIdx + dir + n) % n;
  dBannerGo(dBannerIdx);
}
function dBannerGo(i) {
  dBannerIdx = i;
  const track = document.getElementById('d-hero-track');
  if (track) track.style.transform = `translateX(-${i * 100}%)`;
  document.querySelectorAll('#d-hero-dots button').forEach((b, j) => b.classList.toggle('on', j === i));
}

/* ---------- GAMES / GAME / SEARCH desktop ---------- */
const D_CAT_IMGS = { ml: '/img/ml.webp', genshin: '/img/genshin.webp', pubg: '/img/pubg.webp', ff: '/img/ff.webp', roblox: '/img/roblox.webp', steam: '/img/steam.webp' };

async function dGames(el) {
  el.innerHTML = `<div class="d-sec"><div class="d-sec-head"><h2><span class="dot"></span>Semua Game</h2></div>
    <div class="d-catrow" id="d-games">${'<div class="skel" style="height:150px"></div>'.repeat(6)}</div></div>`;
  try {
    const s = await api.get('/api/settings/public');
    cachePayMethods(s);
    const cats = s.categories || [];
    document.getElementById('d-games').innerHTML = cats.map((c) => `
      <div class="d-cat" onclick="go('#/game/${esc(c.id)}')">
        <div class="imgph" style="border-radius:18px"><img src="${imgUrl(D_CAT_IMGS[c.id] || '/img/steam.webp')}" alt="${esc(c.label)}" loading="lazy" decoding="async" onload="imgLd(this)" style="width:88px;height:88px;object-fit:cover;border-radius:18px;margin-bottom:10px"></div>
        <b style="font-size:15px">${esc(c.icon || '')} ${esc(c.label)}</b>
        <div class="muted" style="font-size:12.5px;font-weight:700;margin-top:4px">Top up instan</div>
      </div>`).join('') || `<div class="d-empty">Belum ada game.</div>`;
  } catch { document.getElementById('d-games').innerHTML = `<div class="d-empty">Gagal memuat.</div>`; }
}

async function dGame(el, id) {
  window._dgSort = 'populer'; window._dgItems = [];
  el.innerHTML = `
    <div class="d-crumb" style="margin-top:26px"><a href="#/">Home</a> › <a href="#/games">Games</a> › <b id="d-gt">…</b></div>
    <div class="d-sec" style="margin-top:0"><div id="dg-sort">${sortChips('populer', 'dgSort')}</div>
    <div class="d-pgrid" id="d-ggrid">${'<div class="skel" style="height:300px"></div>'.repeat(5)}</div></div>`;
  try {
    const s = await api.get('/api/settings/public');
    cachePayMethods(s);
    const cat = (s.categories || []).find((c) => c.id === id);
    const t = document.getElementById('d-gt');
    if (t) t.textContent = cat ? `${cat.icon || ''} ${cat.label}` : 'Produk';
    const d = await api.get('/api/products?category=' + encodeURIComponent(id) + '&limit=60');
    window._dgItems = d.products || [];
    renderDGGrid();
  } catch {
    const g = document.getElementById('d-ggrid');
    if (g) g.innerHTML = `<div class="d-empty" style="grid-column:1/-1">Gagal memuat.</div>`;
  }
}
function dgSort(s) {
  window._dgSort = s;
  const el = document.getElementById('dg-sort');
  if (el) el.innerHTML = sortChips(s, 'dgSort');
  renderDGGrid();
}
function renderDGGrid() {
  const grid = document.getElementById('d-ggrid');
  if (!grid) return;
  const items = applySort(window._dgItems, window._dgSort);
  grid.innerHTML = items.length ? items.map(productCard).join('')
    : `<div class="d-empty" style="grid-column:1/-1"><div class="big">🎮</div>Belum ada produk di kategori ini.</div>`;
}

async function dSearch(el, q) {
  window._dsSort = 'populer'; window._dsItems = []; window._dsQ = q;
  el.innerHTML = `
    <div class="d-crumb" style="margin-top:26px"><a href="#/">Home</a> › <b>Hasil pencarian</b></div>
    <div class="d-sec" style="margin-top:0"><div class="d-sec-head"><h2>🔍 "${esc(q)}"</h2></div>
    <div id="ds-sort">${sortChips('populer', 'dsSort')}</div>
    <div class="d-pgrid" id="d-sgrid">${'<div class="skel" style="height:300px"></div>'.repeat(5)}</div></div>`;
  try {
    const d = await api.get('/api/products?q=' + encodeURIComponent(q) + '&limit=40');
    window._dsItems = d.products || [];
    renderDSGrid();
  } catch {
    const g = document.getElementById('d-sgrid');
    if (g) g.innerHTML = `<div class="d-empty" style="grid-column:1/-1">Pencarian gagal.</div>`;
  }
}
function dsSort(s) {
  window._dsSort = s;
  const el = document.getElementById('ds-sort');
  if (el) el.innerHTML = sortChips(s, 'dsSort');
  renderDSGrid();
}
function renderDSGrid() {
  const grid = document.getElementById('d-sgrid');
  if (!grid) return;
  const items = applySort(window._dsItems, window._dsSort);
  grid.innerHTML = items.length ? items.map(productCard).join('')
    : `<div class="d-empty" style="grid-column:1/-1"><div class="big">🔍</div>Tidak ada hasil untuk "${esc(window._dsQ || '')}".</div>`;
}

/* ---------- PRODUCT DETAIL desktop ---------- */
async function dProduct(el, id) {
  el.innerHTML = `<div class="d-pgrid" style="margin-top:26px">${'<div class="skel" style="height:300px"></div>'.repeat(5)}</div>`;
  let d;
  try { d = await api.get('/api/products/' + id); }
  catch { el.innerHTML = `<div class="d-empty"><div class="big">😕</div>Produk tidak ditemukan.<br><br><button class="btn ghost" onclick="history.back()">Kembali</button></div>`; return; }
  const p = d.product, vars = p.variants || [], imgs = d.images || [];
  saveRecent(p);
  const mainImg = (imgs[0] && imgs[0].url) || p.image_url || '';
  const disc = Number(p.discount) || 0;

  el.innerHTML = `
    <div class="d-crumb" style="margin-top:26px"><a href="#/">Home</a> › <a href="#/games">Games</a> › <b>${esc(p.name)}</b></div>
    <div class="d-pd">
      <div class="d-pd-gallery">
        <div class="detail-img imgph" style="border-radius:24px">${mainImg ? `<img src="${esc(imgUrl(mainImg))}" alt="${esc(p.name)}" decoding="async" onload="imgLd(this)">` : `<div style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;font-size:72px;background:var(--card-solid);border-radius:24px">🎮</div>`}</div>
      </div>
      <div class="d-pd-info">
        <div class="muted" style="font-weight:800;font-size:13.5px;letter-spacing:.4px;text-transform:uppercase">${esc(p.category || '')}</div>
        <h1>${esc(p.name)} ${store.user ? `<button class="icon-btn ghost" style="vertical-align:middle" onclick="dToggleWish(${p.id},this)">${window._wishlist && window._wishlist.has(p.id) ? '❤️' : '🤍'}</button>` : ''}</h1>
        <div>${stars(p.avg_rating, p.review_count)}</div>
        ${disc ? `<div style="margin-top:10px"><span class="chip" style="background:#fee2e2;color:#b91c1c">-${Math.round(disc)}% OFF</span> <s class="muted">${rp(p.price)}</s></div>` : ''}
        <div class="d-pd-price" id="d-pd-price">${rp(effPrice(p))}</div>
        ${vars.length ? `<div style="font-weight:900;margin:6px 0 2px">Pilih Denominasi</div>
        <div class="d-variant-grid" id="d-var-list">${vars.map((v, i) => `
          <div class="var-item ${i === 0 ? 'sel' : ''}" data-vid="${v.id}" data-price="${v.price}" data-label="${esc(v.label)}" onclick="dSelVar(this)">
            <span>${esc(v.label)}</span><span class="vp">${rp(v.price)}</span></div>`).join('')}</div>` : ''}
        ${p.stock <= 0 && !vars.length ? `<div class="chip" style="background:#fee2e2;color:#b91c1c">Stok habis</div>` : `<div class="muted" style="font-size:13.5px;font-weight:700">Stok: ${p.stock}</div>`}
        <div style="font-weight:900;margin:18px 0 6px">Jumlah</div>
        <div class="d-qty" style="width:max-content"><button onclick="dChQtyDetail(-1)">−</button><b id="d-qty">1</b><button onclick="dChQtyDetail(1)">+</button></div>
        <div class="d-buyrow">
          <button class="btn ghost" onclick="dAddDetailToCart()">🛒 Keranjang</button>
          <button class="btn" onclick="dBuyNow()">BELI SEKARANG</button>
        </div>
        <div class="card" style="margin-top:6px"><div style="font-weight:900;margin-bottom:8px">Deskripsi</div>
          <div style="font-size:14.5px;line-height:1.7;color:var(--ink)">${esc(p.description || 'Top up instan. Aman & cepat, 24/7.')}</div></div>
      </div>
    </div>
    <div class="d-sec"><div class="card"><div class="d-sec-head" style="margin:0 0 10px"><h2 style="font-size:18px">Ulasan</h2></div>
      <div id="d-rev-list"><div class="skel" style="height:70px"></div></div></div></div>
    <div class="d-sec" id="d-rel-slot"></div>`;

  window._dpd = { p, vars, selVar: vars[0] || null, qty: 1 };
  try {
    const r = await api.get(`/api/products/${id}/reviews`);
    const list = r.reviews || [];
    document.getElementById('d-rev-list').innerHTML = list.length ? list.map((x) => `
      <div class="ticket-msg"><div class="who">${esc(x.user_name || 'User')} • ${stars(x.rating)}</div><div style="font-size:14px">${esc(x.comment || '')}</div></div>`).join('')
      : `<div class="muted" style="font-size:13.5px">Belum ada ulasan.</div>`;
  } catch { document.getElementById('d-rev-list').innerHTML = ''; }
  loadDRelated(p);
}
async function loadDRelated(p) {
  const slot = document.getElementById('d-rel-slot');
  if (!slot || !p.category) return;
  try {
    const d = await api.get('/api/products?category=' + encodeURIComponent(p.category) + '&limit=12');
    const items = (d.products || []).filter((x) => x.id !== p.id).slice(0, 5);
    if (!items.length) return;
    slot.innerHTML = `<div class="d-sec-head"><h2><span class="dot"></span>🎮 Produk Terkait</h2><a href="#/game/${esc(p.category)}">Lihat Semua ›</a></div>
      <div class="d-pgrid">${items.map(productCard).join('')}</div>`;
  } catch {}
}
function dSelVar(elm) {
  document.querySelectorAll('#d-var-list .var-item').forEach((x) => x.classList.remove('sel'));
  elm.classList.add('sel');
  const vid = +elm.dataset.vid;
  window._dpd.selVar = window._dpd.vars.find((v) => v.id === vid) || null;
  dUpdDetailPrice();
}
function dChQtyDetail(dd) {
  window._dpd.qty = Math.max(1, (window._dpd.qty || 1) + dd);
  document.getElementById('d-qty').textContent = window._dpd.qty;
  dUpdDetailPrice();
}
function dUpdDetailPrice() {
  const { selVar, p, qty } = window._dpd;
  const price = selVar ? selVar.price : effPrice(p);
  document.getElementById('d-pd-price').textContent = rp(price * qty);
}
function dDetailSelection() {
  const { p, vars, selVar, qty } = window._dpd;
  if (vars.length && !selVar) { toast('Pilih denominasi dulu', false); return null; }
  return {
    product_id: p.id, variant_id: selVar ? selVar.id : null, name: p.name,
    variant_label: selVar ? selVar.label : '', price: selVar ? selVar.price : effPrice(p),
    image_url: p.image_url, category: p.category || '', qty: qty || 1,
  };
}
function dAddDetailToCart() {
  const s = dDetailSelection(); if (!s) return;
  store.addToCart(s);
  toast('Ditambahkan ke keranjang', true);
  refreshDChrome();
}
function dBuyNow() {
  const s = dDetailSelection(); if (!s) return;
  if (!store.user) { sessionStorage.setItem('ptu_after_login', location.hash); go('#/auth'); toast('Login dulu untuk checkout'); return; }
  store.addToCart(s);
  go('#/checkout');
}
async function dToggleWish(pid, btn) {
  if (!store.user) { go('#/auth'); return; }
  try {
    if (window._wishlist && window._wishlist.has(pid)) {
      await api.del('/api/wishlist/' + pid); window._wishlist.delete(pid); btn.textContent = '🤍';
    } else {
      await api.post('/api/wishlist/' + pid); window._wishlist.add(pid); btn.textContent = '❤️';
    }
  } catch (e) { toast(e.message, false); }
}

/* ---------- CART desktop ---------- */
function dCart(el) {
  const cart = store.cart;
  if (!cart.length) {
    el.innerHTML = `<div class="d-empty"><div class="big">🛒</div><h3>Keranjang kosong</h3><p class="muted">Top up game favoritmu sekarang!</p><br><button class="btn" onclick="go('#/games')">Jelajahi Game</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="d-crumb" style="margin-top:26px"><a href="#/">Home</a> › <b>Keranjang (${store.cartCount()})</b></div>
    <div class="d-cols">
      <div class="card" style="padding:6px 20px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
          <b style="font-size:17px">Item Keranjang</b>
          <button class="chip" onclick="store.clearCart();refreshDChrome();dCart(document.getElementById('d-view'))">Kosongkan</button>
        </div>
        ${cart.map((it, i) => `
        <div class="d-cart-item" style="padding:14px 0;border-top:1px solid var(--line)">
          ${it.image_url ? `<div class="imgph" style="border-radius:16px"><img src="${esc(imgUrl(it.image_url))}" alt="" loading="lazy" decoding="async" onload="imgLd(this)" style="width:96px;height:96px;border-radius:16px;object-fit:cover"></div>`
            : `<div style="width:96px;height:96px;border-radius:16px;background:var(--purple-soft);display:flex;align-items:center;justify-content:center;font-size:38px;flex:none">🎮</div>`}
          <div class="grow"><div style="font-weight:900;font-size:15.5px">${esc(it.name)}</div>
            ${it.variant_label ? `<div class="muted" style="font-size:13px;font-weight:700">${esc(it.variant_label)}</div>` : ''}
            <div class="price" style="font-size:16px;margin-top:4px">${rp(it.price)}</div></div>
          <div class="d-qty"><button onclick="dChQty(${i},-1)">−</button><b>${it.qty}</b><button onclick="dChQty(${i},1)">+</button></div>
          <button class="icon-btn ghost" onclick="dRmItem(${i})" title="Hapus">🗑️</button>
        </div>`).join('')}
      </div>
      <div class="card d-summary">
        <div style="font-weight:900;font-size:17px;margin-bottom:12px">Ringkasan</div>
        <div class="row"><span class="muted grow" style="font-weight:700">Subtotal</span><b>${rp(store.cartTotal())}</b></div>
        <div class="divider"></div>
        <div class="row" style="margin-bottom:14px"><span class="grow" style="font-weight:900">Total</span><span class="price" style="font-size:24px">${rp(store.cartTotal())}</span></div>
        <button class="btn block" onclick="goCheckout()">Checkout →</button>
        <button class="btn ghost block" style="margin-top:10px" onclick="go('#/games')">+ Tambah Belanja</button>
      </div>
    </div>`;
}
function dChQty(i, dd) {
  store.setQty(i, (store.cart[i].qty || 1) + dd);
  refreshDChrome();
  dCart(document.getElementById('d-view'));
}
function dRmItem(i) {
  store.cart.splice(i, 1); store.saveCart();
  refreshDChrome();
  dCart(document.getElementById('d-view'));
}

/* ---------- CHECKOUT desktop ---------- */
async function dCheckout(el) {
  if (!store.cart.length) { go('#/cart'); return; }
  el.innerHTML = `<div class="d-crumb" style="margin-top:26px"><a href="#/">Home</a> › <a href="#/cart">Keranjang</a> › <b>Checkout</b></div>
    <div class="d-cols"><div class="skel" style="height:300px"></div><div class="skel" style="height:300px"></div></div>`;
  let pub;
  try { pub = await api.get('/api/settings/public'); cachePayMethods(pub); }
  catch { el.innerHTML = `<div class="d-empty"><div class="big">😕</div>Gagal memuat metode pembayaran.</div>`; return; }
  const methods = pub.pay_methods || [];
  window._dco = { method: methods[0] ? methods[0].id : '', voucher: '', discount: 0 };

  el.innerHTML = `
    <div class="d-crumb" style="margin-top:26px"><a href="#/">Home</a> › <a href="#/cart">Keranjang</a> › <b>Checkout</b></div>
    <div class="d-cols">
      <div>
        <div class="card" style="margin-bottom:18px">
          <div style="font-weight:900;font-size:17px;margin-bottom:12px">🎟️ Voucher</div>
          <div class="row"><input id="dco-vin" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:12px 14px;font-family:inherit;font-weight:700" placeholder="Kode voucher (mis. BONUS10)">
          <button class="btn sm purple" onclick="dApplyVoucher()">Pakai</button></div>
        </div>
        <div class="card" style="margin-bottom:18px">
          <div style="font-weight:900;font-size:17px;margin-bottom:4px">🎮 Data Game</div>
          <div class="muted" style="font-size:13px;font-weight:600;margin-bottom:12px">Diamond/UC akan dikirim ke ID ini. Pastikan benar!</div>
          ${store.cart.map((it, i) => `
          <div class="field" style="margin-bottom:10px"><label>${gidLabel(it)} — ${esc(it.name)}${it.variant_label ? ` (${esc(it.variant_label)})` : ''}${needGid(it) ? ' *' : ''}</label>
          <input data-gid="${i}" value="${esc(it.game_id || '')}" oninput="setGid(${i},this.value)" placeholder="${needGid(it) ? 'Contoh: 12345678 (cek di profil game)' : 'Email untuk terima kode voucher'}"></div>`).join('')}
        </div>
        <div class="card">
          <div style="font-weight:900;font-size:17px;margin-bottom:12px">💳 Metode Pembayaran</div>
          <div class="d-paygrid" id="d-pay-list">${methods.map((m, i) => `
            <div class="pay-method ${i === 0 ? 'sel' : ''}" onclick="dSelPay('${esc(m.id)}',this)">
              <div style="font-size:26px">${m.kind === 'qris' ? '⚡' : '🏦'}</div>
              <div><div class="pl">${esc(m.label)}</div><div class="pd">${esc(m.desc || '')}</div></div>
            </div>`).join('') || '<div class="muted">Tidak ada metode pembayaran.</div>'}</div>
        </div>
      </div>
      <div class="card d-summary">
        <div style="font-weight:900;font-size:17px;margin-bottom:12px">Ringkasan Pesanan</div>
        ${store.cart.map((it) => `<div class="row" style="margin-bottom:8px"><span class="grow" style="font-size:14px;font-weight:700">${esc(it.name)}${it.variant_label ? ` <span class="muted">(${esc(it.variant_label)})</span>` : ''} × ${it.qty}</span><b>${rp(it.price * it.qty)}</b></div>`).join('')}
        <div class="divider"></div>
        <div class="row"><span class="grow" style="font-weight:700">Subtotal</span><b id="dco-sub">${rp(store.cartTotal())}</b></div>
        <div class="row" id="dco-disc-row" style="display:none"><span class="grow" style="font-weight:700;color:var(--green)">Voucher <span id="dco-vcode"></span></span><b id="dco-disc" style="color:var(--green)"></b></div>
        <div class="row" style="margin:10px 0 16px"><span class="grow" style="font-weight:900">Total</span><span class="price" style="font-size:24px" id="dco-total">${rp(store.cartTotal())}</span></div>
        <button class="btn block" id="dco-btn" onclick="dPlaceOrder()">Buat Pesanan →</button>
      </div>
    </div>`;
}
function dSelPay(id, elm) {
  window._dco.method = id;
  document.querySelectorAll('#d-pay-list .pay-method').forEach((x) => x.classList.remove('sel'));
  elm.classList.add('sel');
}
async function dApplyVoucher() {
  const code = document.getElementById('dco-vin').value.trim();
  if (!code) return;
  try {
    const d = await api.post('/api/vouchers/validate', { code, total: store.cartTotal() });
    window._dco.voucher = code;
    window._dco.discount = d.discount || 0;
    const sub = store.cartTotal();
    const disc = Math.min(window._dco.discount, sub);
    document.getElementById('dco-disc-row').style.display = 'flex';
    document.getElementById('dco-vcode').textContent = '(' + code + ')';
    document.getElementById('dco-disc').textContent = '−' + rp(disc);
    document.getElementById('dco-total').textContent = rp(sub - disc);
    toast('Voucher dipakai: ' + code, true);
  } catch (e) { toast(e.message, false); }
}
async function dPlaceOrder() {
  const btn = document.getElementById('dco-btn');
  const missing = store.cart.findIndex((it) => needGid(it) && !String(it.game_id || '').trim());
  if (missing >= 0) {
    toast('Isi ID Game untuk "' + store.cart[missing].name + '" dulu', false);
    const inp = document.querySelector(`[data-gid="${missing}"]`);
    if (inp) { inp.focus(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return;
  }
  btn.disabled = true; btn.textContent = 'Memproses…';
  try {
    const d = await api.post('/api/orders', {
      items: store.cart.map((it) => ({ product_id: it.product_id, variant_id: it.variant_id || null, qty: it.qty, game_id: String(it.game_id || '').trim() })),
      payment_method: window._dco.method,
      voucher_code: window._dco.voucher || undefined,
    });
    store.clearCart();
    refreshUnread().then(() => renderChrome()).catch(() => {});
    go('#/pay/' + d.order.id);
  } catch (e) { toast(e.message, false); btn.disabled = false; btn.textContent = 'Buat Pesanan →'; }
}

/* ---------- router desktop ---------- */
async function renderDesktop() {
  if (dBannerTimer) { clearInterval(dBannerTimer); dBannerTimer = null; }
  const h = location.hash || '#/';
  const app = document.getElementById('app');
  app.innerHTML = `${dHeader()}<main class="d-page"><div class="d-container"><div id="d-view"></div></div></main>${dFooter()}`;
  const el = document.getElementById('d-view');
  let m;
  window.scrollTo(0, 0);
  if (h === '#/' || h === '#') return dHome(el);
  if (h === '#/games') return dGames(el);
  if ((m = h.match(/^#\/game\/([\w-]+)$/))) return dGame(el, m[1]);
  if ((m = h.match(/^#\/product\/(\d+)$/))) return dProduct(el, m[1]);
  if ((m = h.match(/^#\/search\/(.+)$/))) return dSearch(el, decodeURIComponent(m[1]));
  if (h === '#/cart') return dCart(el);
  if (h === '#/checkout') return dCheckout(el);
  // halaman lain: pakai view yang sama, dibungkus layout desktop
  el.innerHTML = `<div class="d-secondary"><div id="view"></div></div>`;
  routeMobile(h);
}
