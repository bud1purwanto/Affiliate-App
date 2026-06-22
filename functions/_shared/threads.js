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

export async function postThread(posts, topicTag, env) {
  const ids = [];
  let replyToId = null;
  for (let i = 0; i < posts.length; i++) {
    const containerId = await createContainer({ text: posts[i], replyToId, topicTag: i === 0 ? topicTag : undefined }, env);
    const publishedId = await publishContainer(containerId, env);
    ids.push(publishedId);
    replyToId = publishedId;
    if (i < posts.length - 1) await new Promise((r) => setTimeout(r, 1200));
  }
  return ids;
}
