/* ===== PlayTopUp Store — UI helpers ===== */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function rp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}
/* Cache-buster gambar statis bawaan: paksa browser ambil ulang versi baru,
   agar gambar yang pernah ke-cache dalam keadaan rusak tidak terus dipakai. */
const IMG_V = '2';
function imgUrl(u) {
  if (!u || typeof u !== 'string') return u;
  return u.startsWith('/img/') ? u + '?v=' + IMG_V : u;
}
function toast(msg, ok) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (ok === true ? ' ok' : ok === false ? ' err' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2600);
}
function stars(rating, count) {
  const r = Number(rating) || 0;
  const full = Math.round(r);
  let s = '';
  for (let i = 0; i < 5; i++) s += i < full ? '★' : '☆';
  return `<span class="stars">${s} <small>${r.toFixed(1)}${count != null ? ` (${count})` : ''}</small></span>`;
}
function fmtCount(n) {
  n = Number(n) || 0;
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k';
  return String(n);
}
function statusPill(st) {
  const map = {
    pending: 'Menunggu', proses: 'Diproses', delivery: 'Dikirim',
    selesai: 'Selesai', dibatalkan: 'Dibatalkan',
  };
  return `<span class="status-pill st-${esc(st)}">${esc(map[st] || st)}</span>`;
}
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-veil" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.body.style.overflow = '';
}
function confirmModal(title, message, onYes, yesLabel) {
  openModal(`
    <h3 style="margin-top:0">${esc(title)}</h3>
    <p style="font-size:14px;font-weight:600;color:var(--muted)">${esc(message)}</p>
    <div class="row" style="margin-top:16px">
      <button class="btn line grow" onclick="closeModal()">Cancel</button>
      <button class="btn grow" id="cf-yes" style="background:#dc2626;box-shadow:0 8px 20px rgba(220,38,38,.3)">${esc(yesLabel || 'Yes, delete')}</button>
    </div>`);
  document.getElementById('cf-yes').onclick = () => { closeModal(); onYes(); };
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function imgLd(el) {
  el.classList.add('ld');
  const w = el.closest('.imgph');
  if (w) w.classList.add('done');
}
function badgesInner(p) {
  const disc = Number(p.discount) || 0;
  let b = '';
  if (disc > 0) b += `<span class="pbadge sale">-${Math.round(disc)}%</span>`;
  if ((p.sold_count || 0) >= 10) b += `<span class="pbadge hot">🔥 Terlaris</span>`;
  return b;
}
function badgeHTML(p) {
  const b = badgesInner(p);
  return b ? `<div class="pbadges">${b}</div>` : '';
}
function productCard(p) {
  const img = p.image_url ? `<img src="${esc(imgUrl(p.image_url))}" alt="${esc(p.name)}" loading="lazy" decoding="async" onload="imgLd(this)">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px;background:var(--purple-soft)">🎮</div>`;
  const wished = store.user && window._wishlist && window._wishlist.has(p.id);
  return `
  <div class="pcard" onclick="go('#/product/${p.id}')">
    <div class="pimg-wrap"><div class="pimg imgph">${img}</div>
      ${badgeHTML(p)}
      ${store.user ? `<button class="wish-btn" onclick="event.stopPropagation();toggleWish(${p.id},this)" aria-label="wishlist">${wished ? '❤️' : '🤍'}</button>` : ''}
    </div>
    <div class="pbody">
      <div class="pname">${esc(p.name)}</div>
      <div class="pvar">${esc(p.variant_label || p.short || '')}</div>
      <div class="prate">${stars(p.avg_rating, p.sold_count != null ? fmtCount(p.sold_count) + ' sold' : p.review_count)}</div>
      ${Number(p.discount) > 0 ? `<div class="pvar"><s class="muted">${rp(p.price)}</s></div>` : ''}
      <button class="buy" onclick="event.stopPropagation();quickBuy(${p.id})">${rp(effPrice(p))}</button>
    </div>
  </div>`;
}
async function toggleWish(pid, btn) {
  try {
    if (window._wishlist && window._wishlist.has(pid)) {
      await api.del('/api/wishlist/' + pid);
      window._wishlist.delete(pid);
      btn.textContent = '🤍';
      toast('Removed from wishlist');
    } else {
      await api.post('/api/wishlist/' + pid);
      if (!window._wishlist) window._wishlist = new Set();
      window._wishlist.add(pid);
      btn.textContent = '❤️';
      toast('Added to wishlist', true);
    }
  } catch (e) { toast(e.message, false); }
}
async function quickBuy(pid) {
  try {
    const d = await api.get('/api/products/' + pid);
    const p = d.product;
    const vars = p.variants || [];
    if (vars.length) { go('#/product/' + pid); return; } // pilih varian dulu
    store.addToCart({ product_id: p.id, variant_id: null, name: p.name, variant_label: '', price: effPrice(p), image_url: p.image_url, category: p.category || '', qty: 1 });
    toast('Added to cart', true);
  } catch (e) { toast(e.message, false); }
}
function effPrice(p) {
  const d = Number(p.discount) || 0;
  return d > 0 ? Math.round(p.price * (1 - d / 100)) : p.price;
}
/* Debounce: tunda eksekusi sampai jeda input selesai (hindari spam API/render). */
function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 300); };
}
function go(hash) { location.hash = hash; }

