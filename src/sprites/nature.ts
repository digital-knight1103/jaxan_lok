// Drzewa, krzaki, choinki – proceduralne, cache'owane po wariancie.
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { drawBlob, type Circle } from './blob';

const FOLIAGE = [PAL.foliageHi, PAL.foliage, PAL.foliage, PAL.foliageShade, PAL.foliageDeep] as const;
export const TREE_VARIANTS = 6;
export const BUSH_VARIANTS = 8;
export const PINE_VARIANTS = 4;

/** Drzewo liściaste (okrągła, bujna korona jak na styl.jpg). Spód sprite'a = ziemia. */
export function getTree(variant: number): HTMLCanvasElement {
  const v = variant % TREE_VARIANTS;
  return cached(`tree-${v}`, () => {
    const rnd = mulberry32(100 + v);
    const w = 22 + v * 4;
    const h = Math.round(w * 1.25);
    return makeSprite(w, h, (ctx) => {
      const trunkH = Math.round(h * 0.3);
      rect(ctx, (w >> 1) - 1, h - trunkH, 3, trunkH, PAL.trunk);
      rect(ctx, (w >> 1) + 1, h - trunkH, 1, trunkH, PAL.earthShade);
      const circles: Circle[] = [];
      const cy = (h - trunkH) * 0.55;
      const n = 5 + v;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = w * (0.18 + rnd() * 0.1);
        circles.push({
          x: w / 2 + Math.cos(a) * w * 0.22,
          y: cy + Math.sin(a) * h * 0.16,
          r,
        });
      }
      circles.push({ x: w / 2, y: cy, r: w * 0.3 });
      drawBlob(ctx, circles, FOLIAGE, rnd);
    });
  });
}

/** Krzak – niski kleks. */
export function getBush(variant: number): HTMLCanvasElement {
  const v = variant % BUSH_VARIANTS;
  return cached(`bush-${v}`, () => {
    const rnd = mulberry32(200 + v);
    const w = 10 + v * 4;
    const h = Math.round(w * 0.6);
    return makeSprite(w, h, (ctx) => {
      const circles: Circle[] = [];
      // koła mieszczą się w płótnie (inaczej krzak byłby przycięty do prostokąta)
      for (let i = 0; i < 3 + v; i++) {
        const r = h * (0.32 + rnd() * 0.18);
        circles.push({ x: r + rnd() * (w - 2 * r), y: h - r - rnd() * (h - 2 * r) * 0.5, r });
      }
      circles.push({ x: w / 2, y: h * 0.55, r: h * 0.45 });
      drawBlob(ctx, circles, [PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep], rnd, 0, 0, undefined, 0.4);
    });
  });
}

/** Świerk – trójkątne piętra. */
export function getPine(variant: number): HTMLCanvasElement {
  const v = variant % PINE_VARIANTS;
  return cached(`pine-${v}`, () => {
    const rnd = mulberry32(300 + v);
    const h = 30 + v * 8;
    const w = Math.round(h * 0.45) | 1;
    return makeSprite(w, h, (ctx) => {
      rect(ctx, (w >> 1) - 1, h - 5, 2, 5, PAL.trunk);
      const tiers = 4 + (v >> 1);
      for (let t = 0; t < tiers; t++) {
        const top = Math.round(((h - 5) * t) / (tiers + 1));
        const bottom = Math.round(((h - 5) * (t + 2)) / (tiers + 1));
        for (let y = top; y < bottom; y++) {
          const half = Math.round(((y - top) / (bottom - top)) * (w / 2) * (0.55 + 0.45 * ((t + 1) / tiers)));
          for (let x = (w >> 1) - half; x <= (w >> 1) + half; x++) {
            const left = x < w >> 1;
            const c = left && rnd() > 0.3 ? PAL.pineHi : rnd() > 0.85 ? PAL.foliageDeep : PAL.pine;
            rect(ctx, x, y, 1, 1, c);
          }
        }
      }
    });
  });
}
