/* ===== PlayTopUp Store — views: auth, profile, wallet, tickets ===== */
function vAuth() {
  const view = document.getElementById('view');
  if (store.user) { go('#/profile'); return; }
  view.innerHTML = `
    <div class="card" style="margin-top:20px">
      <div class="center" style="margin-bottom:14px"><div style="font-size:44px">🎮</div>
      <h2 style="color:var(--purple);margin:6px 0 2px">Welcome to PlayTopUp!</h2>
      <div class="muted" style="font-weight:600;font-size:13px">Login to checkout & track orders</div></div>
      <div class="row" style="margin-bottom:14px">
        <button class="chip grow ${window._authMode !== 'register' ? 'active' : ''}" style="justify-content:center;padding:11px" onclick="window._authMode='login';vAuth()">Login</button>
        <button class="chip grow ${window._authMode === 'register' ? 'active' : ''}" style="justify-content:center;padding:11px" onclick="window._authMode='register';vAuth()">Register</button>
      </div>
      <div id="auth-form"></div>
    </div>`;
  const reg = window._authMode === 'register';
  document.getElementById('auth-form').innerHTML = `
    ${reg ? `<div class="field"><label>Name</label><input id="a-name" placeholder="Your name"></div>` : ''}
    <div class="field"><label>Email</label><input id="a-email" type="email" placeholder="you@email.com"></div>
    <div class="field"><label>Password</label><input id="a-pass" type="password" placeholder="••••••"></div>
    <button class="btn block purple" onclick="doAuth(${reg})">${reg ? 'Create Account' : 'Login'}</button>
    ${!reg ? `<div class="center" style="margin-top:10px"><a class="link-more" href="#/forgot">Forgot password?</a></div>` : ''}`;
}
async function doAuth(reg) {
  const email = document.getElementById('a-email').value.trim();
  const pass = document.getElementById('a-pass').value;
  if (!email || !pass) { toast('Fill email & password', false); return; }
  try {
    const body = reg ? { name: document.getElementById('a-name').value.trim(), email, password: pass } : { email, password: pass };
    const d = await api.post(reg ? '/api/auth/register' : '/api/auth/login', body);
    if (reg) {
      toast(d.message || 'Registered! Check your email to verify.', true);
      if (d.dev_link) { /* dev only */ }
      window._authMode = 'login'; vAuth(); return;
    }
    store.setSession(d.token, d.user);
    await loadWishlist();
    toast('Welcome back!', true);
    const after = sessionStorage.getItem('ptu_after_login');
    sessionStorage.removeItem('ptu_after_login');
    go(after || '#/');
  } catch (e) { toast(e.message, false); }
}

function vProfile() {
  const view = document.getElementById('view');
  if (!store.user) { go('#/auth'); return; }
  const u = store.user;
  view.innerHTML = `
    <div class="card">
      <div class="profile-head">
        <img class="avatar" src="${esc(u.avatar || '')}" loading="lazy" decoding="async" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🧑</text></svg>'" alt="">
        <div class="grow"><h2 style="margin:0">${esc(u.name)}</h2><div class="muted" style="font-weight:600;font-size:13px">${esc(u.email)}</div>
        ${u.role === 'admin' ? `<span class="chip" style="margin-top:4px">👑 Admin</span>` : ''}</div>
      </div>
      <div class="menu-list">
        ${u.role === 'admin' ? `<a class="menu-item" href="#/admin"><span class="mi">⚙️</span>Admin Panel<span class="arr">›</span></a>` : ''}
        <a class="menu-item" href="#/orders"><span class="mi">📦</span>My Orders<span class="arr">›</span></a>
        <a class="menu-item" href="#/wishlist"><span class="mi">❤️</span>Wishlist<span class="arr">›</span></a>
        <a class="menu-item" href="#/tickets"><span class="mi">💬</span>Support Tickets<span class="arr">›</span></a>
        <button class="menu-item" onclick="editProfile()"><span class="mi">✏️</span>Edit Profile<span class="arr">›</span></button>
        <button class="menu-item" onclick="store.logout()"><span class="mi">🚪</span>Logout<span class="arr">›</span></button>
      </div>
    </div>`;
}
function editProfile() {
  const u = store.user;
  openModal(`<button class="mclose" onclick="closeModal()">✕</button>
    <h3 style="margin-top:0">Edit Profile</h3>
    <div class="field"><label>Name</label><input id="ep-name" value="${esc(u.name)}"></div>
    <div class="field"><label>Avatar (image)</label><input type="file" id="ep-av" accept="image/*"></div>
    <button class="btn block purple" onclick="saveProfile()">Save</button>`);
}
async function saveProfile() {
  try {
    const name = document.getElementById('ep-name').value.trim();
    if (name) await api.put('/api/users/me', { name });
    const f = document.getElementById('ep-av').files[0];
    if (f) { const fd = new FormData(); fd.append('avatar', f); await api.upload('/api/users/me/avatar', fd); }
    await store.refreshUser();
    closeModal(); toast('Profile updated', true); vProfile(); renderChrome();
  } catch (e) { toast(e.message, false); }
}

