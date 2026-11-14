// Polska wieś (styl2): drewniana stodoła, wiatrak koźlak, gniazdo bociana na słupie,
// kapliczka, domy z czerwoną dachówką, płoty sztachetowe, topole i wierzby głowiaste.
// Światło z lewej-góry: jasna krawędź od słońca, chłodny cień po prawej i pod okapem.
// Wszystko proceduralne, rysowane raz i cache'owane. Spód sprite'a = ziemia.
import { PAL } from '../palette';
import { cached, makeSprite, rect, line } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { bayer } from '../engine/pixbuf';
import { drawFoliage } from './blob';

const WOOD = [PAL.woodGlint, PAL.woodHi, PAL.wood, PAL.woodShade, PAL.woodDeep] as const;
const TILE = [PAL.roofRedGlint, PAL.roofRedHi, PAL.roofRed, PAL.roofRedShade, PAL.roofRedDeep] as const;
const STUCCO = [PAL.stuccoHi, PAL.stucco, PAL.stuccoShade, PAL.stuccoDeep] as const;
const POPLAR = [PAL.foliageGlint, PAL.poplarHi, PAL.poplar, PAL.poplarShade, PAL.foliageDeep] as const;
const WILLOW = [PAL.willowHi, PAL.willowHi, PAL.willow, PAL.willowShade, PAL.willowDeep] as const;

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string) => rect(ctx, x, y, 1, 1, c);

/** Dithering 50% między dwoma kolorami w prostokącie (miękkie przejście tonów). */
function dither(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, k = 0.5): void {
  ctx.fillStyle = c;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < k) ctx.fillRect(x + i, y + j, 1, 1);
}

/** Ściana z desek pionowych: lewa krawędź w blasku, prawa w cieniu, fugi co `plank` px. */
function planks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, plank = 3): void {
  rect(ctx, x, y, w, h, WOOD[2]);
  for (let i = 0; i < w; i += plank) rect(ctx, x + i, y, 1, h, WOOD[3]);
  // światło wzdłuż ściany: z lewej jaśniej, z prawej ciemniej (dithering między)
  dither(ctx, x, y, Math.round(w * 0.3), h, WOOD[1], 0.5);
  dither(ctx, x + Math.round(w * 0.7), y, w - Math.round(w * 0.7), h, WOOD[3], 0.5);
  rect(ctx, x, y, 1, h, WOOD[0]); // rim light
  rect(ctx, x + w - 1, y, 1, h, WOOD[4]);
}

/** Dach dwuspadowy szczytem do widza (trójkąt z okapem): lewa połać w słońcu. */
function gable(ctx: CanvasRenderingContext2D, cx: number, base: number, half: number, h: number, ramp: readonly string[]): void {
  for (let j = 0; j <= h; j++) {
    const y = base - h + j;
    const hw = Math.round((j / h) * half);
    for (let i = -hw; i <= hw; i++) {
      const left = i < 0;
      // rzędy dachówek co 2 px: jaśniejszy górny wiersz rzędu
      const row = (j & 1) === 0;
      let k = left ? (row ? 1 : 2) : row ? 2 : 3;
      if (i === -hw) k = 0; // blask na krawędzi połaci od słońca
      if (i === hw) k = 4;
      px(ctx, cx + i, y, ramp[k]);
    }
  }
}

/** Dach dwuspadowy widziany z boku (trapez) z rzędami dachówki. */
function sideRoof(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, ramp: readonly string[]): void {
  for (let j = 0; j < h; j++) {
    const inset = Math.round(((h - j) / h) * h * 0.9);
    const y = base - h + j;
    const x0 = x + inset;
    const x1 = x + w - inset;
    const row = j % 3;
    rect(ctx, x0, y, x1 - x0, 1, ramp[row === 0 ? 1 : row === 1 ? 2 : 3]);
    // przesunięte „fale” dachówki
    for (let i = x0 + (j % 2) * 2; i < x1; i += 4) px(ctx, i, y, ramp[row === 0 ? 0 : 3]);
    px(ctx, x0, y, ramp[0]); // krawędź od słońca
    px(ctx, x1 - 1, y, ramp[4]);
  }
  rect(ctx, x + Math.round(h * 0.9), base - h, w - 2 * Math.round(h * 0.9), 1, ramp[0]); // kalenica w słońcu
}

