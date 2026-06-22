// Fallback generator berbasis template (tanpa AI / tanpa API key).
// Menghasilkan UTAS storytelling Bahasa Indonesia yang natural.

const HOOKS = {
  Edukasi: [
    'Banyak yang belum tahu, padahal {kw} itu ngaruh banget ke keseharian kita 👇',
    'Sebenarnya milih {kw} yang bener itu nggak susah, asal tahu triknya. Aku jelasin ya 🧵',
    'Ngomongin {kw}, ternyata ada hal penting yang sering dilewatin orang. Simak deh 👇',
  ],
  Storytelling: [
    '🔥 Lagi nyari {kw} yang beneran worth it? Aku punya cerita nih...',
    'Awalnya aku ragu sama {kw} ini, tapi ternyata... 🧵',
    'Cerita dikit ya soal {kw} yang akhirnya bikin aku nggak nyesel beli 👇',
  ],
  'Soft Selling': [
    'Akhir-akhir ini lagi suka banget sama {kw} yang satu ini 👀',
    'Kalau kamu lagi galau soal {kw}, mungkin ini bisa jadi pertimbangan 🧵',
    'Nemu {kw} yang pas di hati, pengen cerita ke kalian 👇',
  ],
  'Hard Selling': [
    '🚨 STOP scroll! {kw} terbaik dengan harga miring cuma di sini 👇',
    'Jangan sampai kehabisan! Promo {kw} ini beneran sayang dilewatin 🔥',
    'Buruan checkout! {kw} incaran kamu lagi diskon gede 🧵',
  ],
  Review: [
    'Review jujur {kw} setelah aku pakai beberapa waktu 🧵',
    'Worth it nggak sih {kw} ini? Ini pengalaman aslinya 👇',
    'Aku breakdown plus minus {kw} ini biar kamu nggak salah beli 🔥',
  ],
  Tips: [
    'Tips memilih {kw} biar nggak nyesel — thread 🧵',
    '5 hal yang harus kamu cek sebelum beli {kw} 👇',
    'Biar cuan dan hemat, ini cara pilih {kw} yang tepat 🔥',
  ],
};

const BODIES = [
  'Kualitasnya beneran di atas ekspektasi buat harga segini. Detailnya rapi, bahannya nyaman dipakai harian.',
  'Yang bikin aku suka, ini fungsional banget tapi tetap kelihatan stylish. Cocok buat berbagai suasana.',
  'Awalnya skeptis, tapi pas dipakai langsung kerasa bedanya. Nggak nyesel sama sekali.',
  'Banyak yang nanya beli di mana, makanya aku share di sini biar gampang dicari semua.',
  'Buat kamu yang suka value for money, ini salah satu pilihan yang menurutku paling masuk akal.',
  'Pengiriman cepet, packing aman, dan barangnya sesuai sama yang di foto. Recommended pokoknya.',
];

const CTAS = [
  'Kalau tertarik, langsung cek aja di sini ya 👉 {link}',
  'Buruan sebelum kehabisan, link-nya aku taruh di sini 👇 {link}',
  'Cek sekarang selagi masih promo 👉 {link}',
  'Mau lihat detail lengkapnya? Mampir ke sini 👇 {link}',
];

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function lengthToCount(length) {
  if (/pendek|short|1/i.test(length)) return 2;
  if (/panjang|long|6/i.test(length)) return 7;
  return 4; // sedang default
}

/**
 * Generate UTAS via template.
 * @param {{keyword:string, style:string, length:string, productName?:string, link:string, extraInfo?:string}} opts
 * @returns {string[]} array of post
 */
export function generateTemplate(opts) {
  const { keyword = 'produk ini', style = 'Storytelling', length = 'Sedang', productName, link = '' } = opts;
  const count = lengthToCount(length);
  const kw = productName || keyword;
  const seed = (kw + style).split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  const hookSet = HOOKS[style] || HOOKS.Storytelling;
  const posts = [];

  // Post 1: hook
  posts.push(pick(hookSet, seed).replace(/{kw}/g, kw));

  // Body posts
  const bodyCount = Math.max(1, count - 2);
  for (let i = 0; i < bodyCount; i++) {
    posts.push(pick(BODIES, seed + i * 7).replace(/{kw}/g, kw));
  }

  // Last post: CTA + link
  posts.push(pick(CTAS, seed + 99).replace(/{kw}/g, kw).replace(/{link}/g, link));

  // Tambahkan penanda urutan (n/total) seperti gaya UTAS Threads
  const total = posts.length;
  return posts.map((p, i) => `${p}`.trim()).slice(0, Math.max(total, count));
}

const THREADS_LIMIT = 500;

// Pecah teks > limit jadi beberapa bagian di batas kalimat/kata (bukan potong asal).
export function splitToLimit(text, limit = THREADS_LIMIT) {
  const t = (text || '').trim();
  if (t.length <= limit) return [t];
  const chunks = [];
  let rem = t;
  while (rem.length > limit) {
    let cut = rem.lastIndexOf(' ', limit);
    const sEnd = Math.max(
      rem.lastIndexOf('. ', limit),
      rem.lastIndexOf('! ', limit),
      rem.lastIndexOf('? ', limit),
      rem.lastIndexOf('\n', limit)
    );
    if (sEnd > limit * 0.6) cut = sEnd + 1;
    else if (cut < limit * 0.5) cut = limit; // tidak ada spasi wajar -> potong keras
    chunks.push(rem.slice(0, cut).trim());
    rem = rem.slice(cut).trim();
  }
  if (rem) chunks.push(rem);
  return chunks;
}

// Pastikan SEMUA post <= limit; yang kepanjangan dipecah jadi post tambahan.
export function enforceLimit(posts, limit = THREADS_LIMIT) {
  const out = [];
  for (const p of posts) out.push(...splitToLimit(p, limit));
  return out;
}

/** Hasilkan beberapa variasi hook (kalimat pembuka) untuk dipilih. */
export function generateHookVariations(opts, n = 3) {
  const { keyword = 'produk ini', style = 'Storytelling', productName } = opts;
  const kw = productName || keyword;
  const pool = [...(HOOKS[style] || HOOKS.Storytelling), ...HOOKS.Storytelling, ...HOOKS.Tips, ...HOOKS.Edukasi];
  let seed = (kw + style).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < pool.length && out.length < n; i++) {
    const h = pool[(seed + i) % pool.length].replace(/{kw}/g, kw);
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}

