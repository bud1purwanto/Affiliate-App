import { json, readJson } from '../_shared/respond.js';

// Sync riwayat lintas-device via Cloudflare KV (opsional).
// Butuh binding KV bernama THREADSMIL_KV (lihat wrangler.toml & README).
function kv(env) {
  return env.THREADSMIL_KV || env.HISTORY_KV || null;
}

const KEY = (code) => 'hist:' + code;
const MAX = 200;

export async function onRequestGet({ request, env }) {
  const store = kv(env);
  if (!store) return json({ configured: false, error: 'Sync KV belum dikonfigurasi di Cloudflare.' }, 501);
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return json({ error: 'Parameter code wajib.' }, 400);
  const data = await store.get(KEY(code));
  return json({ configured: true, list: data ? JSON.parse(data) : [] });
}

export async function onRequestPut({ request, env }) {
  const store = kv(env);
  if (!store) return json({ configured: false, error: 'Sync KV belum dikonfigurasi di Cloudflare.' }, 501);
  const { code, list } = await readJson(request);
  if (!code) return json({ error: 'code wajib.' }, 400);
  await store.put(KEY(code), JSON.stringify((list || []).slice(0, MAX)));
  return json({ ok: true, configured: true, count: (list || []).length });
}
