// Generates public/icons/{icon.svg, icon-192.png, icon-512.png, icon-512-maskable.png}
// from the pixel campfire under a night sky on an ink square. Run: npm run icons
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const INK = '#3a1219';
const RED = '#b8323b';
const PAPER = '#ebe3d4';
const MID = '#8a4a52';
const WALNUT = '#6b3f2a';

// r flame, p flame core, w logs, m stars and moon.
const PALETTE = { r: RED, p: PAPER, w: WALNUT, m: MID };
const ART = [
  '.m.........mm.',
  '..........m...',
  '......r...m...',
  '......rr...mm.',
  '.....rrr......',
  '.....rrrr..m..',
  '...r.rrprr....',
  '...rrrrpprr...',
  '..rrrrpppprr..',
  '..rrrppppprr..',
  '..rrpppppppr..',
  '...rrpppppr...',
  '....rrrrrr....',
  'ww..........ww',
  '.wwww....wwww.',
  '....wwwwww....',
  '.wwww....wwww.',
  'ww..........ww',
];

function svg({ size, pad, maskable }) {
  const w = ART[0].length;
  const h = ART.length;
  const grid = Math.max(w, h) + 2; // one cell of breathing room each side
  const cell = (size - pad * 2) / grid;
  const ox = (grid - w) / 2;
  const oy = (grid - h) / 2;
  const rects = [];
  ART.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const fill = PALETTE[ch];
      if (fill) rects.push(`<rect x="${pad + (c + ox) * cell}" y="${pad + (r + oy) * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`);
    }),
  );
  const bg = maskable ? `<rect width="${size}" height="${size}" fill="${INK}"/>` : `<rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${INK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${bg}${rects.join('')}</svg>`;
}

await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/icon.svg', svg({ size: 512, pad: 64, maskable: false }));
await sharp(Buffer.from(svg({ size: 512, pad: 64, maskable: false }))).png().toFile('public/icons/icon-512.png');
await sharp(Buffer.from(svg({ size: 192, pad: 24, maskable: false }))).png().toFile('public/icons/icon-192.png');
// Maskable: full-bleed background, artwork inside the 80% safe zone.
await sharp(Buffer.from(svg({ size: 512, pad: 96, maskable: true }))).png().toFile('public/icons/icon-512-maskable.png');
console.log('icons written to public/icons');

// iOS app icon (1024, full bleed, no transparency) and splash (2732, ink with the sun centred).
import { existsSync } from 'node:fs';
if (existsSync('ios/App/App/Assets.xcassets')) {
  await sharp(Buffer.from(svg({ size: 1024, pad: 150, maskable: true }))).flatten({ background: INK }).png().toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  const splash = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732"><rect width="2732" height="2732" fill="${INK}"/></svg>`,
  );
  const sun = await sharp(Buffer.from(svg({ size: 420, pad: 0, maskable: true }))).png().toBuffer();
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await sharp(splash).composite([{ input: sun, gravity: 'center' }]).png().toFile(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`);
  }
  console.log('iOS icon and splash written');
}