// --- drzewa przy miedzach ---
export const POPLAR_VARIANTS = 3;
/** Topola: smukła kolumna listowia. */
export function getPoplar(variant: number): HTMLCanvasElement {
  const v = variant % POPLAR_VARIANTS;
  return cached(`poplar-${v}`, () => {
    const rnd = mulberry32(400 + v);
    const h = 44 + v * 8;
    const w = 12 + v * 2;
    return makeSprite(w, h, (ctx) => {
      rect(ctx, (w >> 1) - 1, h - 6, 2, 6, PAL.trunk);
      px(ctx, (w >> 1) - 1, h - 6, PAL.woodHi);
      drawFoliage(ctx, w / 2, h * 0.62, w * 0.36, h * 0.26, POPLAR, rnd, [1.5, 2.5], 1.8);
      drawFoliage(ctx, w / 2, h * 0.36, w * 0.32, h * 0.24, POPLAR, rnd, [1.5, 2.5], 1.6);
      drawFoliage(ctx, w / 2 + 0.5, h * 0.14, w * 0.2, h * 0.13, POPLAR, rnd, [1.2, 2], 1.4);
    });
  });
}

export const WILLOW_VARIANTS = 2;
/** Wierzba głowiasta: gruby, krótki pień z guzem i okrągła srebrzysta korona. */
export function getWillow(variant: number): HTMLCanvasElement {
  const v = variant % WILLOW_VARIANTS;
  return cached(`willow-${v}`, () => {
    const rnd = mulberry32(450 + v);
    const w = 30 + v * 6;
    const h = 30 + v * 4;
    return makeSprite(w, h, (ctx) => {
      const tx = w >> 1;
      rect(ctx, tx - 2, h - 12, 5, 12, PAL.woodGreyShade);
      rect(ctx, tx - 2, h - 12, 1, 12, PAL.woodGreyHi);
      rect(ctx, tx + 2, h - 12, 1, 12, PAL.woodDeep);
      rect(ctx, tx - 3, h - 14, 7, 3, PAL.woodGrey); // „głowa” po ogławianiu
      drawFoliage(ctx, w / 2, h * 0.38, w * 0.46, h * 0.32, WILLOW, rnd, [2, 3.5], 1.8);
      // zwisające witki pod koroną
      for (let i = 0; i < w * 0.6; i++) {
        const x = 3 + Math.floor(rnd() * (w - 6));
        const y0 = Math.round(h * 0.5) + Math.floor(rnd() * 3);
        const len = 3 + Math.floor(rnd() * 5);
        for (let j = 0; j < len; j++) px(ctx, x, y0 + j, j === 0 ? WILLOW[2] : x < w / 2 ? WILLOW[2] : WILLOW[3]);
      }
    });
  });
}

// --- zabudowa ---
/** Drewniana stodoła szczytem do widza: wrota z krzyżulcem, okienko na siano, czerwony dach. */
export function getBarn(variant: number): HTMLCanvasElement {
  const v = variant % 2;
  return cached(`barn-${v}`, () => {
    const w = 52 + v * 8;
    const wallH = 26 + v * 4;
    const roofH = 20 + v * 2;
    const h = wallH + roofH + 2;
    return makeSprite(w + 4, h, (ctx) => {
      const x0 = 2;
      const top = h - wallH;
      planks(ctx, x0, top, w, wallH);
      // cień pod okapem
      rect(ctx, x0, top, w, 1, WOOD[4]);
      dither(ctx, x0, top + 1, w, 2, WOOD[4], 0.5);
      // dach (okap wystaje 2 px)
      gable(ctx, x0 + w / 2, top, w / 2 + 2, roofH, TILE);
      // okienko na siano w szczycie
      const wx = x0 + (w >> 1) - 3;
      rect(ctx, wx, top - 9, 6, 5, PAL.woodDeep);
      rect(ctx, wx, top - 9, 6, 1, PAL.woodGlint);
      // wrota: dwa skrzydła z krzyżulcami
      const dw = Math.round(w * 0.46);
      const dx = x0 + ((w - dw) >> 1);
      const dh = wallH - 6;
      const dy = h - dh;
      rect(ctx, dx, dy, dw, dh, WOOD[3]);
      rect(ctx, dx - 1, dy - 1, dw + 2, 1, WOOD[1]);
      rect(ctx, dx - 1, dy - 1, 1, dh + 1, WOOD[0]);
      const half = dw >> 1;
      for (const sx of [dx, dx + half]) {
        rect(ctx, sx, dy, half, 1, WOOD[1]);
        line(ctx, sx + 1, dy + 1, sx + half - 2, h - 2, WOOD[1]);
        line(ctx, sx + half - 2, dy + 1, sx + 1, h - 2, WOOD[1]);
        rect(ctx, sx + half - 1, dy, 1, dh, WOOD[4]);
      }
      // uchwyty
      px(ctx, dx + half - 2, dy + (dh >> 1), PAL.steel);
      px(ctx, dx + half + 1, dy + (dh >> 1), PAL.steel);
    });
  });
}

