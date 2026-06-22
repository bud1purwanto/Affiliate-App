import { json } from '../../_shared/respond.js';
import { getServerAccounts } from '../../_shared/threads.js';

// Daftar akun yang dikonfigurasi di server (label & userId saja — TANPA token).
export function onRequestGet({ env }) {
  const accounts = getServerAccounts(env).map((a) => ({ id: a.id, label: a.label, userId: a.userId }));
  const hasDefault = Boolean(env.THREADS_ACCESS_TOKEN && env.THREADS_USER_ID);
  return json({ accounts, hasDefault });
}
