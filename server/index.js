import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { generateUtas, RECOMMENDED_MODELS, testOpenRouter } from './services/ai.js';
import { generateShortLink, searchProducts, hasShopeeCredentials, testShopee } from './services/shopee.js';
import { postThread, hasThreadsCredentials } from './services/threads.js';
import { applyAndPersist, status as configStatus, checkSetupAuth, setupTokenRequired } from './services/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- Static frontend (Web App) ----
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---- Health & config ----
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ai: Boolean(process.env.OPENROUTER_API_KEY),
    shopee: hasShopeeCredentials(),
    threads: hasThreadsCredentials(),
    models: RECOMMENDED_MODELS,
    defaultModel: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  });
});

// ---- Generate UTAS ----
app.post('/api/generate', async (req, res) => {
  try {
    const { keyword, style, length, productName, productInfo, link, audience, model } = req.body || {};
    if (!keyword && !productName) {
      return res.status(400).json({ error: 'keyword atau productName wajib diisi.' });
    }
    const result = await generateUtas({ keyword, style, length, productName, productInfo, link, audience, model });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Shopee: cari produk ----
app.post('/api/shopee/products', async (req, res) => {
  try {
    const { keyword, itemId, shopId, limit, sortType } = req.body || {};
    const products = await searchProducts({ keyword, itemId, shopId, limit, sortType });
    res.json({ products });
  } catch (err) {
    const status = err.code === 'NO_SHOPEE_CREDENTIALS' ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

// ---- Shopee: short link affiliate ----
app.post('/api/shopee/shortlink', async (req, res) => {
  try {
    const { originUrl, subIds } = req.body || {};
    if (!originUrl) return res.status(400).json({ error: 'originUrl wajib diisi.' });
    const shortLink = await generateShortLink(originUrl, Array.isArray(subIds) ? subIds : [subIds].filter(Boolean));
    res.json({ shortLink });
  } catch (err) {
    const status = err.code === 'NO_SHOPEE_CREDENTIALS' ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

// ---- QR Code (data URL PNG) ----
app.post('/api/qrcode', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text wajib diisi.' });
    const dataUrl = await QRCode.toDataURL(text, { width: 320, margin: 1 });
    res.json({ dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Threads: posting via API resmi (opsional) ----
app.post('/api/threads/post', async (req, res) => {
  try {
    const { posts, topicTag } = req.body || {};
    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ error: 'posts (array) wajib diisi.' });
    }
    const ids = await postThread(posts, topicTag);
    res.json({ ids, count: ids.length });
  } catch (err) {
    const status = err.code === 'NO_THREADS_CREDENTIALS' ? 400 : 502;
    res.status(status).json({ error: err.message });
  }
});

// ---- Setup wizard: status credential ----
app.get('/api/setup/status', (_req, res) => {
  res.json({
    config: configStatus(),
    tokenRequired: setupTokenRequired(),
    integrations: {
      ai: Boolean(process.env.OPENROUTER_API_KEY),
      shopee: hasShopeeCredentials(),
      threads: hasThreadsCredentials(),
    },
  });
});

// ---- Setup wizard: simpan credential ----
app.post('/api/setup', (req, res) => {
  if (!checkSetupAuth(req)) return res.status(401).json({ error: 'Setup token salah/diperlukan.' });
  const { OPENROUTER_API_KEY, OPENROUTER_MODEL, SHOPEE_APP_ID, SHOPEE_APP_SECRET, THREADS_ACCESS_TOKEN, THREADS_USER_ID } = req.body || {};
  const result = applyAndPersist({ OPENROUTER_API_KEY, OPENROUTER_MODEL, SHOPEE_APP_ID, SHOPEE_APP_SECRET, THREADS_ACCESS_TOKEN, THREADS_USER_ID });
  res.json({ ok: true, ...result, config: configStatus() });
});

// ---- Test koneksi ----
app.post('/api/test/openrouter', async (req, res) => {
  if (!checkSetupAuth(req)) return res.status(401).json({ error: 'Setup token salah/diperlukan.' });
  try {
    res.json(await testOpenRouter());
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/test/shopee', async (req, res) => {
  if (!checkSetupAuth(req)) return res.status(401).json({ error: 'Setup token salah/diperlukan.' });
  try {
    res.json(await testShopee());
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🧵 Threadsmil server jalan di http://localhost:${PORT}`);
  console.log(`   AI (OpenRouter): ${process.env.OPENROUTER_API_KEY ? 'aktif' : 'OFF (template fallback)'}`);
  console.log(`   Shopee API     : ${hasShopeeCredentials() ? 'aktif' : 'OFF'}`);
  console.log(`   Threads API    : ${hasThreadsCredentials() ? 'aktif' : 'OFF (pakai extension)'}\n`);
});
