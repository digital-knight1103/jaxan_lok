// LANDMARK: kopalnia kamienia. Tarasowe ściany wyrobiska, koparka, wywrotka,
// przenośnik taśmowy sypiący kruszywo na hałdę i lej załadowczy nad torem.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { line, rect } from '../../engine/sprite';
import { ditherEdge, paint } from '../../engine/pixbuf';
import { drawText, textWidth } from '../../engine/font';
import type { SegmentDef } from './types';
import { disc, drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';

const WIDTH = 900;
const ROCK = [PAL.rockDust, PAL.rockLight, PAL.rock, PAL.rockShade, PAL.rockDark] as const;
/** x leja załadowczego nad torem (względem początku segmentu). */
export const HOPPER_X = 560;
const LEVELS = 6;
const LEVEL_H = 20;
const PIT_FROM = 40;
const PIT_TO = 860;
const STEP_IN = 40;

const PILE_X = 205;
const PILE_HALF = 58;
const PILE_H = 54;
// przenośnik 1: z dna wyrobiska na hałdę; przenośnik 2: spod hałdy do leja
const C1 = { x0: 96, y0: TRACK_Y - 6, x1: PILE_X, y1: TRACK_Y - PILE_H - 12 };
const C2 = { x0: 286, y0: TRACK_Y - 4, x1: HOPPER_X - 16, y1: TRACK_Y - 94 };
const BIN_TOP = TRACK_Y - 98;
const SPOUT_Y = TRACK_Y - 66;

function drawWall(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  for (let i = 0; i < LEVELS; i++) {
    const x0 = PIT_FROM + i * STEP_IN + Math.floor(rnd() * 6);
    const x1 = PIT_TO - i * STEP_IN - Math.floor(rnd() * 6);
    const top = TRACK_Y - LEVEL_H * (i + 1);
    // styl2: ściana tarasu w 5 tonach – jasna półka u góry, ku stopie ciemniej i chłodniej,
    // bloki skalne rozdzielone pionowymi spękaniami (lewy brzeg bloku w słońcu)
    // spękania nieregularne: losowy początek i długość, część ścian bez spękań
    const cracks: { x: number; a: number; b: number }[] = [];
    for (let x = x0 + 4; x < x1; x += 5 + Math.floor(rnd() * 14)) {
      if (rnd() < 0.35) continue;
      const a = 2 + Math.floor(rnd() * 8);
      cracks.push({ x, a, b: a + 3 + Math.floor(rnd() * 9) });
    }
    // spękanie w kolumnie x i tuż po nim (brzeg bloku w słońcu) – tablice po x
    type Crack = (typeof cracks)[number];
    const crackAt: (Crack | null)[] = new Array(x1 - x0).fill(null);
    const afterAt: (Crack | null)[] = new Array(x1 - x0).fill(null);
    for (const c of cracks) {
      if (c.x - x0 < crackAt.length) crackAt[c.x - x0] = c;
      if (c.x + 1 - x0 < afterAt.length) afterAt[c.x + 1 - x0] = c;
    }
    const strata = top + 7 + Math.floor(rnd() * 4);
    paint(ctx, x0, top, x1 - x0, LEVEL_H, (x, y) => {
      const cr = crackAt[x - x0];
      const prev = afterAt[x - x0];
      {
        const ry = y - top;
        let t = 1.2 + (ry / LEVEL_H) * 2.2 + Math.sin(x * 0.31 + y * 0.7) * 0.25;
        if (ry < 2) t = ry === 0 ? 0 : 0.8; // półka w słońcu
        else if (cr && ry >= cr.a && ry < cr.b) t = 3.6;
        else if (prev && ry >= prev.a && ry < prev.b) t -= 1; // rim light na brzegu bloku
        if (y === strata || y === strata + (Math.sin(x * 0.07 + i) > 0.6 ? 1 : 0)) t -= 0.9;
        if (ry >= LEVEL_H - 2) t = 4; // chłodny cień u stopy ściany
        return ROCK[ditherEdge(t, 5, x, y)];
      }
    });
    for (let x = x0; x < x1; x += 2) if (rnd() < 0.3) rect(ctx, x, top, 1, 1, PAL.rockDust);
    // skośne krawędzie tarasu: lewa oświetlona, prawa w cieniu
    for (let y = 0; y < LEVEL_H; y++) {
      rect(ctx, x0 - Math.floor(y / 3), top + y, 2, 1, PAL.rockLight);
      rect(ctx, x1 + Math.floor(y / 3) - 2, top + y, 2, 1, PAL.rockDark);
    }
  }
  // las na krawędzi wyrobiska
  const rim = TRACK_Y - LEVEL_H * LEVELS;
  for (let x = PIT_FROM + LEVELS * STEP_IN; x < PIT_TO - LEVELS * STEP_IN; x += 9 + Math.floor(rnd() * 12)) {
    plantBackItem(ctx, x, rnd() < 0.6 ? 'pine' : 'tree', rnd, rim - TRACK_Y + 2);
  }
}

function drawPile(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  for (let dx = -PILE_HALF; dx <= PILE_HALF; dx++) {
    const h = Math.round(PILE_H * (1 - Math.abs(dx) / PILE_HALF) + (rnd() - 0.5) * 2);
    const x = PILE_X + dx;
    const top = TRACK_Y + 2 - h;
    rect(ctx, x, top, 1, h, dx < -8 ? PAL.aggregateHi : dx < 14 ? PAL.aggregate : PAL.aggregateShade);
    if (rnd() < 0.4) rect(ctx, x, top + Math.floor(rnd() * h), 1, 1, PAL.aggregateShade);
  }
}

function drawConveyor(ctx: CanvasRenderingContext2D, c: { x0: number; y0: number; x1: number; y1: number }): void {
  line(ctx, c.x0, c.y0 + 3, c.x1, c.y1 + 3, PAL.conveyor);
  line(ctx, c.x0, c.y0, c.x1, c.y1, PAL.conveyorBelt);
  const len = Math.hypot(c.x1 - c.x0, c.y1 - c.y0);
  for (let d = 0; d < len; d += 6) {
    const u = d / len;
    const x = c.x0 + (c.x1 - c.x0) * u;
    const y = c.y0 + (c.y1 - c.y0) * u;
    line(ctx, x, y + 1, x + 3, y + 3 - 3 * ((c.y1 - c.y0) / len), PAL.conveyor);
  }
  // podpory do ziemi
  for (let d = 24; d < len - 10; d += 30) {
    const u = d / len;
    const x = Math.round(c.x0 + (c.x1 - c.x0) * u);
    const y = Math.round(c.y0 + (c.y1 - c.y0) * u);
    rect(ctx, x, y + 3, 1, TRACK_Y + 2 - y - 3, PAL.conveyor);
  }
  rect(ctx, c.x1 - 2, c.y1 - 2, 5, 5, PAL.machine); // bęben zwrotny
}

function drawExcavator(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, x - 13, y - 5, 26, 5, PAL.machineDark); // gąsienice
  for (let i = -11; i < 12; i += 4) rect(ctx, x + i, y - 3, 2, 2, PAL.conveyor);
  rect(ctx, x - 9, y - 13, 18, 8, PAL.machine);
  rect(ctx, x - 9, y - 6, 18, 1, PAL.machineShade);
  rect(ctx, x - 9, y - 20, 8, 7, PAL.machine);
  rect(ctx, x - 8, y - 19, 5, 4, PAL.glass);
  for (let k = 0; k < 2; k++) line(ctx, x + 4, y - 12 + k, x + 20, y - 30 + k, PAL.machineShade);
  line(ctx, x + 20, y - 30, x + 27, y - 12, PAL.machine);
  rect(ctx, x + 24, y - 12, 6, 5, PAL.machineDark);
}

