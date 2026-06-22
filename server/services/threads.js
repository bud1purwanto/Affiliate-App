// Klien Threads API resmi (Meta) — opsional, untuk auto-post dari Web App.
// Untuk Chrome Extension, posting dilakukan via DOM threads.com (tidak butuh ini).
// Docs: https://developers.facebook.com/docs/threads
const GRAPH = 'https://graph.threads.net/v1.0';

export function hasThreadsCredentials() {
  return Boolean(process.env.THREADS_ACCESS_TOKEN && process.env.THREADS_USER_ID);
}

function creds() {
  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  if (!token || !userId) {
    const err = new Error('THREADS_ACCESS_TOKEN / THREADS_USER_ID belum diset.');
    err.code = 'NO_THREADS_CREDENTIALS';
    throw err;
  }
  return { token, userId };
}

async function createContainer({ text, replyToId, topicTag }) {
  const { token, userId } = creds();
  const params = new URLSearchParams({ media_type: 'TEXT', text, access_token: token });
  if (replyToId) params.set('reply_to_id', replyToId);
  if (topicTag) params.set('topic_tag', topicTag);

  const res = await fetch(`${GRAPH}/${userId}/threads`, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Gagal membuat container Threads');
  return data.id;
}

async function publishContainer(creationId) {
  const { token, userId } = creds();
  const params = new URLSearchParams({ creation_id: creationId, access_token: token });
  const res = await fetch(`${GRAPH}/${userId}/threads_publish`, { method: 'POST', body: params });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Gagal publish Threads');
  return data.id;
}

/**
 * Posting UTAS (array of post) sebagai rangkaian reply.
 * @param {string[]} posts
 * @param {string} [topicTag] - topic untuk post pertama
 * @returns {Promise<string[]>} array id post yang dipublish
 */
export async function postThread(posts, topicTag) {
  const ids = [];
  let replyToId = null;
  for (let i = 0; i < posts.length; i++) {
    const containerId = await createContainer({
      text: posts[i],
      replyToId,
      topicTag: i === 0 ? topicTag : undefined,
    });
    const publishedId = await publishContainer(containerId);
    ids.push(publishedId);
    replyToId = publishedId;
    // Threads butuh jeda singkat antar publish
    if (i < posts.length - 1) await new Promise((r) => setTimeout(r, 1200));
  }
  return ids;
}
