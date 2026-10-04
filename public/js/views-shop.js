/* ===== PlayTopUp Store — views: cart, checkout, orders ===== */
function vCart() {
  const view = document.getElementById('view');
  const cart = store.cart;
  if (!cart.length) {
    view.innerHTML = `<div class="empty"><div class="big">🛒</div><h3>Your cart is empty</h3><p class="muted">Top up your favorite game now!</p><br><button class="btn" onclick="go('#/games')">Explore Games</button></div>`;
    return;
  }
  view.innerHTML = `
    <div class="sec-head"><h2>Cart (${store.cartCount()})</h2><button class="chip" onclick="store.clearCart();vCart()">Clear</button></div>
    <div id="cart-items">${cart.map((it, i) => `
      <div class="cart-item">
        ${it.image_url ? `<div class="imgph" style="width:64px;height:64px;border-radius:14px;flex:none"><img src="${esc(imgUrl(it.image_url))}" alt="" loading="lazy" decoding="async" onload="imgLd(this)" style="width:64px;height:64px;border-radius:14px;object-fit:cover"></div>` : `<div style="width:64px;height:64px;border-radius:14px;background:var(--purple-soft);display:flex;align-items:center;justify-content:center;font-size:28px">🎮</div>`}
        <div class="grow"><div style="font-weight:900;font-size:14px">${esc(it.name)}</div>
          ${it.variant_label ? `<div class="muted" style="font-size:12px;font-weight:700">${esc(it.variant_label)}</div>` : ''}
          <div class="price" style="font-size:14px">${rp(it.price)}</div></div>
        <div class="qty"><button onclick="chQty(${i},-1)">−</button><b>${it.qty}</b><button onclick="chQty(${i},1)">+</button></div>
      </div>`).join('')}</div>
    <div class="card" style="margin-top:6px">
      <div class="row"><span class="muted grow" style="font-weight:700">Total</span><span class="price" style="font-size:22px">${rp(store.cartTotal())}</span></div>
      <div style="height:12px"></div>
      <button class="btn block" onclick="goCheckout()">Checkout →</button>
    </div>`;
}
function chQty(i, d) { store.setQty(i, (store.cart[i].qty || 1) + d); vCart(); }
function goCheckout() {
  if (!store.user) { sessionStorage.setItem('ptu_after_login', '#/checkout'); go('#/auth'); toast('Login first to checkout'); return; }
  go('#/checkout');
}

