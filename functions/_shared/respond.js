// Helper respons + CORS untuk Cloudflare Pages Functions.
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-setup-token',
  };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/** Cek token setup. Jika env.SETUP_TOKEN tidak diset → terbuka. */
export function checkSetupAuth(request, env, body = {}) {
  const token = env.SETUP_TOKEN;
  if (!token) return true;
  const provided = request.headers.get('x-setup-token') || body.setupToken;
  return provided === token;
}
