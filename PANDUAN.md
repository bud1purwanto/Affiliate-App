# 📘 Panduan Threadsmil — Konfigurasi, Deploy & Testing

Panduan lengkap untuk menyiapkan, men-deploy, dan menguji semua fitur Threadsmil.

---

## BAGIAN 1 — Yang perlu disiapkan (akun & credential)

| Credential | Wajib? | Untuk fitur | Cara dapat |
|---|---|---|---|
| **OPENROUTER_API_KEY** | Disarankan | Generate UTAS pakai AI, variasi hook, repurpose | Daftar di https://openrouter.ai → menu **Keys** → **Create Key**. Isi saldo sedikit (mis. $5). |
| **OPENROUTER_MODEL** | Opsional | Pilih model default | Contoh: `anthropic/claude-3.5-sonnet` |
| **SHOPEE_APP_ID** + **SHOPEE_APP_SECRET** | Untuk fitur Shopee | Cari produk, short link, tracking komisi | Login https://affiliate.shopee.co.id (harus sudah jadi Affiliate yang di-approve) → menu **Open API** → buat App → salin App ID & Secret |
| **THREADS_ACCESS_TOKEN** + **THREADS_USER_ID** | Opsional | Auto-post dari Web App (TANPA extension) | https://developers.facebook.com → buat App → produk **Threads API** → generate token |
| **SETUP_TOKEN** | Opsional | Mengunci halaman setup di deploy publik | Bebas, mis. `rahasia123` |

> ⚠️ **Penting:** Tanpa credential apa pun, app **tetap jalan** — generate UTAS pakai template otomatis. Fitur Shopee (produk/komisi/short link) baru aktif setelah `SHOPEE_APP_ID` & `SHOPEE_APP_SECRET` diisi. Untuk posting ke Threads, pakai **Extension** (tidak perlu Threads API).

---

## BAGIAN 2 — Deploy ke Cloudflare Pages

### Langkah A — Hubungkan repo
1. Buka https://dash.cloudflare.com → **Workers & Pages** → **Create** → tab **Pages** → **Connect to Git**.
2. Pilih repo `bud1purwanto/affiliate-app`.
3. Pilih branch: `main` (setelah PR di-merge) **atau** branch `claude/affiliate-post-generator-app-z3y4xd`.

### Langkah B — Build settings
- **Framework preset:** None
- **Build command:** *(kosongkan)*
- **Build output directory:** `public`
- (File `wrangler.toml` otomatis mengatur Functions + flag `nodejs_compat`.)

### Langkah C — Environment Variables
Di halaman setup project (atau nanti **Settings → Variables and Secrets**), tambahkan:
```
OPENROUTER_API_KEY   = sk-or-v1-........
OPENROUTER_MODEL     = anthropic/claude-3.5-sonnet
SHOPEE_APP_ID        = 1xxxxxxxxx
SHOPEE_APP_SECRET    = xxxxxxxxxxxxxxxx
SETUP_TOKEN          = rahasia123          (opsional)
```
> Threads & KV bisa menyusul (lihat Bagian 5 & 6).

### Langkah D — Deploy
Klik **Save and Deploy**. Setelah selesai kamu dapat URL, mis.
`https://affiliate-app.pages.dev`

### Langkah E — Cek cepat
- Buka `https://<project>.pages.dev` → halaman utama muncul.
- Buka `https://<project>.pages.dev/setup.html` → status integrasi (AI/Shopee) harusnya **ON** kalau env benar.

---

## BAGIAN 3 — Pasang Chrome Extension

1. Buka folder repo di komputer (clone / download).
2. Chrome → `chrome://extensions` → aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked** → pilih folder **`extension/`**.
4. Klik ikon Threadsmil (🧵) di toolbar → **side panel** terbuka.
5. Klik **⚙** di panel → isi **Backend URL** dengan URL Cloudflare kamu (mis. `https://affiliate-app.pages.dev`) → **Simpan**.

---

## BAGIAN 4 — Testing step-by-step (semua fitur)

### ✅ Test 1 — Setup & koneksi
1. Buka `/setup.html`.
2. Pill **AI** dan **Shopee** harus **ON**.
3. Klik **🔌 Tes Koneksi** di OpenRouter → harus "Valid".
4. Klik **🔌 Tes Koneksi** di Shopee → harus "Terhubung — contoh produk: ...".

### ✅ Test 2 — Riset produk cuan
1. Di halaman utama, kolom **Sub ID / Keyword** isi mis. `jaket`.
2. Pilih urutan **Komisi tertinggi** (atau Terlaris) → klik **🔍 Cari Produk**.
3. Muncul daftar produk (nama, harga, komisi, terjual).
4. Klik **✨ Generate UTAS produk ini** pada salah satu → langsung membuat UTAS.

### ✅ Test 3 — Generate UTAS + variasi hook + disclosure
1. Pastikan keyword/produk terisi.
2. Pilih **Gaya** (mis. Storytelling) & **Panjang** (Sedang 3-5 post).
3. Centang **Tambah disclosure #ad** (disarankan).
4. Klik **✨ Generate UTAS**.
5. Cek hasil:
   - Beberapa post muncul (Post 1/4, dst), tiap post ada penghitung karakter (merah kalau > 500).
   - Kotak **🎯 Variasi hook** muncul — klik salah satu untuk mengganti Post 1.
   - Post terakhir ada disclosure **#ad**.

### ✅ Test 4 — Short link & QR
1. Tempel link produk Shopee di kolom atas (atau pilih dari hasil cari produk).
2. Klik **🔗 Buat Short Link** → muncul link `s.shopee.co.id/...` dengan sub_id.
3. Klik **▦ Buat QR Code** → muncul gambar QR (digenerate di browser).