async function vCheckout() {
  const view = document.getElementById('view');
  if (!store.cart.length) { go('#/cart'); return; }
  view.innerHTML = `<div class="sec-head"><h2>Checkout</h2></div><div class="skel" style="height:200px"></div>`;
  let pub;
  try { pub = await api.get('/api/settings/public'); cachePayMethods(pub); }
  catch { view.innerHTML = `<div class="empty">Failed to load payment methods.</div>`; return; }
  const methods = pub.pay_methods || [];
  window._co = { method: methods[0] ? methods[0].id : '', voucher: '', discount: 0 };

  view.innerHTML = `
    <div class="sec-head"><h2>Checkout</h2></div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:900;margin-bottom:8px">Order items</div>
      ${store.cart.map((it) => `<div class="row" style="margin-bottom:6px"><span class="grow" style="font-size:14px;font-weight:700">${esc(it.name)}${it.variant_label ? ` <span class="muted">(${esc(it.variant_label)})</span>` : ''} × ${it.qty}</span><b>${rp(it.price * it.qty)}</b></div>`).join('')}
      <div class="divider"></div>
      <div class="row"><span class="grow" style="font-weight:700">Subtotal</span><b id="co-sub">${rp(store.cartTotal())}</b></div>
      <div class="row" id="co-disc-row" style="display:none"><span class="grow" style="font-weight:700;color:var(--green)">Voucher <span id="co-vcode"></span></span><b id="co-disc" style="color:var(--green)"></b></div>
      <div class="row" style="margin-top:6px"><span class="grow" style="font-weight:900">Total</span><span class="price" style="font-size:22px" id="co-total">${rp(store.cartTotal())}</span></div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:900;margin-bottom:4px">🎮 Data Game</div>
      <div class="muted" style="font-size:12.5px;font-weight:600;margin-bottom:10px">Diamond/UC akan dikirim ke ID ini. Pastikan benar!</div>
      ${store.cart.map((it, i) => `
      <div class="field" style="margin-bottom:8px"><label>${gidLabel(it)} — ${esc(it.name)}${it.variant_label ? ` (${esc(it.variant_label)})` : ''}${needGid(it) ? ' *' : ''}</label>
      <input data-gid="${i}" value="${esc(it.game_id || '')}" oninput="setGid(${i},this.value)" placeholder="${needGid(it) ? 'Contoh: 12345678 (cek di profil game)' : 'Email untuk terima kode voucher'}"></div>`).join('')}
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:900;margin-bottom:8px">🎟️ Voucher</div>
      <div class="row"><input id="co-vin" class="grow" style="border:2px solid var(--line);border-radius:12px;padding:10px 12px;font-family:inherit;font-weight:700" placeholder="Voucher code"><button class="btn sm purple" onclick="applyVoucher()">Apply</button></div>
    </div>
    <div class="card">
      <div style="font-weight:900;margin-bottom:8px">💳 Payment method</div>
      <div id="pay-list">${methods.map((m, i) => `
        <div class="pay-method ${i === 0 ? 'sel' : ''}" onclick="selPay('${esc(m.id)}',this)">
          <div style="font-size:24px">${m.kind === 'qris' ? '⚡' : '🏦'}</div>
          <div><div class="pl">${esc(m.label)}</div><div class="pd">${esc(m.desc || '')}</div></div>
        </div>`).join('') || '<div class="muted">No payment methods.</div>'}</div>
      <div style="height:12px"></div>
      <button class="btn block" id="co-btn" onclick="placeOrder()">Place Order →</button>
    </div>`;
}
function selPay(id, el) {
  window._co.method = id;
  document.querySelectorAll('#pay-list .pay-method').forEach((x) => x.classList.remove('sel'));
  el.classList.add('sel');
}
async function applyVoucher() {
  const code = document.getElementById('co-vin').value.trim();
  if (!code) return;
  try {
    const d = await api.post('/api/vouchers/validate', { code, total: store.cartTotal() });
    window._co.voucher = code;
    window._co.discount = d.discount || 0;
    const sub = store.cartTotal();
    const disc = Math.min(window._co.discount, sub);
    document.getElementById('co-disc-row').style.display = 'flex';
    document.getElementById('co-vcode').textContent = '(' + code + ')';
    document.getElementById('co-disc').textContent = '−' + rp(disc);
    document.getElementById('co-total').textContent = rp(sub - disc);
    toast('Voucher applied: ' + code, true);
  } catch (e) { toast(e.message, false); }
}
async function placeOrder() {
  const btn = document.getElementById('co-btn');
  const missing = store.cart.findIndex((it) => needGid(it) && !String(it.game_id || '').trim());
  if (missing >= 0) {
    toast('Isi ID Game untuk "' + store.cart[missing].name + '" dulu', false);
    const inp = document.querySelector(`[data-gid="${missing}"]`);
    if (inp) { inp.focus(); inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return;
  }
  btn.disabled = true; btn.textContent = 'Processing…';
  try {
    const d = await api.post('/api/orders', {
      items: store.cart.map((it) => ({ product_id: it.product_id, variant_id: it.variant_id || null, qty: it.qty, game_id: String(it.game_id || '').trim() })),
      payment_method: window._co.method,
      voucher_code: window._co.voucher || undefined,
    });
    const order = d.order;
    store.clearCart();
    refreshUnread().then(() => renderChrome()).catch(() => {});
    go('#/pay/' + order.id);
  } catch (e) { toast(e.message, false); btn.disabled = false; btn.textContent = 'Place Order →'; }
}

async function vPay(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="skel" style="height:300px;border-radius:22px"></div>`;
  let d;
  try { d = await api.get('/api/orders/' + id); }
  catch { view.innerHTML = `<div class="empty">Order not found.</div>`; return; }
  const o = d.order;
  const isQris = /qris/i.test(o.payment_method);

  if (isQris) {
    let qr = null;
    try { qr = await api.get(`/api/orders/${id}/qris`); } catch (e) { /* fallback */ }
    view.innerHTML = `
      <div class="sec-head"><h2>Pay Order #${o.id}</h2>${statusPill(o.status)}</div>
      <div class="qr-box">
        <div style="font-weight:900;font-size:17px;margin-bottom:4px">⚡ Scan to Pay</div>
        <div class="muted" style="font-size:13px;font-weight:700;margin-bottom:12px">Order #${o.id} • PlayTopUp Store</div>
        ${qr && qr.qr ? `<div class="imgph" style="border-radius:16px;max-width:280px;margin:0 auto"><img src="${qr.qr}" alt="QRIS code" loading="lazy" decoding="async" onload="imgLd(this)" style="width:100%;border-radius:16px"></div>` : `<div class="muted">QR code unavailable — contact support.</div>`}
        <div class="price" style="font-size:26px;margin:12px 0">${rp(o.total)}</div>
        <div class="muted" style="font-size:13px;font-weight:600">Open any e-wallet / m-banking app and scan.<br>Amount is set automatically.</div>
      </div>
      <div style="height:12px"></div>
      <button class="btn block" onclick="go('#/orders')">✓ I've Paid — Track Order</button>
      <div style="height:8px"></div>
      <button class="btn block line" onclick="go('#/track/${o.id}')">Track without login</button>`;
  } else {
    let pub = {};
    try { pub = await api.get('/api/settings/public'); cachePayMethods(pub); } catch {}
    const pm = (pub.pay_methods || []).find((m) => m.id === o.payment_method);
    view.innerHTML = `
      <div class="sec-head"><h2>Pay Order #${o.id}</h2>${statusPill(o.status)}</div>
      <div class="card">
        <div style="font-weight:900;margin-bottom:6px">🏦 ${esc(pm ? pm.label : o.payment_method)}</div>
        <div class="muted" style="font-weight:700;font-size:14px;margin-bottom:10px">${esc(pm ? pm.desc : 'Transfer to our account')}</div>
        <div class="row"><span class="muted grow" style="font-weight:700">Amount to pay</span><span class="price" style="font-size:24px">${rp(o.total)}</span></div>
        <div class="divider"></div>
        <div class="field"><label>Upload payment proof (image, max 5MB)</label>
          <input type="file" id="proof-file" accept="image/*">
          <div id="proof-prev" style="margin-top:8px"></div></div>
        <button class="btn block" id="proof-btn" onclick="uploadProof(${o.id})">Upload Proof</button>
        ${o.proof_path ? `<div class="center" style="margin-top:10px"><span class="chip">✔ Proof uploaded</span></div>` : ''}
      </div>
      <div style="height:12px"></div>
      <button class="btn block line" onclick="go('#/orders')">Track My Orders</button>`;
    const fi = document.getElementById('proof-file');
    fi.addEventListener('change', () => {
      const f = fi.files[0];
      if (f) document.getElementById('proof-prev').innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-width:100%;border-radius:14px" decoding="async">`;
    });
  }
}
async function uploadProof(id) {
  const fi = document.getElementById('proof-file');
  if (!fi.files[0]) { toast('Choose an image first', false); return; }
  const btn = document.getElementById('proof-btn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    const fd = new FormData();
    fd.append('bukti', fi.files[0]);
    await api.upload(`/api/orders/${id}/proof`, fd);
    toast('Proof uploaded', true);
    vPay(id);
  } catch (e) { toast(e.message, false); btn.disabled = false; btn.textContent = 'Upload Proof'; }
}

