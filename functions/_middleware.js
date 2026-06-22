// Middleware: tangani preflight OPTIONS + tempel header CORS ke semua respons API.
import { corsHeaders } from './_shared/respond.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  const res = await context.next();
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
