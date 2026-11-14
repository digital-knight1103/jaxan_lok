// Drzewa, krzaki, choinki – proceduralne, cache'owane po wariancie.
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { drawFoliage } from './blob';

const FOLIAGE = [PAL.foliageGlint, PAL.foliageHi, PAL.foliageMid, PAL.foliage, PAL.foliageShade, PAL.foliageDeep] as const;
const GRASS = [PAL.grassGlint, PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep] as const;
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
      const trunkH = Math.round(h * 0.34);
      const tx = w >> 1;
      rect(ctx, tx - 1, h - trunkH, 3, trunkH, PAL.trunk);
      rect(ctx, tx + 1, h - trunkH, 1, trunkH, PAL.earthShade);
      rect(ctx, tx - 1, h - trunkH, 1, trunkH, PAL.sleeperHi); // światło na pniu
      // konary rozchodzące się pod koroną
      rect(ctx, tx - 3, h - trunkH - 1, 2, 1, PAL.trunk);
      rect(ctx, tx + 2, h - trunkH - 2, 2, 1, PAL.trunk);
      // korona z 2–3 nakładających się kęp listowia – nieregularna sylwetka
      const cy = (h - trunkH) * 0.55;
      const rx = w * 0.46;
      const ry = (h - trunkH) * 0.5;
      drawFoliage(ctx, w * 0.36, cy + ry * 0.15, rx * 0.62, ry * 0.7, FOLIAGE, rnd, [2, 4]);
      drawFoliage(ctx, w * 0.64, cy + ry * 0.2, rx * 0.58, ry * 0.66, FOLIAGE, rnd, [2, 4]);
      drawFoliage(ctx, w * 0.5, cy - ry * 0.18, rx * 0.66, ry * 0.72, FOLIAGE, rnd, [2, 4 + (v >> 1)]);
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
      // krzak z kępek liści; mieści się w płótnie (bez przycinania do prostokąta)
      drawFoliage(ctx, w / 2, h * 0.58, w / 2 - 1, h * 0.46, GRASS, rnd, [1.5, 2.5 + v * 0.3], 2.4);
      // kilka źdźbeł wystających u podstawy
      for (let i = 0; i < 3 + v; i++) {
        const x = 1 + Math.floor(rnd() * (w - 2));
        ctx.fillStyle = rnd() < 0.5 ? PAL.grassGlint : PAL.grassHi;
        ctx.fillRect(x, h - 3 - Math.floor(rnd() * 2), 1, 2);
      }
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
            let c: string = left && rnd() > 0.3 ? PAL.pineHi : rnd() > 0.85 ? PAL.foliageDeep : PAL.pine;
            // rim light na lewym brzegu piętra, chłodny cień pod piętrem i na prawym brzegu
            if (x === (w >> 1) - half && half > 0) c = PAL.foliageHi;
            else if (x === (w >> 1) + half && half > 0) c = PAL.foliageDeep;
            else if (y === bottom - 1) c = PAL.foliageDeep;
            rect(ctx, x, y, 1, 1, c);
          }
        }
      }
    });
  });
}
