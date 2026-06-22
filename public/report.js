const $ = (id) => document.getElementById(id);
const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

$('btn-load').addEventListener('click', load);

async function load() {
  const out = $('out');
  const btn = $('btn-load');
  btn.disabled = true;
  out.innerHTML = '<div class="empty">Menarik data dari Shopee...</div>';
  $('summary').classList.add('hidden');
  try {
    const res = await fetch('/api/shopee/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: Number($('days').value) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat');

    $('s-commission').textContent = rupiah(data.totalCommission);
    $('s-orders').textContent = (data.totalOrders || 0).toLocaleString('id-ID');
    $('s-subs').textContent = (data.rows || []).length;
    $('summary').classList.remove('hidden');

    if (!data.rows || !data.rows.length) {
      out.innerHTML = '<div class="empty">Belum ada konversi pada periode ini. Terus posting & sebar link ya! 💪</div>';
      return;
    }
    const maxC = Math.max(...data.rows.map((r) => r.commission), 1);
    out.innerHTML =
      '<table class="rtable"><thead><tr><th>Sub ID</th><th>Order</th><th>Komisi</th></tr></thead><tbody>' +
      data.rows
        .map(
          (r) => `<tr>
            <td><span class="bar" style="width:${(r.commission / maxC) * 100}%"></span><span class="sid">${escapeHtml(r.subId)}</span></td>
            <td>${r.orders}</td>
            <td class="rcom">${rupiah(r.commission)}</td>
          </tr>`
        )
        .join('') +
      '</tbody></table>';
  } catch (e) {
    out.innerHTML = `<div class="empty">⚠ ${escapeHtml(e.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
