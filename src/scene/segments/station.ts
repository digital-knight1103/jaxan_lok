// LANDMARK: stacja Kamieniec Ząbkowicki. Ceglany dworzec, peron z wiatą i lampami,
// duża tablica z nazwą stacji, a w tle na wzgórzu pałac Marianny Orańskiej.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { rect, cached, makeSprite } from '../../engine/sprite';
import { drawText, textWidth } from '../../engine/font';
import { drawFoliage } from '../../sprites/blob';
import { shadeWall, skyWindow, type Ramp5 } from './shade';

const BRICK: Ramp5 = [PAL.brickGlint, PAL.brickHi, PAL.brick, PAL.brickShade, PAL.brickDeep];
const PALACE: Ramp5 = [PAL.palaceGlint, PAL.palaceHi, PAL.palace, PAL.palaceShade, PAL.palaceDeep];
const SLATE: Ramp5 = [PAL.roofGlint, PAL.roofHi, PAL.roof, PAL.roofShade, PAL.roofDeep];
const FOLIAGE = [PAL.foliageGlint, PAL.foliageHi, PAL.foliageMid, PAL.foliage, PAL.foliageShade, PAL.foliageDeep] as const;
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
  shadeWall(ctx, x0, y0, w, h, BRICK, 3);
  // spoiny: co 3 wiersze, cegły przesunięte; pojedyncze jaśniejsze cegły (zróżnicowanie)
  for (let y = y0 + 2; y < y0 + h; y += 3) {
    for (let x = x0 + 1 + ((y >> 1) % 2) * 2; x < x0 + w - 1; x += 4 + Math.floor(rnd() * 2)) {
      rect(ctx, x, y, 1, 1, PAL.brickShade);
      if (rnd() < 0.12) rect(ctx, x + 1, y - 1, 2, 1, PAL.brickHi);
    }
  }
}

function drawPalace(ctx: CanvasRenderingContext2D): void {
  // wzgórze pod pałacem
  // wzgórze parkowe: gęste korony drzew rzędami od góry (dolne nachodzą na górne)
  // (stały wzór, sprite cache'owany – drogi w rysowaniu, a Kamieniec zawsze ten sam)
  const PARK_X = 560;
  const park = cached('kamieniec-park', () =>
    makeSprite(WIDTH - PARK_X, 80, (c) => {
      const prnd = mulberry32(0x9a7c);
      for (let row = 0; row < 7; row++) {
        const y = 14 + row * 9;
        for (let x = 12 + (row & 1) * 7; x < WIDTH - PARK_X; x += 12 + Math.floor(prnd() * 6)) {
          const r = 6 + prnd() * 3;
          drawFoliage(c, x, y + Math.sin((x + PARK_X) * 0.05) * 3, r * 1.15, r, FOLIAGE, prnd, [2, 3.5], 2.3 + row * 0.15);
        }
      }
    }),
  );
  ctx.drawImage(park, PARK_X, TRACK_Y - 80);


  // korpus z blankami
  shadeWall(ctx, P0, P_TOP, P1 - P0, P_BOTTOM - P_TOP, PALACE, 0);
  for (let x = P0; x < P1; x += 4) rect(ctx, x, P_TOP - 3, 2, 3, PAL.palace);
  rect(ctx, P0, P_TOP + 18, P1 - P0, 1, PAL.palaceShade); // gzyms
  for (const w of palaceWindows()) {
    rect(ctx, w.x, w.y, 2, 6, PAL.palaceDeep);
    rect(ctx, w.x, w.y, 1, 2, PAL.towerGlassHi); // odbicie nieba
  }
  // wieże neogotyckie ze strzelistymi hełmami
  const tower = (cx: number, w: number, top: number, spire: number) => {
    shadeWall(ctx, cx - (w >> 1), top, w, P_BOTTOM - top, PALACE, 0);
    for (let x = cx - (w >> 1); x < cx + (w >> 1); x += 3) rect(ctx, x, top - 2, 2, 2, PAL.palace);
    for (let y = 0; y < spire; y++) {
      const half = Math.round(((y + 1) / spire) * (w / 2 - 1));
      rect(ctx, cx - half, top - 2 - spire + y, half * 2 + 1, 1, PAL.palaceRoof);
      rect(ctx, cx - half, top - 2 - spire + y, Math.max(1, half >> 1), 1, PAL.roofGlint); // hełm: połać w słońcu
      rect(ctx, cx + half, top - 2 - spire + y, 1, 1, PAL.roofDeep);
    }
    rect(ctx, cx - 1, top + 6, 2, 5, PAL.palaceShade);
  };
  tower(P0 + 4, 10, P_TOP - 18, 12);
  tower(P1 - 4, 10, P_TOP - 18, 12);
  tower((P0 + P1) >> 1, 12, P_TOP - 28, 18);
  tower(P0 + 46, 6, P_TOP - 8, 8);
  tower(P1 - 46, 6, P_TOP - 8, 8);
}

function drawBuilding(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  brickWall(ctx, B0, B_TOP, B1 - B0, PLATFORM_TOP - B_TOP, rnd);
  // ryzalit środkowy, wyższy
  const mid = (B0 + B1) >> 1;
  brickWall(ctx, mid - 22, B_TOP - 10, 44, 10, rnd);
  // dach dwuspadowy (z boku – trapez) + szczyt ryzalitu
  // dach łupkowy: rzędy co 3 px, jasna kalenica i lewa krawędź, cień przy okapie
  const roof = (x0: number, y0: number, w: number, h: number) => {
    for (let y = 0; y < h; y++) {
      const t = y === h - 1 ? 0 : y % 3 === 0 ? 3 : y < 2 ? 3.4 : 2;
      rect(ctx, x0 + y, y0 - y, w - 2 * y, 1, SLATE[Math.floor(t)]);
      rect(ctx, x0 + y, y0 - y, 1, 1, SLATE[0]);
      rect(ctx, x0 + w - y - 1, y0 - y, 1, 1, SLATE[4]);
    }
  };
  roof(B0 - 3, B_TOP - 1, B1 - B0 + 6, 16);
  roof(mid - 24, B_TOP - 11, 48, 18);
  for (const kx of [B0 + 30, B1 - 34]) { // kominy
    shadeWall(ctx, kx, B_TOP - 22, 4, 10, BRICK, 0);
    rect(ctx, kx - 1, B_TOP - 23, 6, 1, PAL.trim);
  }
  // gzymsy jasne
  rect(ctx, B0, B_TOP, B1 - B0, 2, PAL.trim);
  rect(ctx, B0, TRACK_Y - 38, B1 - B0, 6, PAL.trim);
  // nazwa stacji na elewacji
  const tw = textWidth(STATION_NAME);
  drawText(ctx, STATION_NAME, mid - (tw >> 1), TRACK_Y - 37, PAL.roof);
  // okna z jasnym obramowaniem, drzwi
  for (const w of buildingWindows()) {
    rect(ctx, w.x - 1, w.y - 1, 7, w.h + 2, PAL.trim);
    skyWindow(ctx, w.x, w.y, 5, w.h, PAL.glassHi, PAL.windowDay, PAL.roofDeep);
    rect(ctx, w.x + 2, w.y, 1, w.h, PAL.trim);
    rect(ctx, w.x - 1, w.y + w.h + 1, 7, 1, PAL.brickDeep); // cień pod parapetem
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
    drawPalace(back);
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
