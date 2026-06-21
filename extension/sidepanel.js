// Threadsmil side panel logic
const $ = (id) => document.getElementById(id);
const THREADS_LIMIT = 500;
let backendUrl = 'http://localhost:3000';
let currentPosts = [];

// ---- Settings (backend URL di chrome.storage) ----
async function loadSettings() {
  const { threadsmilBackend } = await chrome.storage.local.get('threadsmilBackend');
  if (threadsmilBackend) backendUrl = threadsmilBackend;
  $('backend-url').value = backendUrl;
}
$('btn-settings').addEventListener('click', () => $('settings').classList.toggle('hidden'));
$('btn-save-settings').addEventListener('click', async () => {
  backendUrl = $('backend-url').value.trim().replace(/\/$/, '') || 'http://localhost:3000';
  await chrome.storage.local.set({ threadsmilBackend: backendUrl });
  $('settings').classList.add('hidden');
  init();
});

async function api(path, body) {
  const res = await fetch(backendUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request gagal');
  return data;
}

async function init() {
  try {
    const cfg = await fetch(backendUrl + '/api/health').then((r) => r.json());
    const sel = $('model');
    sel.innerHTML = '';
    (cfg.models || []).forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label;
      if (m.id === cfg.defaultModel) o.selected = true;
      sel.appendChild(o);
    });
  } catch (e) {
    console.warn('Backend belum terhubung:', e.message);
  }
}

// ---- Short link ----
$('btn-shortlink').addEventListener('click', async () => {
  const originUrl = $('shopee-url').value.trim();
  if (!originUrl) return alert('Isi link produk Shopee dulu.');
  const out = $('shortlink-out');
  out.classList.remove('hidden');
  out.textContent = 'Membuat short link...';
  try {
    const { shortLink } = await api('/api/shopee/shortlink', { originUrl, subIds: [$('keyword').value.trim()] });
    out.innerHTML = `<a href="${shortLink}" target="_blank" style="color:#db2777">${shortLink}</a>`;
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
  out.textContent = 'Membuat QR...';
  try {
    // QR digenerate di sisi extension (vendor/qrcode.bundle.js), tanpa backend.
    const dataUrl = window.QRCode?.toDataURL
      ? await window.QRCode.toDataURL(text, { width: 320, margin: 1 })
      : (await api('/api/qrcode', { text })).dataUrl;
    out.innerHTML = `<img src="${dataUrl}" />`;
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
  }
});

// ---- Cari produk ----
$('btn-search-product').addEventListener('click', async () => {
  const keyword = $('keyword').value.trim();
  if (!keyword) return alert('Isi keyword dulu.');
  const out = $('product-out');
  out.innerHTML = 'Mencari...';
  try {
    const { products } = await api('/api/shopee/products', { keyword, limit: 5 });
    out.innerHTML = '';
    if (!products.length) return (out.textContent = 'Produk tidak ditemukan.');
    products.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'product';
      const price = p.priceMin ? `Rp${Number(p.priceMin).toLocaleString('id-ID')}` : (p.price || '');
      div.innerHTML = `<img src="${p.imageUrl || ''}" onerror="this.style.display='none'" />
        <div><div class="name">${p.productName || ''}</div><div class="price">${price}</div></div>`;
      div.addEventListener('click', () => {
        $('shopee-url').value = p.offerLink || p.productLink || '';
        $('shopee-url').dataset.affiliate = p.offerLink || p.productLink || '';
        $('shopee-url').dataset.productName = p.productName || '';
      });
      out.appendChild(div);
    });
  } catch (e) {
    out.textContent = '⚠ ' + e.message;
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
      keyword, productName, link,
      style: $('style').value,
      length: $('length').value,
      model: $('model').value,
      disclosure: $('disclosure').checked,
    });
    currentPosts = result.posts;
    postImages = [];
    renderPosts(result.posts);
    renderHooks(result.hooks || []);
    $('btn-fill-all').classList.toggle('hidden', result.posts.length === 0);
    await saveHistory(result.source === 'ai' ? 'ai' : 'template');
    if (result.warning) {
      $('warning').textContent = '⚠ ' + result.warning;
      $('warning').classList.remove('hidden');
    }
  } catch (e) {
    alert('Gagal generate: ' + e.message + '\n\nCek Backend URL di pengaturan (⚙).');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Generate UTAS';
  }
});

// Foto per-post: postImages[i] = array of { name, type, dataUrl }
let postImages = [];

function fileToData(file) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve({ name: file.name, type: file.type, dataUrl: fr.result });
    fr.readAsDataURL(file);
  });
}

