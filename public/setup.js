const $ = (id) => document.getElementById(id);
let writable = true;

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const t = $('setup-token')?.value.trim();
  if (t) h['x-setup-token'] = t;
  return h;
}

async function loadStatus() {
  // isi dropdown model dari health
  try {
    const health = await fetch('/api/health').then((r) => r.json());
    const sel = $('OPENROUTER_MODEL');
    sel.innerHTML = '';
    (health.models || []).forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label;
      if (m.id === health.defaultModel) o.selected = true;
      sel.appendChild(o);
    });
  } catch {}

  const data = await fetch('/api/setup/status').then((r) => r.json());
  if (data.tokenRequired) $('token-box').classList.remove('hidden');
  pill('pill-ai', data.integrations.ai);
  pill('pill-shopee', data.integrations.shopee);
  pill('pill-threads', data.integrations.threads);

  // Cloudflare (writable:false): credential di-set lewat dashboard, bukan via web.
  writable = data.writable !== false;
  if (!writable) {
    $('btn-save').classList.add('hidden');
    const banner = $('cf-banner');
    if (banner) banner.classList.remove('hidden');
  }

  // tampilkan nilai yang sudah tersimpan (mask) sebagai placeholder
  const c = data.config || {};
  if (c.OPENROUTER_API_KEY) $('OPENROUTER_API_KEY').placeholder = c.OPENROUTER_API_KEY + ' (tersimpan)';
  if (c.SHOPEE_APP_ID) $('SHOPEE_APP_ID').value = c.SHOPEE_APP_ID;
  if (c.SHOPEE_APP_SECRET) $('SHOPEE_APP_SECRET').placeholder = c.SHOPEE_APP_SECRET + ' (tersimpan)';
  if (c.THREADS_ACCESS_TOKEN) $('THREADS_ACCESS_TOKEN').placeholder = c.THREADS_ACCESS_TOKEN + ' (tersimpan)';
  if (c.THREADS_USER_ID) $('THREADS_USER_ID').value = c.THREADS_USER_ID;
}

function pill(id, on) {
  const el = $(id);
  el.textContent = on ? 'ON' : 'OFF';
  el.className = 'pill ' + (on ? 'on' : 'off');
}

$('btn-save').addEventListener('click', async () => {
  const body = {
    OPENROUTER_API_KEY: $('OPENROUTER_API_KEY').value.trim(),
    OPENROUTER_MODEL: $('OPENROUTER_MODEL').value,
    SHOPEE_APP_ID: $('SHOPEE_APP_ID').value.trim(),
    SHOPEE_APP_SECRET: $('SHOPEE_APP_SECRET').value.trim(),
    THREADS_ACCESS_TOKEN: $('THREADS_ACCESS_TOKEN').value.trim(),
    THREADS_USER_ID: $('THREADS_USER_ID').value.trim(),
  };
  const out = $('save-out');
  out.classList.remove('hidden');
  out.textContent = 'Menyimpan...';
  try {
    const res = await fetch('/api/setup', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal');
    out.innerHTML = `✅ Tersimpan.${data.persisted ? ' (ditulis ke .env)' : ' (runtime saja — set di Railway Variables untuk permanen)'}`;
    loadStatus();
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
  }
});

document.querySelectorAll('[data-test]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const which = btn.dataset.test;
    const out = $('test-' + which);
    out.classList.remove('hidden');
    out.textContent = 'Mengetes...';
    // Di server yang writable (Node/Railway), simpan dulu agar test pakai nilai terbaru.
    // Di Cloudflare, test memakai credential yang sudah di-set di dashboard.
    if (writable) {
      await fetch('/api/setup', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          OPENROUTER_API_KEY: $('OPENROUTER_API_KEY').value.trim() || undefined,
          SHOPEE_APP_ID: $('SHOPEE_APP_ID').value.trim() || undefined,
          SHOPEE_APP_SECRET: $('SHOPEE_APP_SECRET').value.trim() || undefined,
        }),
      });
    }
    try {
      const res = await fetch('/api/test/' + which, { method: 'POST', headers: headers(), body: '{}' });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || 'Gagal');
      out.innerHTML =
        which === 'openrouter'
          ? `✅ Valid — ${data.label || 'OK'}`
          : `✅ Terhubung — contoh produk: ${data.sample || '(tidak ada)'}`;
      loadStatus();
    } catch (e) {
      out.textContent = '⚠ ' + e.message;
    }
  });
});

loadStatus();