/** Wiatrak koźlak: drewniana budka na kozłach, cztery skrzydła z kratownicą. */
export function getWindmill(): HTMLCanvasElement {
  return cached('windmill', () => {
    const w = 56;
    const h = 72;
    return makeSprite(w, h, (ctx) => {
      const cx = 28;
      // kozioł: zastrzały i słup
      line(ctx, cx - 9, h - 1, cx - 1, h - 20, PAL.woodDeep);
      line(ctx, cx + 9, h - 1, cx + 1, h - 20, PAL.woodDeep);
      line(ctx, cx - 8, h - 1, cx, h - 20, PAL.woodShade);
      rect(ctx, cx - 1, h - 22, 3, 22, PAL.woodShade);
      px(ctx, cx - 1, h - 22, PAL.woodHi);
      rect(ctx, cx - 11, h - 2, 22, 2, PAL.woodDeep); // podwaliny
      // dyszel (belka do obracania) i schody
      line(ctx, cx + 8, h - 26, cx + 20, h - 2, PAL.woodShade);
      line(ctx, cx + 9, h - 26, cx + 21, h - 2, PAL.woodDeep);
      // budka
      const bx = cx - 9;
      const by = h - 46;
      planks(ctx, bx, by, 18, 24, 3);
      rect(ctx, bx, by, 18, 1, WOOD[4]);
      rect(ctx, bx + 7, by + 14, 4, 7, PAL.woodDeep); // drzwiczki
      rect(ctx, bx + 4, by + 5, 3, 3, PAL.glass);
      // dach dwuspadowy z gontu (szary)
      gable(ctx, cx, by, 11, 9, [PAL.woodGreyHi, PAL.woodGreyHi, PAL.woodGrey, PAL.woodGreyShade, PAL.woodDeep]);
      // skrzydła: krzyż ukośny z kratownicą żagla po jednej stronie ramienia
      const hy = by + 6;
      px(ctx, cx, hy, PAL.woodDeep);
      const arms: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [ax, ay] of arms) {
        const L = 24;
        // żagiel: kratka po stronie ruchu skrzydła
        for (let t = 6; t <= L; t++) {
          const sx = cx + ax * t;
          const sy = hy + ay * t;
          for (let k = 1; k <= 4; k++) {
            // prostopadle do ramienia (ramię ukośne → kierunek (-ay, ax))
            const qx = sx - ay * k * 0.7;
            const qy = sy + ax * k * 0.7;
            const lattice = t % 3 === 0 || k === 4;
            px(ctx, Math.round(qx), Math.round(qy), lattice ? PAL.woodShade : (ax < 0 ? PAL.woodGreyHi : PAL.woodGrey));
          }
        }
        line(ctx, cx, hy, cx + ax * L, hy + ay * L, PAL.woodDeep);
      }
    });
  });
}

/** Słup z gniazdem bociana i bocianem. */
export function getStorkNest(): HTMLCanvasElement {
  return cached('stork', () => {
    const w = 22;
    const h = 64;
    return makeSprite(w, h, (ctx) => {
      const cx = 11;
      rect(ctx, cx - 1, 14, 3, h - 14, PAL.woodGrey);
      rect(ctx, cx - 1, 14, 1, h - 14, PAL.woodGreyHi);
      rect(ctx, cx + 1, 14, 1, h - 14, PAL.woodGreyShade);
      rect(ctx, cx - 5, 15, 11, 1, PAL.woodGreyShade); // poprzeczka pod gniazdem
      // gniazdo: splątane gałęzie
      const rnd = mulberry32(77);
      for (let y = 9; y < 15; y++) {
        const hw = 8 - Math.abs(y - 12);
        for (let x = cx - hw; x <= cx + hw; x++) {
          const r = rnd();
          px(ctx, x, y, y === 9 || (x < cx && r < 0.4) ? PAL.nestHi : r < 0.3 ? PAL.woodDeep : PAL.nest);
        }
      }
      for (let i = 0; i < 6; i++) px(ctx, cx - 9 + Math.floor(rnd() * 18), 10 + Math.floor(rnd() * 4), PAL.nestHi); // wystające patyki
      // bocian: biały tułów, czarne lotki, długa szyja, czerwony dziób
      rect(ctx, cx - 3, 5, 6, 4, PAL.stork);
      rect(ctx, cx + 1, 6, 3, 3, PAL.storkBlack);
      px(ctx, cx - 3, 5, PAL.sun);
      rect(ctx, cx - 3, 1, 1, 4, PAL.stork);
      rect(ctx, cx - 4, 0, 2, 2, PAL.stork);
      rect(ctx, cx - 7, 1, 3, 1, PAL.storkBeak);
      px(ctx, cx - 1, 9, PAL.storkBeak);
    });
  });
}

