import { json, readJson, checkSetupAuth } from '../../_shared/respond.js';
import { testShopee } from '../../_shared/shopee.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  if (!checkSetupAuth(request, env, body)) return json({ error: 'Setup token salah/diperlukan.' }, 401);
  try {
    return json(await testShopee(env));
  } catch (err) {
    return json({ ok: false, error: err.message }, 400);
  }
}
