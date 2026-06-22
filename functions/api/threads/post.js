import { json, readJson } from '../../_shared/respond.js';
import { postThread, getServerAccounts } from '../../_shared/threads.js';

export async function onRequestPost({ request, env }) {
  const { posts, topicTag, accountId, accessToken, userId } = await readJson(request);
  if (!Array.isArray(posts) || !posts.length) return json({ error: 'posts (array) wajib diisi.' }, 400);
  let override;
  if (accountId) {
    const acc = getServerAccounts(env).find((a) => a.id === accountId);
    if (!acc) return json({ error: 'Akun server tidak ditemukan.' }, 400);
    override = { accessToken: acc.token, userId: acc.userId };
  } else if (accessToken && userId) {
    override = { accessToken, userId };
  }
  try {
    const ids = await postThread(posts, topicTag, env, override);
    return json({ ids, count: ids.length });
  } catch (err) {
    return json({ error: err.message }, err.code === 'NO_THREADS_CREDENTIALS' ? 400 : 502);
  }
}

