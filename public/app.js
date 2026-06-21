// Threadsmil Web App frontend
const $ = (id) => document.getElementById(id);
const THREADS_LIMIT = 500;
let currentPosts = [];
let config = { threads: false };

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request gagal');
  return data;
}

// ---- Init: load config & model list ----
async function init() {
  try {
    const cfg = await fetch('/api/health').then((r) => r.json());
    config = cfg;
    $('status-pills').innerHTML = [
      pill('AI', cfg.ai),
      pill('Shopee', cfg.shopee),
      pill('Threads', cfg.threads),
    ].join('');
    const modelSel = $('model');
    (cfg.models || []).forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label;
      if (m.id === cfg.defaultModel) o.selected = true;
      modelSel.appendChild(o);
    });
    $('btn-post-threads').textContent = cfg.threads ? '▶ Kirim ke Threads' : '▶ Kirim ke Threads (butuh extension)';
  } catch (e) {
    console.error(e);
  }
}
function pill(name, on) {
  return `<span class="pill ${on ? 'on' : 'off'}">${name}: ${on ? 'ON' : 'OFF'}</span>`;
}

// ---- Short link ----
$('btn-shortlink').addEventListener('click', async () => {
  const originUrl = $('shopee-url').value.trim();
  const subId = $('keyword').value.trim();
  if (!originUrl) return alert('Isi link produk Shopee dulu.');
  const out = $('shortlink-out');
  out.classList.remove('hidden');
  out.textContent = 'Membuat short link...';
  try {
    const { shortLink } = await api('/api/shopee/shortlink', { originUrl, subIds: [subId] });
    out.innerHTML = `Short link: <a href="${shortLink}" target="_blank" style="color:#db2777">${shortLink}</a>`;
    $('shopee-url').dataset.affiliate = shortLink;
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
  }
});

// ---- QR ----
$('btn-qr').addEventListener('click', async () => {
  const text = $('shopee-url').dataset.affiliate || $('shopee-url').value.trim();
  if (!text) return alert('Isi link produk Shopee dulu.');
  const out = $('qr-out');
  out.classList.remove('hidden');
  out.innerHTML = 'Membuat QR...';
  try {
    const dataUrl = await makeQr(text);
    out.innerHTML = `<img src="${dataUrl}" alt="QR" />`;
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
  }
});

// QR digenerate di browser (vendor/qrcode.bundle.js). Fallback ke backend bila perlu.
async function makeQr(text) {
  if (window.QRCode?.toDataURL) {
    return window.QRCode.toDataURL(text, { width: 320, margin: 1 });
  }
  const { dataUrl } = await api('/api/qrcode', { text });
  return dataUrl;
}

// ---- Cari produk ----
$('btn-search-product').addEventListener('click', async () => {
  const keyword = $('keyword').value.trim();
  if (!keyword) return alert('Isi keyword dulu.');
  const out = $('product-out');
  out.innerHTML = '<div class="empty">Mencari produk...</div>';
  try {
    const { products } = await api('/api/shopee/products', { keyword, limit: 5 });
    if (!products.length) return (out.innerHTML = '<div class="empty">Produk tidak ditemukan.</div>');
    out.innerHTML = '';
    products.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'product';
      const price = p.priceMin ? `Rp${Number(p.priceMin).toLocaleString('id-ID')}` : (p.price || '');
      div.innerHTML = `
        <img src="${p.imageUrl || ''}" onerror="this.style.display='none'" />
        <div class="meta">
          <div class="name">${p.productName || ''}</div>
          <div class="price">${price} · komisi ${p.commissionRate || '-'}</div>
        </div>`;
      div.addEventListener('click', () => {
        $('shopee-url').value = p.offerLink || p.productLink || $('shopee-url').value;
        $('shopee-url').dataset.affiliate = p.offerLink || p.productLink || '';
        $('shopee-url').dataset.productName = p.productName || '';
        out.querySelectorAll('.product').forEach((el) => (el.style.borderColor = ''));
        div.style.borderColor = '#7c3aed';
      });
      out.appendChild(div);
    });
  } catch (e) {
    out.innerHTML = `<div class="empty">⚠ ${e.message}</div>`;
  }
});

