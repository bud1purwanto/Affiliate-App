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
- **QR Code** — buat QR dari link affiliate.
- **Threads** — pilih topic, lalu:
  - via **Extension**: tombol "▶ Isi ke Threads" mengisi composer + topic langsung di threads.com.
  - via **Web App**: posting otomatis pakai Threads API resmi (opsional, butuh token Meta).
- **Editor per post** + penghitung karakter (batas 500 Threads) + Salin / Salin Semua.

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
├── extension/              # Chrome Extension (MV3, side panel)
│   ├── manifest.json · background.js
│   ├── content.js          # inject ke threads.com
│   └── sidepanel.{html,css,js}
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

---

## 📌 Catatan

- **Shopee Affiliate Open API** memakai signature `SHA256(AppId+Timestamp+Payload+Secret)`. Daftar Open API di dashboard Shopee Affiliate.
- **"Isi ke Threads"** pada extension bekerja dengan menyisipkan teks ke composer aktif di threads.com. Pastikan kotak "New thread" sudah terbuka. Pemilihan topic bersifat best-effort mengikuti UI Threads terkini.
- Threads membatasi **500 karakter** per post — penghitung warna merah menandai post yang kepanjangan.
