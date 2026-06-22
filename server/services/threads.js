// Klien Threads API resmi (Meta) — opsional, untuk auto-post dari Web App.
// Untuk Chrome Extension, posting dilakukan via DOM threads.com (tidak butuh ini).
// Docs: https://developers.facebook.com/docs/threads
import { enforceLimit } from './templates.js';

const GRAPH = 'https://graph.threads.net/v1.0';

export function hasThreadsCredentials() {
  return Boolean(process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_USER_ID);
}

function resolveCreds(override) {
  const token = override?.accessToken || process.env.THREADS_ACCESS_TOKEN;
  const userId = override?.userId || process.env.THREADS_USER_ID;
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

/** Verifikasi akun (token + userId) -> kembalikan username. */
export async function verifyAccount(accessToken, userId) {
  if (!accessToken || !userId) throw new Error('accessToken & userId wajib diisi.');
  const res = await fetch(`${GRAPH}/${userId}?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Akun tidak valid (HTTP ${res.status})`);
  return { ok: true, id: data.id, username: data.username || null };
}

/**
 * Posting UTAS (array of post) sebagai rangkaian reply.
 * @param {string[]} posts
 * @param {string} [topicTag] - topic untuk post pertama
 * @returns {Promise<string[]>} array id post yang dipublish
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

export async function postThread(rawPosts, topicTag, override) {
  const creds = resolveCreds(override);
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
