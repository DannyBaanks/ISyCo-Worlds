import { Texture } from 'pixi.js';

/**
 * Village objects painted in code. Each painter draws whole pixels on a small
 * canvas whose bottom edge is the object's ground line; the scene stands it on
 * the bottom of its footprint. The two house variants are recoloured from the
 * village-home raster so they match the authored buildings.
 */

type Ctx = CanvasRenderingContext2D;
type Painter = { width: number; height: number; paint: (ctx: Ctx) => void };

const OUT = '#3a2a1a';
const WOOD_D = '#5a3a1e';
const WOOD = '#8a5a2c';
const WOOD_L = '#b98545';
const STONE_D = '#5f636b';
const STONE = '#8d9096';
const STONE_L = '#c9ccd0';
const CREAM = '#fff2d8';
const RED = '#c8442e';

function r(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Filled block with a one-pixel dark outline. */
function box(ctx: Ctx, color: string, x: number, y: number, w: number, h: number, outline = OUT): void {
  r(ctx, outline, x - 1, y - 1, w + 2, h + 2);
  r(ctx, color, x, y, w, h);
}

const PAINTERS: Readonly<Record<string, Painter>> = {
  'notice-board': {
    width: 32, height: 28,
    paint(ctx) {
      box(ctx, WOOD, 5, 10, 2, 17); box(ctx, WOOD, 25, 10, 2, 17);
      box(ctx, WOOD_L, 3, 8, 26, 13);
      r(ctx, WOOD, 3, 12, 26, 1); r(ctx, WOOD, 3, 16, 26, 1); r(ctx, '#d7a45e', 3, 8, 26, 1);
      box(ctx, '#a04a32', 2, 4, 28, 3); r(ctx, '#c8623e', 2, 4, 28, 1);
      box(ctx, '#a04a32', 6, 2, 20, 1);
    }
  },
  mailbox: {
    width: 16, height: 22,
    paint(ctx) {
      box(ctx, WOOD, 7, 13, 2, 8);
      box(ctx, RED, 3, 5, 10, 8); r(ctx, '#e8664c', 3, 5, 10, 2); r(ctx, '#9a2f20', 3, 11, 10, 2);
      r(ctx, OUT, 5, 8, 6, 1); r(ctx, CREAM, 6, 9, 4, 1);
      box(ctx, '#ffd84a', 13, 3, 2, 2); r(ctx, OUT, 13, 5, 1, 4);
    }
  },
  well: {
    width: 32, height: 42,
    paint(ctx) {
      // Stone ring.
      box(ctx, STONE, 4, 25, 24, 14, '#3f434b');
      r(ctx, STONE_L, 4, 25, 24, 2); r(ctx, STONE_D, 4, 35, 24, 4);
      for (let x = 4; x < 28; x += 6) { r(ctx, STONE_D, x + 2, 29, 1, 3); r(ctx, STONE_D, x + 5, 32, 1, 3); }
      r(ctx, STONE_D, 4, 31, 24, 1);
      r(ctx, '#3f434b', 6, 22, 20, 4); r(ctx, '#2f6fb8', 7, 23, 18, 3); r(ctx, '#7fb6e8', 9, 24, 5, 1);
      // Frame and roof.
      box(ctx, WOOD, 5, 9, 2, 16); box(ctx, WOOD, 25, 9, 2, 16);
      box(ctx, WOOD_D, 8, 12, 16, 2);
      r(ctx, '#d9c9a0', 15, 14, 1, 6); box(ctx, WOOD_L, 13, 19, 5, 4); r(ctx, STONE_D, 13, 20, 5, 1);
      box(ctx, '#a04a32', 2, 4, 28, 5); r(ctx, '#c8623e', 2, 4, 28, 2); r(ctx, '#7a3424', 2, 8, 28, 1);
      box(ctx, '#a04a32', 6, 1, 20, 2); r(ctx, '#d87a52', 6, 1, 20, 1);
    }
  },
  campfire: {
    width: 16, height: 16,
    paint(ctx) {
      for (const [x, y] of [[2, 10], [5, 12], [9, 12], [12, 10], [3, 7], [11, 7]] as const) {
        box(ctx, STONE, x, y, 2, 2, '#3f434b'); r(ctx, STONE_L, x, y, 1, 1);
      }
      box(ctx, WOOD, 4, 9, 8, 2); box(ctx, WOOD_D, 7, 7, 2, 5);
      r(ctx, '#2a1a10', 6, 9, 4, 2);
    }
  },
  bench: {
    width: 32, height: 16,
    paint(ctx) {
      box(ctx, WOOD_D, 5, 9, 2, 6); box(ctx, WOOD_D, 25, 9, 2, 6);
      box(ctx, WOOD, 3, 3, 26, 3); r(ctx, WOOD_L, 3, 3, 26, 1);
      box(ctx, WOOD_L, 2, 8, 28, 3); r(ctx, '#d7a45e', 2, 8, 28, 1); r(ctx, WOOD, 2, 10, 28, 1);
    }
  },
  barrel: {
    width: 16, height: 18,
    paint(ctx) {
      box(ctx, WOOD, 4, 3, 8, 13); r(ctx, WOOD_L, 5, 3, 2, 13); r(ctx, WOOD_D, 10, 3, 2, 13);
      r(ctx, OUT, 3, 6, 10, 6); r(ctx, WOOD, 3, 6, 10, 6); r(ctx, WOOD_L, 4, 6, 2, 6); r(ctx, WOOD_D, 10, 6, 3, 6);
      r(ctx, OUT, 2, 6, 1, 6); r(ctx, OUT, 13, 6, 1, 6);
      r(ctx, STONE_D, 3, 5, 10, 1); r(ctx, STONE_D, 3, 12, 10, 1); r(ctx, STONE_L, 4, 5, 3, 1);
      r(ctx, '#6a4424', 5, 3, 6, 1);
    }
  },
  'hay-bale': {
    width: 16, height: 16,
    paint(ctx) {
      box(ctx, '#d9b04a', 2, 5, 12, 10, '#6a4a14');
      r(ctx, '#f0d070', 2, 5, 12, 2); r(ctx, '#b98a2c', 2, 12, 12, 3);
      for (let x = 3; x < 14; x += 3) r(ctx, '#b98a2c', x, 8, 1, 3);
      r(ctx, '#8a5a2c', 5, 5, 1, 10); r(ctx, '#8a5a2c', 10, 5, 1, 10);
    }
  },
  anvil: {
    width: 16, height: 16,
    paint(ctx) {
      box(ctx, WOOD, 5, 10, 6, 5); r(ctx, WOOD_L, 5, 10, 6, 1);
      box(ctx, STONE_D, 6, 7, 4, 3, '#2b2d33');
      box(ctx, STONE_D, 3, 4, 10, 3, '#2b2d33'); r(ctx, STONE_L, 3, 4, 10, 1);
      r(ctx, '#2b2d33', 0, 4, 3, 3); r(ctx, STONE, 1, 5, 2, 1);
    }
  },
  'log-pile': {
    width: 16, height: 16,
    paint(ctx) {
      for (const [x, y] of [[1, 10], [8, 10], [4, 5]] as const) {
        box(ctx, WOOD, x, y, 7, 5); r(ctx, WOOD_L, x, y, 7, 1);
        r(ctx, '#e0b878', x + 1, y + 1, 3, 3); r(ctx, WOOD, x + 2, y + 2, 1, 1);
      }
    }
  },
  'training-dummy': {
    width: 16, height: 26,
    paint(ctx) {
      box(ctx, WOOD, 7, 14, 2, 11);
      box(ctx, WOOD, 1, 10, 14, 2);
      box(ctx, '#d9b04a', 4, 8, 8, 9, '#6a4a14'); r(ctx, '#f0d070', 4, 8, 8, 2); r(ctx, '#b98a2c', 4, 15, 8, 2);
      r(ctx, CREAM, 6, 10, 4, 4); r(ctx, RED, 7, 11, 2, 2);
      box(ctx, '#e8cf8a', 5, 2, 6, 5, '#6a4a14'); r(ctx, OUT, 6, 4, 1, 1); r(ctx, OUT, 9, 4, 1, 1); r(ctx, '#8a5a2c', 5, 7, 6, 1);
    }
  },
  'market-stall': {
    width: 48, height: 46,
    paint(ctx) {
      box(ctx, WOOD, 3, 16, 2, 28); box(ctx, WOOD, 43, 16, 2, 28);
      // Counter with goods.
      box(ctx, WOOD_L, 2, 30, 44, 4); r(ctx, '#d7a45e', 2, 30, 44, 1);
      box(ctx, WOOD, 3, 35, 42, 9);
      for (let x = 8; x < 45; x += 7) r(ctx, WOOD_D, x, 35, 1, 9);
      for (const [x, color] of [[6, RED], [9, '#e8664c'], [12, RED], [18, '#e0a458'], [22, '#e0a458'], [34, '#7adfc3'], [38, '#b9a2ff']] as const) {
        box(ctx, color, x, 27, 2, 2); r(ctx, CREAM, x, 27, 1, 1);
      }
      box(ctx, '#d9b04a', 26, 26, 5, 3); r(ctx, '#f0d070', 26, 26, 5, 1);
      // Striped awning.
      r(ctx, OUT, 0, 3, 48, 15);
      for (let x = 0; x < 48; x += 6) {
        const light = (x / 6) % 2 === 1;
        r(ctx, light ? CREAM : '#e0503c', x + (x === 0 ? 1 : 0), 4, x === 42 ? 5 : 6 - (x === 0 ? 1 : 0), 11);
        r(ctx, light ? '#d8c8a8' : '#a83424', x + (x === 0 ? 1 : 0), 13, x === 42 ? 5 : 6 - (x === 0 ? 1 : 0), 2);
        r(ctx, light ? CREAM : '#e0503c', x + 1, 15, 4, 2);
      }
      r(ctx, 'rgba(255,255,255,0.25)', 1, 4, 46, 2);
      r(ctx, 'rgba(18,38,26,0.25)', 3, 19, 42, 2);
    }
  },
  portal: {
    width: 32, height: 44,
    paint(ctx) {
      box(ctx, STONE_D, 1, 39, 30, 4, '#2b2d33'); r(ctx, STONE, 1, 39, 30, 1);
      // Swirl inside the arch.
      r(ctx, '#2a1a5c', 8, 9, 16, 30);
      for (let y = 10; y < 39; y += 1) {
        const wave = Math.round(Math.sin(y / 2.4) * 3);
        r(ctx, '#5a3ac8', 10 + wave, y, 9, 1);
        if (y % 3 === 0) r(ctx, '#9a7cff', 12 + wave, y, 5, 1);
        if (y % 7 === 0) r(ctx, '#e6dcff', 14 - wave, y, 2, 1);
      }
      // Pillars and arch.
      for (const x of [3, 23]) {
        box(ctx, STONE, x, 12, 6, 27, '#2b2d33'); r(ctx, STONE_L, x, 12, 2, 27); r(ctx, STONE_D, x + 4, 12, 2, 27);
        for (let y = 17; y < 38; y += 6) r(ctx, STONE_D, x, y, 6, 1);
        r(ctx, '#9fe0ff', x + 2, 20, 2, 2); r(ctx, '#9fe0ff', x + 2, 30, 2, 2);
      }
      box(ctx, STONE, 3, 6, 26, 6, '#2b2d33'); r(ctx, STONE_L, 3, 6, 26, 2); r(ctx, STONE_D, 3, 11, 26, 1);
      box(ctx, STONE, 7, 3, 18, 3, '#2b2d33'); r(ctx, STONE_L, 7, 3, 18, 1);
      box(ctx, '#b9a2ff', 14, 5, 4, 4, '#2b2d33'); r(ctx, '#e6dcff', 14, 5, 2, 2);
    }
  },
  observatory: {
    width: 48, height: 84,
    paint(ctx) {
      // Tower.
      box(ctx, STONE, 12, 36, 24, 44, '#3f434b');
      r(ctx, STONE_L, 12, 36, 5, 44); r(ctx, STONE_D, 30, 36, 6, 44);
      for (let y = 40; y < 80; y += 5) {
        r(ctx, 'rgba(63,67,75,0.55)', 12, y, 24, 1);
        for (let x = 14 + ((y / 5) % 2) * 4; x < 36; x += 8) r(ctx, 'rgba(63,67,75,0.55)', x, y + 1, 1, 4);
      }
      box(ctx, STONE_D, 10, 77, 28, 6, '#3f434b'); r(ctx, STONE, 10, 77, 28, 2);
      // Door and windows.
      box(ctx, WOOD, 20, 66, 8, 14); r(ctx, WOOD_L, 20, 66, 3, 14); r(ctx, OUT, 23, 66, 1, 14); r(ctx, '#ffd84a', 25, 73, 1, 2);
      r(ctx, OUT, 21, 64, 6, 1);
      for (const y of [44, 55]) { box(ctx, '#ffd84a', 21, y, 6, 6); r(ctx, '#fff6c8', 21, y, 3, 3); r(ctx, OUT, 24, y, 1, 6); }
      // Brass ring and dome.
      box(ctx, '#c89a3c', 9, 33, 30, 3, '#5a3a1e'); r(ctx, '#f0d070', 9, 33, 30, 1);
      const dome: readonly (readonly [number, number])[] = [[18, 12], [15, 18], [13, 22], [12, 24], [11, 26], [10, 28], [10, 28], [9, 30], [9, 30], [9, 30]];
      dome.forEach(([x, w], index) => {
        const y = 13 + index * 2;
        r(ctx, '#1f3a5c', x - 1, y - (index === 0 ? 1 : 0), w + 2, 2 + (index === 0 ? 1 : 0));
        r(ctx, '#3f6fa8', x, y, w, 2);
        r(ctx, '#6fa0d8', x + 1, y, Math.max(2, Math.floor(w / 4)), 2);
        r(ctx, '#2c5484', x + w - Math.max(2, Math.floor(w / 5)), y, Math.max(2, Math.floor(w / 5)), 2);
      });
      r(ctx, '#12233a', 22, 13, 5, 20);
      // Telescope leaning out of the slit.
      for (let step = 0; step < 7; step += 1) {
        box(ctx, '#c89a3c', 24 + step * 2, 20 - step * 2, 4, 4, '#5a3a1e');
        r(ctx, '#f0d070', 24 + step * 2, 20 - step * 2, 4, 1);
      }
      box(ctx, '#9fe0ff', 39, 5, 4, 4, '#5a3a1e'); r(ctx, '#e6f6ff', 39, 5, 2, 2);
    }
  }
};

/** House variants: the village-home raster with its roof re-dyed and a trade sign by the door. */
const HOUSE_VARIANTS: Readonly<Record<string, { hue: number; saturation: number; sign: (ctx: Ctx, x: number, y: number) => void }>> = {
  library: {
    hue: 265, saturation: 0.62,
    sign(ctx, x, y) {
      r(ctx, '#3b5fc0', x + 1, y + 2, 8, 6); r(ctx, CREAM, x + 2, y + 2, 6, 5); r(ctx, OUT, x + 5, y + 2, 1, 5);
      r(ctx, '#b0a080', x + 3, y + 4, 1, 1); r(ctx, '#b0a080', x + 7, y + 4, 1, 1);
    }
  },
  workshop: {
    hue: 165, saturation: 0.5,
    sign(ctx, x, y) {
      r(ctx, WOOD_L, x + 5, y + 3, 1, 6); r(ctx, STONE_D, x + 2, y + 1, 7, 3); r(ctx, STONE_L, x + 2, y + 1, 7, 1);
    }
  }
};

const HOME_FRAME = { x: 232, y: 8, width: 64, height: 64 } as const;

function rgbToHsv(red: number, green: number, blue: number): [number, number, number] {
  const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue, max === 0 ? 0 : delta / max, max / 255];
}

