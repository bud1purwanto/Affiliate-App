import { json, readJson } from '../_shared/respond.js';
import { repurpose } from '../_shared/ai.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!Array.isArray(body.posts) || !body.posts.length) return json({ error: 'posts wajib diisi.' }, 400);
  try {
    return json(await repurpose(body, env));
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
