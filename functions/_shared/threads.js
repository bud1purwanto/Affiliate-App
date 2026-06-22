// Akun yang dikonfigurasi di server via env THREADS_ACCOUNTS (JSON).
// Format: [{"label":"Budi","token":"TH...","userId":"123"}, ...]
export function getServerAccounts(env) {
  const raw = env.THREADS_ACCOUNTS;
  if (!raw) return [];
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a, i) => ({ id: 'srv-' + i, label: a.label || 'Akun ' + (i + 1), token: a.token, userId: String(a.userId || '') }))
    .filter((a) => a.token && a.userId);
}

// Threads API resmi (Meta) untuk Cloudflare Functions.
import { enforceLimit } from './templates.js';

const GRAPH = 'https://graph.threads.net/v1.0';

// Ambil credential: utamakan override (akun yang dipilih dari UI), lalu env.
function resolveCreds(env, override) {
  const token = override?.accessToken || env.THREADS_ACCESS_TOKEN;
  const userId = override?.userId || env.THREADS_USER_ID;
  if (!token || !userId) {
    const err = new Error('Akun Threads belum diset (token / user ID).');
    err.code = 'NO_THREADS_CREDENTIALS';
    throw err;
  }
  return { token, userId };
}

async function createContainer({ text, replyToId, topicTag }, creds) {
  const params = new URLSearchParams({ media_type: 'TEXT', text, access_token: creds.token });
  if (replyToId) params.set('reply_to_id', replyToId);
  if (topicTag) params.set('topic_tag', topicTag);
  const res = await fetch(`${GRAPH}/${creds.userId}/threads`, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Gagal membuat container Threads');
  return data.id;
}

async function publishContainer(creationId, creds) {
  const params = new URLSearchParams({ creation_id: creationId, access_token: creds.token });
  const res = await fetch(`${GRAPH}/${creds.userId}/threads_publish`, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Gagal publish Threads');
  return data.id;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Coba ulang dengan backoff untuk error transien (mis. post induk belum siap dibalas).
async function withRetry(fn, tries = 1) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await wait(2000 * (i + 1));
    }
  }
  throw lastErr;
}

// override = { accessToken, userId } untuk memilih akun tertentu (multi-akun).
export async function postThread(rawPosts, topicTag, env, override) {
  const creds = resolveCreds(env, override);
  const posts = enforceLimit(rawPosts); // jaga tiap post <= 500 karakter
  const ids = [];
  let replyToId = null;
  for (let i = 0; i < posts.length; i++) {
    const isReply = i > 0;
    try {
      const containerId = await withRetry(
        () => createContainer({ text: posts[i], replyToId, topicTag: isReply ? undefined : topicTag }, creds),
        isReply ? 3 : 1
      );
      const publishedId = await withRetry(() => publishContainer(containerId, creds), isReply ? 3 : 1);
      ids.push(publishedId);
      replyToId = publishedId;
    } catch (e) {
      const err = new Error(`Gagal di post ${i + 1}/${posts.length}: ${e.message}. Berhasil terkirim ${ids.length} post.`);
      err.posted = ids.length;
      throw err;
    }
    if (i < posts.length - 1) await wait(3000);
  }
  return ids;
}

// Verifikasi akun (token + userId) -> kembalikan username.
export async function verifyAccount(accessToken, userId) {
  if (!accessToken || !userId) throw new Error('accessToken & userId wajib diisi.');
  const res = await fetch(`${GRAPH}/${userId}?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Akun tidak valid (HTTP ${res.status})`);
  return { ok: true, id: data.id, username: data.username || null };
}
