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
