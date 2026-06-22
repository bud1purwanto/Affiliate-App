import { json, readJson } from '../../_shared/respond.js';
import { postThread } from '../../_shared/threads.js';

export async function onRequestPost({ request, env }) {
  const { posts, topicTag } = await readJson(request);
  if (!Array.isArray(posts) || !posts.length) return json({ error: 'posts (array) wajib diisi.' }, 400);
  try {
    const ids = await postThread(posts, topicTag, env);
    return json({ ids, count: ids.length });
  } catch (err) {
    return json({ error: err.message }, err.code === 'NO_THREADS_CREDENTIALS' ? 400 : 502);
  }
}
