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
function productCard(p) {
  const img = p.image_url ? `<img src="${esc(imgUrl(p.image_url))}" alt="${esc(p.name)}" loading="lazy" onload="imgLd(this)">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px;background:var(--purple-soft)">🎮</div>`;
  const wished = store.user && window._wishlist && window._wishlist.has(p.id);
  return `
  <div class="pcard" onclick="go('#/product/${p.id}')">
    <div class="pimg-wrap"><div class="pimg imgph">${img}</div>
      ${store.user ? `<button class="wish-btn" onclick="event.stopPropagation();toggleWish(${p.id},this)" aria-label="wishlist">${wished ? '❤️' : '🤍'}</button>` : ''}
    </div>
    <div class="pbody">
      <div class="pname">${esc(p.name)}</div>
      <div class="pvar">${esc(p.variant_label || p.short || '')}</div>
      <div class="prate">${stars(p.avg_rating, p.sold_count != null ? fmtCount(p.sold_count) + ' sold' : p.review_count)}</div>
      <button class="buy" onclick="event.stopPropagation();quickBuy(${p.id})">${rp(p.price)}</button>
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
    store.addToCart({ product_id: p.id, variant_id: null, name: p.name, variant_label: '', price: effPrice(p), image_url: p.image_url, qty: 1 });
    toast('Added to cart', true);
  } catch (e) { toast(e.message, false); }
}
function effPrice(p) {
  const d = Number(p.discount) || 0;
  return d > 0 ? Math.round(p.price * (1 - d / 100)) : p.price;
}
function go(hash) { location.hash = hash; }

async function loadWishlist() {
  window._wishlist = new Set();
  if (!store.user) return;
  try {
    const d = await api.get('/api/wishlist');
    (d.items || d.wishlist || []).forEach((w) => window._wishlist.add(w.product_id || w.id));
  } catch { /* abaikan */ }
}