async function vOrders() {
  const view = document.getElementById('view');
  if (!store.user) { sessionStorage.setItem('ptu_after_login', '#/orders'); go('#/auth'); return; }
  view.innerHTML = `<div class="sec-head"><h2>My Orders</h2></div><div class="skel" style="height:90px"></div><div class="skel" style="height:90px;margin-top:10px"></div>`;
  try {
    const d = await api.get('/api/orders');
    const list = d.orders || [];
    view.innerHTML = `<div class="sec-head"><h2>My Orders</h2></div>` + (list.length ? list.map((o) => `
      <div class="card" style="margin-bottom:10px;cursor:pointer" onclick="go('#/order/${o.id}')">
        <div class="row"><b class="grow">Order #${o.id}</b>${statusPill(o.status)}</div>
        <div class="muted" style="font-size:13px;font-weight:600;margin:4px 0">${esc((o.items || []).map((i) => i.name).join(', '))}</div>
        <div class="row"><span class="muted" style="font-size:12px;font-weight:700">${esc(o.created_at || '')}</span><span class="grow"></span><b class="price">${rp(o.total)}</b></div>
      </div>`).join('') : `<div class="empty"><div class="big">📦</div>No orders yet.<br><br><button class="btn" onclick="go('#/games')">Top Up Now</button></div>`);
  } catch { view.innerHTML = `<div class="empty">Failed to load orders.</div>`; }
}

