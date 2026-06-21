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
}

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