### ✅ Test 5 — Riwayat, draft, export/import, sync
1. Setiap generate otomatis masuk **🕘 Riwayat & Draft** (bawah halaman).
2. Klik **📂 Muat** pada satu entri → form & post terisi ulang.
3. Klik **💾 Simpan** (di header hasil) → tersimpan sebagai Draft.
4. Klik **⬇ Export** → unduh file JSON. Klik **⬆ Import** → pilih file itu → tergabung.
5. (Opsional, butuh KV — Bagian 6) Isi **Kode Sync** mis. `budi-2026` → **☁ Sync**.

### ✅ Test 6 — Repurpose ke IG/TikTok
1. Setelah ada hasil UTAS, di bawah post klik **📸 Caption Instagram** atau **🎵 Caption TikTok**.
2. Muncul satu caption + hashtag → edit bila perlu → **📋 Salin Caption**.

### ✅ Test 7 — Tracking performa
1. Buka **📊 Performa** (`/report.html`).
2. Pilih periode (30 hari) → **🔄 Muat**.
3. Muncul total komisi, jumlah order, dan tabel komisi per **sub_id** (bar makin panjang = makin cuan).
> Kalau belum ada konversi, tampil pesan kosong — itu normal untuk akun baru.

### ✅ Test 8 — Posting ke Threads via Extension (INTI)
1. Buka https://www.threads.com dan login.
2. Klik **New thread** (buka kotak tulis).
3. Buka side panel Threadsmil → generate UTAS (atau **Muat** dari riwayat).
4. **Isi per post:** klik **▶ Isi** pada Post 1 → teks masuk ke composer; isi **topic** ikut terisi (best-effort).
5. **Auto-chaining:** klik **▶ Kirim Semua ke Threads (1 utas)** → otomatis klik "Add to thread" & isi semua post berurutan.
6. Cek isinya, lalu klik **Post** di Threads.

### ✅ Test 9 — Lampirkan foto sendiri (Extension, eksperimental)
1. Di side panel, pada post yang diinginkan klik **📎 Foto** → pilih gambar dari komputer (muncul thumbnail).
2. Klik **▶ Isi** (atau Kirim Semua) → foto dicoba dilampirkan ke composer Threads.
3. **Jika foto tidak otomatis nempel:** teks tetap masuk normal — tinggal klik tombol foto bawaan Threads & pilih manual. (Fitur ini best-effort karena UI Threads bisa berubah.)

---

## BAGIAN 5 — (Opsional) Auto-post dari Web App via Threads API
Kalau mau posting **tanpa** buka browser/extension:
1. Dapatkan `THREADS_ACCESS_TOKEN` & `THREADS_USER_ID` dari Meta.
2. Tambahkan ke Variables Cloudflare → Redeploy.
3. Tombol **▶ Kirim ke Threads** di Web App akan aktif memposting otomatis (beruntun sebagai utas).

---

## BAGIAN 6 — (Opsional) Aktifkan Sync lintas-device (Cloudflare KV)
1. Buat namespace: `npx wrangler kv namespace create THREADSMIL_KV`
   (atau dashboard: **Workers & Pages → KV → Create namespace**).
2. Tambah binding ke Pages project: **Settings → Functions → KV namespace bindings** → Variable name **`THREADSMIL_KV`** → pilih namespace.
3. Redeploy. Lalu pakai **Kode Sync** yang sama di Web App & Extension untuk berbagi riwayat.

---

## BAGIAN 7 — Ringkasan fitur

| Fitur | Lokasi | Catatan |
|---|---|---|
| Generate UTAS (AI + template) | Web & Extension | Tanpa API key → template otomatis |
| Variasi hook A/B | Web & Extension | Klik untuk ganti Post 1 |
| Disclosure #ad | Web & Extension | Default aktif, aman ≤500 karakter |
| Riset produk (komisi/terlaris) | Web | Butuh Shopee API |
| Short link + sub_id | Web & Extension | Butuh Shopee API |
| QR Code | Web & Extension | Digenerate di browser |
| Tracking komisi per sub_id | Web (`/report.html`) | Butuh Shopee API |
| Repurpose IG/TikTok | Web | AI + fallback template |
| Riwayat & Draft | Web & Extension | Tersimpan di browser |
| Export / Import | Web & Extension | File JSON |
| Sync lintas-device | Web & Extension | Butuh KV (Bagian 6) |
| Isi/Kirim ke Threads + topic | Extension | Inti — posting praktis |
| Lampirkan foto | Extension | Eksperimental |
| Setup Wizard + Tes Koneksi | Web (`/setup.html`) | Cek credential |

---

## Appendix — Test cepat di komputer (sebelum deploy)
```bash
npm install
cp .env.example .env     # isi credential (boleh dikosongkan dulu)
npm start
```
Buka http://localhost:3000 — semua fitur Web App jalan. Untuk extension, set Backend URL = `http://localhost:3000`.

---

## Troubleshooting singkat
- **Pill Shopee OFF / "credential belum diset"** → cek `SHOPEE_APP_ID`/`SECRET` di Variables, lalu Redeploy.
- **Generate selalu "template"** → `OPENROUTER_API_KEY` belum keisi atau saldo habis.
- **"Composer Threads tidak ditemukan"** → buka kotak **New thread** dulu sebelum klik Isi.
- **Tombol "Add to thread" tidak ketemu** → UI Threads berubah; isi post sisanya manual, kabari untuk penyesuaian selektor.
- **Foto tidak nempel** → lampirkan manual via tombol foto Threads (fitur best-effort).
- **Sync error "KV belum aktif"** → ikuti Bagian 6.