function drawTruck(ctx: CanvasRenderingContext2D, x: number, y: number, flip: boolean): void {
  const s = flip ? -1 : 1;
  rect(ctx, x - 12, y - 11, 18, 7, PAL.machine); // skrzynia
  rect(ctx, x - 12, y - 11, 18, 1, PAL.machineShade);
  rect(ctx, x - 11, y - 12, 16, 1, PAL.aggregate); // ładunek
  rect(ctx, x + (flip ? -18 : 6), y - 12, 7, 8, PAL.machineShade); // kabina
  rect(ctx, x + (flip ? -17 : 8), y - 11, 4, 3, PAL.glass);
  rect(ctx, x - 13, y - 4, 26, 1, PAL.machineDark);
  for (const dx of [-8, 8 * s]) {
    rect(ctx, x + dx - 2, y - 4, 5, 4, PAL.wheelDark);
    rect(ctx, x + dx, y - 3, 1, 1, PAL.wheelRim);
  }
}

function drawHopperBack(ctx: CanvasRenderingContext2D): void {
  const x = HOPPER_X;
  // tylne nogi i stężenia
  for (const lx of [x - 22, x + 20]) rect(ctx, lx, BIN_TOP, 2, TRACK_Y + 2 - BIN_TOP, PAL.plantDark);
  for (let y = BIN_TOP + 30; y < TRACK_Y - 4; y += 24) line(ctx, x - 20, y, x + 20, y + 20, PAL.plantShade);
  // zasobnik (lej) zwężający się do wysypu
  for (let y = BIN_TOP; y < SPOUT_Y; y++) {
    const t = (y - BIN_TOP) / (SPOUT_Y - BIN_TOP);
    const half = t < 0.45 ? 18 : Math.round(18 - ((t - 0.45) / 0.55) * 14);
    rect(ctx, x - half, y, half * 2, 1, PAL.plant);
    rect(ctx, x - half, y, 2, 1, PAL.plantHi);
    rect(ctx, x + half - 3, y, 3, 1, PAL.plantShade);
  }
  rect(ctx, x - 19, BIN_TOP - 2, 38, 2, PAL.rust);
  rect(ctx, x - 3, SPOUT_Y, 6, 3, PAL.plantDark);
  // tabliczka JAXAN na zasobniku
  rect(ctx, x - 12, BIN_TOP + 6, 24, 7, PAL.locoMagenta);
  drawText(ctx, 'JAXAN', x - 10, BIN_TOP + 7, PAL.white);
}

