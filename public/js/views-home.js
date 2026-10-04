/* ===== PlayTopUp Store — views: home, games, product ===== */
const CAT_STYLE = {
  popular: { bg: '#6d28d9', fg: '#fff', icon: '⭐' },
  ml: { bg: '#3b82f6', fg: '#fff', icon: '⚔️' },
  genshin: { bg: '#14b8a6', fg: '#fff', icon: '✨' },
  pubg: { bg: '#f59e0b', fg: '#fff', icon: '🪖' },
  ff: { bg: '#f97316', fg: '#fff', icon: '🔥' },
  roblox: { bg: '#2563eb', fg: '#fff', icon: '🧱' },
  steam: { bg: '#1e3a8a', fg: '#fff', icon: '🎮' },
};
function catChip(c, active) {
  const s = CAT_STYLE[c.id] || { bg: '#8b5cf6', fg: '#fff', icon: c.icon || '📦' };
  return `<button class="chip cat ${active ? 'active' : ''}" style="${active ? '' : `background:${s.bg};color:${s.fg}`}" onclick="go('#/game/${esc(c.id)}')"><span class="ce">${esc(c.icon || s.icon)}</span>${esc(c.label)}</button>`;
}

async function vHome() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div id="announce-slot"></div>
    <div class="hero">
      <div class="txt">
        <h1>Top Up<br>Instantly!</h1>
        <div class="bonus">10% BONUS<br>for First Top-Up ✨</div>
        <div class="ticks"><b>✔</b> Instant • Safe • 24/7 &nbsp; 🛡️ Support</div>
        <button class="btn" onclick="go('#/games')">Explore Deals →</button>
      </div>
      <img class="mascots" src="/img/hero.webp" alt="PlayTopUp mascots">
    </div>
    <div class="sec-head"><h2>Categories</h2></div>
    <div class="hscroll" id="cat-row"><div class="skel" style="width:120px;height:52px"></div><div class="skel" style="width:140px;height:52px"></div><div class="skel" style="width:130px;height:52px"></div></div>
    <div class="sec-head"><h2>Popular Top-Ups</h2><a class="link-more" href="#/games">See All ›</a></div>
    <div class="pgrid" id="pop-grid">
      ${'<div class="skel" style="height:270px"></div>'.repeat(4)}
    </div>
    <div class="trust">✨⚡ Instant delivery • 100% Safe Payment • Official Partner</div>
    <div style="height:8px"></div>`;

  try {
    const s = await api.get('/api/settings/public');
    if (s.announcement) document.getElementById('announce-slot').innerHTML = `<div class="announce">📢 ${esc(s.announcement)}</div>`;
    const cats = [{ id: 'popular', label: 'Popular', icon: '⭐' }, ...(s.categories || [])];
    document.getElementById('cat-row').innerHTML = cats.map((c) => catChip(c)).join('');
  } catch { document.getElementById('cat-row').innerHTML = ''; }

  try {
    const d = await api.get('/api/products?limit=60');
    const items = (d.products || []).sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 6);
    document.getElementById('pop-grid').innerHTML = items.length
      ? items.map(productCard).join('')
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🎮</div>No products yet.</div>`;
  } catch (e) {
    document.getElementById('pop-grid').innerHTML = `<div class="empty" style="grid-column:1/-1">Failed to load products.</div>`;
  }
}

