import { json, readJson } from '../_shared/respond.js';
import { generateUtas } from '../_shared/ai.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!body.keyword && !body.productName) return json({ error: 'keyword atau productName wajib diisi.' }, 400);
  try {
    return json(await generateUtas(body, env));
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
