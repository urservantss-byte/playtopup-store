/* ===== PlayTopUp Store — API client ===== */
const api = (() => {
  const getToken = () => localStorage.getItem('ptu_token') || '';

  async function call(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    let body = opts.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 30000);
    try {
      const res = await fetch(path, { ...opts, headers, body, signal: ctrl.signal });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) {
        const msg = (data && data.error) || `Request failed (${res.status})`;
        const e = new Error(msg);
        e.status = res.status;
        throw e;
      }
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Request timed out — check your connection');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: (p) => call(p),
    post: (p, b) => call(p, { method: 'POST', body: b }),
    put: (p, b) => call(p, { method: 'PUT', body: b }),
    patch: (p, b) => call(p, { method: 'PATCH', body: b }),
    del: (p) => call(p, { method: 'DELETE' }),
    upload: (p, formData) => call(p, { method: 'POST', body: formData }),
  };
})();