// ---- Generate ----
$('btn-generate').addEventListener('click', async () => {
  const keyword = $('keyword').value.trim();
  const productName = $('shopee-url').dataset.productName || '';
  if (!keyword && !productName) return alert('Isi keyword / pilih produk dulu.');
  const btn = $('btn-generate');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  $('warning').classList.add('hidden');
  try {
    const link = $('shopee-url').dataset.affiliate || $('shopee-url').value.trim();
    const result = await api('/api/generate', {
      keyword,
      productName,
      link,
      style: $('style').value,
      length: $('length').value,
      audience: $('audience').value.trim(),
      model: $('model').value,
    });
    currentPosts = result.posts;
    renderPosts(result.posts);
    saveHistory(result.source === 'ai' ? 'ai' : 'template'); // auto-save tiap generate
    if (result.warning) {
      $('warning').textContent = '⚠ ' + result.warning;
      $('warning').classList.remove('hidden');
    }
  } catch (e) {
    alert('Gagal generate: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Generate UTAS';
  }
});

function renderPosts(posts) {
  const wrap = $('posts');
  wrap.innerHTML = '';
  posts.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
      <div class="post-head">
        <span class="idx">Post ${i + 1}/${posts.length}</span>
        <button class="copy btn-secondary">📋 Salin</button>
      </div>
      <textarea>${text}</textarea>
      <div class="count"></div>`;
    const ta = div.querySelector('textarea');
    const count = div.querySelector('.count');
    const update = () => {
      const len = ta.value.length;
      count.textContent = `${len} karakter`;
      count.classList.toggle('over', len > THREADS_LIMIT);
      currentPosts[i] = ta.value;
    };
    ta.addEventListener('input', update);
    update();
    div.querySelector('.copy').addEventListener('click', () => {
      navigator.clipboard.writeText(ta.value);
      div.querySelector('.copy').textContent = '✓ Tersalin';
      setTimeout(() => (div.querySelector('.copy').textContent = '📋 Salin'), 1500);
    });
    wrap.appendChild(div);
  });
  $('btn-copy-all').disabled = posts.length === 0;
  $('btn-post-threads').disabled = posts.length === 0;
  $('btn-save-history').disabled = posts.length === 0;
}

// ================= Riwayat & Draft (localStorage) =================
const HISTORY_KEY = 'threadsmil_history';
const HISTORY_MAX = 50;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
function persistHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
}

// Snapshot form + posts saat ini. tag: 'ai' | 'template' | 'draft'
function currentSnapshot(tag) {
  return {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    tag,
    keyword: $('keyword').value.trim(),
    topic: $('topic').value.trim(),
    style: $('style').value,
    length: $('length').value,
    audience: $('audience').value.trim(),
    url: $('shopee-url').value.trim(),
    affiliate: $('shopee-url').dataset.affiliate || '',
    productName: $('shopee-url').dataset.productName || '',
    posts: [...currentPosts],
  };
}

function saveHistory(tag) {
  if (!currentPosts.length) return;
  const list = loadHistory();
  list.unshift(currentSnapshot(tag));
  persistHistory(list);
  renderHistory();
}

function renderHistory() {
  const wrap = $('history-list');
  const list = loadHistory();
  if (!list.length) {
    wrap.innerHTML = '<div class="empty">Belum ada riwayat. Setiap hasil generate & draft tersimpan otomatis di browser ini.</div>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach((h) => {
    const d = new Date(h.ts);
    const tanggal = d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const tagLabel = h.tag === 'ai' ? 'AI' : h.tag === 'draft' ? 'Draft' : 'Template';
    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML = `
      <div class="htop">
        <span class="hkw">${escapeHtml(h.keyword || h.productName || '(tanpa judul)')}</span>
        <span class="htag ${h.tag}">${tagLabel}</span>
      </div>
      <div class="hmeta">${tanggal} · ${h.posts.length} post · ${escapeHtml(h.style)}${h.topic ? ' · #' + escapeHtml(h.topic) : ''}</div>
      <div class="hpreview">${escapeHtml((h.posts[0] || '').slice(0, 160))}</div>
      <div class="hactions">
        <button class="btn-secondary load">📂 Muat</button>
        <button class="btn-secondary del">🗑 Hapus</button>
      </div>`;
    div.querySelector('.load').addEventListener('click', () => loadEntry(h));
    div.querySelector('.del').addEventListener('click', () => deleteEntry(h.id));
    wrap.appendChild(div);
  });
}

function loadEntry(h) {
  $('keyword').value = h.keyword || '';
  $('topic').value = h.topic || '';
  $('style').value = h.style || 'Storytelling';
  $('length').value = h.length || 'Sedang (3-5 post)';
  $('audience').value = h.audience || '';
  $('shopee-url').value = h.url || '';
  $('shopee-url').dataset.affiliate = h.affiliate || '';
  $('shopee-url').dataset.productName = h.productName || '';
  currentPosts = [...h.posts];
  renderPosts(currentPosts);
  $('warning').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEntry(id) {
  persistHistory(loadHistory().filter((h) => h.id !== id));
  renderHistory();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

$('btn-save-history').addEventListener('click', () => {
  saveHistory('draft');
  $('btn-save-history').textContent = '✓ Tersimpan';
  setTimeout(() => ($('btn-save-history').textContent = '💾 Simpan'), 1500);
});

$('btn-clear-history').addEventListener('click', () => {
  if (!loadHistory().length) return;
  if (confirm('Hapus semua riwayat & draft di browser ini?')) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }
});

// ---- Gabung dua list riwayat (dedup by id, terbaru dulu, cap MAX) ----
function mergeHistory(a, b) {
  const map = new Map();
  [...a, ...b].forEach((h) => h && h.id && map.set(h.id, h));
  return [...map.values()].sort((x, y) => y.ts - x.ts).slice(0, HISTORY_MAX);
}

// ---- Export ke file JSON ----
$('btn-export').addEventListener('click', () => {
  const list = loadHistory();
  if (!list.length) return alert('Belum ada riwayat untuk diexport.');
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `threadsmil-riwayat-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---- Import dari file JSON ----
$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Format tidak valid');
      persistHistory(mergeHistory(loadHistory(), imported));
      renderHistory();
      alert(`✅ ${imported.length} entri diimport (digabung & dedup).`);
    } catch (err) {
      alert('Gagal import: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ---- Sync via server (KV di Cloudflare / file di Railway) ----
const SYNC_CODE_KEY = 'threadsmil_sync_code';
$('sync-code').value = localStorage.getItem(SYNC_CODE_KEY) || '';

$('btn-sync').addEventListener('click', async () => {
  const code = $('sync-code').value.trim();
  if (!code) return alert('Isi Kode Sync dulu (bebas, mis. "budi-2026"). Pakai kode sama di device lain.');
  localStorage.setItem(SYNC_CODE_KEY, code);
  const btn = $('btn-sync');
  btn.disabled = true;
  btn.textContent = '⏳ Sync...';
  try {
    // tarik remote → gabung dengan lokal → push hasil gabungan
    const res = await fetch(`/api/history?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (res.status === 501 || data.configured === false) {
      throw new Error('Sync KV belum aktif di server ini. Aktifkan binding THREADSMIL_KV di Cloudflare (lihat README).');
    }
    if (!res.ok) throw new Error(data.error || 'Gagal tarik data');
    const merged = mergeHistory(loadHistory(), data.list || []);
    persistHistory(merged);
    await fetch('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, list: merged }),
    });
    renderHistory();
    alert(`✅ Tersinkron — total ${merged.length} entri.`);
  } catch (e) {
    alert('⚠ ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '☁ Sync';
  }
});

// ---- Salin semua ----
$('btn-copy-all').addEventListener('click', () => {
  navigator.clipboard.writeText(currentPosts.join('\n\n---\n\n'));
  $('btn-copy-all').textContent = '✓ Tersalin';
  setTimeout(() => ($('btn-copy-all').textContent = '📋 Salin Semua'), 1500);
});

// ---- Kirim ke Threads ----
$('btn-post-threads').addEventListener('click', async () => {
  if (!config.threads) {
    return alert(
      'Posting otomatis dari Web App butuh Threads API resmi (set THREADS_ACCESS_TOKEN).\n\n' +
      'Cara paling praktis: pakai Chrome Extension Threadsmil yang bisa "Isi ke Threads" langsung di threads.com.'
    );
  }
  const topicTag = $('topic').value.trim();
  if (!confirm(`Kirim ${currentPosts.length} post ke Threads sekarang?`)) return;
  try {
    const { count } = await api('/api/threads/post', { posts: currentPosts, topicTag });
    alert(`✅ Berhasil posting ${count} post ke Threads!`);
  } catch (e) {
    alert('Gagal posting: ' + e.message);
  }
});

init();
renderHistory();
