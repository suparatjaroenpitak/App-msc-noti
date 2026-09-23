#!/usr/bin/env node
/* eslint-disable no-console */
// Generates public/icons/*.png (192, 512, maskable) without external deps.
// Minimal PNG writer using node:zlib.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length, 0); // note: PNG uses big-endian; fixed below
  // PNG is big-endian:
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // raw scanlines with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function makeIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const bg = [5, 150, 105]; // emerald-600
  const bgDark = [4, 120, 87];
  const white = [255, 255, 255];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // rounded-rect background for non-maskable; full-bleed for maskable
      const r = size * (maskable ? 0.0 : 0.22);
      const dx = Math.abs(x - cx) - (size / 2 - r);
      const dy = Math.abs(y - cy) - (size / 2 - r);
      const distX = Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2;
      const corner = Math.min(Math.max(Math.sqrt(distX) - r, 0), 1);
      const inside = dx <= 0 || dy <= 0 ? 1 : corner === 0 ? 1 : 1 - corner;
      const inShape = (dx <= 0 && dy <= 0) || Math.sqrt(distX) <= r;

      let px = [0, 0, 0, 0];
      if (maskable || inShape) {
        px = [...(maskable ? bg : bg), 255];
        // Slight gradient
        if (y > size * 0.6) px = [...bgDark, 255];
      }

      // "S" letter via simple bars (blocky S)
      const s = size / 64; // scale unit
      const inS =
        (y >= 14 * s && y <= 20 * s && x >= 16 * s && x <= 48 * s) ||
        (y >= 28 * s && y <= 34 * s && x >= 16 * s && x <= 48 * s) ||
        (y >= 42 * s && y <= 48 * s && x >= 16 * s && x <= 48 * s) ||
        (y >= 14 * s && y <= 34 * s && x >= 42 * s && x <= 48 * s) ||
        (y >= 28 * s && y <= 48 * s && x >= 16 * s && x <= 22 * s);

      if (inS && (maskable || inShape)) px = [...white, 255];

      rgba[idx] = px[0]; rgba[idx + 1] = px[1]; rgba[idx + 2] = px[2]; rgba[idx + 3] = px[3];
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.join(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const [size, maskable] of [[192, false], [512, false], [512, true]]) {
  const name = maskable ? "icon-512-maskable.png" : `icon-${size}.png`;
  fs.writeFileSync(path.join(outDir, name), makeIcon(size, maskable));
  console.log("wrote", name);
}
console.log("done");