/* ---------- theme (dark / light) ---------- */
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}
function themeIcon() { return currentTheme() === 'light' ? '🌙' : '☀️'; }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  try { localStorage.setItem('ptu_theme', t === 'light' ? 'light' : 'dark'); } catch {}
  renderChrome();
}
function toggleTheme() { applyTheme(currentTheme() === 'light' ? 'dark' : 'light'); }

/* ---------- game ID per item (checkout) ---------- */
function needGid(it) { return (it.category || '') !== 'steam'; }
function setGid(i, v) { if (store.cart[i]) { store.cart[i].game_id = v; store.saveCart(); } }
function gidLabel(it) { return needGid(it) ? '🎮 ID Game / User ID' : '📧 Email pengiriman'; }

/* ---------- terakhir dilihat ---------- */
function saveRecent(p) {
  try {
    let r = JSON.parse(localStorage.getItem('ptu_recent') || '[]');
    r = r.filter((x) => x.id !== p.id);
    r.unshift({ id: p.id, name: p.name, image_url: p.image_url, price: effPrice(p) });
    localStorage.setItem('ptu_recent', JSON.stringify(r.slice(0, 8)));
  } catch {}
}
function getRecent() {
  try { return JSON.parse(localStorage.getItem('ptu_recent') || '[]'); } catch { return []; }
}
function recentSection() {
  const r = getRecent();
  if (!r.length) return '';
  return `<div class="sec-head" style="margin-top:6px"><h2>🕐 Terakhir Dilihat</h2></div>
    <div class="hscroll">${r.map((p) => `
      <div class="pcard" style="min-width:150px;max-width:150px;flex:none" onclick="go('#/product/${p.id}')">
        <div class="pimg imgph">${p.image_url ? `<img src="${esc(imgUrl(p.image_url))}" alt="${esc(p.name)}" loading="lazy" decoding="async" onload="imgLd(this)">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px">🎮</div>`}</div>
        <div class="pbody"><div class="pname">${esc(p.name)}</div>
        <button class="buy" onclick="event.stopPropagation();go('#/product/${p.id}')">${rp(p.price)}</button></div>
      </div>`).join('')}</div>`;
}

async function loadWishlist() {
  window._wishlist = new Set();
  if (!store.user) return;
  try {
    const d = await api.get('/api/wishlist');
    (d.items || d.wishlist || []).forEach((w) => window._wishlist.add(w.product_id || w.id));
  } catch { /* abaikan */ }
}

