/* ===== PlayTopUp Store — global state (auth + cart) ===== */
const store = (() => {
  let user = null;
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('ptu_cart') || '[]'); } catch { cart = []; }

  function saveCart() { localStorage.setItem('ptu_cart', JSON.stringify(cart)); }
  function cartCount() { return cart.reduce((n, i) => n + (i.qty || 1), 0); }
  function cartTotal() { return cart.reduce((n, i) => n + (i.price || 0) * (i.qty || 1), 0); }

  function addToCart(item) {
    // item: {product_id, variant_id, name, variant_label, price, image_url, qty}
    const key = (p) => p.product_id + '|' + (p.variant_id || 0);
    const ex = cart.find((p) => key(p) === key(item));
    if (ex) ex.qty = (ex.qty || 1) + (item.qty || 1);
    else cart.push({ ...item, qty: item.qty || 1 });
    saveCart();
    renderChrome();
  }
  function setQty(idx, qty) {
    if (qty <= 0) cart.splice(idx, 1);
    else cart[idx].qty = qty;
    saveCart();
    renderChrome();
  }
  function clearCart() { cart = []; saveCart(); renderChrome(); }

  async function refreshUser() {
    if (!localStorage.getItem('ptu_token')) { user = null; return null; }
    try { user = (await api.get('/api/auth/me')).user || null; }
    catch { user = null; localStorage.removeItem('ptu_token'); }
    return user;
  }
  function setSession(token, u) {
    localStorage.setItem('ptu_token', token);
    user = u;
  }
  function logout() {
    localStorage.removeItem('ptu_token');
    user = null;
    location.hash = '#/';
  }

  return {
    get user() { return user; },
    get cart() { return cart; },
    cartCount, cartTotal, addToCart, setQty, clearCart,
    refreshUser, setSession, logout,
    isAdmin: () => !!(user && user.role === 'admin'),
  };
})();
