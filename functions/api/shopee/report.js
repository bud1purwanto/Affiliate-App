import { json, readJson } from '../../_shared/respond.js';
import { getConversionReport } from '../../_shared/shopee.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  try {
    return json(await getConversionReport(body, env));
  } catch (err) {
    return json({ error: err.message }, err.code === 'NO_SHOPEE_CREDENTIALS' ? 400 : 502);
  }
}
