// Drzewa, krzaki, choinki – proceduralne, cache'owane po wariancie.
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { rgba as rgbaPx } from '../engine/pixbuf';
import { mulberry32 } from '../engine/rng';
import { drawFoliage } from './blob';
import { line } from '../engine/sprite';
import { look } from '../scene/season';

const AUTUMN = [
  [PAL.autumnGoldGlint, PAL.autumnGoldHi, PAL.autumnGoldMid, PAL.autumnGold, PAL.autumnGoldShade, PAL.autumnGoldDeep],
  [PAL.autumnOrangeGlint, PAL.autumnOrangeHi, PAL.autumnOrangeMid, PAL.autumnOrange, PAL.autumnOrangeShade, PAL.autumnOrangeDeep],
  [PAL.autumnRedGlint, PAL.autumnRedHi, PAL.autumnRedMid, PAL.autumnRed, PAL.autumnRedShade, PAL.autumnRedDeep],
] as const;

const FOLIAGE = [PAL.foliageGlint, PAL.foliageHi, PAL.foliageMid, PAL.foliage, PAL.foliageShade, PAL.foliageDeep] as const;
const GRASS = [PAL.grassGlint, PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep] as const;
export const TREE_VARIANTS = 6;
export const BUSH_VARIANTS = 8;
export const PINE_VARIANTS = 4;

/** Drzewo liściaste (okrągła, bujna korona jak na styl.jpg). Spód sprite'a = ziemia. */
export function getTree(variant: number): HTMLCanvasElement {
  const v = variant % TREE_VARIANTS;
  const season = look.season;
  return cached(`tree-${season}-${v}`, () => {
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
      if (season === 'winter') {
        bareCrown(ctx, w, h, trunkH, rnd);
        return;
      }
      const ramp = season === 'autumn' ? AUTUMN[v % 3] : FOLIAGE;
      // korona z 2–3 nakładających się kęp listowia – nieregularna sylwetka
      const cy = (h - trunkH) * 0.55;
      const rx = w * 0.46;
      const ry = (h - trunkH) * 0.5;
      drawFoliage(ctx, w * 0.36, cy + ry * 0.15, rx * 0.62, ry * 0.7, ramp, rnd, [2, 4]);
      drawFoliage(ctx, w * 0.64, cy + ry * 0.2, rx * 0.58, ry * 0.66, ramp, rnd, [2, 4]);
      drawFoliage(ctx, w * 0.5, cy - ry * 0.18, rx * 0.66, ry * 0.72, ramp, rnd, [2, 4 + (v >> 1)]);
      // wiosna: drzewa owocowe (co drugi wariant) w pełnym kwieciu, biało-różowym
      if (season === 'spring' && v % 2 === 0) blossom(ctx, w, h - trunkH, rnd);
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
  const winter = look.season === 'winter';
  return cached(`pine-${winter ? 'w' : 's'}-${v}`, () => {
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
            if (winter) c = left && rnd() > 0.3 ? PAL.pineWinterHi : rnd() > 0.85 ? PAL.pineWinterDeep : PAL.pineWinter;
            // rim light na lewym brzegu piętra, chłodny cień pod piętrem i na prawym brzegu
            if (x === (w >> 1) - half && half > 0) c = PAL.foliageHi;
            else if (x === (w >> 1) + half && half > 0) c = PAL.foliageDeep;
            else if (y === bottom - 1) c = winter ? PAL.pineWinterDeep : PAL.foliageDeep;
            // zima: śnieg zalega na górnej części każdego piętra (więcej po lewej, w świetle)
            if (winter) {
              const depth = (y - top) / (bottom - top);
              const lit = x < (w >> 1) + 1 ? 0.5 : 0.34;
              if (depth < lit && !(x === (w >> 1) + half && half > 1)) c = depth < 0.12 || rnd() < 0.2 ? PAL.snowLit : PAL.snowMid;
              else if (depth < lit + 0.1 && rnd() < 0.35) c = PAL.snowShade;
            }
            rect(ctx, x, y, 1, 1, c);
          }
        }
      }
    });
  });
}

/** Nagie drzewo liściaste: pień rozgałęziony na cieńsze gałęzie (zima). */
function bareCrown(ctx: CanvasRenderingContext2D, w: number, h: number, trunkH: number, rnd: () => number): void {
  const tx = w >> 1;
  const topY = h - trunkH;
  const branch = (x: number, y: number, len: number, ang: number, depth: number) => {
    const x1 = x + Math.cos(ang) * len;
    const y1 = y - Math.sin(ang) * len;
    line(ctx, x, y, x1, y1, depth >= 2 ? PAL.trunk : PAL.earthShade);
    if (depth >= 2) line(ctx, x + 1, y, x1 + 1, y1, PAL.trunk); // grubsze konary
    if (depth === 0 || len < 3) return;
    const n = 2 + (depth > 2 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const spread = (i / (n - 1) - 0.5) * 1.5 + (rnd() - 0.5) * 0.4;
      branch(x1, y1, len * (0.62 + rnd() * 0.12), ang + spread, depth - 1);
    }
  };
  branch(tx, topY + 1, (h - trunkH) * 0.34, Math.PI / 2, 4);
}

/** Kwiecie na koronie: biało-różowe plamki w miejscu listowia. */
function blossom(ctx: CanvasRenderingContext2D, w: number, hCrown: number, rnd: () => number): void {
  const img = ctx.getImageData(0, 0, w, hCrown);
  const px = new Uint32Array(img.data.buffer);
  const col = [PAL.blossomWhite, PAL.blossomWhite, PAL.blossomPink, PAL.blossomPinkDeep].map(rgbaPx);
  for (let i = 0; i < px.length; i++) {
    if (px[i] >>> 24 === 0 || rnd() > 0.7) continue;
    const y = Math.floor(i / w);
    // cień od dołu: niżej więcej ciemniejszego różu
    const k = rnd() * (1 - 0.35 * (1 - y / hCrown));
    px[i] = col[k < 0.5 ? 0 : k < 0.75 ? 1 : k < 0.92 ? 2 : 3];
  }
  ctx.putImageData(img, 0, 0);
}
