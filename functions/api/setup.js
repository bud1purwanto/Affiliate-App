import { json } from '../_shared/respond.js';

// Di Cloudflare, credential di-set lewat dashboard (Settings → Variables and Secrets),
// bukan disimpan via web (Workers tanpa filesystem).
export function onRequestPost() {
  return json({
    ok: false,
    writable: false,
    error:
      'Di Cloudflare Pages, credential di-set lewat dashboard: Settings → Variables and Secrets ' +
      '(OPENROUTER_API_KEY, SHOPEE_APP_ID, SHOPEE_APP_SECRET, dll), lalu Redeploy. ' +
      'Gunakan tombol "Tes Koneksi" untuk verifikasi.',
  });
}
