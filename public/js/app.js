/* ===== PlayTopUp Store — shell: topbar, bottom nav, router ===== */

/* Desktop vs mobile: dua desain terpisah.
   Desktop (>=1024px) -> views-desktop.js + desktop.css (body.is-desktop).
   Mobile -> desain app-shell seperti sekarang. */
const mqDesktop = window.matchMedia('(min-width: 1024px)');
function isDesktop() { return mqDesktop.matches; }
function applyMode() {
  document.body.classList.toggle('is-desktop', isDesktop());
}
if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', () => { applyMode(); router(); });

function renderTopbar() {
  const tb = document.getElementById('topbar');
  if (!tb) return;
  const u = store.user;
  const cc = store.cartCount();
  tb.innerHTML = `
    <div class="tb-row">
      <a class="logo" href="#/">
        <span class="logo-badge">🎮</span>
        <span class="logo-text"><b>PLAYTOPUP</b><span>STORE</span></span>
      </a>
      <div class="tb-qwrap"><input id="tb-q" placeholder="Cari diamond, voucher…" onkeydown="if(event.key==='Enter')doSearch()" aria-label="Search"></div>
      <button class="icon-btn" onclick="toggleTheme()" aria-label="Theme">${themeIcon()}</button>
      <button class="icon-btn" onclick="go('#/cart')" aria-label="Cart">🛒${cc ? `<span class="badge">${cc > 9 ? '9+' : cc}</span>` : ''}</button>
      <button class="icon-btn" onclick="go('#/notif')" aria-label="Notifications">🔔${window._unread ? `<span class="badge">${window._unread > 9 ? '9+' : window._unread}</span>` : (u ? '<span class="dot"></span>' : '')}</button>
      <button class="icon-btn" onclick="go('${u ? '#/profile' : '#/auth'}')" aria-label="Akun">${u ? '👤' : '🔑'}</button>
    </div>`;
}
/* refresh header (mobile topbar / desktop header) */
function renderChrome() {
  if (isDesktop()) { if (typeof refreshDChrome === 'function') refreshDChrome(); }
  else renderTopbar();
}
function toggleSearch() {
  const el = document.getElementById('tb-search');
  if (!el) { const q = document.getElementById('tb-q'); if (q) q.focus(); return; }
  el.style.display = el.style.display === 'none' ? 'flex' : 'none';
  if (el.style.display !== 'none') document.getElementById('tb-q').focus();
}
function doSearch() {
  const q = document.getElementById('tb-q').value.trim();
  if (q) go('#/search/' + encodeURIComponent(q));
}

function renderNav(active) {
  const nav = document.getElementById('bottomnav');
  if (!nav) return;
  const items = [
    ['home', '🏠', 'Home', '#/'],
    ['cart', '🛒', 'Cart', '#/cart', store.cartCount()],
    ['profile', '👤', 'Akun', store.user ? '#/profile' : '#/auth'],
  ];
  nav.innerHTML = items.map(([k, ic, lb, h, badge]) =>
    `<button class="bn-item ${k === active ? 'active' : ''}" onclick="go('${h}')"><span class="ic">${ic}</span>${lb}${badge ? `<span class="badge">${badge > 9 ? '9+' : badge}</span>` : ''}</button>`).join('');
}

async function vSearch(q) {
  const view = document.getElementById('view');
  window._sSort = 'populer'; window._sItems = []; window._sQ = q;
  view.innerHTML = `<div class="sec-head"><h2>🔍 "${esc(q)}"</h2></div>
    <div id="s-sort">${sortChips('populer', 'sSort')}</div>
    <div class="pgrid" id="s-grid">${'<div class="skel" style="height:270px"></div>'.repeat(4)}</div>`;
  try {
    const d = await api.get('/api/products?q=' + encodeURIComponent(q) + '&limit=40');
    window._sItems = d.products || [];
    renderSGrid();
  } catch {
    const g = document.getElementById('s-grid');
    if (g) g.innerHTML = `<div class="empty" style="grid-column:1/-1">Search failed.</div>`;
  }
}
function sSort(s) {
  window._sSort = s;
  const el = document.getElementById('s-sort');
  if (el) el.innerHTML = sortChips(s, 'sSort');
  renderSGrid();
}
function renderSGrid() {
  const grid = document.getElementById('s-grid');
  if (!grid) return;
  const items = applySort(window._sItems, window._sSort);
  grid.innerHTML = items.length ? items.map(productCard).join('')
    : `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>No results for "${esc(window._sQ || '')}".</div>`;
}

