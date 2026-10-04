/* ===== PlayTopUp Store — views: admin panel ===== */
const ADM_TABS = [
  ['dash', '📊 Dashboard'], ['orders', '📦 Orders'], ['products', '🎮 Products'],
  ['vouchers', '🎟️ Vouchers'], ['banners', '🖼️ Banners'], ['tickets', '💬 Tickets'],
  ['users', '👥 Users'], ['settings', '⚙️ Settings'],
];
function vAdmin(tab) {
  const view = document.getElementById('view');
  if (!store.isAdmin()) { go('#/'); toast('Admin only', false); return; }
  tab = tab || 'dash';
  view.innerHTML = `
    <div class="sec-head"><h2>⚙️ Admin Panel</h2></div>
    <div class="adm-tabs">${ADM_TABS.map(([k, l]) => `<button class="chip ${k === tab ? 'active' : ''}" onclick="go('#/admin/${k}')">${l}</button>`).join('')}</div>
    <div id="adm-body"><div class="skel" style="height:160px"></div></div>`;
  ({ dash: admDash, orders: admOrders, products: admProducts, vouchers: admVouchers, banners: admBanners, tickets: admTickets, users: admUsers, settings: admSettings }[tab] || admDash)();
}

async function admDash() {
  const el = document.getElementById('adm-body');
  try {
    const d = await api.get('/api/admin/stats');
    el.innerHTML = `
      <div class="adm-grid">
        <div class="stat"><div class="n">${rp(d.revenue_total || 0)}</div><div class="l">Revenue</div></div>
        <div class="stat"><div class="n">${d.orders_today || 0}</div><div class="l">Orders today</div></div>
        <div class="stat"><div class="n">${d.pending_orders || 0}</div><div class="l">Pending</div></div>
        <div class="stat"><div class="n">${d.total_products || 0}</div><div class="l">Products</div></div>
        <div class="stat"><div class="n">${d.total_users || 0}</div><div class="l">Users</div></div>
        <div class="stat"><div class="n">${d.low_stock || 0}</div><div class="l">Low stock</div></div>
      </div>
      ${d.low_stock > 0 ? `<div class="announce">⚠️ ${d.low_stock} product(s) low on stock.</div>` : ''}
      <button class="btn block purple" onclick="go('#/admin/orders')">Manage Orders →</button>`;
  } catch (e) { el.innerHTML = `<div class="empty">Failed to load stats.</div>`; }
}