function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
  const chroma = value * saturation; const section = hue / 60; const x = chroma * (1 - Math.abs((section % 2) - 1)); const m = value - chroma;
  const [red, green, blue] = section < 1 ? [chroma, x, 0] : section < 2 ? [x, chroma, 0] : section < 3 ? [0, chroma, x]
    : section < 4 ? [0, x, chroma] : section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  return [Math.round((red + m) * 255), Math.round((green + m) * 255), Math.round((blue + m) * 255)];
}

function paintHouseVariant(id: string, atlasImage: CanvasImageSource): HTMLCanvasElement {
  const variant = HOUSE_VARIANTS[id];
  const canvas = document.createElement('canvas');
  canvas.width = HOME_FRAME.width; canvas.height = HOME_FRAME.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlasImage, HOME_FRAME.x, HOME_FRAME.y, HOME_FRAME.width, HOME_FRAME.height, 0, 0, HOME_FRAME.width, HOME_FRAME.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue;
    const y = Math.floor(index / 4 / canvas.width);
    const [hue, saturation, value] = rgbToHsv(data[index], data[index + 1], data[index + 2]);
    // Terracotta tiles only: warm reds in the upper part of the sprite, not the lit windows or the door.
    if (y > 40 || saturation < 0.45 || !(hue < 27 || hue > 340)) continue;
    const [red, green, blue] = hsvToRgb(variant.hue, Math.min(1, saturation * variant.saturation / 0.62), value * 0.95);
    data[index] = red; data[index + 1] = green; data[index + 2] = blue;
  }
  ctx.putImageData(image, 0, 0);
  // Hanging trade sign left of the door.
  box(ctx, WOOD_L, 5, 38, 11, 10); r(ctx, '#d7a45e', 5, 38, 11, 1); r(ctx, OUT, 10, 34, 1, 3);
  variant.sign(ctx, 5, 38);
  return canvas;
}

export interface ProceduralObjectTexture { texture: Texture; width: number; height: number; }

const CACHE = new Map<string, ProceduralObjectTexture>();

export function isProceduralObject(assetId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PAINTERS, assetId) || Object.prototype.hasOwnProperty.call(HOUSE_VARIANTS, assetId);
}

/** Returns the painted texture for a code-drawn object, or null when the asset comes from an atlas. */
export function proceduralObjectTexture(assetId: string, buildingsAtlas: Texture): ProceduralObjectTexture | null {
  if (!isProceduralObject(assetId)) return null;
  const cached = CACHE.get(assetId);
  if (cached && !cached.texture.destroyed) return cached;
  let canvas: HTMLCanvasElement;
  if (Object.prototype.hasOwnProperty.call(HOUSE_VARIANTS, assetId)) {
    canvas = paintHouseVariant(assetId, buildingsAtlas.source.resource as CanvasImageSource);
  } else {
    const painter = PAINTERS[assetId];
    canvas = document.createElement('canvas');
    canvas.width = painter.width; canvas.height = painter.height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    painter.paint(ctx);
  }
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  const entry = { texture, width: canvas.width, height: canvas.height };
  CACHE.set(assetId, entry);
  return entry;
}