const routes = [
  [/^#\/?$/, () => { renderNav('home'); vHome(); }],
  [/^#\/games$/, () => { renderNav('home'); vGames(); }],
  [/^#\/game\/([\w-]+)$/, (m) => { renderNav('home'); vGame(m[1]); }],
  [/^#\/product\/(\d+)$/, (m) => { renderNav('home'); vProduct(m[1]); }],
  [/^#\/search\/(.+)$/, (m) => { renderNav('home'); vSearch(decodeURIComponent(m[1])); }],
  [/^#\/cart$/, () => { renderNav('cart'); vCart(); }],
  [/^#\/checkout$/, () => { renderNav('cart'); vCheckout(); }],
  [/^#\/pay\/(\d+)$/, (m) => { renderNav('profile'); vPay(m[1]); }],
  [/^#\/orders$/, () => { renderNav('profile'); vOrders(); }],
  [/^#\/order\/(\d+)$/, (m) => { renderNav('profile'); vOrder(m[1]); }],
  [/^#\/track$/, () => { renderNav('profile'); vTrackForm(); }],
  [/^#\/track\/(\d+)$/, (m) => { renderNav('profile'); vTrackForm(); }],
  [/^#\/faq$/, () => { renderNav('profile'); vFaq(); }],
  [/^#\/notif$/, () => { renderNav('profile'); vNotif(); }],
  [/^#\/wallet$/, () => { renderNav('profile'); vWallet(); }],
  [/^#\/wishlist$/, () => { renderNav('profile'); vWishlist(); }],
  [/^#\/tickets$/, () => { renderNav('profile'); vTickets(); }],
  [/^#\/ticket\/(\d+)$/, (m) => { renderNav('profile'); vTicket(m[1]); }],
  [/^#\/profile$/, () => { renderNav('profile'); vProfile(); }],
  [/^#\/auth$/, () => { renderNav('profile'); vAuth(); }],
  [/^#\/forgot$/, () => { renderNav('profile'); vForgot(); }],
  [/^#\/admin(?:\/(\w+))?$/, (m) => { renderNav('profile'); vAdmin(m[1]); }],
];

function routeMobile(h) {
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) { fn(m); window.scrollTo(0, 0); return true; }
  }
  renderNav('home'); vHome(); window.scrollTo(0, 0);
  return false;
}

function router() {
  closeModal();
  stopFlashCountdown();
  if (isDesktop()) { renderDesktop(); return; }
  ensureMobileShell();
  renderTopbar();
  routeMobile(location.hash || '#/');
}
/* pulihkan struktur shell mobile bila sebelumnya diganti shell desktop (resize) */
function ensureMobileShell() {
  if (!document.getElementById('view')) {
    document.getElementById('app').innerHTML = `<header id="topbar"></header><main id="view"></main><nav id="bottomnav"></nav>`;
  }
}

function vForgot() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="card" style="margin-top:20px"><h2>Reset Password</h2>
    <div class="field"><label>Email</label><input id="f-email" type="email"></div>
    <button class="btn block purple" onclick="doForgot()">Send Reset Link</button></div>`;
}
async function doForgot() {
  try {
    await api.post('/api/auth/forgot-password', { email: document.getElementById('f-email').value.trim() });
    toast('If the email exists, a reset link was sent.', true);
  } catch (e) { toast(e.message, false); }
}

window.addEventListener('hashchange', router);
(async function init() {
  applyMode();
  renderTopbar();
  renderNav('home');
  await store.refreshUser();
  await loadWishlist();
  await refreshUnread();
  renderChrome();
  if (!location.hash) location.hash = '#/';
  router();
})();