async function vWishlist() {
  const view = document.getElementById('view');
  if (!store.user) { go('#/auth'); return; }
  view.innerHTML = `<div class="sec-head"><h2>❤️ Wishlist</h2></div><div class="skel" style="height:270px"></div>`;
  try {
    const d = await api.get('/api/wishlist');
    const items = d.items || d.wishlist || d.products || [];
    view.innerHTML = `<div class="sec-head"><h2>❤️ Wishlist</h2></div>` +
      (items.length ? `<div class="pgrid">${items.map((p) => productCard(p.product || p)).join('')}</div>`
        : `<div class="empty"><div class="big">🤍</div>No wishlist yet.<br><span class="muted">Tap 🤍 on products you like.</span></div>`);
  } catch { view.innerHTML = `<div class="empty">Failed to load wishlist.</div>`; }
}

async function vWallet() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="sec-head"><h2>🎟️ Wallet & Promos</h2></div><div class="skel" style="height:110px"></div>`;
  const [pRes, bRes] = await Promise.allSettled([api.get('/api/promos'), api.get('/api/banners')]);
  const promos = pRes.status === 'fulfilled' ? (pRes.value.promos || []) : [];
  const banners = bRes.status === 'fulfilled' ? (bRes.value.banners || []) : [];
  view.innerHTML = `
    <div class="sec-head"><h2>🎟️ Wallet & Promos</h2></div>
    ${banners.filter((b) => b.active).map((b) => `<div class="banner-card" ${b.link_url ? `onclick="go('${esc(b.link_url)}')" style="cursor:pointer"` : ''}>${b.image_url ? `<div class="imgph" style="border-radius:18px"><img src="${esc(imgUrl(b.image_url))}" alt="" loading="lazy" decoding="async" onload="imgLd(this)" style="width:100%;border-radius:18px;display:block"></div>` : ''}</div>`).join('')}
    ${promos.length ? `<div class="sec-head"><h2 style="font-size:17px">Available vouchers</h2></div>` + promos.map((p) => `
      <div class="voucher-card"><div class="vc">${esc(p.code)}</div><div class="vd">${esc(p.description || '')}</div>
      <button class="btn sm" style="margin-top:8px;background:var(--card2);color:var(--ink);box-shadow:none" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(p.code)}');toast('Code copied: ${esc(p.code)}',true)">Copy Code</button></div>`).join('')
    : `<div class="empty"><div class="big">🎟️</div><p class="muted">No active promos right now.<br>Check back soon!</p></div>`}`;
}

async function vTickets() {
  const view = document.getElementById('view');
  if (!store.user) { go('#/auth'); return; }
  view.innerHTML = `<div class="sec-head"><h2>Support Tickets</h2><button class="btn sm purple" onclick="newTicket()">+ New</button></div><div class="skel" style="height:80px"></div>`;
  try {
    const d = await api.get('/api/tickets');
    const list = d.tickets || [];
    view.innerHTML = `<div class="sec-head"><h2>Support Tickets</h2><button class="btn sm purple" onclick="newTicket()">+ New</button></div>` +
      (list.length ? list.map((t) => `
      <div class="card" style="margin-bottom:10px;cursor:pointer" onclick="go('#/ticket/${t.id}')">
        <div class="row"><b class="grow">${esc(t.subject)}</b>${statusPill(t.status === 'open' ? 'pending' : 'selesai')}</div>
        <div class="muted" style="font-size:12px;font-weight:700">${esc(t.created_at || '')}</div>
      </div>`).join('') : `<div class="empty"><div class="big">💬</div>No tickets yet.</div>`);
  } catch { view.innerHTML = `<div class="empty">Failed to load tickets.</div>`; }
}
function newTicket() {
  openModal(`<button class="mclose" onclick="closeModal()">✕</button>
    <h3 style="margin-top:0">New Ticket</h3>
    <div class="field"><label>Subject</label><input id="nt-sub" placeholder="e.g. Order #12 not delivered"></div>
    <div class="field"><label>Message</label><textarea id="nt-msg" rows="4"></textarea></div>
    <button class="btn block purple" onclick="sendTicket()">Send</button>`);
}
async function sendTicket() {
  try {
    await api.post('/api/tickets', { subject: document.getElementById('nt-sub').value, message: document.getElementById('nt-msg').value });
    closeModal(); toast('Ticket sent', true); vTickets();
  } catch (e) { toast(e.message, false); }
}
async function vTicket(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="skel" style="height:200px"></div>`;
  try {
    const d = await api.get('/api/tickets/' + id);
    const t = d.ticket, msgs = t.messages || [];
    view.innerHTML = `
      <div class="sec-head"><h2 style="font-size:18px">${esc(t.subject)}</h2></div>
      <div id="tmsgs">${msgs.map((m) => `<div class="ticket-msg ${m.is_admin ? '' : 'me'}"><div class="who">${m.is_admin ? '🛡️ Support' : 'You'} • ${esc(m.created_at || '')}</div><div style="font-size:14px">${esc(m.message)}</div></div>`).join('')}</div>
      <div class="card" style="margin-top:10px"><div class="row"><input id="tr-msg" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit" placeholder="Type a reply…"><button class="btn sm purple" onclick="replyTicket(${t.id})">Send</button></div></div>`;
  } catch { view.innerHTML = `<div class="empty">Ticket not found.</div>`; }
}
async function replyTicket(id) {
  const v = document.getElementById('tr-msg').value.trim();
  if (!v) return;
  try { await api.post(`/api/tickets/${id}/reply`, { message: v }); vTicket(id); }
  catch (e) { toast(e.message, false); }
}