/** Kapliczka przydrożna: bielony słupek, niebieska wnęka z figurką, daszek, krzyżyk, kwiaty. */
export function getShrine(): HTMLCanvasElement {
  return cached('shrine', () => {
    const w = 14;
    const h = 32;
    return makeSprite(w, h, (ctx) => {
      rect(ctx, 1, h - 4, 12, 4, STUCCO[3]);
      rect(ctx, 1, h - 4, 12, 1, STUCCO[1]);
      rect(ctx, 3, 10, 8, h - 14, STUCCO[1]);
      rect(ctx, 3, 10, 1, h - 14, STUCCO[0]);
      rect(ctx, 9, 10, 2, h - 14, STUCCO[2]);
      // wnęka
      rect(ctx, 5, 13, 4, 6, PAL.shrineBlue);
      rect(ctx, 6, 14, 2, 4, PAL.stork);
      px(ctx, 6, 14, PAL.sun);
      // daszek blaszany (dwuspadowy)
      gable(ctx, 7, 10, 6, 4, [PAL.roofHi, PAL.roofHi, PAL.roof, PAL.roof, PAL.storkBlack]);
      rect(ctx, 7, 2, 1, 5, PAL.storkBlack);
      rect(ctx, 6, 3, 3, 1, PAL.storkBlack);
      // kwiaty u stóp
      for (const [x, c] of [[1, PAL.flower], [3, PAL.sun], [10, PAL.flower], [12, PAL.shrineBlue]] as [number, string][]) {
        px(ctx, x, h - 6, c);
        px(ctx, x, h - 5, PAL.grassMid);
      }
    });
  });
}

/** Dom wiejski: tynk, czerwona dachówka (widok z boku), okna z obramieniem, komin. */
export function getHouse(variant: number): HTMLCanvasElement {
  const v = variant % 4;
  return cached(`house-${v}`, () => {
    const small = v >= 2;
    const w = small ? 24 : 36;
    const wallH = small ? 11 : 15;
    const roofH = small ? 8 : 11;
    const h = wallH + roofH + 4;
    return makeSprite(w + 4, h, (ctx) => {
      const x0 = 2;
      const top = h - wallH;
      rect(ctx, x0, top, w, wallH, STUCCO[1]);
      dither(ctx, x0, top, 6, wallH, STUCCO[0], 0.5);
      rect(ctx, x0, top, 1, wallH, STUCCO[0]);
      dither(ctx, x0 + w - 6, top, 6, wallH, STUCCO[2], 0.5);
      rect(ctx, x0 + w - 1, top, 1, wallH, STUCCO[3]);
      rect(ctx, x0, h - 2, w, 2, STUCCO[3]); // cokół
      // cień pod okapem
      rect(ctx, x0, top, w, 1, STUCCO[3]);
      dither(ctx, x0, top + 1, w, 1, STUCCO[2], 0.5);
      // okna
      const n = small ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const wx = x0 + 3 + Math.round(((w - 9) * i) / Math.max(1, n - 1));
        if (!small && i === 1) {
          rect(ctx, wx, h - 9, 4, 7, PAL.woodShade); // drzwi
          px(ctx, wx + 3, h - 6, PAL.steel);
          continue;
        }
        rect(ctx, wx - 1, top + 3, 5, 6, PAL.stuccoHi);
        rect(ctx, wx, top + 4, 3, 4, PAL.glass);
        px(ctx, wx, top + 4, PAL.glassHi); // odbicie nieba
        rect(ctx, wx + 1, top + 4, 1, 4, PAL.stuccoHi); // szprosy
      }
      sideRoof(ctx, x0 - 2, top, w + 4, roofH, TILE);
      // komin z cegły
      const kx = x0 + Math.round(w * (v % 2 ? 0.7 : 0.3));
      rect(ctx, kx, top - roofH - 2, 3, 5, PAL.brick);
      px(ctx, kx, top - roofH - 2, PAL.brickGlint);
      rect(ctx, kx + 2, top - roofH - 2, 1, 5, PAL.brickDeep);
    });
  });
}

/** Płot sztachetowy wzdłuż [x0, x1) z podstawą na y. */
export function drawFence(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  for (let x = x0; x < x1; x += 2) {
    const post = (x - x0) % 12 === 0;
    const hgt = post ? 8 : 6;
    rect(ctx, x, y - hgt, 1, hgt, (x - x0) % 4 === 0 ? PAL.woodGreyHi : PAL.woodGrey);
    if (post) rect(ctx, x + 1, y - hgt, 1, hgt, PAL.woodGreyShade);
  }
  rect(ctx, x0, y - 5, x1 - x0, 1, PAL.woodGreyShade);
  rect(ctx, x0, y - 2, x1 - x0, 1, PAL.woodGreyShade);
}
