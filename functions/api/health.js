import { json } from '../_shared/respond.js';
import { RECOMMENDED_MODELS } from '../_shared/ai.js';

export function onRequestGet({ env }) {
  return json({
    ok: true,
    ai: Boolean(env.OPENROUTER_API_KEY),
    shopee: Boolean(env.SHOPEE_APP_ID && env.SHOPEE_APP_SECRET),
    threads: Boolean(env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID),
    models: RECOMMENDED_MODELS,
    defaultModel: env.OPENROUTER_MODEL || 'openrouter/auto',
    platform: 'cloudflare',
  });
}