async function admOrders() {
  const el = document.getElementById('adm-body');
  try {
    const d = await api.get('/api/orders/all?limit=50');
    const list = d.orders || [];
    el.innerHTML = list.length ? `<div class="card" style="overflow-x:auto"><table class="tbl"><tr><th>#</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr>` +
      list.map((o) => `<tr><td><b>#${o.id}</b></td><td style="font-size:12px">${esc((o.items || []).map((i) => i.name).join(', '))}</td>
      <td><b>${rp(o.total)}</b></td><td>${statusPill(o.status)}</td>
      <td><button class="btn sm ghost" onclick="admOrderDetail(${o.id})">Open</button></td></tr>`).join('') + `</table></div>`
      : `<div class="empty"><div class="big">📦</div>No orders.</div>`;
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admOrderDetail(id) {
  try {
    const d = await api.get('/api/orders/' + id);
    const o = d.order;
    const next = { pending: ['proses', 'dibatalkan'], proses: ['delivery', 'dibatalkan'], delivery: ['selesai', 'dibatalkan'] }[o.status] || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">Order #${o.id} ${statusPill(o.status)}</h3>
      <div style="font-size:14px;margin-bottom:8px">${esc((o.items || []).map((i) => `${i.name} × ${i.qty}`).join('<br>'))}</div>
      <div class="row" style="margin-bottom:8px"><span class="muted grow">Total</span><b class="price">${rp(o.total)}</b></div>
      <div class="muted" style="font-size:13px">Pay via: ${esc(o.payment_method)}${o.voucher_code ? ` • Voucher: ${esc(o.voucher_code)}` : ''}</div>
      ${o.proof_path ? `<div style="margin:10px 0"><b>Payment proof:</b><br><img src="${esc(o.proof_path)}" style="max-width:100%;border-radius:12px;margin-top:6px"></div>` : ''}
      ${o.delivery_data ? `<div class="announce">🎁 ${esc(typeof o.delivery_data === 'string' ? o.delivery_data : JSON.stringify(o.delivery_data))}</div>` : ''}
      <div class="divider"></div>
      <div class="row" style="flex-wrap:wrap;gap:8px">${next.map((s) => `<button class="btn sm ${s === 'dibatalkan' ? 'line' : 'purple'}" onclick="admSetStatus(${o.id},'${s}')">${s === 'dibatalkan' ? 'Cancel order' : '→ ' + s}</button>`).join('') || '<span class="muted">No actions available.</span>'}</div>`);
  } catch (e) { toast(e.message, false); }
}
async function admSetStatus(id, status) {
  try {
    const d = await api.patch(`/api/orders/${id}/status`, { status });
    closeModal(); toast(`Order #${id} → ${status}`, true); admOrders();
  } catch (e) { toast(e.message, false); }
}

async function admProducts() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admProductForm()">+ Add Product</button><div class="skel" style="height:90px"></div>`;
  try {
    const d = await api.get('/api/products?limit=100');
    const list = d.products || [];
    el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admProductForm()">+ Add Product</button>` +
      `<div class="card" style="overflow-x:auto"><table class="tbl"><tr><th></th><th>Product</th><th>Price</th><th>Stock</th><th></th></tr>` +
      list.map((p) => `<tr><td>${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}">` : '🎮'}</td>
      <td><b>${esc(p.name)}</b><br><span class="muted" style="font-size:11px">${esc(p.category || '')}</span></td>
      <td><b>${rp(p.price)}</b></td><td>${p.stock}</td>
      <td><button class="btn sm ghost" onclick="admProductForm(${p.id})">Edit</button></td></tr>`).join('') + `</table></div>`;
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admProductForm(id) {
  let p = { name: '', price: 0, stock: 10, category: 'topup', tags: '', description: '', discount: 0, image_url: '' };
  let cats = [];
  try { cats = (await api.get('/api/settings/public')).categories || []; } catch {}
  if (id) { try { p = (await api.get('/api/products/' + id)).product; } catch (e) { toast(e.message, false); return; } }
  openModal(`<button class="mclose" onclick="closeModal()">✕</button>
    <h3 style="margin-top:0">${id ? 'Edit' : 'Add'} Product</h3>
    <div class="field"><label>Name</label><input id="ap-name" value="${esc(p.name)}"></div>
    <div class="row"><div class="field grow"><label>Price (Rp)</label><input id="ap-price" type="number" value="${p.price}"></div>
    <div class="field grow"><label>Stock</label><input id="ap-stock" type="number" value="${p.stock}"></div></div>
    <div class="row"><div class="field grow"><label>Category</label><select id="ap-cat">${cats.map((c) => `<option value="${esc(c.id)}" ${c.id === p.category ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
    <div class="field grow"><label>Discount %</label><input id="ap-disc" type="number" value="${p.discount || 0}"></div></div>
    <div class="field"><label>Tags (comma separated)</label><input id="ap-tags" value="${esc(p.tags || '')}"></div>
    <div class="field"><label>Description</label><textarea id="ap-desc" rows="2">${esc(p.description || '')}</textarea></div>
    <div class="field"><label>Image URL</label><input id="ap-img" value="${esc(p.image_url || '')}" placeholder="/img/ml.png"></div>
    <button class="btn block purple" onclick="admSaveProduct(${id || 0})">Save</button>
    ${id ? `<div style="height:8px"></div><button class="btn block line" onclick="admProductVariants(${id})">Manage Variants (denominations)</button>
    <div style="height:8px"></div><button class="btn block line" style="color:#b91c1c" onclick="admDelProduct(${id})">Delete Product</button>` : ''}`);
}
async function admSaveProduct(id) {
  const body = {
    name: document.getElementById('ap-name').value.trim(),
    price: +document.getElementById('ap-price').value || 0,
    stock: +document.getElementById('ap-stock').value || 0,
    category: document.getElementById('ap-cat').value,
    discount: +document.getElementById('ap-disc').value || 0,
    tags: document.getElementById('ap-tags').value.trim(),
    description: document.getElementById('ap-desc').value.trim(),
    image_url: document.getElementById('ap-img').value.trim(),
  };
  if (!body.name) { toast('Name required', false); return; }
  try {
    if (id) await api.put('/api/products/' + id, body);
    else await api.post('/api/products', body);
    closeModal(); toast('Saved', true); admProducts();
  } catch (e) { toast(e.message, false); }
}
async function admDelProduct(id) {
  confirmModal('Delete product?', 'This product and its variants will be removed.', async () => {
    try { await api.del('/api/products/' + id); toast('Deleted', true); admProducts(); }
    catch (e) { toast(e.message, false); }
  });
}
async function admProductVariants(pid) {
  try {
    const d = await api.get(`/api/products/${pid}/variants`);
    const vars = d.variants || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">Variants</h3>
      ${vars.map((v) => `<div class="row" style="margin-bottom:8px"><span class="grow" style="font-weight:700">${esc(v.label)} — ${rp(v.price)} (stock ${v.stock})</span><button class="btn sm line" style="color:#b91c1c" onclick="admDelVariant(${pid},${v.id})">✕</button></div>`).join('') || '<div class="muted">No variants.</div>'}
      <div class="divider"></div>
      <div class="row"><input id="av-label" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px" placeholder="Label e.g. 86 Diamonds">
      <input id="av-price" type="number" style="width:110px;border:2px solid var(--line);border-radius:12px;padding:10px" placeholder="Price">
      <input id="av-stock" type="number" style="width:80px;border:2px solid var(--line);border-radius:12px;padding:10px" placeholder="Stock"></div>
      <div style="height:8px"></div><button class="btn block purple" onclick="admAddVariant(${pid})">+ Add Variant</button>`);
  } catch (e) { toast(e.message, false); }
}
async function admAddVariant(pid) {
  try {
    await api.post(`/api/products/${pid}/variants`, {
      label: document.getElementById('av-label').value.trim(),
      price: +document.getElementById('av-price').value || 0,
      stock: +document.getElementById('av-stock').value || 0,
    });
    admProductVariants(pid);
  } catch (e) { toast(e.message, false); }
}
async function admDelVariant(pid, vid) {
  try { await api.del(`/api/products/${pid}/variants/${vid}`); admProductVariants(pid); }
  catch (e) { toast(e.message, false); }
}

async function admVouchers() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admVoucherForm()">+ Add Voucher</button><div class="skel" style="height:80px"></div>`;
  try {
    const d = await api.get('/api/admin/vouchers');
    el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admVoucherForm()">+ Add Voucher</button>` +
      ((d.vouchers || []).map((v) => `
      <div class="voucher-card"><div class="row"><div class="grow"><div class="vc">${esc(v.code)}</div>
      <div class="vd">${v.kind === 'percent' ? v.value + '% off' : rp(v.value) + ' off'} • used ${v.used_count}/${v.max_uses || '∞'} • ${v.active ? 'active' : 'off'}</div></div>
      <button class="btn sm" style="background:#fff;color:var(--purple);box-shadow:none" onclick="admDelVoucher('${esc(v.code)}')">Delete</button></div></div>`).join('') || '<div class="empty">No vouchers.</div>');
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
function admVoucherForm() {
  openModal(`<button class="mclose" onclick="closeModal()">✕</button><h3 style="margin-top:0">Add Voucher</h3>
    <div class="field"><label>Code</label><input id="avc-code" placeholder="BONUS10"></div>
    <div class="row"><div class="field grow"><label>Type</label><select id="avc-kind"><option value="percent">Percent %</option><option value="fixed">Fixed Rp</option></select></div>
    <div class="field grow"><label>Value</label><input id="avc-val" type="number" value="10"></div></div>
    <div class="row"><div class="field grow"><label>Min. total (Rp)</label><input id="avc-min" type="number" value="0"></div>
    <div class="field grow"><label>Max uses (0=∞)</label><input id="avc-max" type="number" value="0"></div></div>
    <button class="btn block purple" onclick="admSaveVoucher()">Save</button>`);
}
async function admSaveVoucher() {
  try {
    await api.post('/api/admin/vouchers', {
      code: document.getElementById('avc-code').value.trim().toUpperCase(),
      kind: document.getElementById('avc-kind').value,
      value: +document.getElementById('avc-val').value || 0,
      min_total: +document.getElementById('avc-min').value || 0,
      max_uses: +document.getElementById('avc-max').value || 0,
    });
    closeModal(); toast('Voucher saved', true); admVouchers();
  } catch (e) { toast(e.message, false); }
}
async function admDelVoucher(code) {
  confirmModal('Delete voucher?', `Delete voucher ${code}?`, async () => {
    try { await api.del('/api/admin/vouchers/' + encodeURIComponent(code)); toast('Deleted', true); admVouchers(); }
    catch (e) { toast(e.message, false); }
  });
}

async function admBanners() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admBannerForm()">+ Add Banner</button><div class="skel" style="height:100px"></div>`;
  try {
    const d = await api.get('/api/admin/banners');
    el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admBannerForm()">+ Add Banner</button>` +
      ((d.banners || []).map((b) => `
      <div class="banner-card"><div class="row" style="padding:10px"><div class="grow"><b>Banner #${b.id}</b><br><span class="muted" style="font-size:12px">${b.active ? '✅ active' : '⏸ off'} ${b.link_url ? `• → ${esc(b.link_url)}` : ''}</span></div>
      <button class="btn sm ghost" onclick="admToggleBanner(${b.id},${b.active ? 0 : 1})">${b.active ? 'Disable' : 'Enable'}</button>
      <button class="btn sm line" style="color:#b91c1c" onclick="admDelBanner(${b.id})">✕</button></div>
      ${b.image_url ? `<img src="${esc(b.image_url)}">` : ''}</div>`).join('') || '<div class="empty">No banners.</div>');
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
function admBannerForm() {
  openModal(`<button class="mclose" onclick="closeModal()">✕</button><h3 style="margin-top:0">Add Banner</h3>
    <div class="field"><label>Image (max 2MB)</label><input type="file" id="ab-file" accept="image/*"></div>
    <div class="field"><label>Link URL (optional)</label><input id="ab-link" placeholder="#/games"></div>
    <button class="btn block purple" onclick="admSaveBanner()">Upload & Save</button>`);
}
async function admSaveBanner() {
  const f = document.getElementById('ab-file').files[0];
  if (!f) { toast('Choose an image first', false); return; }
  try {
    const fd = new FormData();
    fd.append('image', f);
    fd.append('link_url', document.getElementById('ab-link').value.trim());
    await api.upload('/api/admin/banners', fd);
    closeModal(); toast('Banner saved', true); admBanners();
  } catch (e) { toast(e.message, false); }
}
async function admToggleBanner(id, active) {
  try { await api.patch('/api/admin/banners/' + id, { active }); admBanners(); }
  catch (e) { toast(e.message, false); }
}
async function admDelBanner(id) {
  confirmModal('Delete banner?', 'Remove this banner?', async () => {
    try { await api.del('/api/admin/banners/' + id); toast('Deleted', true); admBanners(); }
    catch (e) { toast(e.message, false); }
  });
}

async function admTickets() {
  const el = document.getElementById('adm-body');
  try {
    const d = await api.get('/api/admin/tickets');
    const list = d.tickets || [];
    el.innerHTML = list.length ? list.map((t) => `
      <div class="card" style="margin-bottom:10px;cursor:pointer" onclick="admTicketDetail(${t.id})">
        <div class="row"><b class="grow">${esc(t.subject)}</b>${statusPill(t.status === 'open' ? 'pending' : 'selesai')}</div>
        <div class="muted" style="font-size:12px;font-weight:700">${esc(t.user_name || t.user_email || '')} • ${esc(t.created_at || '')}</div>
      </div>`).join('') : `<div class="empty"><div class="big">💬</div>No tickets.</div>`;
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admTicketDetail(id) {
  try {
    const d = await api.get('/api/admin/tickets/' + id);
    const t = d.ticket, msgs = t.messages || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">${esc(t.subject)}</h3>
      ${msgs.map((m) => `<div class="ticket-msg ${m.is_admin ? '' : 'me'}"><div class="who">${m.is_admin ? '🛡️ You (admin)' : esc(t.user_name || 'User')} • ${esc(m.created_at || '')}</div><div style="font-size:14px">${esc(m.message)}</div></div>`).join('')}
      <div class="row" style="margin-top:8px"><input id="adm-tr" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit" placeholder="Reply…"><button class="btn sm purple" onclick="admReplyTicket(${id})">Send</button></div>`);
  } catch (e) { toast(e.message, false); }
}
async function admReplyTicket(id) {
  const v = document.getElementById('adm-tr').value.trim();
  if (!v) return;
  try { await api.post(`/api/admin/tickets/${id}/reply`, { message: v }); admTicketDetail(id); }
  catch (e) { toast(e.message, false); }
}

async function admUsers() {
  const el = document.getElementById('adm-body');
  try {
    const d = await api.get('/api/users');
    const list = d.users || [];
    el.innerHTML = `<div class="card" style="overflow-x:auto"><table class="tbl"><tr><th>User</th><th>Email</th><th>Role</th><th></th></tr>` +
      list.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td style="font-size:12px">${esc(u.email)}</td><td>${u.role === 'admin' ? '👑 admin' : 'user'}</td>
      <td>${u.role !== 'admin' ? `<button class="btn sm ghost" onclick="admMakeAdmin(${u.id})">Make admin</button>` : ''}</td></tr>`).join('') + `</table></div>`;
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admMakeAdmin(id) {
  confirmModal('Make admin?', 'Grant admin access to this user?', async () => {
    try { await api.patch(`/api/users/${id}/role`, { role: 'admin' }); toast('Updated', true); admUsers(); }
    catch (e) { toast(e.message, false); }
  }, 'Make admin');
}

async function admSettings() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<div class="skel" style="height:200px"></div>`;
  try {
    const d = await api.get('/api/admin/store-settings');
    el.innerHTML = `
      <div class="card">
        <div class="field"><label>Store name</label><input id="as-name" value="${esc(d.store_name || '')}"></div>
        <div class="field"><label>Announcement</label><textarea id="as-ann" rows="2">${esc(d.announcement || '')}</textarea></div>
        <div class="field"><label>Flash sale ends (ISO datetime)</label><input id="as-flash" value="${esc(d.flash_sale_ends || '')}" placeholder="2026-12-31T23:59:59"></div>
        <button class="btn block purple" onclick="admSaveSettings()">Save Settings</button>
      </div>
      <div class="card" style="margin-top:12px">
        <div style="font-weight:900;margin-bottom:8px">📢 Categories</div>
        <div id="cat-admin">${(d.categories || []).map((c) => `<div class="row" style="margin-bottom:8px"><span class="grow" style="font-weight:700">${esc(c.icon || '')} ${esc(c.label)} <span class="muted">(${esc(c.id)})</span></span><span class="muted" style="font-size:12px">${c.active ? '✅' : '⏸'}</span></div>`).join('')}</div>
        <div class="muted" style="font-size:12px">Manage categories via API for now.</div>
      </div>`;
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admSaveSettings() {
  try {
    await api.put('/api/admin/settings', {
      store_name: document.getElementById('as-name').value.trim(),
      announcement: document.getElementById('as-ann').value.trim(),
      flash_sale_ends: document.getElementById('as-flash').value.trim(),
    });
    toast('Settings saved', true);
  } catch (e) { toast(e.message, false); }
}
