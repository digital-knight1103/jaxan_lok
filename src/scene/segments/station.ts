// LANDMARK: stacja Kamieniec Ząbkowicki. Ceglany dworzec, peron z wiatą i lampami,
// duża tablica z nazwą stacji, a w tle na wzgórzu pałac Marianny Orańskiej.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { rect } from '../../engine/sprite';
import { drawText, textWidth } from '../../engine/font';
import { drawBlob, type Circle } from '../../sprites/blob';
import type { SegmentDef } from './types';
import { disc, drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';

const WIDTH = 800;
export const STATION_NAME = 'KAMIENIEC ZĄBKOWICKI';
const PLATFORM_TOP = TRACK_Y - 5;
const LAMPS = [30, 228, 432, 586, 700, 784];

// dworzec
const B0 = 240;
const B1 = 410;
const B_TOP = TRACK_Y - 60;
const WIN_UP = TRACK_Y - 52;
const WIN_LOW = TRACK_Y - 28;
const buildingWindows = (): { x: number; y: number; h: number }[] => {
  const out: { x: number; y: number; h: number }[] = [];
  for (let x = B0 + 8; x < B1 - 8; x += 15) {
    if (Math.abs(x + 2 - (B0 + B1) / 2) < 10) continue; // drzwi
    out.push({ x, y: WIN_UP, h: 8 }, { x, y: WIN_LOW, h: 11 });
  }
  return out;
};

// pałac na wzgórzu
const P0 = 604;
const P1 = 756;
const P_TOP = TRACK_Y - 116;
const P_BOTTOM = TRACK_Y - 74;
const palaceWindows = (): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = [];
  for (let x = P0 + 12; x < P1 - 12; x += 9) for (const y of [P_TOP + 10, P_TOP + 24]) out.push({ x, y });
  return out;
};

function brickWall(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, rnd: () => number): void {
  rect(ctx, x0, y0, w, h, PAL.brick);
  for (let y = y0 + 2; y < y0 + h; y += 3) {
    for (let x = x0 + ((y >> 1) % 2) * 2; x < x0 + w; x += 4 + Math.floor(rnd() * 2)) {
      rect(ctx, x, y, 1, 1, PAL.brickShade);
    }
  }
  rect(ctx, x0 + w - 2, y0, 2, h, PAL.brickShade);
  rect(ctx, x0, y0, 1, h, PAL.brickHi);
}

function drawPalace(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  // wzgórze pod pałacem
  const hill: Circle[] = [];
  for (let i = 0; i < 6; i++) hill.push({ x: 580 + i * 40, y: TRACK_Y - 40 + rnd() * 10, r: 30 + rnd() * 14 });
  drawBlob(ctx, hill, [PAL.foliageHi, PAL.foliage, PAL.foliageShade, PAL.foliageDeep], rnd, 0, 0, undefined, 0.5);

  // korpus z blankami
  rect(ctx, P0, P_TOP, P1 - P0, P_BOTTOM - P_TOP, PAL.palace);
  rect(ctx, P1 - 6, P_TOP, 6, P_BOTTOM - P_TOP, PAL.palaceShade);
  for (let x = P0; x < P1; x += 4) rect(ctx, x, P_TOP - 3, 2, 3, PAL.palace);
  rect(ctx, P0, P_TOP + 18, P1 - P0, 1, PAL.palaceShade); // gzyms
  for (const w of palaceWindows()) rect(ctx, w.x, w.y, 2, 6, PAL.palaceShade);
  // wieże neogotyckie ze strzelistymi hełmami
  const tower = (cx: number, w: number, top: number, spire: number) => {
    rect(ctx, cx - (w >> 1), top, w, P_BOTTOM - top, PAL.palace);
    rect(ctx, cx + (w >> 1) - 2, top, 2, P_BOTTOM - top, PAL.palaceShade);
    for (let x = cx - (w >> 1); x < cx + (w >> 1); x += 3) rect(ctx, x, top - 2, 2, 2, PAL.palace);
    for (let y = 0; y < spire; y++) {
      const half = Math.round(((y + 1) / spire) * (w / 2 - 1));
      rect(ctx, cx - half, top - 2 - spire + y, half * 2 + 1, 1, PAL.palaceRoof);
    }
    rect(ctx, cx - 1, top + 6, 2, 5, PAL.palaceShade);
  };
  tower(P0 + 4, 10, P_TOP - 18, 12);
  tower(P1 - 4, 10, P_TOP - 18, 12);
  tower((P0 + P1) >> 1, 12, P_TOP - 28, 18);
  tower(P0 + 46, 6, P_TOP - 8, 8);
  tower(P1 - 46, 6, P_TOP - 8, 8);
  // drzewa parku u stóp pałacu
  for (let x = 586; x < 790; x += 14 + Math.floor(rnd() * 10)) plantBackItem(ctx, x, 'tree', rnd, -60 + Math.floor(rnd() * 10));
}

