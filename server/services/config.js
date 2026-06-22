// Pengelolaan credential runtime: update process.env + persist ke .env (best-effort).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '..', '.env');

export const EDITABLE_KEYS = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'SHOPEE_APP_ID',
  'SHOPEE_APP_SECRET',
  'THREADS_ACCESS_TOKEN',
  'THREADS_USER_ID',
];

const SECRET_KEYS = ['OPENROUTER_API_KEY', 'SHOPEE_APP_SECRET', 'THREADS_ACCESS_TOKEN'];

function mask(v) {
  if (!v) return null;
  const s = String(v);
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}

/** Terapkan update ke process.env (langsung aktif) lalu simpan ke .env. */
export function applyAndPersist(updates = {}) {
  for (const [k, v] of Object.entries(updates)) {
    if (!EDITABLE_KEYS.includes(k)) continue;
    if (v === undefined || v === null || v === '') continue;
    process.env[k] = String(v);
  }

  let persisted = false;
  let error = null;
  try {
    const lines = {};
    if (fs.existsSync(ENV_PATH)) {
      for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m) lines[m[1]] = line;
      }
    }
    for (const [k, v] of Object.entries(updates)) {
      if (!EDITABLE_KEYS.includes(k) || v === undefined || v === null || v === '') continue;
      lines[k] = `${k}=${v}`;
    }
    fs.writeFileSync(ENV_PATH, Object.values(lines).join('\n') + '\n');
    persisted = true;
  } catch (e) {
    error = e.message; // di Railway filesystem ephemeral — wajar gagal, runtime tetap aktif
  }
  return { persisted, error };
}

/** Status terkini (secret di-mask). */
export function status() {
  const out = {};
  for (const k of EDITABLE_KEYS) {
    out[k] = SECRET_KEYS.includes(k) ? mask(process.env[k]) : process.env[k] || null;
  }
  return out;
}

/** Cek token setup. Jika SETUP_TOKEN tidak diset → terbuka (mode lokal). */
export function checkSetupAuth(req) {
  const token = process.env.SETUP_TOKEN;
  if (!token) return true;
  const provided = req.headers['x-setup-token'] || req.body?.setupToken;
  return provided === token;
}

export function setupTokenRequired() {
  return Boolean(process.env.SETUP_TOKEN);
}