async function vGames() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="sec-head"><h2>All Games</h2></div><div class="pgrid" id="games-grid">${'<div class="skel" style="height:150px"></div>'.repeat(4)}</div>`;
  try {
    const s = await api.get('/api/settings/public');
    const cats = s.categories || [];
    const imgs = { ml: '/img/ml.webp', genshin: '/img/genshin.webp', pubg: '/img/pubg.webp', ff: '/img/ff.webp', roblox: '/img/roblox.webp', steam: '/img/steam.webp' };
    document.getElementById('games-grid').innerHTML = cats.map((c) => `
      <div class="pcard" onclick="go('#/game/${esc(c.id)}')">
        <div class="pimg imgph"><img src="${imgs[c.id] || '/img/steam.webp'}" alt="${esc(c.label)}" loading="lazy" onload="imgLd(this)"></div>
        <div class="pbody"><div class="pname">${esc(c.icon || '')} ${esc(c.label)}</div>
        <div class="pvar">Top up instantly</div></div>
      </div>`).join('') || `<div class="empty" style="grid-column:1/-1">No games yet.</div>`;
  } catch { document.getElementById('games-grid').innerHTML = `<div class="empty" style="grid-column:1/-1">Failed to load.</div>`; }
}

async function vGame(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="sec-head"><h2 id="g-title">…</h2></div><div class="pgrid" id="g-grid">${'<div class="skel" style="height:270px"></div>'.repeat(4)}</div>`;
  try {
    const s = await api.get('/api/settings/public');
    const cat = (s.categories || []).find((c) => c.id === id);
    document.getElementById('g-title').textContent = cat ? `${cat.icon || ''} ${cat.label}` : 'Products';
    const d = await api.get('/api/products?category=' + encodeURIComponent(id) + '&limit=60');
    const items = d.products || [];
    document.getElementById('g-grid').innerHTML = items.length ? items.map(productCard).join('')
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🎮</div>No products in this category yet.</div>`;
  } catch { document.getElementById('g-grid').innerHTML = `<div class="empty" style="grid-column:1/-1">Failed to load.</div>`; }
}

async function vProduct(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="skel" style="height:320px;border-radius:22px"></div><div class="skel" style="height:120px;margin-top:12px"></div>`;
  let d;
  try { d = await api.get('/api/products/' + id); }
  catch { view.innerHTML = `<div class="empty"><div class="big">😕</div>Product not found.<br><br><button class="btn ghost" onclick="history.back()">Back</button></div>`; return; }
  const p = d.product, vars = p.variants || [], imgs = d.images || [];
  const mainImg = (imgs[0] && imgs[0].url) || p.image_url || '';
  const disc = Number(p.discount) || 0;

  view.innerHTML = `
    <div class="detail-img imgph">${mainImg ? `<img src="${esc(mainImg)}" alt="${esc(p.name)}" onload="imgLd(this)">` : `<div style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;font-size:64px">🎮</div>`}</div>
    <div class="card" style="margin-top:12px">
      <div class="row"><h2 style="margin:0" class="grow">${esc(p.name)}</h2>
        ${store.user ? `<button class="icon-btn ghost" onclick="toggleWish(${p.id},this)">${window._wishlist && window._wishlist.has(p.id) ? '❤️' : '🤍'}</button>` : ''}</div>
      <div class="muted" style="font-weight:700;font-size:13px;margin:4px 0">${esc(p.category || '')}</div>
      <div>${stars(p.avg_rating, p.review_count)}</div>
      ${disc ? `<div style="margin-top:8px"><span class="chip" style="background:#fee2e2;color:#b91c1c">-${disc}% OFF</span> <s class="muted">${rp(p.price)}</s></div>` : ''}
      <div class="price" style="font-size:26px;margin-top:6px" id="pd-price">${rp(effPrice(p))}</div>
      ${vars.length ? `<div class="field" style="margin-top:12px"><label>Choose denomination</label><div class="var-list" id="var-list">` +
        vars.map((v, i) => `<div class="var-item ${i === 0 ? 'sel' : ''}" data-vid="${v.id}" data-price="${v.price}" data-label="${esc(v.label)}" onclick="selVar(this)"><span>${esc(v.label)}</span><span class="vp">${rp(v.price)}</span></div>`).join('') + `</div></div>` : ''}
      ${p.stock <= 0 && !vars.length ? `<div class="chip" style="background:#fee2e2;color:#b91c1c">Out of stock</div>` : `<div class="muted" style="font-size:13px;font-weight:700">Stock: ${p.stock}</div>`}
      <div class="divider"></div>
      <div style="font-weight:700;font-size:14px;line-height:1.6">${esc(p.description || 'Instant top-up delivery. Safe & fast, 24/7.')}</div>
    </div>
    <div class="card" style="margin-top:12px"><div class="sec-head" style="margin:0 0 8px"><h2 style="font-size:17px">Reviews</h2></div><div id="rev-list"><div class="skel" style="height:60px"></div></div></div>
    <div class="sticky-buy">
      <div class="grow"><div class="muted" style="font-size:12px;font-weight:800">TOTAL</div><div class="price" style="font-size:20px" id="buy-total">${rp(effPrice(p))}</div></div>
      <button class="btn ghost" onclick='addDetailToCart()'>🛒 Cart</button>
      <button class="btn" onclick="buyNow()">BUY</button>
    </div>`;

  window._pd = { p, vars, selVar: vars[0] || null };
  loadReviews(id);
}
function selVar(el) {
  document.querySelectorAll('#var-list .var-item').forEach((x) => x.classList.remove('sel'));
  el.classList.add('sel');
  const vid = +el.dataset.vid;
  window._pd.selVar = window._pd.vars.find((v) => v.id === vid) || null;
  const price = +el.dataset.price;
  document.getElementById('pd-price').textContent = rp(price);
  document.getElementById('buy-total').textContent = rp(price);
}
function detailSelection() {
  const { p, vars, selVar } = window._pd;
  if (vars.length && !selVar) { toast('Choose a denomination first', false); return null; }
  return {
    product_id: p.id,
    variant_id: selVar ? selVar.id : null,
    name: p.name,
    variant_label: selVar ? selVar.label : '',
    price: selVar ? selVar.price : effPrice(p),
    image_url: p.image_url,
    qty: 1,
  };
}
function addDetailToCart() {
  const s = detailSelection(); if (!s) return;
  store.addToCart(s);
  toast('Added to cart', true);
}
function buyNow() {
  const s = detailSelection(); if (!s) return;
  if (!store.user) { sessionStorage.setItem('ptu_after_login', location.hash); go('#/auth'); toast('Login first to checkout'); return; }
  store.addToCart(s);
  go('#/checkout');
}
async function loadReviews(pid) {
  try {
    const d = await api.get(`/api/products/${pid}/reviews`);
    const list = d.reviews || [];
    document.getElementById('rev-list').innerHTML = list.length ? list.map((r) => `
      <div class="ticket-msg"><div class="who">${esc(r.user_name || 'User')} • ${stars(r.rating)}</div><div style="font-size:14px">${esc(r.comment || '')}</div></div>`).join('')
      : `<div class="muted" style="font-size:13px">No reviews yet.</div>`;
  } catch { document.getElementById('rev-list').innerHTML = ''; }
}