function drawBuilding(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  brickWall(ctx, B0, B_TOP, B1 - B0, PLATFORM_TOP - B_TOP, rnd);
  // ryzalit środkowy, wyższy
  const mid = (B0 + B1) >> 1;
  brickWall(ctx, mid - 22, B_TOP - 10, 44, 10, rnd);
  // dach dwuspadowy (z boku – trapez) + szczyt ryzalitu
  for (let y = 0; y < 16; y++) {
    rect(ctx, B0 - 3 + y, B_TOP - 1 - y, B1 - B0 + 6 - 2 * y, 1, y === 0 ? PAL.roofHi : PAL.roof);
  }
  for (let y = 0; y < 18; y++) {
    rect(ctx, mid - 24 + y, B_TOP - 11 - y, 48 - 2 * y, 1, y < 1 ? PAL.roofHi : PAL.roof);
  }
  rect(ctx, B0 + 30, B_TOP - 22, 4, 10, PAL.brickShade); // komin
  rect(ctx, B1 - 34, B_TOP - 22, 4, 10, PAL.brickShade);
  // gzymsy jasne
  rect(ctx, B0, B_TOP, B1 - B0, 2, PAL.trim);
  rect(ctx, B0, TRACK_Y - 38, B1 - B0, 6, PAL.trim);
  // nazwa stacji na elewacji
  const tw = textWidth(STATION_NAME);
  drawText(ctx, STATION_NAME, mid - (tw >> 1), TRACK_Y - 37, PAL.roof);
  // okna z jasnym obramowaniem, drzwi
  for (const w of buildingWindows()) {
    rect(ctx, w.x - 1, w.y - 1, 7, w.h + 2, PAL.trim);
    rect(ctx, w.x, w.y, 5, w.h, PAL.windowDay);
    rect(ctx, w.x + 2, w.y, 1, w.h, PAL.trim);
  }
  rect(ctx, mid - 5, TRACK_Y - 26, 10, 21, PAL.trim);
  rect(ctx, mid - 4, TRACK_Y - 25, 8, 20, PAL.roof);
  rect(ctx, mid, TRACK_Y - 25, 1, 20, PAL.trim);
}

function drawShelter(ctx: CanvasRenderingContext2D): void {
  const x0 = 450;
  const x1 = 562;
  for (const px of [x0 + 4, (x0 + x1) >> 1, x1 - 6]) rect(ctx, px, TRACK_Y - 44, 2, 39, PAL.pole);
  rect(ctx, x0, TRACK_Y - 48, x1 - x0, 4, PAL.roof);
  rect(ctx, x0, TRACK_Y - 48, x1 - x0, 1, PAL.roofHi);
  rect(ctx, x0 + 20, TRACK_Y - 14, 22, 2, PAL.trunk); // ławka
  rect(ctx, x0 + 22, TRACK_Y - 12, 1, 7, PAL.trunk);
  rect(ctx, x0 + 39, TRACK_Y - 12, 1, 7, PAL.trunk);
}

