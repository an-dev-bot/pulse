// Genera los íconos (PNG sin dependencias + SVG): fondo casi negro y una línea de pulso verde neón.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const LINE = [[0.12, 0.56], [0.34, 0.56], [0.42, 0.40], [0.50, 0.72], [0.58, 0.28], [0.66, 0.56], [0.88, 0.56]];

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
}
const CRC = crcTable();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function draw(size, bg, { scale = 1, rounded = true } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const [br, bgc, bb] = hex(bg);
  const [lr, lg, lb] = [57, 255, 136];
  const pts = LINE.map(([x, y]) => [(0.5 + (x - 0.5) * scale) * size, (0.5 + (y - 0.5) * scale) * size]);
  const w = size * 0.055 * scale;
  const glow = size * 0.06 * scale;
  const r = size * 0.2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    let a = 255;
    if (rounded) {
      const cx = Math.min(Math.max(x + 0.5, r), size - r), cy = Math.min(Math.max(y + 0.5, r), size - r);
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      a = Math.round(255 * Math.max(0, Math.min(1, r - d + 0.5)));
    }
    let d = Infinity;
    for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, segDist(x + 0.5, y + 0.5, ...pts[k], ...pts[k + 1]));
    const core = Math.max(0, Math.min(1, w / 2 - d + 0.5));
    const halo = Math.max(0, 1 - (d - w / 2) / glow) * 0.28;
    const m = Math.max(core, halo);
    buf[i] = Math.round(br + (lr - br) * m);
    buf[i + 1] = Math.round(bgc + (lg - bgc) * m);
    buf[i + 2] = Math.round(bb + (lb - bb) * m);
    buf[i + 3] = a;
  }
  return png(size, buf);
}

export async function makeIcons(dir, bg) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'icon-192.png'), draw(192, bg));
  await writeFile(join(dir, 'icon-512.png'), draw(512, bg));
  await writeFile(join(dir, 'maskable-512.png'), draw(512, bg, { scale: 0.72, rounded: false }));
  await writeFile(join(dir, 'apple-touch-icon.png'), draw(180, bg, { rounded: false }));
  const pts = LINE.map(([x, y]) => `${x * 64},${y * 64}`).join(' ');
  await writeFile(join(dir, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="13" fill="${bg}"/><polyline points="${pts}" fill="none" stroke="#39ff88" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
}
