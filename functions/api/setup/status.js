import { json } from '../../_shared/respond.js';

const SECRET = ['OPENROUTER_API_KEY', 'SHOPEE_APP_SECRET', 'THREADS_ACCESS_TOKEN'];
const PLAIN = ['OPENROUTER_MODEL', 'SHOPEE_APP_ID', 'THREADS_USER_ID'];
const mask = (v) => (!v ? null : String(v).length <= 4 ? '••••' : '••••' + String(v).slice(-4));

export function onRequestGet({ env }) {
  const config = {};
  for (const k of SECRET) config[k] = mask(env[k]);
  for (const k of PLAIN) config[k] = env[k] || null;
  return json({
    config,
    tokenRequired: Boolean(env.SETUP_TOKEN),
    // Cloudflare Workers tidak punya filesystem → credential di-set lewat dashboard.
    writable: false,
    platform: 'cloudflare',
    integrations: {
      ai: Boolean(env.OPENROUTER_API_KEY),
      shopee: Boolean(env.SHOPEE_APP_ID && env.SHOPEE_APP_SECRET),
      threads: Boolean(env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID),
    },
  });
}
