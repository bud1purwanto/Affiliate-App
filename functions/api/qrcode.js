import { json, readJson } from '../_shared/respond.js';
import QRCode from 'qrcode';

// QR sebagai SVG (pure JS) agar tidak butuh canvas/zlib di runtime Workers.
export async function onRequestPost({ request }) {
  const { text } = await readJson(request);
  if (!text) return json({ error: 'text wajib diisi.' }, 400);
  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 1, width: 320 });
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    return json({ dataUrl });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