async function vOrder(id) {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="skel" style="height:200px"></div>`;
  let d;
  try { d = await api.get('/api/orders/' + id); }
  catch { view.innerHTML = `<div class="empty">Order not found.</div>`; return; }
  const o = d.order;
  const steps = [
    { k: 'pending', t: 'Order placed', s: 'We received your order' },
    { k: 'proses', t: 'Processing', s: 'Admin is preparing your items' },
    { k: 'delivery', t: 'Delivered', s: 'Items sent to your account' },
    { k: 'selesai', t: 'Completed', s: 'Enjoy your game!' },
  ];
  const order = ['pending', 'proses', 'delivery', 'selesai'];
  const cur = o.status === 'dibatalkan' ? -1 : order.indexOf(o.status);
  view.innerHTML = `
    <div class="sec-head"><h2>Order #${o.id}</h2>${statusPill(o.status)}</div>
    <div class="card" style="margin-bottom:12px">
      ${(o.items || []).map((i) => `<div style="margin-bottom:8px"><div class="row"><span class="grow" style="font-size:14px;font-weight:700">${esc(i.name)} × ${i.qty}</span><b>${rp(i.price * i.qty)}</b></div>${i.game_id ? `<div class="muted" style="font-size:12.5px;font-weight:700">🎮 ID: ${esc(i.game_id)}</div>` : ''}</div>`).join('')}
      <div class="divider"></div>
      <div class="row"><span class="grow" style="font-weight:700">Total</span><b class="price" style="font-size:20px">${rp(o.total)}</b></div>
      <div class="muted" style="font-size:13px;font-weight:600;margin-top:6px">Paid via: ${esc(o.payment_method)}</div>
      ${o.delivery_data ? `<div class="announce" style="margin:10px 0 0">🎁 <b>Delivery:</b> ${esc(typeof o.delivery_data === 'string' ? o.delivery_data : JSON.stringify(o.delivery_data))}</div>` : ''}
    </div>
    <div class="card"><div style="font-weight:900;margin-bottom:10px">Tracking</div>
      ${o.status === 'dibatalkan' ? `<div class="chip" style="background:#fee2e2;color:#b91c1c">Order cancelled</div>` :
      `<div class="timeline">${steps.map((s, i) => `
        <div class="tl-step ${i < cur ? 'done' : i === cur ? 'now' : ''}">
          <div class="tl-dot">${i < cur ? '✓' : i + 1}</div>
          <div><div class="tt">${s.t}</div><div class="ts">${s.s}</div></div>
        </div>`).join('')}</div>`}
    </div>
    <div style="height:12px"></div>
    <div class="row">
      ${o.status === 'pending' && !/qris/i.test(o.payment_method) ? `<button class="btn grow" onclick="go('#/pay/${o.id}')">Pay Now</button>` : ''}
      ${o.status === 'pending' ? `<button class="btn line grow" onclick="cancelOrder(${o.id})">Cancel</button>` : ''}
    </div>
    ${o.status === 'delivery' ? `<div style="height:10px"></div><button class="btn purple block" onclick="reviewOrder(${o.id})">⭐ Write a Review</button>` : ''}
    <div style="height:10px"></div><button class="btn line block" onclick="buyAgain(${o.id})">🔁 Beli Lagi</button>`;
}
async function buyAgain(oid) {
  try {
    const d = await api.get('/api/orders/' + oid);
    for (const i of (d.order.items || [])) {
      let p = null;
      try { p = (await api.get('/api/products/' + i.product_id)).product; } catch {}
      if (!p) continue;
      const v = (p.variants || []).find((x) => x.id === i.variant_id);
      store.addToCart({
        product_id: p.id, variant_id: v ? v.id : null, name: p.name,
        variant_label: v ? v.label : '', price: v ? v.price : effPrice(p),
        image_url: p.image_url, category: p.category || '', qty: i.qty || 1,
      });
    }
    toast('Ditambahkan ke keranjang', true);
    go('#/cart');
  } catch (e) { toast(e.message, false); }
}
async function cancelOrder(id) {
  confirmModal('Cancel order?', `Cancel order #${id}?`, async () => {
    try { await api.post(`/api/orders/${id}/cancel`); toast('Order cancelled', true); vOrder(id); }
    catch (e) { toast(e.message, false); }
  }, 'Yes, cancel');
}
function reviewOrder(oid) {
  openModal(`<button class="mclose" onclick="closeModal()">✕</button>
    <h3 style="margin-top:0">⭐ Write a Review</h3>
    <div class="field"><label>Rating</label><select id="rv-star"><option value="5">★★★★★ (5)</option><option value="4">★★★★ (4)</option><option value="3">★★★ (3)</option><option value="2">★★ (2)</option><option value="1">★ (1)</option></select></div>
    <div class="field"><label>Comment</label><textarea id="rv-text" rows="3" placeholder="How was it?"></textarea></div>
    <button class="btn block" onclick="submitReview(${oid})">Submit Review</button>`);
}
async function submitReview(oid) {
  try {
    const d = await api.get('/api/orders/' + oid);
    const pid = (d.order.items || [])[0].product_id;
    await api.post(`/api/products/${pid}/reviews`, { rating: +document.getElementById('rv-star').value, comment: document.getElementById('rv-text').value });
    closeModal(); toast('Thanks for the review!', true); vOrder(oid);
  } catch (e) { toast(e.message, false); }
}

function vTrackForm() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="sec-head"><h2>Track Order</h2></div>
    <div class="card">
      <div class="field"><label>Order ID</label><input id="tr-id" inputmode="numeric" placeholder="e.g. 12"></div>
      <div class="field"><label>Email used at checkout</label><input id="tr-email" type="email" placeholder="you@email.com"></div>
      <button class="btn block" onclick="doTrack()">Track 🔍</button>
    </div>
    <div id="tr-result" style="margin-top:12px"></div>`;
}
async function doTrack() {
  const id = document.getElementById('tr-id').value.trim();
  const email = document.getElementById('tr-email').value.trim();
  if (!id || !email) { toast('Fill order ID and email', false); return; }
  try {
    const d = await api.get(`/api/track?order_id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`);
    const o = d.order;
    document.getElementById('tr-result').innerHTML = `
      <div class="card"><div class="row"><b class="grow">Order #${o.id}</b>${statusPill(o.status)}</div>
      <div class="muted" style="font-size:13px;font-weight:600;margin:4px 0">${esc((o.items || []).map((i) => i.name).join(', '))}</div>
      <div class="price">${rp(o.total)}</div></div>`;
  } catch (e) { toast(e.message, false); }
}
