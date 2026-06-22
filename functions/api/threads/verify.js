import { json, readJson } from '../../_shared/respond.js';
import { verifyAccount } from '../../_shared/threads.js';

export async function onRequestPost({ request }) {
  const { accessToken, userId } = await readJson(request);
  try {
    return json(await verifyAccount(accessToken, userId));
  } catch (err) {
    return json({ ok: false, error: err.message }, 400);
  }
}
