// LANDMARK: Warszawa – duża stacja z dwoma peronami pod długą wiatą, a w tle pikselowa
// panorama miasta: Pałac Kultury i Nauki, Varso, Złota 44, Warsaw Spire i biurowce.
// Nocą okna wieżowców rozświetlone (gotowa warstwa świateł, rysowana jednym drawImage),
// na szczytach migają czerwone światła przeszkodowe.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { cached, makeSprite, rect } from '../../engine/sprite';
import type { SegmentDef } from './types';
import { drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';
import { drawLampLights, drawNameBoard, drawPlatform } from './stationkit';
import { shadeWall, type Ramp5 } from './shade';
import { ditherEdge, paint } from '../../engine/pixbuf';

const RAMPS: Record<Kind, Ramp5> = {
  glass: [PAL.towerGlassGlint, PAL.towerGlassHi, PAL.towerGlass, PAL.towerGlassShade, PAL.towerGlassDeep],
  concrete: [PAL.towerConcreteGlint, PAL.towerConcreteHi, PAL.towerConcrete, PAL.towerConcreteShade, PAL.towerConcreteDeep],
  // dalekie bloki: perspektywa powietrzna – mały kontrast, kolor powietrza
  haze: [PAL.hazeFar, PAL.cityHaze, PAL.cityHaze, PAL.cityHazeShade, PAL.cityHazeShade],
};
const PKIN: Ramp5 = [PAL.pkinGlint, PAL.pkinHi, PAL.pkin, PAL.pkinShade, PAL.pkinDark];

const WIDTH = 1500;
export const WARSZAWA = 'WARSZAWA';
/** Podstawa budynków panoramy (zasłonięta peronem i wiatą). */
const BASE = TRACK_Y - 6;
const LAMPS = [40, 150, 1474];
const CANOPY = { x0: 200, x1: 1450, y: TRACK_Y - 54 };
const BACK_CANOPY = { x0: 260, x1: 1400, y: TRACK_Y - 66 };

type Kind = 'glass' | 'concrete' | 'haze';
interface Tower { x: number; w: number; h: number; kind: Kind; shape?: 'sail' | 'chamfer' | 'wedge'; spire?: number }

const PKIN_CX = 760;
/** Stopnie Pałacu Kultury: [połowa szerokości, wysokość od podstawy]. */
const PKIN_STEPS: [number, number][] = [[76, 30], [52, 46], [30, 96], [24, 110], [18, 124], [12, 136], [8, 144], [5, 150]];
const PKIN_SPIRE = 28;

const TOWERS: Tower[] = [
  { x: 112, w: 26, h: 92, kind: 'glass' },
  { x: 200, w: 40, h: 70, kind: 'concrete' },
  { x: 300, w: 34, h: 112, kind: 'glass', shape: 'chamfer' },
  { x: 400, w: 40, h: 82, kind: 'concrete' },
  { x: 548, w: 30, h: 138, kind: 'glass', shape: 'sail' }, // Złota 44
  { x: 960, w: 26, h: 166, kind: 'glass', shape: 'chamfer', spire: 40 }, // Varso
  { x: 1040, w: 36, h: 96, kind: 'concrete' },
  { x: 1130, w: 36, h: 142, kind: 'glass', shape: 'wedge' }, // Warsaw Spire
  { x: 1230, w: 30, h: 102, kind: 'glass' },
  { x: 1300, w: 44, h: 76, kind: 'concrete' },
  { x: 1385, w: 28, h: 118, kind: 'glass', shape: 'chamfer' },
];

/** Szerokość wieżowca w wierszu d od szczytu (kształty uproszczonych sylwetek). */
function rowSpan(t: Tower, d: number): [number, number] {
  if (t.shape === 'sail' && d < 46) return [t.x, t.x + t.w - Math.round(14 * (1 - d / 46) ** 2)]; // „żagiel"
  if (t.shape === 'chamfer' && d < 14) return [t.x, t.x + t.w - (14 - d)];
  if (t.shape === 'wedge' && d < 24) return [t.x + Math.round((24 - d) * 0.9), t.x + t.w];
  return [t.x, t.x + t.w];
}

const COLORS: Record<Kind, [string, string, string, string]> = {
  // [ściana, refleks, cień, linie pięter]
  glass: [PAL.towerGlass, PAL.towerGlassHi, PAL.towerGlassShade, PAL.towerGlassShade],
  concrete: [PAL.towerConcrete, PAL.pkinHi, PAL.towerConcreteShade, PAL.towerConcreteShade],
  haze: [PAL.cityHaze, PAL.cityHaze, PAL.cityHazeShade, PAL.cityHazeShade],
};

function drawTower(ctx: CanvasRenderingContext2D, t: Tower): void {
  const floor = COLORS[t.kind][3];
  const top = BASE - t.h;
  const R = RAMPS[t.kind];
  paint(ctx, t.x, top, t.w, t.h, (x, y) => {
    const [a, b] = rowSpan(t, y - top);
    if (x < a || x >= b) return null;
    const v = (y - top) / t.h; // szkło odbija jaśniejsze niebo u góry
    const u = (x - a) / Math.max(1, b - a - 1);
    let tt = 1.4 + u * 2.2 + (t.kind === 'glass' ? v * 0.8 - 0.3 : 0);
    if (x === a) tt = 0; // rim light od słońca
    return R[ditherEdge(tt, 5, x, y)];
  });
  if (t.kind !== 'haze') {
    for (let y = top + 3; y < BASE; y += 4) {
      const [a, b] = rowSpan(t, y - top);
      rect(ctx, a + 2, y, b - a - 5, 1, floor); // piętra
    }
  }
  if (t.kind === 'glass') {
    // pionowe słupki fasady i ukośny refleks nieba
    for (let x = t.x + 5; x < t.x + t.w - 4; x += 5) rect(ctx, x, top + 14, 1, t.h - 14, PAL.towerGlassShade);
    for (let k = 0; k < t.h - 20; k += 2) rect(ctx, t.x + 3 + Math.floor(k / 6), top + 16 + k, 1, 1, PAL.towerGlassHi);
  }
  if (t.spire) {
    rect(ctx, t.x + 8, top - t.spire, 1, t.spire, PAL.towerConcreteShade);
    rect(ctx, t.x + 7, top - 6, 3, 6, PAL.towerConcrete);
  }
}

function drawPkin(ctx: CanvasRenderingContext2D): void {
  const cx = PKIN_CX;
  for (const [half, h] of PKIN_STEPS) {
    const top = BASE - h;
    shadeWall(ctx, cx - half, top, half * 2, h, PKIN, 2);
    rect(ctx, cx - half, top, half * 2, 1, PAL.pkinGlint); // gzyms w słońcu
    // attyki z sterczynami na narożnikach
    for (const px of [cx - half, cx + half - 2]) rect(ctx, px, top - 4, 2, 4, PAL.pkin);
    for (let x = cx - half + 4; x < cx + half - 4; x += 6) rect(ctx, x, top - 2, 2, 2, PAL.pkinHi);
  }
  // pionowe lizeny (charakterystyczne pasy) na korpusie
  for (let x = cx - 28; x < cx + 26; x += 4) rect(ctx, x, BASE - 94, 1, 64, PAL.pkinShade);
  for (let x = cx - 74; x < cx + 72; x += 5) if (Math.abs(x - cx) > 32) rect(ctx, x, BASE - 28, 1, 22, PAL.pkinShade);
  // zegar
  rect(ctx, cx - 3, BASE - 141, 6, 6, PAL.pkinHi);
  rect(ctx, cx - 1, BASE - 140, 1, 3, PAL.pkinDark);
  // iglica
  for (let y = 0; y < PKIN_SPIRE; y++) {
    const w = y > PKIN_SPIRE - 8 ? 3 : y > PKIN_SPIRE - 18 ? 2 : 1;
    rect(ctx, cx - (w >> 1), BASE - 150 - PKIN_SPIRE + y, w, 1, PAL.pkinDark);
  }
}

/** Okna panoramy (x, y, szer.) – deterministycznie, bez seeda (zawsze ta sama Warszawa). */
function windows(): { x: number; y: number; w: number }[] {
  return cached('warsaw-windows', () => {
    const rnd = mulberry32(0x5a2a);
    const out: { x: number; y: number; w: number }[] = [];
    for (const t of TOWERS) {
      const top = BASE - t.h;
      for (let y = top + 6; y < BASE - 6; y += 4) {
        const [a, b] = rowSpan(t, y - top);
        for (let x = a + 3; x < b - 4; x += 3) if (rnd() < 0.42) out.push({ x, y: y + 1, w: 2 });
      }
    }
    for (const [half, h] of PKIN_STEPS.slice(0, 6)) {
      for (let y = BASE - h + 4; y < BASE - 8; y += 6) {
        for (let x = PKIN_CX - half + 3; x < PKIN_CX + half - 4; x += 4) if (rnd() < 0.3) out.push({ x, y, w: 1 });
      }
    }
    return out;
  });
}

/** Warstwa nocnych świateł okien – rysowana raz. */
function windowLayer(): HTMLCanvasElement {
  return cached('warsaw-window-layer', () =>
    makeSprite(WIDTH, TRACK_Y, (c) => {
      for (const w of windows()) {
        c.fillStyle = (w.x * 7 + w.y) % 5 === 0 ? PAL.windowGlow : PAL.windowLit;
        c.fillRect(w.x, w.y, w.w, 2);
      }
    }),
  );
}

function drawSkyline(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  // dalekie, zamglone bloki
  for (let x = 0; x < WIDTH; x += 18 + Math.floor(rnd() * 26)) {
    drawTower(ctx, { x, w: 16 + Math.floor(rnd() * 22), h: 26 + Math.floor(rnd() * 46), kind: 'haze' });
  }
  for (const t of TOWERS) if (t.x < PKIN_CX - 90 || t.x > PKIN_CX + 90) drawTower(ctx, t);
  drawPkin(ctx);
  // niższa zabudowa śródmieścia przed wieżowcami
  for (let x = 0; x < WIDTH; x += 24 + Math.floor(rnd() * 20)) {
    const w = 20 + Math.floor(rnd() * 18);
    const h = 18 + Math.floor(rnd() * 16);
    rect(ctx, x, BASE - h, w, h, PAL.towerConcreteShade);
    rect(ctx, x, BASE - h, w, 1, PAL.towerConcrete);
    for (let y = BASE - h + 3; y < BASE - 2; y += 4) for (let wx = x + 2; wx < x + w - 2; wx += 4) rect(ctx, wx, y, 2, 2, PAL.windowDay);
  }
}

function drawCanopy(ctx: CanvasRenderingContext2D, c: { x0: number; x1: number; y: number }, colShade: string): void {
  for (let x = c.x0 + 6; x < c.x1; x += 64) {
    rect(ctx, x, c.y + 4, 2, TRACK_Y - 5 - c.y - 4, colShade);
    rect(ctx, x - 3, c.y + 4, 8, 1, colShade); // rozgałęzienie podpory
  }
  rect(ctx, c.x0, c.y, c.x1 - c.x0, 4, PAL.canopy);
  rect(ctx, c.x0, c.y + 3, c.x1 - c.x0, 1, PAL.canopyShade);
  for (let x = c.x0 + 4; x < c.x1 - 4; x += 16) rect(ctx, x, c.y + 1, 9, 1, PAL.glassHi); // świetliki
  rect(ctx, c.x0, c.y - 1, c.x1 - c.x0, 1, PAL.canopyShade);
}

export const warszawa: SegmentDef = {
  id: 'warszawa',
  kind: 'landmark',
  width: WIDTH,
  weight: 0,
  signals: true,
  mapIcon: 'city',
  mapLabel: WARSZAWA,
  mapAnchor: PKIN_CX,
  // generator: yield = miejsce na przerwę między klatkami (World rozkłada render w czasie)
  *render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    drawSkyline(back, mulberry32(0x77a));
    yield;
    // drugi tor i peron za głównym (dalszy plan)
    rect(back, 0, TRACK_Y - 20, WIDTH, 6, PAL.ballastShade);
    rect(back, 0, TRACK_Y - 19, WIDTH, 1, PAL.railHead);
    rect(back, BACK_CANOPY.x0 - 30, TRACK_Y - 14, BACK_CANOPY.x1 - BACK_CANOPY.x0 + 60, 6, PAL.platform);
    rect(back, BACK_CANOPY.x0 - 30, TRACK_Y - 14, BACK_CANOPY.x1 - BACK_CANOPY.x0 + 60, 1, PAL.platformEdge);
    drawCanopy(back, BACK_CANOPY, PAL.canopyShade);
    yield;
    for (let x = 6; x < 190; x += 18 + Math.floor(rnd() * 14)) plantBackItem(back, x, 'tree', rnd, -8);
    // główny peron, wiata, tablica
    yield;
    drawPlatform(back, 20, WIDTH - 20, LAMPS, rnd);
    yield;
    drawCanopy(back, CANOPY, PAL.pole);
    yield;
    drawNameBoard(back, WARSZAWA, 46);
    // tablica z nazwą także na wiacie
    drawBackStrip(back, 0, 20, rnd);
    drawBackStrip(back, WIDTH - 20, WIDTH, rnd);
    yield;
    drawGround(bed, 0, WIDTH, rnd);
    yield;
    scatterBushes(bed, 0, WIDTH, 30, rnd);
  },

  lights(ctx, x, env) {
    const n = env.night;
    if (n > 0) {
      ctx.globalAlpha = Math.min(1, n * 1.4);
      ctx.drawImage(windowLayer(), x, 0);
      // świetlówki pod wiatami
      for (const c of [BACK_CANOPY, CANOPY]) {
        for (let lx = c.x0 + 20; lx < c.x1 - 10; lx += 32) {
          ctx.globalAlpha = Math.min(1, n * 1.4) * 0.3;
          rect(ctx, x + lx - 4, c.y + 4, 14, 6, PAL.lampGlow);
          ctx.globalAlpha = Math.min(1, n * 1.4);
          rect(ctx, x + lx, c.y + 4, 6, 1, PAL.headlight);
        }
      }
      ctx.globalAlpha = 1;
      drawLampLights(ctx, x, LAMPS, n);
    }
    // światła przeszkodowe na szczytach – migają (widoczne także o zmierzchu)
    if (n > 0.2 && env.time % 1.6 < 0.8) {
      const tops = [[PKIN_CX, BASE - 150 - PKIN_SPIRE], ...TOWERS.filter((t) => t.h > 110).map((t) => [t.x + (t.spire ? 8 : t.w >> 1), BASE - t.h - (t.spire ?? 0)])];
      for (const [tx, ty] of tops) rect(ctx, x + tx, ty, 1 + (tx === PKIN_CX ? 0 : 1), 2, PAL.aviationRed);
    }
  },
};
