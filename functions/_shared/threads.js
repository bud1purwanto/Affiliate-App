// Threads API resmi (Meta) untuk Cloudflare Functions.
const GRAPH = 'https://graph.threads.net/v1.0';

function creds(env) {
  const token = env.THREADS_ACCESS_TOKEN;
  const userId = env.THREADS_USER_ID;
  if (!token || !userId) {
    const err = new Error('THREADS_ACCESS_TOKEN / THREADS_USER_ID belum diset.');
    err.code = 'NO_THREADS_CREDENTIALS';
    throw err;
  }
  return { token, userId };
}

async function createContainer({ text, replyToId, topicTag }, env) {
  const { token, userId } = creds(env);
  const params = new URLSearchParams({ media_type: 'TEXT', text, access_token: token });
  if (replyToId) params.set('reply_to_id', replyToId);
  if (topicTag) params.set('topic_tag', topicTag);
  const res = await fetch(`${GRAPH}/${userId}/threads`, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Gagal membuat container Threads');
  return data.id;
}

async function publishContainer(creationId, env) {
  const { token, userId } = creds(env);
  const params = new URLSearchParams({ creation_id: creationId, access_token: token });
  const res = await fetch(`${GRAPH}/${userId}/threads_publish`, { method: 'POST', body: params });
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

export async function postThread(posts, topicTag, env) {
  const ids = [];
  let replyToId = null;
  for (let i = 0; i < posts.length; i++) {
    const isReply = i > 0;
    try {
      // post balasan: retry 3x karena post induk kadang belum siap dibalas
      const containerId = await withRetry(
        () => createContainer({ text: posts[i], replyToId, topicTag: isReply ? undefined : topicTag }, env),
        isReply ? 3 : 1
      );
      const publishedId = await withRetry(() => publishContainer(containerId, env), isReply ? 3 : 1);
      ids.push(publishedId);
      replyToId = publishedId;
    } catch (e) {
      const err = new Error(`Gagal di post ${i + 1}/${posts.length}: ${e.message}. Berhasil terkirim ${ids.length} post.`);
      err.posted = ids.length;
      throw err;
    }
    // beri waktu post induk siap dibalas sebelum membuat post berikutnya
    if (i < posts.length - 1) await wait(3000);
  }
  return ids;
}