function renderPosts(posts) {
  const wrap = $('posts');
  wrap.innerHTML = '';
  if (postImages.length !== posts.length) postImages = posts.map((_, i) => postImages[i] || []);
  posts.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
      <div class="post-head">
        <span class="idx">Post ${i + 1}/${posts.length}</span>
        <div class="actions">
          <button class="copy">📋 Salin</button>
          <button class="photo">📎 Foto</button>
          <button class="fill">▶ Isi</button>
        </div>
      </div>
      <textarea>${text}</textarea>
      <div class="photos"></div>
      <input type="file" accept="image/*" multiple class="photo-input" style="display:none" />
      <div class="count"></div>`;
    const ta = div.querySelector('textarea');
    const count = div.querySelector('.count');
    const photosBox = div.querySelector('.photos');
    const photoInput = div.querySelector('.photo-input');
    const update = () => {
      count.textContent = `${ta.value.length} karakter`;
      count.classList.toggle('over', ta.value.length > THREADS_LIMIT);
      currentPosts[i] = ta.value;
    };
    const renderThumbs = () => {
      photosBox.innerHTML = '';
      (postImages[i] || []).forEach((img, k) => {
        const t = document.createElement('span');
        t.className = 'thumb';
        t.innerHTML = `<img src="${img.dataUrl}" /><span class="x">×</span>`;
        t.querySelector('.x').addEventListener('click', () => {
          postImages[i].splice(k, 1);
          renderThumbs();
        });
        photosBox.appendChild(t);
      });
    };
    ta.addEventListener('input', update);
    update();
    renderThumbs();
    div.querySelector('.copy').addEventListener('click', () => navigator.clipboard.writeText(ta.value));
    div.querySelector('.photo').addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async (e) => {
      const files = [...e.target.files];
      for (const f of files) postImages[i].push(await fileToData(f));
      renderThumbs();
      e.target.value = '';
    });
    div.querySelector('.fill').addEventListener('click', () =>
      fillToThreads(ta.value, i === 0 ? $('topic').value.trim() : '', postImages[i])
    );
    wrap.appendChild(div);
  });
}

// ---- Variasi hook (A/B) ----
function renderHooks(hooks) {
  const wrap = $('hooks');
  if (!hooks || !hooks.length || !currentPosts.length) {
    wrap.classList.add('hidden');
    wrap.innerHTML = '';
    return;
  }
  const options = [currentPosts[0], ...hooks];
  wrap.classList.remove('hidden');
  wrap.innerHTML = '<div class="htitle">🎯 Variasi hook (klik pakai sbg Post 1):</div>';
  options.forEach((h, i) => {
    const el = document.createElement('div');
    el.className = 'hook-opt' + (i === 0 ? ' active' : '');
    el.textContent = h;
    el.addEventListener('click', () => {
      currentPosts[0] = h;
      renderPosts(currentPosts);
      $('btn-fill-all').classList.toggle('hidden', currentPosts.length === 0);
      wrap.querySelectorAll('.hook-opt').forEach((o) => o.classList.remove('active'));
      el.classList.add('active');
    });
    wrap.appendChild(el);
  });
}

// ---- Kirim Semua ke Threads (chaining) ----
$('btn-fill-all').addEventListener('click', () =>
  sendToThreads('THREADSMIL_FILL_ALL', {
    posts: currentPosts,
    topic: $('topic').value.trim(),
    media: currentPosts.map((_, i) => postImages[i] || []),
  })
);

// ---- Kirim teks (+foto) ke tab Threads aktif ----
async function fillToThreads(text, topic, images) {
  return sendToThreads('THREADSMIL_FILL', { text, topic, images: images || [] });
}

// Helper umum: kirim pesan ke content script (inject kalau perlu).
async function sendToThreads(type, payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/threads\.(com|net)/.test(tab.url || '')) {
    return alert('Buka tab threads.com dulu, lalu klik "New thread" dan posisikan kursor di kotak tulis.');
  }
  const send = () => chrome.tabs.sendMessage(tab.id, { type, ...payload });
  try {
    const resp = await send();
    if (!resp?.ok) alert(resp?.error || 'Gagal mengisi composer Threads.');
    else if (type === 'THREADSMIL_FILL_ALL') alert(`✅ ${resp.count} post terisi sebagai 1 utas. Tinggal klik Post di Threads.`);
  } catch (e) {
    // Content script belum termuat — inject lalu coba lagi.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const resp = await send();
      if (!resp?.ok) alert(resp?.error || 'Gagal mengisi composer Threads.');
      else if (type === 'THREADSMIL_FILL_ALL') alert(`✅ ${resp.count} post terisi sebagai 1 utas. Tinggal klik Post di Threads.`);
    } catch (e2) {
      alert('Tidak bisa terhubung ke halaman Threads: ' + e2.message);
    }
  }
}

// ================= Riwayat & Draft (chrome.storage.local) =================
const HISTORY_KEY = 'threadsmil_history';
const HISTORY_MAX = 50;

async function loadHistory() {
  const { [HISTORY_KEY]: list } = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(list) ? list : [];
}
async function persistHistory(list) {
  await chrome.storage.local.set({ [HISTORY_KEY]: list.slice(0, HISTORY_MAX) });
}

function snapshot(tag) {
  return {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    tag,
    keyword: $('keyword').value.trim(),
    topic: $('topic').value.trim(),
    style: $('style').value,
    length: $('length').value,
    url: $('shopee-url').value.trim(),
    affiliate: $('shopee-url').dataset.affiliate || '',
    productName: $('shopee-url').dataset.productName || '',
    posts: [...currentPosts],
  };
}

async function saveHistory(tag) {
  if (!currentPosts.length) return;
  const list = await loadHistory();
  list.unshift(snapshot(tag));
  await persistHistory(list);
  renderHistory();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function renderHistory() {
  const wrap = $('history-list');
  const list = await loadHistory();
  if (!list.length) {
    wrap.innerHTML = '<div class="empty">Belum ada riwayat. Hasil generate tersimpan otomatis.</div>';
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
      <div class="hmeta">${tanggal} · ${h.posts.length} post · ${escapeHtml(h.style)}</div>
      <div class="hpreview">${escapeHtml((h.posts[0] || '').slice(0, 120))}</div>
      <div class="hactions">
        <button class="copy load">📂 Muat</button>
        <button class="copy del">🗑</button>
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
  $('shopee-url').value = h.url || '';
  $('shopee-url').dataset.affiliate = h.affiliate || '';
  $('shopee-url').dataset.productName = h.productName || '';
  currentPosts = [...h.posts];
  postImages = [];
  renderPosts(currentPosts);
  $('btn-fill-all').classList.toggle('hidden', currentPosts.length === 0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteEntry(id) {
  await persistHistory((await loadHistory()).filter((h) => h.id !== id));
  renderHistory();
}

$('btn-toggle-history').addEventListener('click', () => {
  $('history-wrap').classList.toggle('hidden');
  renderHistory();
});
$('btn-clear-history').addEventListener('click', async () => {
  if (confirm('Hapus semua riwayat & draft?')) {
    await chrome.storage.local.remove(HISTORY_KEY);
    renderHistory();
  }
});

function mergeHistory(a, b) {
  const map = new Map();
  [...a, ...b].forEach((h) => h && h.id && map.set(h.id, h));
  return [...map.values()].sort((x, y) => y.ts - x.ts).slice(0, HISTORY_MAX);
}

// Export
$('btn-export').addEventListener('click', async () => {
  const list = await loadHistory();
  if (!list.length) return alert('Belum ada riwayat.');
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `threadsmil-riwayat-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// Import
$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('Format tidak valid');
      await persistHistory(mergeHistory(await loadHistory(), imported));
      renderHistory();
      alert(`✅ ${imported.length} entri diimport.`);
    } catch (err) {
      alert('Gagal import: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// Sync via backend (KV di Cloudflare)
const SYNC_CODE_KEY = 'threadsmil_sync_code';
chrome.storage.local.get(SYNC_CODE_KEY).then(({ [SYNC_CODE_KEY]: c }) => {
  if (c) $('sync-code').value = c;
});
$('btn-sync').addEventListener('click', async () => {
  const code = $('sync-code').value.trim();
  if (!code) return alert('Isi Kode Sync dulu (pakai kode sama di Web App / device lain).');
  await chrome.storage.local.set({ [SYNC_CODE_KEY]: code });
  const btn = $('btn-sync');
  btn.disabled = true;
  try {
    const res = await fetch(`${backendUrl}/api/history?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (res.status === 501 || data.configured === false) throw new Error('Sync KV belum aktif di server.');
    if (!res.ok) throw new Error(data.error || 'Gagal');
    const merged = mergeHistory(await loadHistory(), data.list || []);
    await persistHistory(merged);
    await fetch(`${backendUrl}/api/history`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, list: merged }),
    });
    renderHistory();
    alert(`✅ Tersinkron — ${merged.length} entri.`);
  } catch (e) {
    alert('⚠ ' + e.message);
  } finally {
    btn.disabled = false;
  }
});

loadSettings().then(init);
renderHistory();