export const quarry: SegmentDef = {
  id: 'quarry',
  kind: 'landmark',
  width: WIDTH,
  weight: 0,
  hopperX: HOPPER_X,
  mapIcon: 'quarry',
  mapLabel: 'KOPALNIA KRUSZYWA',
  mapAnchor: HOPPER_X,
  // generator: yield = miejsce na przerwę między klatkami (World rozkłada render w czasie)
  *render({ back, bed, front }, seed) {
    const rnd = mulberry32(seed);
    drawWall(back, rnd);
    yield;
    drawExcavator(back, 700, TRACK_Y - LEVEL_H);
    drawExcavator(back, 300, TRACK_Y - LEVEL_H * 4);
    yield;
    drawPile(back, rnd);
    yield;
    drawConveyor(back, C1);
    drawConveyor(back, C2);
    drawHopperBack(back);
    yield;
    // tablica przy wjeździe
    const label = 'KOPALNIA KRUSZYWA';
    const tw = textWidth(label);
    rect(back, 838 - tw, TRACK_Y - 34, tw + 6, 10, PAL.machine);
    rect(back, 838 - tw, TRACK_Y - 34, tw + 6, 1, PAL.machineShade);
    drawText(back, label, 841 - tw, TRACK_Y - 32, PAL.machineDark);
    rect(back, 840 - tw, TRACK_Y - 24, 1, 26, PAL.plantDark);
    rect(back, 842, TRACK_Y - 24, 1, 26, PAL.plantDark);
    drawBackStrip(back, 0, WIDTH, rnd);
    yield;
    drawGround(bed, 0, WIDTH, rnd);
    yield;
    scatterBushes(bed, 0, WIDTH, 30, rnd);
    // przednie nogi bramy leja – przed pociągiem (głębia)
    for (const lx of [HOPPER_X - 25, HOPPER_X + 22]) {
      rect(front, lx, BIN_TOP + 4, 3, TRACK_Y + 9 - BIN_TOP - 4, PAL.plantShade);
      rect(front, lx, BIN_TOP + 4, 1, TRACK_Y + 9 - BIN_TOP - 4, PAL.plantHi);
    }
    rect(front, HOPPER_X - 25, BIN_TOP + 4, 50, 2, PAL.plantShade);
  },

  animate(ctx, x, env) {
    const t = env.time;
    // kruszywo jadące taśmami
    for (const c of [C1, C2]) {
      for (let k = 0; k < 12; k++) {
        const u = (t * 0.25 + k / 12) % 1;
        rect(ctx, Math.round(x + c.x0 + (c.x1 - c.x0) * u), Math.round(c.y0 + (c.y1 - c.y0) * u) - 1, 2, 1, PAL.aggregateHi);
      }
    }
    // strumień sypiący się z głowicy przenośnika na hałdę
    for (let k = 0; k < 8; k++) {
      const u = (t * 1.6 + k / 8) % 1;
      const fy = C1.y1 + 2 + u * 14;
      rect(ctx, x + C1.x1 + 1 + Math.round(Math.sin(k * 3.1) * 1.5), Math.round(fy), 1, 2, k % 2 ? PAL.aggregate : PAL.aggregateHi);
    }
    // wywrotka kursująca po półce (tam i z powrotem)
    const p = (t * 0.05) % 2;
    const u = p < 1 ? p : 2 - p;
    drawTruck(ctx, Math.round(x + 470 + u * 200), TRACK_Y - LEVEL_H * 3, p >= 1);
  },

  lights(ctx, x, env) {
    if (env.night <= 0) return;
    ctx.globalAlpha = Math.min(1, env.night * 1.5);
    // lampy na bramie leja i na tablicy
    for (const [lx, ly] of [[HOPPER_X - 21, BIN_TOP - 3], [HOPPER_X + 21, BIN_TOP - 3], [818, TRACK_Y - 36]]) {
      disc(ctx, x + lx, ly, 2, PAL.lampGlow);
    }
    ctx.globalAlpha = 1;
  },
};
