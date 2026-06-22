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
    // Nonaktifkan kolom input — di Cloudflare credential diisi lewat dashboard.
    ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'SHOPEE_APP_ID', 'SHOPEE_APP_SECRET', 'THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'].forEach((id) => {
      const el = $(id);
      if (el) {
        el.disabled = true;
        el.title = 'Set lewat Cloudflare Dashboard → Settings → Variables and Secrets';
        if (el.tagName === 'INPUT') el.placeholder = '→ set di Cloudflare Dashboard (Variables)';
      }
    });
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

// ================= Pengelola Akun Threads (multi-akun, localStorage) =================
const ACCOUNTS_KEY = 'threadsmil_threads_accounts';
function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function renderAccounts() {
  const list = loadAccounts();
  const wrap = $('accounts-list');
  $('pill-accounts').textContent = list.length;
  if (!list.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#9a9a9a;padding:6px 0;">Belum ada akun. Tambahkan di bawah.</div>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach((a) => {
    const div = document.createElement('div');
    div.className = 'acc-item';
    div.innerHTML = `<div><div class="acc-label">${escapeHtml(a.label)}</div>
      <div class="acc-sub">${a.username ? '@' + escapeHtml(a.username) + ' · ' : ''}ID ${escapeHtml(a.userId)}</div></div>
      <button class="btn-secondary acc-del" style="flex:0;">🗑</button>`;
    div.querySelector('.acc-del').addEventListener('click', () => {
      saveAccounts(loadAccounts().filter((x) => x.id !== a.id));
      renderAccounts();
    });
    wrap.appendChild(div);
  });
}

async function verifyAcc() {
  const accessToken = $('acc-token').value.trim();
  const userId = $('acc-userid').value.trim();
  if (!accessToken || !userId) throw new Error('Isi Access Token & User ID dulu.');
  const res = await fetch('/api/threads/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, userId }),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Akun tidak valid');
  return data;
}

$('btn-acc-test').addEventListener('click', async () => {
  const out = $('acc-out');
  out.classList.remove('hidden');
  out.textContent = 'Mengetes akun...';
  try {
    const d = await verifyAcc();
    out.innerHTML = `✅ Valid — @${d.username || d.id}`;
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
  }
});

$('btn-acc-add').addEventListener('click', async () => {
  const out = $('acc-out');
  const label = $('acc-label').value.trim();
  const token = $('acc-token').value.trim();
  const userId = $('acc-userid').value.trim();
  if (!label || !token || !userId) {
    out.classList.remove('hidden');
    out.textContent = '⚠ Isi label, token, dan user ID.';
    return;
  }
  out.classList.remove('hidden');
  out.textContent = 'Memverifikasi & menyimpan...';
  let username = null;
  try {
    const d = await verifyAcc();
    username = d.username;
  } catch (e) {
    if (!confirm('Akun gagal diverifikasi (' + e.message + '). Tetap simpan?')) {
      out.textContent = '⚠ Dibatalkan.';
      return;
    }
  }
  const list = loadAccounts();
  list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), label, token, userId, username });
  saveAccounts(list);
  $('acc-label').value = '';
  $('acc-token').value = '';
  $('acc-userid').value = '';
  out.innerHTML = `✅ Akun "${escapeHtml(label)}" tersimpan di browser ini.`;
  renderAccounts();
});

renderAccounts();
loadStatus();
