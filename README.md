# 🧵 Threadsmil — Generator UTAS / Postingan Affiliate

Aplikasi untuk **membuat UTAS (thread) / postingan affiliate Shopee secara otomatis**, lalu posting ke **Threads** lengkap dengan pemilihan **topic**.

Terdiri dari 2 bagian yang saling melengkapi:

1. **Web App** (Node/Express, deploy ke Railway) — generate konten + integrasi Shopee + QR + (opsional) posting via Threads API resmi.
2. **Chrome Extension** (side panel) — generate konten dari mana saja **lalu "Isi ke Threads" langsung** di `threads.com` tanpa perlu API resmi.

Konten di-generate pakai **AI via OpenRouter** (bisa pilih model dinamis) dengan **fallback template** otomatis kalau API key belum diset.

---

## ✨ Fitur

- **Generate UTAS otomatis** — pilih gaya (Edukasi / Storytelling / Soft Selling / Hard Selling / Review / Tips) & panjang (1-2, 3-5, 6-8 post).
- **AI dinamis (OpenRouter)** — ganti model sesuka hati (Claude, GPT, Gemini, Llama, DeepSeek, dll).
- **Shopee Affiliate API resmi** — cari produk (nama, harga, gambar, komisi) + generate **short link** dengan `sub_id` untuk tracking.
- **QR Code** — buat QR dari link affiliate, digenerate **100% di browser** (`vendor/qrcode.bundle.js`) sehingga jalan di Cloudflare/Railway/lokal tanpa bergantung backend. Regenerasi bundle: `npm run build:qr`.
- **Threads** — pilih topic, lalu:
  - via **Extension**: tombol "▶ Isi ke Threads" per post, atau **"▶ Kirim Semua ke Threads (1 utas)"** yang otomatis meng-_chain_ semua post (klik "Add to thread" sendiri) + isi topic.
  - via **Web App**: posting otomatis pakai Threads API resmi (opsional, butuh token Meta).
- **Editor per post** + penghitung karakter (batas 500 Threads) + Salin / Salin Semua.
- **Setup Wizard** (`/setup.html`) — masukkan & **tes koneksi** semua credential (OpenRouter, Shopee, Threads) dari browser, tanpa edit file manual.
- **Riwayat & Draft** — tiap hasil generate tersimpan otomatis; bisa simpan draft manual, **muat ulang** ke editor, atau hapus. Disimpan di sisi klien (`localStorage` di Web App, `chrome.storage` di Extension) — gratis, tanpa server/DB. Cocok untuk Cloudflare Pages.

---

## 🚀 Menjalankan Web App (lokal)

```bash
npm install
cp .env.example .env   # lalu isi key (boleh dikosongkan dulu untuk mode template)
npm start
```

Buka http://localhost:3000

> Tanpa `OPENROUTER_API_KEY`, app tetap jalan memakai **template fallback**.
> Tanpa kredensial Shopee, fitur cari produk & short link nonaktif (generate tetap bisa).

### Deploy ke Cloudflare Pages (full, tanpa Railway)

Backend sudah di-port ke **Cloudflare Pages Functions** (folder `functions/`), jadi seluruh app (frontend + API) bisa jalan di Cloudflare.

1. Push repo ke GitHub (sudah).
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pilih repo ini.
3. Build settings:
   - **Build command:** *(kosongkan)*
   - **Build output directory:** `public`
   - Functions & `wrangler.toml` (termasuk flag `nodejs_compat`) terbaca otomatis.
4. **Settings → Variables and Secrets** → isi: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`, (opsional) `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID`, `SETUP_TOKEN`.
5. **Save & Deploy** → dapat URL `https://<project>.pages.dev`.

> Di Cloudflare credential **di-set lewat dashboard** (Workers tanpa filesystem), jadi halaman `/setup.html` otomatis jadi mode **status & Tes Koneksi** saja. Signature Shopee memakai Web Crypto (sudah diverifikasi identik dengan Node).
>
> Untuk dev lokal Cloudflare: `npx wrangler pages dev public`.

### Deploy ke Railway