function drawNameBoard(ctx: CanvasRenderingContext2D): void {
  // duża tablica – nad pociągiem, widoczna z daleka
  const tw = textWidth(STATION_NAME, 2);
  const x0 = 40;
  const y0 = TRACK_Y - 90;
  const w = tw + 10;
  const h = 18;
  rect(ctx, x0 + 10, y0 + h, 2, PLATFORM_TOP - y0 - h, PAL.pole);
  rect(ctx, x0 + w - 12, y0 + h, 2, PLATFORM_TOP - y0 - h, PAL.pole);
  rect(ctx, x0, y0, w, h, PAL.signBorder);
  rect(ctx, x0 + 1, y0 + 1, w - 2, h - 2, PAL.signBlue);
  drawText(ctx, STATION_NAME, x0 + 5, y0 + 5, PAL.white, 2);
}

function drawPlatform(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  rect(ctx, 20, PLATFORM_TOP, WIDTH - 40, TRACK_Y + 2 - PLATFORM_TOP, PAL.platform);
  rect(ctx, 20, PLATFORM_TOP, WIDTH - 40, 1, PAL.platformEdge);
  rect(ctx, 20, PLATFORM_TOP + 1, WIDTH - 40, 1, PAL.platformHi);
  for (let x = 24; x < WIDTH - 24; x += 12 + Math.floor(rnd() * 3)) rect(ctx, x, PLATFORM_TOP + 2, 1, 4, PAL.rockShade);
  for (const lx of LAMPS) {
    rect(ctx, lx, TRACK_Y - 58, 1, 53, PAL.pole);
    rect(ctx, lx - 2, TRACK_Y - 59, 5, 2, PAL.roof);
    rect(ctx, lx - 1, TRACK_Y - 57, 3, 1, PAL.headlightOff);
  }
}

export const station: SegmentDef = {
  id: 'station',
  kind: 'landmark',
  width: WIDTH,
  weight: 0,
  signals: true,
  mapIcon: 'station',
  mapLabel: STATION_NAME,
  mapAnchor: (B0 + B1) >> 1, // dworzec
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    drawPalace(back, rnd);
    for (let x = 6; x < 236; x += 12 + Math.floor(rnd() * 14)) plantBackItem(back, x, rnd() < 0.5 ? 'tree' : 'pine', rnd, -4);
    for (let x = 416; x < 450; x += 14) plantBackItem(back, x, 'tree', rnd, -4);
    drawBuilding(back, rnd);
    drawShelter(back);
    drawPlatform(back, rnd);
    drawNameBoard(back);
    drawBackStrip(back, 0, 20, rnd);
    drawBackStrip(back, WIDTH - 20, WIDTH, rnd);
    drawGround(bed, 0, WIDTH, rnd);
    scatterBushes(bed, 0, WIDTH, 26, rnd);
  },

  lights(ctx, x, env) {
    if (env.night <= 0) return;
    ctx.globalAlpha = Math.min(1, env.night * 1.5);
    for (const w of buildingWindows()) {
      if ((w.x + w.y) % 3 === 0) continue;
      rect(ctx, x + w.x, w.y, 5, w.h, PAL.windowLit);
      rect(ctx, x + w.x + 2, w.y, 1, w.h, PAL.trim);
    }
    for (const w of palaceWindows()) if ((w.x * 3 + w.y) % 4 === 0) rect(ctx, x + w.x, w.y, 2, 6, PAL.windowLit);
    // lampy peronowe – jasny punkt + poświata
    for (const lx of LAMPS) {
      ctx.globalAlpha = Math.min(1, env.night * 1.5) * 0.35;
      disc(ctx, x + lx, TRACK_Y - 55, 6, PAL.lampGlow);
      ctx.globalAlpha = Math.min(1, env.night * 1.5);
      rect(ctx, x + lx - 1, TRACK_Y - 57, 3, 2, PAL.headlight);
    }
    ctx.globalAlpha = 1;
  },
};
