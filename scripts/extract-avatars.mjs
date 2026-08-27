// Extract pixel-art manager avatars from the generated frame sheet.
// Green-screen background is scanned to find the sprite bounding box,
// then the sprite is composite-scanned per strip.
import sharp from "../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";
import { mkdir } from "node:fs/promises";

const SRC = "docs/error renders/Gemini_Generated_Image_evm0ahevm0ahevm0.jpeg";
const OUT = "public/avatars";

// Strip geometry: the sheet is 1408x768 → 4 columns x 2 rows of 704x384
// tiles; each tile holds 3 sprite frames evenly spaced across the width.
const TILE = { w: 704, h: 384 };
const STRIPS = 3;

// (persona, tile top-left)
const TILES = [
  ["oleg", 0, 0],
  ["mei", 704, 0],
  ["kofi", 0, 384],
  ["ana", 704, 384],
];

const GREEN = { t: 35, minG: 65, maxSpread: 55 };

function isGreen(r, g, b) {
  return g > GREEN.minG && g - r > GREEN.t * 0.6 && g - b > GREEN.t && g - r < GREEN.maxSpread * 3 && g - b < GREEN.maxSpread * 3;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { data, info } = await sharp(SRC).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const px = (x, y) => {
    const i = (y * W + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const written = [];
  for (const [id, tx, ty] of TILES) {
    const stripW = Math.floor(TILE.w / STRIPS);
    for (let s = 0; s < STRIPS; s++) {
      const sx = tx + s * stripW, ex = tx + (s + 1) * stripW;
      let minX = ex, maxX = sx, minY = ty + TILE.h, maxY = ty;
      for (let y = ty; y < ty + TILE.h; y += 1) {
        for (let x = sx; x < ex; x += 1) {
          const [r, g, b] = px(x, y);
          if (!isGreen(r, g, b)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (minX > maxX) continue;
      // Uniform canvas: pad onto 256x320 anchored bottom-centre so every
      // persona renders the same width/height in tiles and lineup rows.
      const pad = 4;
      const left = Math.max(tx, minX - pad), top = Math.max(ty, Math.max(0, minY - pad));
      const width = Math.min(ex, maxX + pad) - left, height = Math.min(ty + TILE.h, maxY + pad) - top;
      const name = s === 0 ? `${id}-idle.png` : `${id}-talk${s}.png`;
      const canvas = 256, canvasH = 320;
      const sprite = await sharp(SRC).extract({ left, top, width, height })
        .resize({ width: canvas, height: canvasH, fit: "inside", kernel: "nearest" })
        .png().toBuffer();
      const meta = await sharp(sprite).metadata();
      const buf = await sharp({ create: {
        width: canvas, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 },
      } })
        .composite([{ input: sprite, left: Math.max(0, Math.round((canvas - meta.width) / 2)), top: canvasH - meta.height }])
        .png().toBuffer();
      written.push([name, buf]);
    }
  }
  const fs = await import("node:fs");
  for (const [name, buf] of written) {
    fs.writeFileSync(`${OUT}/${name}`, buf);
    console.log("wrote", name, buf.length);
  }
}
main();
