import { json, readJson } from '../../_shared/respond.js';
import { generateShortLink } from '../../_shared/shopee.js';

export async function onRequestPost({ request, env }) {
  const { originUrl, subIds } = await readJson(request);
  if (!originUrl) return json({ error: 'originUrl wajib diisi.' }, 400);
  try {
    const shortLink = await generateShortLink(originUrl, Array.isArray(subIds) ? subIds : [subIds].filter(Boolean), env);
    return json({ shortLink });
  } catch (err) {
    return json({ error: err.message }, err.code === 'NO_SHOPEE_CREDENTIALS' ? 400 : 502);
  }
}
