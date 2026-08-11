// Draws the launcher, adaptive, splash and favicon marks and writes them to
// assets/. Committed rather than the images alone: a mark that only exists as
// a PNG cannot be recoloured when global.css changes, and this project's whole
// styling rule is that a restyle stays a one-file diff.
//
// Everything is written by hand because the toolchain has no rasteriser. There
// is no sharp, no ImageMagick and no PIL on a clean checkout, and @expo/image-
// utils bundles jimp-compact, which cannot draw a shape. A PNG encoder plus a
// supersampled implicit-curve fill is about eighty lines and needs nothing.
//
// Usage: node scripts/generate-icons.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets');

// The brand values from global.css, and the only colours here. Keep them in
// step with --brand and --bg in both themes: this file cannot read the
// stylesheet, because a launcher icon is painted long before anything has
// parsed one.
const CLARET = [166, 58, 76];
const PAPER = [252, 250, 247];

// The dark theme's --brand, not the light one dimmed. Claret on ink is around
// 2:1, which is why global.css lightens the brand for dark mode rather than
// reusing it, and the splash mark has to follow the same rule.
const CLARET_DARK = [224, 132, 142];

// The heart is the classic implicit curve, which gives a shape with no
// straight segments and no control points to tune:
//   (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
// Solid, single weight, no gradient. The brand is warm and editorial, and a
// glossy mark would read as exactly the gamified look the product avoids.
function insideHeart(x, y) {
  const a = x * x + y * y - 1;

  return a * a * a - x * x * y * y * y <= 0;
}

// Measured rather than asserted, so the mark is centred and scaled from the
// curve's real extent instead of from a guess about it.
function heartBounds() {
  const steps = 2000;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const x = -2 + (4 * i) / steps;
      const y = -2 + (4 * j) / steps;

      if (insideHeart(x, y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return { minX, maxX, minY, maxY };
}

const BOUNDS = heartBounds();

const SAMPLES = 4;

// coverage is the fraction of an oversampled pixel falling inside the curve,
// which is what gives the edge its antialiasing. Nothing else here is smooth.
function coverage(px, py, size, scale) {
  const width = BOUNDS.maxX - BOUNDS.minX;
  const height = BOUNDS.maxY - BOUNDS.minY;
  const span = Math.max(width, height) / scale;
  const centreX = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const centreY = (BOUNDS.minY + BOUNDS.maxY) / 2;

  let hits = 0;

  for (let sy = 0; sy < SAMPLES; sy += 1) {
    for (let sx = 0; sx < SAMPLES; sx += 1) {
      const u = (px + (sx + 0.5) / SAMPLES) / size;
      const v = (py + (sy + 0.5) / SAMPLES) / size;

      // v is flipped because image rows run downwards and the curve does not.
      const x = centreX + (u - 0.5) * span;
      const y = centreY - (v - 0.5) * span;

      if (insideHeart(x, y)) {
        hits += 1;
      }
    }
  }

  return hits / (SAMPLES * SAMPLES);
}

function render(size, scale, background, foreground) {
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const alpha = coverage(px, py, size, scale);
      const offset = (py * size + px) * 4;

      if (background) {
        for (let channel = 0; channel < 3; channel += 1) {
          const under = background[channel];
          pixels[offset + channel] = Math.round(under + (foreground[channel] - under) * alpha);
        }

        pixels[offset + 3] = 255;
        continue;
      }

      pixels[offset] = foreground[0];
      pixels[offset + 1] = foreground[1];
      pixels[offset + 2] = foreground[2];
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);

  const tagged = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tagged));

  return Buffer.concat([length, tagged, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  // 8 bits per channel, colour type 6 (RGBA), no interlacing.
  header[8] = 8;
  header[9] = 6;

  // Filter byte 0 on every scanline. The shapes are smooth and deflate handles
  // them well enough that choosing a filter per row is not worth the code.
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let row = 0; row < size; row += 1) {
    pixels.copy(raw, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// scale is the fraction of the canvas the mark occupies. The adaptive
// foreground is the tight one: Android crops a 108dp layer to a 72dp mask, so
// anything outside the middle two thirds can be cut off on some launchers.
const TARGETS = [
  { file: 'icon.png', size: 1024, scale: 0.62, background: PAPER, foreground: CLARET },
  { file: 'adaptive-icon.png', size: 1024, scale: 0.44, background: null, foreground: CLARET },
  { file: 'splash-icon.png', size: 1024, scale: 0.5, background: null, foreground: CLARET },
  {
    file: 'splash-icon-dark.png',
    size: 1024,
    scale: 0.5,
    background: null,
    foreground: CLARET_DARK,
  },
  { file: 'favicon.png', size: 256, scale: 0.78, background: PAPER, foreground: CLARET },
];

mkdirSync(OUT, { recursive: true });

for (const target of TARGETS) {
  const pixels = render(target.size, target.scale, target.background, target.foreground);
  const png = encodePng(target.size, pixels);

  writeFileSync(path.join(OUT, target.file), png);
  process.stdout.write(`${target.file} ${target.size}x${target.size} ${png.length} bytes\n`);
}
