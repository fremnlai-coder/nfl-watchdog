// Generates the home-screen icons.
//
// Written by hand rather than pulled from a design tool for two reasons: the
// project has no image dependencies and should keep it that way, and the colours
// have to come from the same oklch values as the theme in web/src/styles.css. A
// PNG here is zlib plus four chunks, and zlib ships with Node.
//
//   node scripts/make-icons.js
//
// Output lands in web/public/icons/ and is committed; the build only copies it.

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

// --- colour -----------------------------------------------------------------

// oklch -> sRGB, so --color-field and --color-chalk stay a single source of
// truth between the stylesheet and the icon.
function oklch(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  });
}

const FIELD = oklch(0.28, 0.05, 155); // --color-field
const CHALK = oklch(0.97, 0.01, 95); // --color-chalk

// --- shape ------------------------------------------------------------------

// A football is a lens: two circular arcs meeting at points, not an ellipse —
// an ellipse rounds off exactly the tips that make the silhouette readable at
// 60 pixels. For half-width a and half-height b the arc through (±a, 0) and
// (0, b) has centre (0, c) and radius R below.
const A = 0.62; // stays inside the 80% safe zone a maskable icon may be cropped to
const B = 0.36;
const C_Y = (B * B - A * A) / (2 * B);
const R = (A * A + B * B) / (2 * B);
const TILT = (-22 * Math.PI) / 180;

// Colour of one sample point in [-1, 1] space, before supersampling.
function sample(px, py) {
  // Into the ball's own frame, so laces and seams are written along its axis.
  const x = px * Math.cos(-TILT) - py * Math.sin(-TILT);
  const y = px * Math.sin(-TILT) + py * Math.cos(-TILT);

  if (Math.abs(x) > A) return FIELD;
  const edge = C_Y + Math.sqrt(Math.max(0, R * R - x * x));
  if (Math.abs(y) > edge) return FIELD;

  // Seams: one short stroke inside each tip.
  if (Math.abs(Math.abs(x) - 0.40) < 0.016 && Math.abs(y) < 0.10) return FIELD;

  // Laces: a spine with five ticks across it.
  if (Math.abs(y) < 0.020 && Math.abs(x) < 0.26) return FIELD;
  for (let i = -2; i <= 2; i++) {
    if (Math.abs(x - i * 0.115) < 0.020 && Math.abs(y) < 0.075) return FIELD;
  }

  return CHALK;
}

// 4x supersampling: the tips and the laces are one pixel wide at 32px, and
// without it they alias away completely.
function render(size) {
  const S = 4;
  const rgb = Buffer.alloc(size * size * 3);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const nx = ((px + (sx + 0.5) / S) / size) * 2 - 1;
          const ny = ((py + (sy + 0.5) / S) / size) * 2 - 1;
          const c = sample(nx, ny);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = S * S;
      const o = (py * size + px) * 3;
      rgb[o] = Math.round(r / n);
      rgb[o + 1] = Math.round(g / n);
      rgb[o + 2] = Math.round(b / n);
    }
  }

  return rgb;
}

// --- PNG --------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Colour type 2 (truecolour, no alpha). Apple rejects an alpha channel on the
// touch icon, and a full-bleed square is what both platforms want to mask
// themselves.
function png(size, rgb) {
  const stride = size * 3;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- output -----------------------------------------------------------------

const OUT = new URL('../web/public/icons/', import.meta.url);

// 180 is the touch icon iOS asks for; 192 and 512 are the manifest sizes; 32 is
// the favicon.
const SIZES = [
  [180, 'apple-touch-icon.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [32, 'favicon-32.png'],
];

await mkdir(OUT, { recursive: true });
for (const [size, name] of SIZES) {
  await writeFile(new URL(name, OUT), png(size, render(size)));
  console.log(`${name}  ${size}x${size}`);
}
