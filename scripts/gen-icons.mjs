// Generator icon PNG untuk extension & favicon — tanpa dependency (pakai zlib bawaan).
// Jalankan: node scripts/gen-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Warna brand
const A = [124, 58, 237]; // #7c3aed
const B = [219, 39, 119]; // #db2777
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22; // radius sudut membulat
  const barW = size * 0.52;
  const barH = Math.max(2, size * 0.1);
  const barX = (size - barW) / 2;
  const bars = [size * 0.28, size * 0.45, size * 0.62]; // 3 garis "utas"
  const barR = barH / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // sudut membulat: alpha 0 di luar radius
      let inside = true;
      const cx = x < r ? r : x > size - r ? size - r : x;
      const cy = y < r ? r : y > size - r ? size - r : y;
      if ((x < r || x > size - r) && (y < r || y > size - r)) {
        inside = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
      }
      if (!inside) {
        buf[i + 3] = 0;
        continue;
      }
      // gradient diagonal
      const t = (x / size + y / size) / 2;
      let cr = lerp(A[0], B[0], t),
        cg = lerp(A[1], B[1], t),
        cb = lerp(A[2], B[2], t);
      // gambar bar putih (rounded)
      for (const by of bars) {
        const top = by - barH / 2;
        if (y >= top && y <= top + barH) {
          let onBar = x >= barX && x <= barX + barW;
          if (x < barX + barR || x > barX + barW - barR) {
            const ccx = x < barX + barR ? barX + barR : barX + barW - barR;
            const ccy = by;
            onBar = Math.hypot(x + 0.5 - ccx, y + 0.5 - ccy) <= barR;
          }
          if (onBar) {
            cr = 255;
            cg = 255;
            cb = 255;
          }
        }
      }
      buf[i] = cr;
      buf[i + 1] = cg;
      buf[i + 2] = cb;
      buf[i + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const extDir = path.join(root, 'extension', 'icons');
fs.mkdirSync(extDir, { recursive: true });
for (const s of [16, 48, 128]) fs.writeFileSync(path.join(extDir, `icon${s}.png`), drawIcon(s));
fs.writeFileSync(path.join(root, 'public', 'favicon.png'), drawIcon(64));
fs.writeFileSync(path.join(extDir, 'icon128.png'), drawIcon(128));
console.log('Icons generated: extension/icons/{16,48,128} + public/favicon.png');
