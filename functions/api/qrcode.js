import { json, readJson } from '../_shared/respond.js';

// Di Cloudflare, QR digenerate di sisi browser (public/vendor/qrcode.bundle.js),
// jadi endpoint ini tidak mengimpor paket npm apa pun (menghindari risiko bundling Workers).
// Tetap disediakan sebagai fallback informatif untuk konsumen API non-browser.
export async function onRequestPost({ request }) {
  const { text } = await readJson(request);
  if (!text) return json({ error: 'text wajib diisi.' }, 400);
  return json({
    clientSide: true,
    message: 'QR digenerate di browser via vendor/qrcode.bundle.js. Endpoint server tidak diperlukan di Cloudflare.',
  });
}
