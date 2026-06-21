// AI generator via OpenRouter (OpenAI-compatible) dengan fallback ke template.
import { generateTemplate } from './templates.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildPrompt({ keyword, style, length, productName, productInfo, link, audience }) {
  const product = productName || keyword;
  const info = productInfo
    ? `\nDetail produk (dari Shopee):\n${productInfo}\n`
    : '';
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
- Setiap post maksimal 480 karakter (batas Threads).
- Sisipkan storytelling / value / edukasi sesuai gaya yang diminta, jangan langsung jualan.
- Post TERAKHIR berisi call-to-action + link affiliate persis seperti ini: ${link || '[LINK]'}
- Gunakan emoji secukupnya, jangan berlebihan.
- Jangan menulis nomor urut (1/4 dll), cukup isi post-nya saja.

Balas HANYA dalam format JSON valid berikut, tanpa teks lain:
{"posts": ["isi post 1", "isi post 2", "..."]}`;
}

function extractJson(text) {
  if (!text) return null;
  // Buang code fence kalau ada
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  // Ambil objek JSON pertama
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * Generate UTAS. Coba OpenRouter dulu, fallback ke template.
 * @returns {Promise<{posts:string[], source:'ai'|'template', model?:string, warning?:string}>}
 */
export async function generateUtas(opts) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = opts.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

  if (!apiKey) {
    return {
      posts: generateTemplate(opts),
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
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://threadsmil.app',
        'X-Title': process.env.OPENROUTER_TITLE || 'Threadsmil',
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

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const posts = Array.isArray(parsed?.posts) ? parsed.posts.filter((p) => typeof p === 'string' && p.trim()) : null;

    if (!posts || posts.length === 0) {
      return {
        posts: generateTemplate(opts),
        source: 'template',
        warning: 'Respon AI tidak bisa diparse — pakai template fallback.',
      };
    }

    return { posts, source: 'ai', model };
  } catch (err) {
    return {
      posts: generateTemplate(opts),
      source: 'template',
      warning: `AI gagal (${err.message}) — pakai template fallback.`,
    };
  }
}

/** Tes validitas OPENROUTER_API_KEY. */
export async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY belum diset.');
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Key tidak valid (${res.status}): ${t.slice(0, 120)}`);
  }
  const data = await res.json();
  const usage = data?.data;
  return {
    ok: true,
    label: usage?.label || 'OpenRouter key valid',
    limit: usage?.limit ?? null,
    usage: usage?.usage ?? null,
  };
}

/** Daftar model rekomendasi untuk dropdown UI. */
export const RECOMMENDED_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (terbaik)' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini (cepat & murah)' },
  { id: 'google/gemini-flash-1.5', label: 'Gemini 1.5 Flash (cepat)' },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B (open)' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat (murah)' },
];
