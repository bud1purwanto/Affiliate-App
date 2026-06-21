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
    const { dataUrl } = await api('/api/qrcode', { text });
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
    });
    currentPosts = result.posts;
    renderPosts(result.posts);
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

function renderPosts(posts) {
  const wrap = $('posts');
  wrap.innerHTML = '';
  posts.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
      <div class="post-head">
        <span class="idx">Post ${i + 1}/${posts.length}</span>
        <div class="actions">
          <button class="copy">📋 Salin</button>
          <button class="fill">▶ Isi ke Threads</button>
        </div>
      </div>
      <textarea>${text}</textarea>
      <div class="count"></div>`;
    const ta = div.querySelector('textarea');
    const count = div.querySelector('.count');
    const update = () => {
      count.textContent = `${ta.value.length} karakter`;
      count.classList.toggle('over', ta.value.length > THREADS_LIMIT);
      currentPosts[i] = ta.value;
    };
    ta.addEventListener('input', update);
    update();
    div.querySelector('.copy').addEventListener('click', () => {
      navigator.clipboard.writeText(ta.value);
    });
    div.querySelector('.fill').addEventListener('click', () =>
      fillToThreads(ta.value, i === 0 ? $('topic').value.trim() : '')
    );
    wrap.appendChild(div);
  });
}

// ---- Kirim teks ke tab Threads aktif ----
async function fillToThreads(text, topic) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/threads\.(com|net)/.test(tab.url || '')) {
    return alert('Buka tab threads.com dulu, lalu klik "New thread" dan posisikan kursor di kotak tulis.');
  }
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'THREADSMIL_FILL', text, topic });
    if (!resp?.ok) alert(resp?.error || 'Gagal mengisi composer Threads.');
  } catch (e) {
    // Content script belum termuat — inject lalu coba lagi.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const resp = await chrome.tabs.sendMessage(tab.id, { type: 'THREADSMIL_FILL', text, topic });
      if (!resp?.ok) alert(resp?.error || 'Gagal mengisi composer Threads.');
    } catch (e2) {
      alert('Tidak bisa terhubung ke halaman Threads: ' + e2.message);
    }
  }
}

loadSettings().then(init);
