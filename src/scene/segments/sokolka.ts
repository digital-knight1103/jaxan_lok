// LANDMARK: Sokółka – stacja z tablicą i żwirownia/piaskownia (Podlasie: kruszywo
// naturalne, nie skała). Piaszczysta skarpa z warstwami i sosnami na górze, staw
// w wyrobisku, koparka, sortownia z przesiewaczami, stożkowe hałdy piasku i żwiru
// usypywane taśmociągami oraz magentowy lej JAXAN nad torem.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { line, rect, disc } from '../../engine/sprite';
import { drawText, textWidth } from '../../engine/font';
import type { SegmentDef } from './types';
import { drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';
import { drawLampLights, drawNameBoard, drawPlatform, PLATFORM_TOP } from './stationkit';

const WIDTH = 1600;
export const SOKOLKA = 'SOKÓŁKA';
const LAMPS = [30, 200, 470, 640];

// dworzec – otynkowany, z czerwonym dachem (inny niż ceglany Kamieniec)
const B0 = 300;
const B1 = 432;
const B_TOP = TRACK_Y - 46;
const WINDOWS = [312, 330, 348, 384, 402, 420].map((x) => ({ x, y: TRACK_Y - 33 }));

// żwirownia
const PIT_FROM = 690;
const RIDGE_H = 74;
/** Półka wydobywcza wcięta w skarpę – stoi na niej koparka (widoczna nad wagonami). */
const BENCH = { x0: 890, x1: 1010, h: 40 };
const POND = { x0: 750, x1: 900, y: TRACK_Y - 13 };
const PILES = [
  // wysokie stożki – widoczne nad wagonami, gdy pociąg stoi przy żwirowni
  { cx: 1205, h: 70, ramp: [PAL.gravelHi, PAL.gravel, PAL.gravelShade, PAL.gravelDark] },
  { cx: 1080, h: 60, ramp: [PAL.sandHi, PAL.sand, PAL.sandShade, PAL.sandDark] },
  { cx: 1310, h: 52, ramp: [PAL.sandHi, PAL.gravelHi, PAL.gravel, PAL.gravelShade] },
];
const PLANT = { x0: 1384, x1: 1466, top: TRACK_Y - 112 };
export const HOPPER_X = 1532;
const BIN_TOP = TRACK_Y - 98;
const SPOUT_Y = TRACK_Y - 66;

interface Belt { x0: number; y0: number; x1: number; y1: number }
/** Taśma zasilająca: z wyrobiska na szczyt sortowni. */
const FEED: Belt = { x0: 985, y0: TRACK_Y - BENCH.h - 3, x1: PLANT.x0 + 4, y1: PLANT.top + 2 };
/** Taśmy odkładcze z sortowni na szczyty hałd. */
const STACKERS: Belt[] = PILES.map((p, i) => ({ x0: PLANT.x0, y0: PLANT.top + 22 + i * 7, x1: p.cx, y1: TRACK_Y - p.h - 8 }));
/** Taśma z sortowni do leja nad torem. */
const LOADER: Belt = { x0: PLANT.x1 - 4, y0: PLANT.top + 44, x1: HOPPER_X - 14, y1: BIN_TOP - 4 };

/** Profil skarpy: stromy początek, płaski grzbiet, łagodne zejście przy leju. */
function ridgeTop(x: number): number {
  if (x < PIT_FROM) return TRACK_Y;
  const up = Math.min(1, (x - PIT_FROM) / 60);
  const down = x > 1490 ? Math.max(0, 1 - (x - 1490) / 80) : 1;
  const wob = Math.sin(x * 0.03) * 3 + Math.sin(x * 0.011 + 1) * 4;
  const h = x >= BENCH.x0 && x < BENCH.x1 ? BENCH.h : RIDGE_H + wob;
  return Math.round(TRACK_Y - h * Math.min(up, down));
}

function drawRidge(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  for (let x = PIT_FROM; x < WIDTH; x++) {
    const top = ridgeTop(x);
    if (top >= TRACK_Y - 1) continue;
    // ściana piasku: jasne i ciemniejsze warstwy osadów
    for (let y = top; y < TRACK_Y; y++) {
      const d = y - top;
      const band = Math.floor((y + Math.sin(x * 0.02) * 3) / 7) % 4;
      let c: string = band === 1 ? PAL.sandShade : band === 3 ? PAL.sandHi : PAL.sand;
      if (d < 2) c = PAL.grassMid; // darń na krawędzi
      else if (d < 4) c = PAL.sandDark;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
    // żłobienia erozyjne spływające po ścianie
    if (rnd() < 0.05) {
      const len = 6 + Math.floor(rnd() * 20);
      rect(ctx, x, top + 4, 1, len, PAL.sandShade);
      rect(ctx, x + 1, top + 4, 1, Math.floor(len * 0.7), PAL.sandHi);
    }
    if (rnd() < 0.12) rect(ctx, x, top + 4 + Math.floor(rnd() * (TRACK_Y - top - 4)), 1, 1, PAL.gravelShade); // kamyki
  }
  // podlaskie sosny na grzbiecie
  for (let x = PIT_FROM + 30; x < 1500; x += 16 + Math.floor(rnd() * 22)) {
    if (x > BENCH.x0 - 8 && x < BENCH.x1 + 8) continue;
    plantBackItem(ctx, x, rnd() < 0.75 ? 'pine' : 'tree', rnd, ridgeTop(x) - TRACK_Y + 3);
  }
}

function drawPond(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  const { x0, x1, y } = POND;
  // piaszczysty brzeg i lustro wody
  rect(ctx, x0 - 8, y - 2, x1 - x0 + 16, 12, PAL.sandHi);
  for (let r = 0; r < 8; r++) {
    const ins = Math.max(0, 6 - r * 2) + Math.max(0, r - 5) * 3;
    rect(ctx, x0 + ins, y + r, x1 - x0 - 2 * ins, 1, r < 2 ? PAL.waterHi : r < 5 ? PAL.water : PAL.waterShade);
  }
  // odbicie skarpy i refleksy
  for (let x = x0 + 8; x < x1 - 8; x += 3 + Math.floor(rnd() * 6)) rect(ctx, x, y + 2 + Math.floor(rnd() * 4), 2 + Math.floor(rnd() * 3), 1, PAL.waterHi);
  // trzcina przy brzegu
  for (let x = x0 - 6; x < x0 + 10; x += 2) rect(ctx, x, y - 4 - (x % 3), 1, 5, PAL.grassMid);
  for (let x = x1 - 10; x < x1 + 6; x += 2) rect(ctx, x, y - 3 - (x % 4), 1, 4, PAL.grassDark);
}

/** Koparka gąsienicowa z łyżką wbitą w piaszczystą ścianę. */
function drawExcavator(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // gąsienice
  rect(ctx, x - 2, y - 5, 26, 5, PAL.machineDark);
  for (let i = 0; i < 26; i += 3) rect(ctx, x - 2 + i, y - 5, 1, 1, PAL.gravelShade);
  // nadwozie z kabiną (żółte)
  rect(ctx, x, y - 14, 22, 9, PAL.machine);
  rect(ctx, x, y - 6, 22, 1, PAL.machineShade);
  rect(ctx, x + 2, y - 21, 9, 8, PAL.machine);
  rect(ctx, x + 3, y - 20, 7, 4, PAL.glass);
  rect(ctx, x + 3, y - 20, 7, 1, PAL.glassHi);
  rect(ctx, x + 16, y - 17, 3, 4, PAL.machineDark); // wydech
  // wysięgnik i ramię w stronę skarpy (w lewo)
  line(ctx, x + 4, y - 14, x - 18, y - 32, PAL.machineShade);
  line(ctx, x + 5, y - 14, x - 17, y - 32, PAL.machine);
  line(ctx, x - 18, y - 32, x - 30, y - 14, PAL.machineShade);
  line(ctx, x - 17, y - 32, x - 29, y - 14, PAL.machine);
  // łyżka z piaskiem
  rect(ctx, x - 36, y - 14, 8, 6, PAL.machineDark);
  rect(ctx, x - 35, y - 15, 6, 2, PAL.sand);
}

function drawPile(ctx: CanvasRenderingContext2D, cx: number, h: number, ramp: string[], rnd: () => number): void {
  // stożek usypowy (kąt naturalny), światło z lewej
  for (let dy = 0; dy < h; dy++) {
    const half = Math.round((h - dy) * 1.5);
    const y = TRACK_Y - 3 - dy;
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - cx) / Math.max(1, half);
      let i = u < -0.45 ? 0 : u < 0.15 ? 1 : u < 0.7 ? 2 : 3;
      if (rnd() < 0.18) i = Math.min(3, Math.max(0, i + (rnd() < 0.5 ? -1 : 1))); // ziarno
      ctx.fillStyle = ramp[i];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawBelt(ctx: CanvasRenderingContext2D, b: Belt, legEvery = 26, legsTo = TRACK_Y - 3): void {
  line(ctx, b.x0, b.y0 + 1, b.x1, b.y1 + 1, PAL.conveyorBelt);
  line(ctx, b.x0, b.y0, b.x1, b.y1, PAL.conveyor);
  const n = Math.floor(Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / legEvery);
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const x = Math.round(b.x0 + (b.x1 - b.x0) * u);
    const y = Math.round(b.y0 + (b.y1 - b.y0) * u) + 2;
    if (y < legsTo) rect(ctx, x, y, 1, legsTo - y, PAL.plantShade);
  }
}

/** Sortownia: stalowa konstrukcja z trzema pochylonymi pokładami sit i lejem zasypowym. */
function drawPlant(ctx: CanvasRenderingContext2D): void {
  const { x0, x1, top } = PLANT;
  // nogi i stężenia
  for (const lx of [x0 + 4, x0 + 30, x0 + 56, x1 - 6]) rect(ctx, lx, top + 20, 3, TRACK_Y - 3 - top - 20, PAL.plantShade);
  for (let y = top + 34; y < TRACK_Y - 6; y += 16) {
    rect(ctx, x0 + 4, y, x1 - x0 - 8, 1, PAL.plantShade);
    line(ctx, x0 + 6, y, x0 + 30, y + 15, PAL.plantShade);
    line(ctx, x0 + 56, y, x0 + 32, y + 15, PAL.plantShade);
  }
  // kosz zasypowy na górze
  for (let r = 0; r < 12; r++) rect(ctx, x0 + 2 + (r >> 1), top + r, 26 - r, 1, r === 0 ? PAL.machine : PAL.machineShade);
  // korpus przesiewacza
  rect(ctx, x0, top + 12, x1 - x0, 26, PAL.plant);
  rect(ctx, x0, top + 12, x1 - x0, 1, PAL.plantHi);
  // trzy pokłady sit (pochylone, żółte ramy, siatka)
  for (let d = 0; d < 3; d++) {
    const y = top + 16 + d * 7;
    line(ctx, x0 + 4, y, x1 - 6, y + 4, PAL.machine);
    for (let x = x0 + 6; x < x1 - 8; x += 3) rect(ctx, x, y + 1 + Math.round(((x - x0) / (x1 - x0)) * 4), 1, 1, PAL.machineDark);
  }
  // podest z barierką i kabina operatora
  rect(ctx, x0 - 4, top + 38, x1 - x0 + 8, 2, PAL.plantDark);
  for (let x = x0 - 4; x < x1 + 4; x += 4) rect(ctx, x, top + 34, 1, 4, PAL.machine);
  rect(ctx, x0 - 4, top + 34, x1 - x0 + 8, 1, PAL.machine);
  rect(ctx, x1 - 18, top + 40, 14, 10, PAL.stucco);
  rect(ctx, x1 - 16, top + 42, 10, 4, PAL.glass);
}

/** Lej załadowczy JAXAN nad torem (magenta + zielony pas), na bramie. */
function drawHopper(ctx: CanvasRenderingContext2D): void {
  const x = HOPPER_X;
  for (const lx of [x - 25, x + 22]) rect(ctx, lx, BIN_TOP + 4, 3, TRACK_Y + 9 - BIN_TOP - 4, PAL.plantDark);
  rect(ctx, x - 25, BIN_TOP + 4, 50, 2, PAL.plantDark);
  // zbiornik: prostokąt + zwężenie
  rect(ctx, x - 20, BIN_TOP, 40, 18, PAL.locoMagenta);
  rect(ctx, x - 20, BIN_TOP, 40, 1, PAL.locoMagentaHi);
  rect(ctx, x + 17, BIN_TOP, 3, 18, PAL.locoMagentaShade);
  rect(ctx, x - 20, BIN_TOP + 14, 40, 2, PAL.jaxanGreen);
  drawText(ctx, 'JAXAN', x - (textWidth('JAXAN') >> 1), BIN_TOP + 6, PAL.white);
  for (let r = 0; r < 10; r++) rect(ctx, x - 20 + r * 2, BIN_TOP + 18 + r, 40 - r * 4, 1, r < 1 ? PAL.locoMagentaShade : PAL.locoMagenta);
  rect(ctx, x - 3, SPOUT_Y - 4, 6, 4, PAL.plantDark); // zsyp
}

function drawBuilding(ctx: CanvasRenderingContext2D): void {
  rect(ctx, B0, B_TOP, B1 - B0, PLATFORM_TOP - B_TOP, PAL.stucco);
  rect(ctx, B1 - 3, B_TOP, 3, PLATFORM_TOP - B_TOP, PAL.stuccoShade);
  rect(ctx, B0, PLATFORM_TOP - 8, B1 - B0, 8, PAL.stuccoShade); // cokół
  // dach dwuspadowy z czerwonej dachówki + lukarna
  for (let y = 0; y < 14; y++) rect(ctx, B0 - 4 + y, B_TOP - 1 - y, B1 - B0 + 8 - 2 * y, 1, y === 0 ? PAL.roofRedHi : y % 3 === 0 ? PAL.roofRedHi : PAL.roofRed);
  const mid = (B0 + B1) >> 1;
  rect(ctx, mid - 8, B_TOP - 20, 16, 10, PAL.stucco);
  for (let y = 0; y < 8; y++) rect(ctx, mid - 10 + y, B_TOP - 21 - y, 20 - 2 * y, 1, PAL.roofRed);
  rect(ctx, mid - 3, B_TOP - 18, 6, 6, PAL.windowDay);
  rect(ctx, B0 + 18, B_TOP - 18, 4, 8, PAL.brickShade); // komin
  // nazwa na elewacji
  drawText(ctx, SOKOLKA, mid - (textWidth(SOKOLKA) >> 1), B_TOP + 4, PAL.roof);
  // okna z łukowym nadprożem i drzwi
  for (const w of WINDOWS) {
    rect(ctx, w.x - 1, w.y - 2, 8, 15, PAL.stuccoShade);
    rect(ctx, w.x, w.y, 6, 12, PAL.windowDay);
    rect(ctx, w.x + 1, w.y - 1, 4, 1, PAL.windowDay);
    rect(ctx, w.x + 3, w.y, 1, 12, PAL.stucco);
  }
  rect(ctx, mid - 6, TRACK_Y - 26, 12, 21, PAL.stuccoShade);
  rect(ctx, mid - 5, TRACK_Y - 25, 10, 20, PAL.trunk);
}

export const sokolka: SegmentDef = {
  id: 'sokolka',
  kind: 'landmark',
  width: WIDTH,
  weight: 0,
  signals: true,
  hopperX: HOPPER_X,
  mapIcon: 'gravel',
  mapLabel: SOKOLKA,
  mapAnchor: (B0 + B1) >> 1,
  render({ back, bed, front }, seed) {
    const rnd = mulberry32(seed);
    // stacja
    for (let x = 6; x < 290; x += 14 + Math.floor(rnd() * 14)) plantBackItem(back, x, rnd() < 0.6 ? 'pine' : 'tree', rnd, -4);
    for (let x = 446; x < 680; x += 16 + Math.floor(rnd() * 14)) plantBackItem(back, x, rnd() < 0.5 ? 'tree' : 'pine', rnd, -4);
    drawBuilding(back);
    drawPlatform(back, 20, 660, LAMPS, rnd);
    drawNameBoard(back, SOKOLKA, 60);
    // żwirownia
    drawRidge(back, rnd);
    drawPond(back, rnd);
    drawExcavator(back, 930, TRACK_Y - BENCH.h);
    drawBelt(back, FEED);
    for (const p of PILES) drawPile(back, p.cx, p.h, p.ramp, rnd);
    for (const s of STACKERS) drawBelt(back, s, 70); // taśmy odkładcze – rzadkie podpory
    drawPlant(back);
    drawBelt(back, LOADER);
    drawHopper(back);
    // tablica wjazdowa żwirowni
    const label = 'ŻWIROWNIA JAXAN';
    const tw = textWidth(label);
    rect(back, 700, TRACK_Y - 36, tw + 6, 11, PAL.jaxanGreenShade);
    rect(back, 700, TRACK_Y - 36, tw + 6, 1, PAL.jaxanGreen);
    drawText(back, label, 703, TRACK_Y - 33, PAL.white);
    rect(back, 702, TRACK_Y - 25, 1, 25, PAL.plantDark);
    rect(back, 703 + tw, TRACK_Y - 25, 1, 25, PAL.plantDark);
    drawBackStrip(back, 0, 20, rnd);
    drawBackStrip(back, 660, WIDTH, rnd);
    drawGround(bed, 0, WIDTH, rnd);
    scatterBushes(bed, 0, WIDTH, 44, rnd);
    // przednie nogi bramy leja – przed pociągiem (głębia)
    for (const lx of [HOPPER_X - 25, HOPPER_X + 22]) {
      rect(front, lx, BIN_TOP + 26, 3, TRACK_Y + 9 - BIN_TOP - 26, PAL.plantDark);
      rect(front, lx, BIN_TOP + 26, 1, TRACK_Y + 9 - BIN_TOP - 26, PAL.plantShade);
    }
  },

  animate(ctx, x, env) {
    const t = env.time;
    // kruszywo jadące taśmami (taśma do leja – ciemniejsze, sortowane)
    for (const [b, c] of [[FEED, PAL.sandHi], [LOADER, PAL.gravelHi], ...STACKERS.map((s, i) => [s, PILES[i].ramp[1]] as const)] as const) {
      for (let k = 0; k < 10; k++) {
        const u = (t * 0.22 + k / 10) % 1;
        rect(ctx, Math.round(x + b.x0 + (b.x1 - b.x0) * u), Math.round(b.y0 + (b.y1 - b.y0) * u) - 1, 2, 1, c);
      }
    }
    // strumienie sypiące się z głowic taśm odkładczych na hałdy
    STACKERS.forEach((s, i) => {
      for (let k = 0; k < 5; k++) {
        const u = (t * 1.8 + k / 5 + i * 0.3) % 1;
        rect(ctx, x + s.x1 + Math.round(Math.sin(k * 2.3) * 1.2), Math.round(s.y1 + 2 + u * 5), 1, 2, PILES[i].ramp[k % 2]);
      }
    });
    // drgające sita przesiewacza (1 px w rytmie)
    const j = Math.floor(t * 14) % 2;
    for (let d = 0; d < 3; d++) {
      const y = PLANT.top + 16 + d * 7 + j;
      for (let xx = PLANT.x0 + 8; xx < PLANT.x1 - 10; xx += 7) rect(ctx, x + xx, y + Math.round(((xx - PLANT.x0) / (PLANT.x1 - PLANT.x0)) * 4), 2, 1, PAL.gravelHi);
    }
  },

  lights(ctx, x, env) {
    if (env.night <= 0) return;
    const a = Math.min(1, env.night * 1.5);
    ctx.globalAlpha = a;
    WINDOWS.forEach((w, i) => {
      if (i % 3 === 1) return;
      rect(ctx, x + w.x, w.y, 6, 12, PAL.windowLit);
      rect(ctx, x + w.x + 3, w.y, 1, 12, PAL.stucco);
    });
    for (const [lx, ly] of [[HOPPER_X - 21, BIN_TOP - 3], [HOPPER_X + 21, BIN_TOP - 3], [PLANT.x0 - 2, PLANT.top + 31], [PLANT.x1 + 2, PLANT.top + 31]]) {
      ctx.globalAlpha = a * 0.35;
      disc(ctx, x + lx, ly, 5, PAL.lampGlow);
      ctx.globalAlpha = a;
      disc(ctx, x + lx, ly, 1, PAL.headlight);
    }
    ctx.globalAlpha = 1;
    drawLampLights(ctx, x, LAMPS, env.night);
  },
};
