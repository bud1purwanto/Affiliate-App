// Klien Shopee Affiliate Open API (GraphQL + signature SHA256).
// Dokumentasi: https://open-api.affiliate.shopee.co.id/
import crypto from 'node:crypto';

const API_URL = process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.co.id/graphql';

function credentials() {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_APP_SECRET;
  if (!appId || !secret) {
    const err = new Error('SHOPEE_APP_ID / SHOPEE_APP_SECRET belum diset di environment.');
    err.code = 'NO_SHOPEE_CREDENTIALS';
    throw err;
  }
  return { appId, secret };
}

/**
 * Kirim query GraphQL ke Shopee Affiliate API dengan signature.
 * Signature = SHA256(AppId + Timestamp + Payload + Secret)
 */
async function callShopee(query, variables = {}) {
  const { appId, secret } = credentials();
  const payload = JSON.stringify({ query, variables });
  const timestamp = Math.floor(Date.now() / 1000);
  const factor = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash('sha256').update(factor).digest('hex');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors) {
    const msg = data?.errors?.[0]?.message || data?.message || `HTTP ${res.status}`;
    const err = new Error(`Shopee API error: ${msg}`);
    err.details = data;
    throw err;
  }
  return data.data;
}

/**
 * Generate short link affiliate dengan sub_id (untuk tracking).
 * @param {string} originUrl - URL produk Shopee asli
 * @param {string[]} subIds - maksimal 5 sub id
 */
export async function generateShortLink(originUrl, subIds = []) {
  const query = `mutation ($input: ShortLinkInput!) {
    generateShortLink(input: $input) {
      shortLink
    }
  }`;
  const data = await callShopee(query, {
    input: { originUrl, subIds: subIds.filter(Boolean).slice(0, 5) },
  });
  return data?.generateShortLink?.shortLink || null;
}

/**
 * Cari produk affiliate berdasarkan keyword (atau itemId/shopId).
 * @param {{keyword?:string, itemId?:number, shopId?:number, limit?:number, sortType?:number}} params
 */
export async function searchProducts({ keyword, itemId, shopId, limit = 5, sortType = 2 } = {}) {
  const query = `query (
    $keyword: String, $itemId: Int64, $shopId: Int64, $limit: Int32, $sortType: Int32
  ) {
    productOfferV2(
      keyword: $keyword, itemId: $itemId, shopId: $shopId, limit: $limit, sortType: $sortType
    ) {
      nodes {
        itemId
        productName
        priceMin
        priceMax
        price
        imageUrl
        shopName
        ratingStar
        sales
        commissionRate
        priceDiscountRate
        offerLink
        productLink
      }
      pageInfo { page limit hasNextPage }
    }
  }`;
  const data = await callShopee(query, { keyword, itemId, shopId, limit, sortType });
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
  const rows = Object.values(bySub).sort((a, b) => b.commission - a.commission);
  return { totalCommission, totalOrders: nodes.length, rows };
}

/** Laporan konversi/komisi (diagregasi per sub_id) untuk N hari terakhir. */
export async function getConversionReport({ days = 30 } = {}) {
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
    const data = await callShopee(query, { start, end, scrollId, limit: 100 });
    const r = data?.conversionReport;
    (r?.nodes || []).forEach((n) => all.push(n));
    scrollId = r?.pageInfo?.hasNextPage ? r.pageInfo.scrollId : null;
    pages += 1;
  } while (scrollId && pages < 10);
  return { ...aggregateReport(all), days };
}

/** Cek apakah credential Shopee tersedia (untuk UI). */
export function hasShopeeCredentials() {
  return Boolean(process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET);
}

/** Tes koneksi Shopee Affiliate API (query ringan). */
export async function testShopee() {
  credentials(); // lempar error kalau credential kosong
  const products = await searchProducts({ keyword: 'jaket', limit: 1 });
  return { ok: true, sample: products[0]?.productName || null, count: products.length };
}