1. Connect repo ini ke Railway (atau `railway up`).
2. Tambahkan environment variables (lihat `.env.example`).
3. Railway otomatis menjalankan `npm start` (lihat `railway.json`).

---

## 🧩 Memasang Chrome Extension

1. Buka `chrome://extensions` → aktifkan **Developer mode**.
2. **Load unpacked** → pilih folder `extension/`.
3. Klik ikon ekstensi → side panel Threadsmil terbuka.
4. Klik ⚙ → set **Backend URL** ke server Web App kamu (mis. `http://localhost:3000` atau URL Railway).
5. Generate UTAS → buka `threads.com` → klik **New thread** → klik **▶ Isi ke Threads** pada tiap post.

---

## 🔑 Environment Variables

| Variable | Wajib | Keterangan |
|---|---|---|
| `OPENROUTER_API_KEY` | untuk AI | Key dari https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | opsional | Model default, mis. `anthropic/claude-3.5-sonnet` |
| `SHOPEE_APP_ID` | untuk Shopee | App ID dari Shopee Affiliate Open API |
| `SHOPEE_APP_SECRET` | untuk Shopee | Secret dari Shopee Affiliate Open API |
| `THREADS_ACCESS_TOKEN` | opsional | Untuk auto-post dari Web App (Threads API Meta) |
| `THREADS_USER_ID` | opsional | User ID Threads |
| `PORT` | opsional | Diisi otomatis oleh Railway |

---

## 🛠 Arsitektur

```
threadsmil/
├── server/                 # Web App backend (Express)
│   ├── index.js            # Routes & static serving
│   └── services/
│       ├── ai.js           # OpenRouter + fallback template
│       ├── templates.js    # Generator template (tanpa API)
│       ├── shopee.js       # Shopee Affiliate Open API (GraphQL + signature)
│       └── threads.js      # Threads API resmi (opsional)
├── public/                 # Web App frontend
│   ├── index.html · styles.css · app.js
├── functions/              # Cloudflare Pages Functions (port dari server/)
│   ├── _middleware.js      # CORS + preflight
│   ├── _shared/            # ai · shopee (Web Crypto) · threads · templates · respond
│   └── api/                # health, generate, qrcode, shopee/*, threads/*, setup*, test/*
├── extension/              # Chrome Extension (MV3, side panel)
│   ├── manifest.json · background.js
│   ├── content.js          # inject ke threads.com
│   └── sidepanel.{html,css,js}
├── wrangler.toml           # config Cloudflare Pages
├── railway.json · .env.example · package.json
```

### Endpoint API

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/health` | Status konfigurasi + daftar model |
| POST | `/api/generate` | Generate UTAS (AI/template) |
| POST | `/api/shopee/products` | Cari produk Shopee |
| POST | `/api/shopee/shortlink` | Buat short link affiliate |
| POST | `/api/qrcode` | Buat QR Code (data URL) |
| POST | `/api/threads/post` | Posting ke Threads (API resmi) |
| GET | `/api/setup/status` | Status credential (secret di-mask) |
| POST | `/api/setup` | Simpan credential (runtime + `.env`) |
| POST | `/api/test/openrouter` | Tes validitas key OpenRouter |
| POST | `/api/test/shopee` | Tes koneksi Shopee API |

> **Keamanan setup:** jika `SETUP_TOKEN` diset di env, endpoint `/api/setup*` & `/api/test/*` butuh header `x-setup-token`. Disarankan set `SETUP_TOKEN` saat deploy publik agar tidak sembarang orang bisa mengubah credential.

---

## 📌 Catatan

- **Shopee Affiliate Open API** memakai signature `SHA256(AppId+Timestamp+Payload+Secret)`. Daftar Open API di dashboard Shopee Affiliate.
- **"Isi ke Threads"** pada extension bekerja dengan menyisipkan teks ke composer aktif di threads.com. Pastikan kotak "New thread" sudah terbuka. Pemilihan topic bersifat best-effort mengikuti UI Threads terkini.
- Threads membatasi **500 karakter** per post — penghitung warna merah menandai post yang kepanjangan.
