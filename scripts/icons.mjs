// Generates public/icons/{icon.svg, icon-192.png, icon-512.png, icon-512-maskable.png, chronicle.ico}
// from the campfire logo in src/ui/sprites.ts on an ink square. Run: npm run icons
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { CAMPFIRE_LOGO_MAP as ART, CAMPFIRE_LOGO_PALETTE as PALETTE, PAPER as COLORS } from '../src/ui/sprites.ts';

const INK = COLORS.ink;

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

// Windows .ico for the desktop shortcut. By convention the 256 px image is PNG and the smaller ones are
// 32-bit bitmaps (BGRA, bottom-up, followed by an all-clear AND mask): every Windows reader takes that.
async function icoImage(size) {
  const svgBuf = Buffer.from(svg({ size, pad: Math.round(size * 0.04), maskable: false }));
  if (size >= 256) return sharp(svgBuf).png().toBuffer();
  const rgba = await sharp(svgBuf).ensureAlpha().raw().toBuffer();
  const maskRow = Math.ceil(size / 32) * 4;
  const dib = Buffer.alloc(40 + size * size * 4 + maskRow * size);
  dib.writeUInt32LE(40, 0); // header size
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8); // image + mask
  dib.writeUInt16LE(1, 12); // planes
  dib.writeUInt16LE(32, 14); // bits per pixel
  dib.writeUInt32LE(size * size * 4 + maskRow * size, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4;
      const to = 40 + ((size - 1 - y) * size + x) * 4;
      dib[to] = rgba[from + 2];
      dib[to + 1] = rgba[from + 1];
      dib[to + 2] = rgba[from];
      dib[to + 3] = rgba[from + 3];
    }
  }
  return dib;
}
const sizes = [16, 24, 32, 48, 64, 256];
const images = await Promise.all(sizes.map(icoImage));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(size >= 256 ? 0 : size, at); // 0 means 256
  header.writeUInt8(size >= 256 ? 0 : size, at + 1);
  header.writeUInt16LE(1, at + 4); // colour planes
  header.writeUInt16LE(32, at + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
await writeFile('public/icons/chronicle.ico', Buffer.concat([header, ...images]));
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
