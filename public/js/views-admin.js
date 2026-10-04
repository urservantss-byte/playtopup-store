/* ===== PlayTopUp Store — views: admin panel ===== */
const ADM_TABS = [
  ['dash', '📊 Dashboard'], ['orders', '📦 Orders'], ['products', '🎮 Products'],
  ['vouchers', '🎟️ Vouchers'], ['reports', '📈 Laporan'], ['banners', '🖼️ Banners'], ['tickets', '💬 Tickets'],
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
  ({ dash: admDash, orders: admOrders, products: admProducts, vouchers: admVouchers, reports: admReports, banners: admBanners, tickets: admTickets, users: admUsers, settings: admSettings }[tab] || admDash)();
}

async function admDash() {
  const el = document.getElementById('adm-body');
  try {
    const [d, s] = await Promise.all([api.get('/api/admin/stats'), api.get('/api/admin/store-settings').catch(() => ({}))]);
    window._admQS = s || {};
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const sales = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const row = (d.sales_7d || []).find((r) => r.d === key);
      sales.push({ label: days[dt.getDay()], t: row ? row.t : 0, c: row ? row.c : 0 });
    }
    const maxT = Math.max(1, ...sales.map((x) => x.t));
    const qs = window._admQS;
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
      <div class="card" style="margin-top:12px">
        <div style="font-weight:900;margin-bottom:10px">📈 Penjualan 7 Hari</div>
        <div style="display:flex;align-items:flex-end;gap:6px;height:120px">
          ${sales.map((x) => `<div class="grow" style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end" title="${x.c} order • ${rp(x.t)}">
            <div style="width:100%;max-width:34px;border-radius:6px 6px 3px 3px;background:var(--grad);height:${Math.max(4, Math.round((x.t / maxT) * 88))}px"></div>
            <div class="muted" style="font-size:10px;font-weight:800">${x.label}</div></div>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="row" style="margin-bottom:8px"><div class="grow" style="font-weight:900">🕐 Pesanan Terbaru</div><button class="btn sm ghost" onclick="go('#/admin/orders')">Semua →</button></div>
        ${(d.recent_orders || []).map((o) => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line);font-size:13px"><b>#${o.id}</b><span class="grow muted" style="font-weight:600">${esc(o.user_name || o.email || '')}</span>${statusPill(o.status)}<b>${rp(o.total)}</b></div>`).join('') || '<div class="muted">Belum ada pesanan.</div>'}
      </div>
      <div class="card" style="margin-top:12px">
        <div style="font-weight:900;margin-bottom:10px">⚙️ Pengaturan Cepat</div>
        <div style="font-weight:800;font-size:13px;margin-bottom:6px">⚡ QRIS Statis ${qs.qris_static ? '<span class="chip" style="background:#dcfce7;color:#15803d">Aktif</span>' : '<span class="chip" style="background:#fee2e2;color:#b91c1c">Mati</span>'}</div>
        <div class="field"><textarea id="qs-qris" rows="2" placeholder="Tempel string QRIS hasil scan…" style="font-size:11px">${esc(qs.qris_static || '')}</textarea></div>
        <div class="divider"></div>
        <div style="font-weight:800;font-size:13px;margin-bottom:6px">💬 WhatsApp CS</div>
        <div class="row" style="gap:8px"><input id="qs-wa" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="62812…" value="${esc(qs.wa_cs || '')}">
        <button class="btn sm ${qs.wa_cs_enabled ? 'purple' : 'ghost'}" onclick="admQSToggleWA(${qs.wa_cs_enabled ? 0 : 1})">${qs.wa_cs_enabled ? '✅ Tampil' : '⏸ Sembunyi'}</button></div>
        <div class="divider"></div>
        <div style="font-weight:800;font-size:13px;margin-bottom:6px">📧 Email SMTP ${qs.smtp_configured ? '<span class="chip" style="background:#dcfce7;color:#15803d">Aktif</span>' : '<span class="chip" style="background:#fee2e2;color:#b91c1c">Belum</span>'}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input id="qs-smtp-h" class="grow" style="min-width:120px;border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="Host (smtp.gmail.com)" value="${esc(qs.smtp_host || '')}">
          <input id="qs-smtp-p" style="width:80px;border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="Port" value="${esc(qs.smtp_port || '587')}">
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
          <input id="qs-smtp-u" class="grow" style="min-width:120px;border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="Username" value="${esc(qs.smtp_user || '')}">
          <input id="qs-smtp-pw" type="password" class="grow" style="min-width:120px;border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="Password / App password">
        </div>
        <div class="row" style="gap:8px;margin-top:8px">
          <input id="qs-smtp-f" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="From (opsional)" value="${esc(qs.smtp_from || '')}">
          <button class="btn sm ghost" onclick="admQSSMTPTest()">📨 Kirim Tes</button>
        </div>
        <div class="divider"></div>
        <div style="font-weight:800;font-size:13px;margin-bottom:6px">🔑 Login Google OAuth ${qs.google_oauth_configured ? '<span class="chip" style="background:#dcfce7;color:#15803d">Aktif</span>' : '<span class="chip" style="background:#fee2e2;color:#b91c1c">Belum</span>'}</div>
        <div class="field"><label>Client ID</label><input id="qs-gid" value="${esc(qs.google_client_id || '')}"></div>
        <div class="field"><label>Client Secret</label><input id="qs-gsec" type="password" placeholder="${qs.google_oauth_configured ? '•••••••• (terisi)' : 'Client secret'}"></div>
        <div style="height:10px"></div>
        <button class="btn block purple" onclick="admQSSave()">💾 Simpan Pengaturan Cepat</button>
      </div>
      <div style="height:12px"></div>
      <button class="btn block purple" onclick="go('#/admin/orders')">Manage Orders →</button>`;
  } catch (e) { el.innerHTML = `<div class="empty">Failed to load stats.</div>`; }
}
async function admQSSave() {
  try {
    const gsec = document.getElementById('qs-gsec').value.trim();
    const body = {
      qris_static: document.getElementById('qs-qris').value.trim(),
      wa_cs: document.getElementById('qs-wa').value.trim(),
      smtp_host: document.getElementById('qs-smtp-h').value.trim(),
      smtp_port: document.getElementById('qs-smtp-p').value.trim(),
      smtp_user: document.getElementById('qs-smtp-u').value.trim(),
      smtp_from: document.getElementById('qs-smtp-f').value.trim(),
      google_client_id: document.getElementById('qs-gid').value.trim(),
    };
    const pw = document.getElementById('qs-smtp-pw').value.trim();
    if (pw) body.smtp_pass = pw;
    if (gsec) body.google_client_secret = gsec;
    await api.put('/api/admin/settings', body);
    toast('Pengaturan cepat disimpan', true);
    admDash();
  } catch (e) { toast(e.message, false); }
}
async function admQSToggleWA(on) {
  try {
    const wa = document.getElementById('qs-wa').value.trim();
    await api.put('/api/admin/settings', { wa_cs: wa, wa_cs_enabled: !!on });
    toast('WhatsApp CS ' + (on ? 'ditampilkan' : 'disembunyikan'), true);
    admDash();
  } catch (e) { toast(e.message, false); }
}
async function admQSSMTPTest() {
  try {
    toast('Mengirim email tes…', true);
    const d = await api.post('/api/admin/smtp/test', {});
    toast('Email tes terkirim ke ' + d.to, true);
  } catch (e) { toast(e.message, false); }
}

async function admOrders() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<div class="skel" style="height:64px"></div><div class="skel" style="height:64px;margin-top:10px"></div><div class="skel" style="height:64px;margin-top:10px"></div>`;
  try {
    const d = await api.get('/api/orders/all?limit=200');
    window._admOrders = d.orders || [];
    window._admOrderFilter = window._admOrderFilter || 'all';
    window._admOrderQ = window._admOrderQ || '';
    renderAdmOrders();
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
function renderAdmOrders() {
  const el = document.getElementById('adm-body');
  const all = window._admOrders || [];
  const f = window._admOrderFilter || 'all';
  const counts = {};
  all.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
  const statuses = ['pending', 'proses', 'delivery', 'selesai', 'dibatalkan'];
  el.innerHTML = `
    <div class="row" style="margin-bottom:10px"><input id="ao-q" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="🔍 Cari ID / nama item / email…" value="${esc(window._admOrderQ || '')}" oninput="window._admOrderQ=this.value;window._admOrderPage=1;renderAdmOrdersList()"></div>
    <div class="adm-tabs" style="margin-bottom:10px">
      <button class="chip ${f === 'all' ? 'active' : ''}" onclick="window._admOrderFilter='all';window._admOrderPage=1;renderAdmOrders()">Semua (${all.length})</button>
      ${statuses.map((s) => `<button class="chip ${f === s ? 'active' : ''}" onclick="window._admOrderFilter='${s}';window._admOrderPage=1;renderAdmOrders()">${s} (${counts[s] || 0})</button>`).join('')}
    </div>
    <div id="ao-list"></div>`;
  renderAdmOrdersList();
}
function admOrderFiltered() {
  const all = window._admOrders || [];
  const f = window._admOrderFilter || 'all';
  const q = (window._admOrderQ || '').toLowerCase();
  let list = all.filter((o) => (f === 'all' || o.status === f));
  if (q) list = list.filter((o) => String(o.id).includes(q) || (o.items || []).some((i) => (i.name || '').toLowerCase().includes(q)) || String(o.user_email || o.email || '').toLowerCase().includes(q));
  return list;
}
function renderAdmOrdersList() {
  const el = document.getElementById('ao-list');
  if (!el) return;
  const list = admOrderFiltered();
  const perPage = 20;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  let pg = Math.min(window._admOrderPage || 1, pages);
  window._admOrderPage = pg;
  const rows = list.slice((pg - 1) * perPage, pg * perPage);
  el.innerHTML = rows.length ? `<div class="card" style="overflow-x:auto"><table class="tbl"><tr><th>#</th><th>Items</th><th>Total</th><th>Bukti</th><th>Status</th><th></th></tr>` +
    rows.map((o) => `<tr><td><b>#${o.id}</b></td><td style="font-size:12px">${esc((o.items || []).map((i) => i.name).join(', '))}</td>
    <td><b>${rp(o.total)}</b></td>
    <td>${o.proof_path ? `<a href="${esc(o.proof_path)}" target="_blank" style="font-size:12px;font-weight:800">🧾 lihat</a>` : '<span class="muted">—</span>'}</td>
    <td>${statusPill(o.status)}</td>
    <td style="white-space:nowrap">
      ${o.status === 'proses' ? `<button class="btn sm purple" title="Input data & delivery" onclick="admOrderDetail(${o.id})">📤</button> ` : ''}
      ${['pending', 'proses'].includes(o.status) ? `<button class="btn sm line" style="color:#b91c1c" title="Batal paksa" onclick="admForceCancel(${o.id})">⚠️</button> ` : ''}
      <button class="btn sm ghost" onclick="admOrderDetail(${o.id})">Open</button>
    </td></tr>`).join('') + `</table></div>
    ${pages > 1 ? `<div class="row" style="justify-content:center;gap:6px;margin-top:10px">
      <button class="btn sm ghost" ${pg <= 1 ? 'disabled style="opacity:.4"' : ''} onclick="window._admOrderPage=${pg - 1};renderAdmOrdersList()">‹</button>
      ${Array.from({ length: pages }, (_, i) => i + 1).map((p) => `<button class="btn sm ${p === pg ? 'purple' : 'ghost'}" onclick="window._admOrderPage=${p};renderAdmOrdersList()">${p}</button>`).join('')}
      <button class="btn sm ghost" ${pg >= pages ? 'disabled style="opacity:.4"' : ''} onclick="window._admOrderPage=${pg + 1};renderAdmOrdersList()">›</button>
    </div>` : ''}`
    : `<div class="empty"><div class="big">📦</div>No orders found.</div>`;
}
async function admForceCancel(id) {
  confirmModal('Batal paksa pesanan?', `Batalkan pesanan #${id}? Stok/voucher akan dikembalikan.`, async () => {
    try { await api.patch(`/api/orders/${id}/status`, { status: 'dibatalkan', force: true }); toast(`Order #${id} dibatalkan`, true); admOrders(); }
    catch (e) { toast(e.message, false); }
  });
}
async function admOrderDetail(id) {
  try {
    const d = await api.get('/api/orders/' + id);
    const o = d.order;
    const next = { pending: ['proses', 'dibatalkan'], proses: ['delivery', 'dibatalkan'], delivery: ['selesai', 'dibatalkan'] }[o.status] || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">Order #${o.id} ${statusPill(o.status)}</h3>
      <div style="font-size:14px;margin-bottom:8px">${esc((o.items || []).map((i) => `${i.name} × ${i.qty}`).join('<br>'))}</div>
      ${(o.items || []).some((i) => i.game_id) ? `<div class="announce" style="margin:0 0 8px">🎮 <b>ID Game:</b> ${esc((o.items || []).filter((i) => i.game_id).map((i) => `${i.name}: ${i.game_id}`).join(' • '))}</div>` : ''}
      <div class="row" style="margin-bottom:8px"><span class="muted grow">Total</span><b class="price">${rp(o.total)}</b></div>
      <div class="muted" style="font-size:13px">Pay via: ${esc(o.payment_method)}${o.voucher_code ? ` • Voucher: ${esc(o.voucher_code)}` : ''}</div>
      ${o.proof_path ? `<div style="margin:10px 0"><b>Payment proof:</b><br><img src="${esc(o.proof_path)}" loading="lazy" decoding="async" style="max-width:100%;border-radius:12px;margin-top:6px"></div>` : ''}
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
    const [pd, sd] = await Promise.all([api.get('/api/products?limit=200'), api.get('/api/settings/public').catch(() => ({ categories: [] }))]);
    window._admProds = pd.products || [];
    window._admProdQ = window._admProdQ || '';
    window._admProdCat = window._admProdCat || 'all';
    window._admProdSel = new Set();
    window._admCats = sd.categories || [];
    renderAdmProducts();
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
function admProdFiltered() {
  const q = (window._admProdQ || '').toLowerCase();
  const c = window._admProdCat || 'all';
  return (window._admProds || []).filter((p) =>
    (c === 'all' || p.category === c) &&
    (!q || (p.name || '').toLowerCase().includes(q)));
}
function renderAdmProducts() {
  const el = document.getElementById('adm-body');
  const cats = window._admCats || [];
  const sel = window._admProdSel || new Set();
  el.innerHTML = `
    <button class="btn purple block" style="margin-bottom:12px" onclick="admProductForm()">+ Add Product</button>
    <div class="row" style="margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <input id="aprod-q" class="grow" style="min-width:160px;border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="🔍 Cari produk…" value="${esc(window._admProdQ || '')}" oninput="window._admProdQ=this.value;renderAdmProdList()">
      <select id="aprod-cat" style="border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" onchange="window._admProdCat=this.value;renderAdmProducts()">
        <option value="all">Semua kategori</option>
        ${cats.map((c) => `<option value="${esc(c.id)}" ${(window._admProdCat === c.id) ? 'selected' : ''}>${esc(c.icon || '')} ${esc(c.label)}</option>`).join('')}
      </select>
    </div>
    <div id="aprod-bulk" style="display:none;margin-bottom:10px" class="card"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
      <b id="aprod-n">0 dipilih</b>
      <input id="aprod-bv" type="number" value="10" style="width:90px;border:2px solid var(--line);border-radius:10px;padding:8px;background:var(--card-solid);color:var(--ink)">
      <button class="btn sm purple" onclick="admBulkStock('set')">Set stok</button>
      <button class="btn sm purple" onclick="admBulkStock('add')">+ Tambah</button>
      <button class="btn sm ghost" onclick="window._admProdSel=new Set();renderAdmProducts()">Batal</button>
    </div></div>
    <div id="aprod-list"></div>`;
  renderAdmProdList();
}
function renderAdmProdList() {
  const el = document.getElementById('aprod-list');
  if (!el) return;
  const list = admProdFiltered();
  const sel = window._admProdSel || new Set();
  const bulk = document.getElementById('aprod-bulk');
  if (bulk) {
    bulk.style.display = sel.size ? '' : 'none';
    const n = document.getElementById('aprod-n');
    if (n) n.textContent = `${sel.size} dipilih`;
  }
  el.innerHTML = list.length ? `<div class="card" style="overflow-x:auto"><table class="tbl">
    <tr><th><input type="checkbox" onchange="admProdSelAll(this.checked)"></th><th></th><th>Product</th><th>Price</th><th>Stock</th><th></th></tr>` +
    list.map((p) => {
      const low = (p.stock || 0) <= 5;
      return `<tr><td><input type="checkbox" ${sel.has(p.id) ? 'checked' : ''} onchange="admProdSel(${p.id},this.checked)"></td>
      <td>${p.image_url ? `<img class="thumb" src="${esc(imgUrl(p.image_url))}" loading="lazy" decoding="async">` : '🎮'}</td>
      <td><b>${esc(p.name)}</b><br><span class="muted" style="font-size:11px">${esc(p.category || '')}</span>${low ? ' <span class="chip" style="background:#fee2e2;color:#b91c1c">⚠️ rendah</span>' : ''}</td>
      <td><b>${rp(p.price)}</b>${p.discount ? `<br><span class="chip" style="background:#fef3c7;color:#b45309">-${p.discount}%</span>` : ''}</td>
      <td><b>${p.stock}</b> <button class="btn sm ghost" title="Tambah 10 stok" onclick="admQuickStock(${p.id},10)">+10</button></td>
      <td style="white-space:nowrap">
        ${p.category === 'akun'
          ? `<button class="btn sm ghost" title="Kelola stok akun" onclick="admProductAccounts(${p.id})">👤 Stok</button>`
          : `<button class="btn sm ghost" title="Kelola stok kode" onclick="admProductCodes(${p.id})">🎫 Stok</button>`}
        <button class="btn sm ghost" title="Edit" onclick="admProductForm(${p.id})">✏️</button>
        <button class="btn sm line" style="color:#b91c1c" title="Hapus" onclick="admDelProduct(${p.id})">🗑️</button>
      </td></tr>`;
    }).join('') + `</table></div>`
    : `<div class="empty"><div class="big">🎮</div>No products found.</div>`;
}
function admProdSel(id, on) {
  const sel = window._admProdSel || (window._admProdSel = new Set());
  if (on) sel.add(id); else sel.delete(id);
  renderAdmProdList();
}
function admProdSelAll(on) {
  const sel = new Set();
  if (on) admProdFiltered().forEach((p) => sel.add(p.id));
  window._admProdSel = sel;
  renderAdmProdList();
}
async function admQuickStock(id, add) {
  try {
    const p = (window._admProds || []).find((x) => x.id === id);
    const cur = p ? (p.stock || 0) : 0;
    await api.put('/api/products/' + id, { stock: cur + add });
    toast(`Stok #${id} → ${cur + add}`, true);
    admProducts();
  } catch (e) { toast(e.message, false); }
}
async function admBulkStock(mode) {
  const sel = [...(window._admProdSel || [])];
  if (!sel.length) return;
  const v = +document.getElementById('aprod-bv').value || 0;
  try {
    for (const id of sel) {
      const p = (window._admProds || []).find((x) => x.id === id);
      const cur = p ? (p.stock || 0) : 0;
      await api.put('/api/products/' + id, { stock: mode === 'set' ? v : cur + v });
    }
    toast(`${sel.length} produk diupdate`, true);
    window._admProdSel = new Set();
    admProducts();
  } catch (e) { toast(e.message, false); }
}
/* ---- Stok kode voucher (pool auto-delivery) ---- */
async function admProductCodes(pid) {
  try {
    const d = await api.get(`/api/admin/products/${pid}/codes`);
    const codes = d.codes || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">🎫 Stok Kode — Produk #${pid}</h3>
      <div class="muted" style="font-size:13px;margin-bottom:8px">${d.available} kode tersedia • kode otomatis terkirim saat delivery • stok produk mengikuti pool</div>
      <div style="max-height:220px;overflow:auto;margin-bottom:10px">
      ${codes.map((c) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
        <code class="grow" style="${c.used ? 'text-decoration:line-through;opacity:.5' : 'font-weight:800'}">${esc(c.code)}</code>
        ${c.used ? `<span class="muted">#${c.order_id}</span>` : `<button class="btn sm line" style="color:#b91c1c" onclick="admDelCode(${pid},${c.id})">✕</button>`}
      </div>`).join('') || '<div class="muted">Belum ada kode.</div>'}</div>
      <div class="field"><label>Tambah kode (satu per baris)</label><textarea id="ac-codes" rows="4" placeholder="KODE1&#10;KODE2"></textarea></div>
      <button class="btn block purple" onclick="admAddCodes(${pid})">+ Tambah Kode</button>`);
  } catch (e) { toast(e.message, false); }
}
async function admAddCodes(pid) {
  const v = document.getElementById('ac-codes').value.trim();
  if (!v) { toast('Isi kode dulu', false); return; }
  try {
    const d = await api.post(`/api/admin/products/${pid}/codes`, { codes: v });
    toast(d.added + ' kode ditambahkan', true);
    admProductCodes(pid); admProducts();
  } catch (e) { toast(e.message, false); }
}
async function admDelCode(pid, cid) {
  try { await api.del(`/api/admin/products/${pid}/codes/${cid}`); admProductCodes(pid); admProducts(); }
  catch (e) { toast(e.message, false); }
}
async function admProductForm(id) {  let p = { name: '', price: 0, stock: 10, category: 'topup', tags: '', description: '', discount: 0, image_url: '' };
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
    <div class="field"><label>Image URL</label><input id="ap-img" value="${esc(p.image_url || '')}" placeholder="/img/ml.webp"></div>
    <button class="btn block purple" onclick="admSaveProduct(${id || 0})">Save</button>
    ${id ? `<div style="height:8px"></div><button class="btn block line" onclick="admProductVariants(${id})">Manage Variants (denominations)</button>
    <div style="height:8px"></div>${p.category === 'akun'
      ? `<button class="btn block line" onclick="admProductAccounts(${id})">👤 Kelola Stok Akun</button>`
      : `<button class="btn block line" onclick="admProductCodes(${id})">🎫 Kelola Stok Kode</button>`}
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

/* ---- Stok akun otomatis (mirip Toko-Game): format "email | password | catatan" per baris ---- */
async function admProductAccounts(pid) {
  try {
    const d = await api.get(`/api/admin/products/${pid}/accounts`);
    const accs = d.accounts || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">👤 Stok Akun</h3>
      <div class="muted" style="font-size:12.5px;font-weight:600;margin-bottom:10px">Tersedia: <b style="color:var(--green)">${d.available || 0}</b> akun • Saat pesanan di-delivery, akun otomatis dikirim ke pembeli (FIFO).</div>
      <div style="max-height:220px;overflow:auto;margin-bottom:10px">
      ${accs.map((a) => `<div class="row" style="margin-bottom:8px"><span class="grow" style="font-weight:700;font-size:13px">${esc(a.email)} ${a.used ? `<span class="chip">order #${a.order_id}</span>` : '<span class="chip" style="background:#dcfce7;color:#166534">ready</span>'}${a.notes ? `<div class="muted" style="font-weight:600">${esc(a.notes)}</div>` : ''}</span>${a.used ? '' : `<button class="btn sm line" style="color:#b91c1c" onclick="admDelAccount(${pid},${a.id})">✕</button>`}</div>`).join('') || '<div class="muted">Belum ada akun.</div>'}
      </div>
      <div class="divider"></div>
      <div class="field"><label>Tambah akun (satu per baris: email | password | catatan)</label>
      <textarea id="aa-bulk" rows="4" style="border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit" placeholder="user1@mail.com | pass123 | rank epic&#10;user2@mail.com | pass456"></textarea></div>
      <button class="btn block purple" onclick="admAddAccounts(${pid})">+ Tambah Akun</button>`);
  } catch (e) { toast(e.message, false); }
}
async function admAddAccounts(pid) {
  const v = document.getElementById('aa-bulk').value.trim();
  if (!v) { toast('Isi dulu daftar akun', false); return; }
  try {
    const d = await api.post(`/api/admin/products/${pid}/accounts`, { accounts: v });
    toast(`Ditambahkan. Tersedia: ${d.available}`, true);
    admProductAccounts(pid);
  } catch (e) { toast(e.message, false); }
}
async function admDelAccount(pid, aid) {
  try { await api.del(`/api/admin/products/${pid}/accounts/${aid}`); admProductAccounts(pid); }
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
      <button class="btn sm ghost" onclick="admToggleVoucher('${esc(v.code)}',${v.active ? 0 : 1})">${v.active ? '⏸ Off' : '▶ On'}</button>
      <button class="btn sm" style="background:var(--card2);color:var(--ink);box-shadow:none" onclick="admDelVoucher('${esc(v.code)}')">Delete</button></div></div>`).join('') || '<div class="empty">No vouchers.</div>');
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admToggleVoucher(code, active) {
  try { await api.patch('/api/admin/vouchers/' + encodeURIComponent(code), { active: !!active }); admVouchers(); }
  catch (e) { toast(e.message, false); }
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

/* ---- Laporan penjualan ---- */
function admRepDates() {
  const fmt = (dt) => dt.toISOString().slice(0, 10);
  const to = new Date();
  const days = window._repDays || 30;
  const from = new Date(Date.now() - (days - 1) * 864e5);
  return { from: window._repFrom || fmt(from), to: window._repTo || fmt(to) };
}
async function admReports() {
  const el = document.getElementById('adm-body');
  const { from, to } = admRepDates();
  el.innerHTML = `
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:900;margin-bottom:10px">📈 Laporan Penjualan</div>
      <div class="adm-tabs" style="margin-bottom:10px">
        ${[7, 30, 90].map((n) => `<button class="chip ${(window._repDays || 30) === n && !window._repCustom ? 'active' : ''}" onclick="window._repDays=${n};window._repCustom=false;window._repFrom='';window._repTo='';admReports()">${n} hari</button>`).join('')}
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input id="rep-from" type="date" value="${from}" style="border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" onchange="window._repCustom=true">
        <input id="rep-to" type="date" value="${to}" style="border:2px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;background:var(--card-solid);color:var(--ink)" onchange="window._repCustom=true">
        <button class="btn sm purple" onclick="window._repFrom=document.getElementById('rep-from').value;window._repTo=document.getElementById('rep-to').value;admReports()">Tampilkan</button>
        <button class="btn sm ghost" onclick="admRepCSV()">📥 Export CSV</button>
      </div>
    </div>
    <div id="rep-body"><div class="skel" style="height:120px"></div></div>`;
  try {
    const d = await api.get(`/api/admin/reports/sales?from=${from}&to=${to}`);
    const s = d.summary || {};
    const body = document.getElementById('rep-body');
    if (!body) return;
    body.innerHTML = `
      <div class="adm-grid" style="margin-bottom:12px">
        <div class="stat"><div class="n">${rp(s.revenue || 0)}</div><div class="l">Total Omzet</div></div>
        <div class="stat"><div class="n">${s.orders || 0}</div><div class="l">Pesanan</div></div>
        <div class="stat"><div class="n">${rp(Math.round(s.avg_order || 0))}</div><div class="l">Rata-rata / Pesanan</div></div>
      </div>
      <div class="card" style="margin-bottom:12px">
        <div style="font-weight:900;margin-bottom:8px">🏆 Produk Terlaris</div>
        <div style="overflow-x:auto"><table class="tbl"><tr><th>Produk</th><th>Terjual</th><th>Omzet</th></tr>
        ${(d.topProducts || []).map((p) => `<tr><td style="font-weight:700">${esc(p.name || ('#' + p.pid))}</td><td>${p.qty}</td><td><b>${rp(p.revenue)}</b></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Tidak ada data.</td></tr>'}
        </table></div>
      </div>
      <div class="card" style="margin-bottom:12px">
        <div style="font-weight:900;margin-bottom:8px">💳 Per Metode Bayar</div>
        <div style="overflow-x:auto"><table class="tbl"><tr><th>Metode</th><th>Pesanan</th><th>Omzet</th></tr>
        ${(d.byPayment || []).map((m) => `<tr><td style="font-weight:700">${esc(m.m || '-')}</td><td>${m.orders}</td><td><b>${rp(m.revenue)}</b></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Tidak ada data.</td></tr>'}
        </table></div>
      </div>
      <div class="card">
        <div style="font-weight:900;margin-bottom:8px">📅 Per Hari</div>
        <div style="overflow-x:auto"><table class="tbl"><tr><th>Tanggal</th><th>Pesanan</th><th>Omzet</th></tr>
        ${(d.byDay || []).map((x) => `<tr><td style="font-weight:700">${esc(x.d)}</td><td>${x.orders}</td><td><b>${rp(x.revenue)}</b></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Tidak ada data.</td></tr>'}
        </table></div>
      </div>`;
  } catch (e) {
    const body = document.getElementById('rep-body');
    if (body) body.innerHTML = `<div class="empty">Failed to load.</div>`;
  }
}
async function admRepCSV() {
  const { from, to } = admRepDates();
  try {
    toast('Menyiapkan CSV…', true);
    const r = await fetch(`/api/admin/reports/sales.csv?from=${from}&to=${to}`, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('ptu_token') || '') } });
    if (!r.ok) throw new Error('Gagal');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `laporan-${from}_${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { toast('Gagal export CSV', false); }
}

async function admBanners() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admBannerForm()">+ Add Banner</button><div class="skel" style="height:100px"></div>`;
  try {
    const d = await api.get('/api/admin/banners');
    el.innerHTML = `<button class="btn purple block" style="margin-bottom:12px" onclick="admBannerForm()">+ Add Banner</button>` +
      ((d.banners || []).map((b, i, arr) => `
      <div class="banner-card"><div class="row" style="padding:10px;gap:6px"><div class="grow"><b>Banner #${b.id}</b><br><span class="muted" style="font-size:12px">${b.active ? '✅ active' : '⏸ off'}</span></div>
      <button class="btn sm ghost" title="Naik" onclick="admMoveBanner(${b.id},-1)" ${i === 0 ? 'disabled style="opacity:.35"' : ''}>↑</button>
      <button class="btn sm ghost" title="Turun" onclick="admMoveBanner(${b.id},1)" ${i === arr.length - 1 ? 'disabled style="opacity:.35"' : ''}>↓</button>
      <button class="btn sm ghost" onclick="admToggleBanner(${b.id},${b.active ? 0 : 1})">${b.active ? 'Off' : 'On'}</button>
      <button class="btn sm line" style="color:#b91c1c" onclick="admDelBanner(${b.id})">✕</button></div>
      <div class="row" style="padding:0 10px 10px;gap:6px"><input id="ab-link-${b.id}" class="grow" style="border:2px solid var(--line);border-radius:10px;padding:8px 10px;font-family:inherit;font-size:12px;background:var(--card-solid);color:var(--ink)" value="${esc(b.link_url || '')}" placeholder="Link tujuan (optional)"><button class="btn sm purple" onclick="admSaveBannerLink(${b.id})">Simpan</button></div>
      ${b.image_url ? `<div class="imgph"><img src="${esc(imgUrl(b.image_url))}" loading="lazy" decoding="async" onload="imgLd(this)" style="width:100%;display:block"></div>` : ''}</div>`).join('') || '<div class="empty">No banners.</div>');
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
async function admSaveBannerLink(id) {
  const v = document.getElementById('ab-link-' + id).value.trim();
  try { await api.patch('/api/admin/banners/' + id, { link_url: v }); toast('Link saved', true); }
  catch (e) { toast(e.message, false); }
}
async function admMoveBanner(id, dir) {
  try {
    const d = await api.get('/api/admin/banners');
    const arr = (d.banners || []).slice().sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
    const i = arr.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    await api.patch('/api/admin/banners/' + a.id, { sort_order: b.sort_order });
    await api.patch('/api/admin/banners/' + b.id, { sort_order: a.sort_order });
    admBanners();
  } catch (e) { toast(e.message, false); }
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
  el.innerHTML = `<div class="skel" style="height:70px"></div><div class="skel" style="height:70px;margin-top:10px"></div>`;
  try {
    const d = await api.get('/api/admin/tickets');
    window._admTickets = d.tickets || [];
    window._admTicketFilter = window._admTicketFilter || 'all';
    renderAdmTickets();
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
function renderAdmTickets() {
  const el = document.getElementById('adm-body');
  const all = window._admTickets || [];
  const f = window._admTicketFilter || 'all';
  const counts = { open: 0, answered: 0, closed: 0 };
  all.forEach((t) => { if (counts[t.status] !== undefined) counts[t.status]++; });
  const filters = [['open', 'Butuh Balasan'], ['answered', 'Terjawab'], ['closed', 'Ditutup'], ['all', 'Semua']];
  const list = all.filter((t) => f === 'all' || t.status === f);
  const pill = (s) => s === 'open' ? '<span class="chip" style="background:#fef3c7;color:#b45309">Butuh Balasan</span>'
    : s === 'answered' ? '<span class="chip" style="background:#dbeafe;color:#1d4ed8">Terjawab</span>'
    : '<span class="chip" style="background:#e5e7eb;color:#4b5563">Ditutup</span>';
  el.innerHTML = `
    <div class="adm-tabs" style="margin-bottom:10px">
      ${filters.map(([k, l]) => `<button class="chip ${f === k ? 'active' : ''}" onclick="window._admTicketFilter='${k}';renderAdmTickets()">${l} (${k === 'all' ? all.length : counts[k]})</button>`).join('')}
    </div>
    ${list.length ? list.map((t) => `
      <div class="card" style="margin-bottom:10px;cursor:pointer" onclick="admTicketDetail(${t.id})">
        <div class="row"><b class="grow">#${t.id} ${esc(t.subject)}</b>${pill(t.status)}</div>
        <div class="muted" style="font-size:12px;font-weight:700">${esc(t.user_name || t.user_email || '')}${t.order_id ? ` • order #${t.order_id}` : ''} • ${esc(t.created_at || '')}</div>
      </div>`).join('') : `<div class="empty"><div class="big">💬</div>No tickets.</div>`}`;
}
async function admTicketDetail(id) {
  try {
    const d = await api.get('/api/admin/tickets/' + id);
    const t = d.ticket, msgs = t.messages || [];
    openModal(`<button class="mclose" onclick="closeModal()">✕</button>
      <h3 style="margin-top:0">${esc(t.subject)}</h3>
      ${msgs.map((m) => `<div class="ticket-msg ${m.is_admin ? '' : 'me'}"><div class="who">${m.is_admin ? '🛡️ You (admin)' : esc(t.user_name || 'User')} • ${esc(m.created_at || '')}</div><div style="font-size:14px">${esc(m.message)}</div></div>`).join('')}
      <div class="row" style="margin-top:8px"><input id="adm-tr" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit" placeholder="Reply…"><button class="btn sm purple" onclick="admReplyTicket(${id})">Send</button></div>
      <div class="row" style="margin-top:8px"><span class="grow"></span>
      ${t.status !== 'closed' ? `<button class="btn sm ghost" onclick="admTicketStatus(${id},'closed')">🔒 Tutup Tiket</button>` : `<button class="btn sm ghost" onclick="admTicketStatus(${id},'open')">🔓 Buka Lagi</button>`}
      </div>`);
  } catch (e) { toast(e.message, false); }
}
async function admReplyTicket(id) {
  const v = document.getElementById('adm-tr').value.trim();
  if (!v) return;
  try { await api.post(`/api/admin/tickets/${id}/reply`, { message: v }); admTicketDetail(id); }
  catch (e) { toast(e.message, false); }
}
async function admTicketStatus(id, status) {
  try { await api.patch(`/api/admin/tickets/${id}`, { status }); closeModal(); toast('Tiket #' + id + ' → ' + status, true); admTickets(); }
  catch (e) { toast(e.message, false); }
}

async function admUsers() {
  const el = document.getElementById('adm-body');
  el.innerHTML = `<div class="skel" style="height:120px"></div>`;
  try {
    const d = await api.get('/api/users');
    window._admUsers = d.users || [];
    window._admUserQ = window._admUserQ || '';
    try { const me = await api.get('/api/auth/me'); window._admMeId = me.user && me.user.id; } catch {}
    renderAdmUsers();
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
function renderAdmUsers() {
  const el = document.getElementById('adm-body');
  const q = (window._admUserQ || '').toLowerCase();
  const list = (window._admUsers || []).filter((u) => !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  el.innerHTML = `
    <div class="row" style="margin-bottom:10px"><input id="au-q" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit;background:var(--card-solid);color:var(--ink)" placeholder="🔍 Cari nama / email…" value="${esc(window._admUserQ || '')}" oninput="window._admUserQ=this.value;renderAdmUserList()"></div>
    <div id="au-list"></div>`;
  renderAdmUserList();
}
function renderAdmUserList() {
  const el = document.getElementById('au-list');
  if (!el) return;
  const q = (window._admUserQ || '').toLowerCase();
  const me = window._admMeId;
  const list = (window._admUsers || []).filter((u) => !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  el.innerHTML = `<div class="card" style="overflow-x:auto"><table class="tbl"><tr><th>User</th><th>Email</th><th>Role</th><th></th></tr>` +
    list.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.id === me ? ' <span class="muted" style="font-size:11px">(kamu)</span>' : ''}<br>${u.email_verified ? '<span class="chip" style="background:#dcfce7;color:#15803d">✓ terverifikasi</span>' : '<span class="chip" style="background:#fee2e2;color:#b91c1c">! belum verifikasi</span>'}</td>
    <td style="font-size:12px">${esc(u.email)}</td><td>${u.role === 'admin' ? '👑 admin' : 'user'}</td>
    <td>${u.role !== 'admin' ? `<button class="btn sm ghost" onclick="admMakeAdmin(${u.id})">Jadikan Admin</button>` : ''}</td></tr>`).join('') + `</table></div>`;
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
    const [d, pm] = await Promise.all([
      api.get('/api/admin/store-settings'),
      api.get('/api/admin/pay-methods').catch(() => ({ methods: [] })),
    ]);
    window._admPayMethods = pm.methods || [];
    window._admCatsFull = d.categories || [];
    window._admCatOpen = window._admCatOpen || {};
    el.innerHTML = `
      <div class="card">
        <div style="font-weight:900;margin-bottom:8px">🏪 Store</div>
        <div class="field"><label>Store name</label><input id="as-name" value="${esc(d.store_name || '')}"></div>
        <div class="field"><label>Announcement</label><textarea id="as-ann" rows="2">${esc(d.announcement || '')}</textarea></div>
        <div class="row" style="margin-bottom:10px;align-items:center"><span class="grow" style="font-weight:700;font-size:13px">📢 Tampilkan pengumuman</span><button class="btn sm ${d.announcement_on ? 'purple' : 'ghost'}" onclick="admToggleAnn(${d.announcement_on ? 0 : 1})">${d.announcement_on ? '✅ On' : '⏸ Off'}</button></div>
        <div class="field"><label>Flash sale ends (ISO datetime)</label><input id="as-flash" value="${esc(d.flash_sale_ends || '')}" placeholder="2026-12-31T23:59:59"></div>
        <div class="field"><label>Auto-complete delivery (hari)</label><input id="as-acd" type="number" value="${d.auto_complete_days || 2}"></div>
        <button class="btn block purple" onclick="admSaveSettings()">Save Settings</button>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="row" style="margin-bottom:8px"><div class="grow" style="font-weight:900">🗂️ Categories</div><button class="btn sm purple" onclick="admCatForm()">+ Add</button></div>
        <div id="cat-admin"></div>
      </div>
      <div class="card" style="margin-top:12px">
        <div class="row" style="margin-bottom:8px"><div class="grow" style="font-weight:900">💳 Payment Methods</div><button class="btn sm purple" onclick="admPmForm()">+ Add</button></div>
        <div id="pm-admin">${(window._admPayMethods || []).map((m) => `<div class="row" style="margin-bottom:8px;gap:6px"><span class="grow" style="font-weight:700;font-size:13px">${esc(m.label)} <span class="muted">(${esc(m.kind)})</span>${m.details ? `<div class="muted" style="font-weight:600;font-size:12px">${esc(m.details)}</div>` : ''}</span>
          <button class="btn sm ghost" onclick="admTogglePm('${esc(m.id)}',${m.active ? 0 : 1})">${m.active ? '✅' : '⏸'}</button>
          <button class="btn sm ghost" onclick="admPmForm('${esc(m.id)}')">✏️</button>
          <button class="btn sm line" style="color:#b91c1c" onclick="admDelPm('${esc(m.id)}')">✕</button></div>`).join('') || '<div class="muted">No payment methods.</div>'}</div>
      </div>`;
    renderAdmCats();
  } catch { el.innerHTML = `<div class="empty">Failed to load.</div>`; }
}
/* ---- Kategori nested (expand/collapse + subkategori) ---- */
function renderAdmCats() {
  const el = document.getElementById('cat-admin');
  if (!el) return;
  const all = window._admCatsFull || [];
  const open = window._admCatOpen || {};
  const tops = all.filter((c) => !c.parent_id);
  const kidsOf = (pid) => all.filter((c) => c.parent_id === pid);
  const rowBtns = (c) => `
    <button class="btn sm ghost" onclick="event.stopPropagation();admCatForm('','${esc(c.id)}')" title="Tambah subkategori">＋Sub</button>
    <button class="btn sm ghost" onclick="event.stopPropagation();admToggleCat('${esc(c.id)}',${c.active ? 0 : 1})">${c.active ? '✅' : '⏸'}</button>
    <button class="btn sm ghost" onclick="event.stopPropagation();admCatForm('${esc(c.id)}')">✏️</button>
    <button class="btn sm line" style="color:#b91c1c" onclick="event.stopPropagation();admDelCat('${esc(c.id)}')">✕</button>`;
  el.innerHTML = tops.map((c) => {
    const kids = kidsOf(c.id);
    const isOpen = !!open[c.id];
    return `<div style="margin-bottom:6px">
      <div class="row" style="gap:6px;cursor:pointer" onclick="window._admCatOpen['${esc(c.id)}']=${isOpen ? 'false' : 'true'};renderAdmCats()">
        <span style="font-weight:800">${kids.length ? (isOpen ? '▾' : '▸') : '•'}</span>
        <span class="grow" style="font-weight:700">${esc(c.icon || '')} ${esc(c.label)} <span class="muted">(${esc(c.id)})</span>${kids.length ? ` <span class="muted" style="font-size:11px">${kids.length} sub</span>` : ''}</span>
        ${rowBtns(c)}
      </div>
      ${isOpen && kids.length ? `<div style="margin-left:22px;border-left:2px solid var(--line);padding-left:10px;margin-top:6px">
        ${kids.map((k) => `<div class="row" style="margin-bottom:6px;gap:6px"><span class="grow" style="font-weight:600;font-size:13px">↳ ${esc(k.icon || '')} ${esc(k.label)} <span class="muted">(${esc(k.id)})</span></span>
          <button class="btn sm ghost" onclick="admToggleCat('${esc(k.id)}',${k.active ? 0 : 1})">${k.active ? '✅' : '⏸'}</button>
          <button class="btn sm ghost" onclick="admCatForm('${esc(k.id)}')">✏️</button>
          <button class="btn sm line" style="color:#b91c1c" onclick="admDelCat('${esc(k.id)}')">✕</button></div>`).join('')}
      </div>` : ''}
    </div>`;
  }).join('') || '<div class="muted">Belum ada kategori.</div>';
}
async function admToggleAnn(on) {
  try { await api.put('/api/admin/settings', { announcement_on: !!on }); admSettings(); }
  catch (e) { toast(e.message, false); }
}
async function admSaveSettings() {
  try {
    await api.put('/api/admin/settings', {
      store_name: document.getElementById('as-name').value.trim(),
      announcement: document.getElementById('as-ann').value.trim(),
      flash_sale_ends: document.getElementById('as-flash').value.trim(),
      auto_complete_days: +document.getElementById('as-acd').value || 2,
    });
    toast('Settings saved', true);
  } catch (e) { toast(e.message, false); }
}
/* ---- Kategori ---- */
function admCatForm(id, parentId) {
  const tops = (window._admCatsFull || []).filter((c) => !c.parent_id);
  openModal(`<button class="mclose" onclick="closeModal()">✕</button><h3 style="margin-top:0">${id ? 'Edit' : parentId ? 'Add Subcategory' : 'Add'} Category${parentId ? ' <span class="muted" style="font-size:13px">di bawah ' + esc((tops.find((c) => c.id === parentId) || {}).label || parentId) + '</span>' : ''}</h3>
    <div class="field"><label>Label</label><input id="ac-label" placeholder="Mobile Legends"></div>
    <div class="field"><label>Icon (emoji)</label><input id="ac-icon" placeholder="⚡" maxlength="8"></div>
    ${!id && !parentId ? `<div class="field"><label>Induk (opsional — jadikan subkategori)</label><select id="ac-parent"><option value="">— Kategori utama —</option>${tops.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}</select></div>` : ''}
    <button class="btn block purple" onclick="admSaveCat('${id || ''}','${parentId || ''}')">Save</button>`);
}
async function admSaveCat(id, parentId) {
  const label = document.getElementById('ac-label').value.trim();
  const icon = document.getElementById('ac-icon').value.trim() || '📦';
  if (!label) { toast('Label required', false); return; }
  try {
    if (id) await api.put('/api/admin/categories/' + encodeURIComponent(id), { label, icon });
    else {
      const pel = document.getElementById('ac-parent');
      await api.post('/api/admin/categories', { label, icon, parent_id: parentId || (pel ? pel.value : '') });
    }
    closeModal(); toast('Saved', true); admSettings();
  } catch (e) { toast(e.message, false); }
}
async function admToggleCat(id, active) {
  try { await api.put('/api/admin/categories/' + encodeURIComponent(id), { active: !!active }); admSettings(); }
  catch (e) { toast(e.message, false); }
}
async function admDelCat(id) {
  confirmModal('Delete category?', `Delete category "${id}"?`, async () => {
    try { await api.del('/api/admin/categories/' + encodeURIComponent(id)); toast('Deleted', true); admSettings(); }
    catch (e) { toast(e.message, false); }
  });
}
/* ---- Metode pembayaran ---- */
function admPmForm(id) {
  const m = (window._admPayMethods || []).find((x) => x.id === id) || { label: '', details: '', kind: 'transfer' };
  openModal(`<button class="mclose" onclick="closeModal()">✕</button><h3 style="margin-top:0">${id ? 'Edit' : 'Add'} Payment Method</h3>
    <div class="field"><label>Label</label><input id="apm-label" value="${esc(m.label)}" placeholder="Transfer BCA"></div>
    <div class="field"><label>Detail (no. rekening / instruksi)</label><input id="apm-details" value="${esc(m.details || '')}" placeholder="1234567890 a.n. PlayTopUp"></div>
    <div class="field"><label>Jenis</label><select id="apm-kind"><option value="transfer" ${m.kind === 'transfer' ? 'selected' : ''}>Transfer</option><option value="qris" ${m.kind === 'qris' ? 'selected' : ''}>QRIS</option></select></div>
    <button class="btn block purple" onclick="admSavePm('${id || ''}')">Save</button>`);
}
async function admSavePm(id) {
  const label = document.getElementById('apm-label').value.trim();
  const details = document.getElementById('apm-details').value.trim();
  const kind = document.getElementById('apm-kind').value;
  if (!label) { toast('Label required', false); return; }
  try {
    if (id) await api.put('/api/admin/pay-methods/' + encodeURIComponent(id), { label, details, kind });
    else await api.post('/api/admin/pay-methods', { label, details, kind });
    closeModal(); toast('Saved', true); admSettings();
  } catch (e) { toast(e.message, false); }
}
async function admTogglePm(id, active) {
  try { await api.put('/api/admin/pay-methods/' + encodeURIComponent(id), { active: !!active }); admSettings(); }
  catch (e) { toast(e.message, false); }
}
async function admDelPm(id) {
  confirmModal('Delete payment method?', `Delete "${id}"?`, async () => {
    try { await api.del('/api/admin/pay-methods/' + encodeURIComponent(id)); toast('Deleted', true); admSettings(); }
    catch (e) { toast(e.message, false); }
  });
}
