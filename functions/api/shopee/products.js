import { json, readJson } from '../../_shared/respond.js';
import { searchProducts } from '../../_shared/shopee.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  try {
    const products = await searchProducts(body, env);
    return json({ products });
  } catch (err) {
    return json({ error: err.message }, err.code === 'NO_SHOPEE_CREDENTIALS' ? 400 : 502);
  }
}
