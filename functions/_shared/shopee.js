// Shopee Affiliate Open API untuk Cloudflare Functions.
// Pakai Web Crypto API (crypto.subtle) untuk SHA256 — tersedia di Workers.

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function creds(env) {
  const appId = env.SHOPEE_APP_ID;
  const secret = env.SHOPEE_APP_SECRET;
  if (!appId || !secret) {
    const err = new Error('SHOPEE_APP_ID / SHOPEE_APP_SECRET belum diset di environment.');
    err.code = 'NO_SHOPEE_CREDENTIALS';
    throw err;
  }
  return { appId, secret, url: env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.co.id/graphql' };
}

async function callShopee(query, variables, env) {
  const { appId, secret, url } = creds(env);
  const payload = JSON.stringify({ query, variables });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha256Hex(`${appId}${timestamp}${payload}${secret}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors) {
    throw new Error(`Shopee API error: ${data?.errors?.[0]?.message || data?.message || 'HTTP ' + res.status}`);
  }
  return data.data;
}

export async function generateShortLink(originUrl, subIds, env) {
  const query = `mutation ($input: ShortLinkInput!) { generateShortLink(input: $input) { shortLink } }`;
  const data = await callShopee(query, { input: { originUrl, subIds: (subIds || []).filter(Boolean).slice(0, 5) } }, env);
  return data?.generateShortLink?.shortLink || null;
}

export async function searchProducts({ keyword, itemId, shopId, limit = 5, sortType = 2 } = {}, env) {
  const query = `query ($keyword: String, $itemId: Int64, $shopId: Int64, $limit: Int32, $sortType: Int32) {
    productOfferV2(keyword: $keyword, itemId: $itemId, shopId: $shopId, limit: $limit, sortType: $sortType) {
      nodes { itemId productName priceMin priceMax price imageUrl shopName ratingStar sales commissionRate priceDiscountRate offerLink productLink }
      pageInfo { page limit hasNextPage }
    }
  }`;
  const data = await callShopee(query, { keyword, itemId, shopId, limit, sortType }, env);
  return data?.productOfferV2?.nodes || [];
}

function aggregateReport(nodes) {
  const bySub = {};
  let totalCommission = 0;
  for (const n of nodes) {
    const sub = n.subId1 || n.utmContent || '(tanpa sub_id)';
    const c = Number(n.totalCommission || n.itemTotalCommission || 0);
    totalCommission += c;
    bySub[sub] = bySub[sub] || { subId: sub, orders: 0, commission: 0 };
    bySub[sub].orders += 1;
    bySub[sub].commission += c;
  }
  return { totalCommission, totalOrders: nodes.length, rows: Object.values(bySub).sort((a, b) => b.commission - a.commission) };
}

export async function getConversionReport({ days = 30 } = {}, env) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;
  const query = `query ($start: Int64, $end: Int64, $scrollId: String, $limit: Int32) {
    conversionReport(purchaseTimeStart: $start, purchaseTimeEnd: $end, scrollId: $scrollId, limit: $limit) {
      nodes { purchaseTime conversionId totalCommission subId1 subId2 subId3 subId4 subId5 utmContent }
      pageInfo { hasNextPage scrollId limit }
    }
  }`;
  let scrollId = null;
  const all = [];
  let pages = 0;
  do {
    const data = await callShopee(query, { start, end, scrollId, limit: 100 }, env);
    const r = data?.conversionReport;
    (r?.nodes || []).forEach((n) => all.push(n));
    scrollId = r?.pageInfo?.hasNextPage ? r.pageInfo.scrollId : null;
    pages += 1;
  } while (scrollId && pages < 10);
  return { ...aggregateReport(all), days };
}

export async function testShopee(env) {
  creds(env);
  const products = await searchProducts({ keyword: 'jaket', limit: 1 }, env);
  return { ok: true, sample: products[0]?.productName || null, count: products.length };
}
