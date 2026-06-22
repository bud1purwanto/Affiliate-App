// AI generator via OpenRouter untuk Cloudflare Functions (env diteruskan via argumen).
import { generateTemplate, generateHookVariations, enforceLimit } from './templates.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const DISCLOSURE_NOTE =
  'Disclosure: link di atas adalah link affiliate, aku bisa dapat komisi kecil tanpa menambah harga buat kamu 🙏 #ad';

function applyDisclosure(posts, enabled) {
  if (!enabled || !posts.length) return posts;
  if (posts.some((p) => /#ad\b|link affiliate|dapat komisi/i.test(p))) return posts;
  const copy = [...posts];
  const last = copy[copy.length - 1];
  if ((last + '\n\n' + DISCLOSURE_NOTE).length <= 500) copy[copy.length - 1] = last + '\n\n' + DISCLOSURE_NOTE;
  else copy.push(DISCLOSURE_NOTE);
  return copy;
}

export const RECOMMENDED_MODELS = [
  { id: 'openrouter/auto', label: 'Auto — pilih model terbaik otomatis' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (terbaik)' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (cepat & murah)' },
  { id: 'google/gemini-flash-1.5', label: 'Gemini 1.5 Flash (cepat)' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B (open)' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat (murah)' },
];

function buildPrompt({ keyword, style, length, productName, productInfo, link, audience }) {
  const product = productName || keyword;
  const info = productInfo ? `\nDetail produk (dari Shopee):\n${productInfo}\n` : '';
  return `Kamu adalah seorang affiliate marketer profesional di Indonesia yang ahli membuat UTAS (thread) viral di Threads/Twitter untuk jualan produk Shopee.

Tugas: Buatkan satu UTAS affiliate untuk produk berikut.

Produk / kata kunci: ${product}
Gaya konten: ${style}
Panjang UTAS: ${length}
Target audiens: ${audience || 'umum, anak muda Indonesia'}
Link affiliate: ${link || '(akan ditambahkan otomatis)'}${info}

Aturan penulisan:
- Bahasa Indonesia santai, natural, relatable (bukan bahasa iklan kaku).
- Post pertama WAJIB hook kuat yang bikin orang berhenti scroll.
- Setiap post maksimal 450 karakter (batas Threads).
- Sisipkan storytelling / value / edukasi sesuai gaya yang diminta, jangan langsung jualan.
- Post TERAKHIR berisi call-to-action + link affiliate persis seperti ini: ${link || '[LINK]'}
- Gunakan emoji secukupnya, jangan berlebihan.
- Jangan menulis nomor urut (1/4 dll), cukup isi post-nya saja.

Selain itu, berikan 2 ALTERNATIF hook pembuka lain (selain post pertama) yang berbeda angle, untuk A/B testing.

Balas HANYA dalam format JSON valid berikut, tanpa teks lain:
{"posts": ["isi post 1", "isi post 2", "..."], "hooks": ["alternatif hook 1", "alternatif hook 2"]}`;
}

function extractJson(text) {
  if (!text) return null;
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export async function generateUtas(opts, env) {
  const apiKey = env.OPENROUTER_API_KEY;
  const model = opts.model || env.OPENROUTER_MODEL || 'openrouter/auto';

  if (!apiKey) {
    return {
      posts: applyDisclosure(enforceLimit(generateTemplate(opts)), opts.disclosure),
      hooks: generateHookVariations(opts, 3),
      source: 'template',
      warning: 'OPENROUTER_API_KEY belum diset — pakai template fallback.',
    };
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.OPENROUTER_REFERER || 'https://threadsmil.app',
        'X-Title': env.OPENROUTER_TITLE || 'Threadsmil',
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        messages: [
          { role: 'system', content: 'Kamu asisten copywriter affiliate yang selalu membalas dalam JSON valid.' },
          { role: 'user', content: buildPrompt(opts) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const posts = Array.isArray(parsed?.posts) ? parsed.posts.filter((p) => typeof p === 'string' && p.trim()) : null;
    if (!posts || !posts.length) {
      return {
        posts: applyDisclosure(enforceLimit(generateTemplate(opts)), opts.disclosure),
        hooks: generateHookVariations(opts, 3),
        source: 'template',
        warning: 'Respon AI tidak bisa diparse — pakai template fallback.',
      };
    }
    const hooks = Array.isArray(parsed?.hooks)
      ? parsed.hooks.filter((h) => typeof h === 'string' && h.trim())
      : generateHookVariations(opts, 2);
    return { posts: applyDisclosure(enforceLimit(posts), opts.disclosure), hooks, source: 'ai', model };
  } catch (err) {
    return {
      posts: applyDisclosure(enforceLimit(generateTemplate(opts)), opts.disclosure),
      hooks: generateHookVariations(opts, 3),
      source: 'template',
      warning: `AI gagal (${err.message}) — pakai template fallback.`,
    };
  }
}

function hashtagsFrom(text) {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);
  return [...words.map((w) => '#' + w), '#shopeefinds', '#racuntiktok', '#shopeehaul', '#rekomendasi'].join(' ');
}

export async function repurpose(opts, env) {
  const { posts = [], platform = 'instagram', productName = '', keyword = '', link = '' } = opts;
  const plat = platform === 'tiktok' ? 'TikTok' : 'Instagram';
  const apiKey = env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const caption = [posts[0] || productName || keyword, posts.slice(1, 3).join(' '), `Cek link ya 👉 ${link}`, hashtagsFrom(productName || keyword)]
      .filter(Boolean)
      .join('\n\n');
    return { platform, caption, source: 'template' };
  }

  const prompt = `Ubah UTAS Threads berikut menjadi SATU caption ${plat} (bukan thread, satu blok teks).
Sertakan hook kuat di awal, ringkas value/storytelling, ajakan cek link, dan 8-12 hashtag relevan di akhir.
Bahasa Indonesia santai & relatable. ${plat === 'TikTok' ? 'Lebih singkat & catchy, cocok jadi deskripsi video TikTok.' : 'Cocok untuk caption Instagram.'}
Link affiliate: ${link || '(link di bio)'}

UTAS:
${posts.join('\n---\n')}

Balas HANYA JSON valid: {"caption": "..."}`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.OPENROUTER_REFERER || 'https://threadsmil.app',
        'X-Title': env.OPENROUTER_TITLE || 'Threadsmil',
      },
      body: JSON.stringify({
        model: opts.model || env.OPENROUTER_MODEL || 'openrouter/auto',
        temperature: 0.85,
        messages: [
          { role: 'system', content: 'Kamu copywriter sosial media yang membalas dalam JSON valid.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json();
    const parsed = extractJson(data?.choices?.[0]?.message?.content || '');
    if (!parsed?.caption) throw new Error('caption kosong');
    return { platform, caption: parsed.caption, source: 'ai' };
  } catch (err) {
    const caption = [posts[0] || productName, `Cek link ya 👉 ${link}`, hashtagsFrom(productName || keyword)].filter(Boolean).join('\n\n');
    return { platform, caption, source: 'template', warning: err.message };
  }
}

export async function testOpenRouter(env) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY belum diset.');
  const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Key tidak valid (${res.status}): ${(await res.text()).slice(0, 120)}`);
  const data = await res.json();
  return { ok: true, label: data?.data?.label || 'OpenRouter key valid', limit: data?.data?.limit ?? null, usage: data?.data?.usage ?? null };
}