/* ---------- sort & filter produk ---------- */
const SORT_OPTS = [['populer', '🔥 Terlaris'], ['termurah', '💰 Termurah'], ['termahal', '💎 Termahal'], ['terbaru', '✨ Terbaru']];
function sortChips(cur, fnName) {
  return `<div class="hscroll" style="margin-bottom:12px">${SORT_OPTS.map(([k, l]) => `<button class="chip ${k === cur ? 'active' : ''}" onclick="${fnName}('${k}')">${l}</button>`).join('')}</div>`;
}
function applySort(items, sort) {
  const a = [...(items || [])];
  if (sort === 'termurah') a.sort((x, y) => effPrice(x) - effPrice(y));
  else if (sort === 'termahal') a.sort((x, y) => effPrice(y) - effPrice(x));
  else if (sort === 'terbaru') a.sort((x, y) => y.id - x.id);
  else a.sort((x, y) => (y.sold_count || 0) - (x.sold_count || 0));
  return a;
}

/* ---------- flash sale ---------- */
function renderFlashSale(slotId, products, endsAt, desktop) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  const ends = new Date(String(endsAt || '').replace(' ', 'T')).getTime();
  const disc = (products || []).filter((p) => Number(p.discount) > 0).slice(0, desktop ? 5 : 6);
  if (!endsAt || isNaN(ends) || ends <= Date.now() || !disc.length) { slot.innerHTML = ''; return; }
  const cards = desktop
    ? `<div class="d-pgrid">${disc.map(productCard).join('')}</div>`
    : `<div class="hscroll">${disc.map((x) => `
      <div class="pcard" style="min-width:150px;max-width:150px;flex:none" onclick="go('#/product/${x.id}')">
        <div class="pimg-wrap"><div class="pimg imgph">${x.image_url ? `<img src="${esc(imgUrl(x.image_url))}" alt="${esc(x.name)}" loading="lazy" decoding="async" onload="imgLd(this)">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px">🎮</div>`}</div>
        <div class="pbadges">${badgesInner(x)}</div></div>
        <div class="pbody"><div class="pname">${esc(x.name)}</div>
        <div class="pvar"><s class="muted">${rp(x.price)}</s></div>
        <button class="buy" onclick="event.stopPropagation();go('#/product/${x.id}')">${rp(effPrice(x))}</button></div>
      </div>`).join('')}</div>`;
  const head = desktop
    ? `<div class="d-sec-head"><h2><span class="dot"></span>⚡ Flash Sale</h2><span class="flash-timer" id="flash-timer-d"></span></div>`
    : `<div class="sec-head"><div class="flash-head"><h2>⚡ Flash Sale</h2><span class="flash-timer" id="flash-timer-m"></span></div></div>`;
  slot.innerHTML = desktop
    ? `<div class="d-sec">${head}${cards}</div>`
    : `${head}${cards}`;
  startFlashCountdown(ends, desktop ? 'flash-timer-d' : 'flash-timer-m');
}
function startFlashCountdown(ends, elId) {
  if (window._flashTimer) { clearInterval(window._flashTimer); window._flashTimer = null; }
  const tick = () => {
    const el = document.getElementById(elId);
    if (!el) { clearInterval(window._flashTimer); window._flashTimer = null; return; }
    const ms = ends - Date.now();
    if (ms <= 0) { el.textContent = 'Berakhir'; clearInterval(window._flashTimer); window._flashTimer = null; return; }
    const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  tick();
  window._flashTimer = setInterval(tick, 1000);
}
function stopFlashCountdown() {
  if (window._flashTimer) { clearInterval(window._flashTimer); window._flashTimer = null; }
}

/* ---------- strip metode pembayaran ---------- */
function payStripHTML() {
  const ms = window._payMethods || [
    { label: '⚡ QRIS' }, { label: '🏦 BCA' }, { label: '🏦 Mandiri' }, { label: '📱 DANA' },
  ];
  if (!ms.length) return '';
  return `<div class="pay-strip"><span class="muted" style="font-size:11.5px;font-weight:800;letter-spacing:1px">PEMBAYARAN</span>${ms.map((m) => `<span class="pay-chip">${esc(m.label)}</span>`).join('')}</div>`;
}
function cachePayMethods(s) {
  if (s && Array.isArray(s.pay_methods)) window._payMethods = s.pay_methods;
}
