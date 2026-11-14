// Odcinek ŁANY PÓL: na pierwszym planie złote zboże falujące na wietrze (kilka odcieni,
// jasne kłosy), w średnim planie pola w pasy – zboże, żółty rzepak, zielone, ściernisko
// z belami siana – pojedyncze drzewa na miedzach, czasem kombajn w pracy.
// Na brzegach segmentu miedza z drzewami: kolejne odcinki pól łączą się naturalnie.
import { H, TRACK_Y, W } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { cached, makeSprite, rect } from '../../engine/sprite';
import type { SegmentDef } from './types';
import { GROUND_Y, drawBackStrip, drawGround, plantBackItem } from './common';
import { bayer, paint } from '../../engine/pixbuf';
import { drawFoliage } from '../../sprites/blob';
import { getPoplar, getWillow, getShrine, POPLAR_VARIANTS, WILLOW_VARIANTS } from '../../sprites/village';

const HEDGE = [PAL.foliageGlint, PAL.foliageHi, PAL.foliageMid, PAL.foliage, PAL.foliageShade, PAL.foliageDeep] as const;

const WIDTH = 640;
/** Szerokość trawiastej miedzy na brzegach segmentu. */
const EDGE = 14;
const MID_TOP = TRACK_Y - 30;
/** Skos miedzy: bliżej widza pole zwęża się (perspektywa), miedza między łanami rośnie. */
const SLANT = 0.3;
const edgeL = (y: number) => EDGE + Math.round(Math.max(0, y - GROUND_Y) * SLANT);
const edgeR = (y: number) => WIDTH - edgeL(y);

type Crop = 'wheat' | 'rapeseed' | 'green' | 'stubble';
const CROP: Record<Crop, [string, string, string]> = {
  wheat: [PAL.wheatHi, PAL.wheat, PAL.wheatShade],
  rapeseed: [PAL.rapeseed, PAL.rapeseed, PAL.rapeseedShade],
  green: [PAL.fieldGreen, PAL.fieldGreen, PAL.fieldGreenShade],
  stubble: [PAL.stubble, PAL.stubble, PAL.stubbleShade],
};

interface Plot { x0: number; x1: number; crop: Crop }
interface Stripe { y0: number; y1: number; plots: Plot[] }
interface Layout { stripes: Stripe[]; combine: { stripe: number; speed: number; phase: number } | null }

/** Układ pól średniego planu – deterministyczny z seeda (render i animate liczą to samo). */
function layout(seed: number): Layout {
  const rnd = mulberry32(seed ^ 0x51e1d);
  const heights = [3, 4, 5, 7, 9]; // dalej = cieńsze (perspektywa)
  const stripes: Stripe[] = [];
  let y = MID_TOP;
  const crops: Crop[] = ['wheat', 'rapeseed', 'green', 'stubble', 'wheat', 'wheat'];
  for (const h of heights) {
    const plots: Plot[] = [];
    let x = 0;
    while (x < WIDTH) {
      const w = 140 + Math.floor(rnd() * 320);
      plots.push({ x0: x, x1: Math.min(WIDTH, x + w), crop: crops[Math.floor(rnd() * crops.length)] });
      x += w;
    }
    stripes.push({ y0: y, y1: y + h, plots });
    y += h;
  }
  let combine: Layout['combine'] = null;
  if (rnd() < 0.45) {
    // kombajn kosi pas zboża przedostatni od dołu
    const s = stripes[3];
    s.plots = [{ x0: 0, x1: WIDTH, crop: 'wheat' }];
    combine = { stripe: 3, speed: 5 + rnd() * 4, phase: rnd() * WIDTH };
  }
  return { stripes, combine };
}

const layoutCache = new Map<number, Layout>();
function getLayout(seed: number): Layout {
  let l = layoutCache.get(seed);
  if (!l) {
    if (layoutCache.size > 32) layoutCache.clear(); // pamięć stała
    l = layout(seed);
    layoutCache.set(seed, l);
  }
  return l;
}

function drawMidFields(ctx: CanvasRenderingContext2D, l: Layout, rnd: () => number): void {
  for (const s of l.stripes) {
    for (const p of s.plots) {
      const [hi, base, shade] = CROP[p.crop];
      // styl2: bruzdy (rzędy upraw) z ditheringiem zamiast twardych pasów; łagodna
      // fala jasności wzdłuż pola – światło ślizga się po łanie
      const ph = rnd() * 6.28;
      paint(ctx, p.x0, s.y0, p.x1 - p.x0, s.y1 - s.y0, (x, y) => {
        const furrow = (y - s.y0) % 2 === 1;
        const glow = 0.5 + 0.5 * Math.sin(x * 0.021 + ph) * Math.sin(x * 0.007 + y * 0.3);
        if (y === s.y0) return glow > 0.35 || bayer(x, y) < 0.5 ? hi : base;
        if (furrow) return bayer(x, y) < 0.75 ? shade : base;
        if (glow > 0.72 && bayer(x, y) < (glow - 0.72) * 3) return hi;
        return base;
      });
      if (p.crop === 'rapeseed') {
        for (let k = 0; k < (p.x1 - p.x0) / 3; k++) rect(ctx, p.x0 + Math.floor(rnd() * (p.x1 - p.x0)), s.y0 + Math.floor(rnd() * (s.y1 - s.y0)), 1, 1, PAL.wheatEar);
      }
      // bele siana na ściernisku (okrągłe, z boku)
      if (p.crop === 'stubble' && s.y1 - s.y0 >= 5) {
        for (let bx = p.x0 + 10 + Math.floor(rnd() * 20); bx < p.x1 - 8; bx += 18 + Math.floor(rnd() * 40)) {
          const by = s.y1 - 1;
          rect(ctx, bx, by - 3, 4, 3, PAL.hay);
          rect(ctx, bx + 1, by - 4, 2, 1, PAL.hay);
          rect(ctx, bx + 3, by - 3, 1, 3, PAL.hayShade);
          rect(ctx, bx + 1, by - 2, 1, 1, PAL.hayShade);
        }
      }
      // miedza między działkami
      if (p.x0 > 0) rect(ctx, p.x0, s.y0, 1, s.y1 - s.y0, PAL.grassMid);
    }
    // miedza wzdłuż pasa (przerywana)
    for (let x = 0; x < WIDTH; x++) if (rnd() < 0.55) rect(ctx, x, s.y1 - 1, 1, 1, PAL.grassMid);
  }
  // górna krawędź pól: żywopłot z pojedynczych koron (rim light od słońca)
  for (let x = 0; x < WIDTH; x++) rect(ctx, x, MID_TOP - 2, 1, 2, PAL.foliageShade);
  for (let x = 4; x < WIDTH - 4; x += 5 + Math.floor(rnd() * 6)) {
    const r = Math.sin(x * 0.05) > 0.6 ? 4 + rnd() * 2 : 2.5 + rnd() * 1.5;
    drawFoliage(ctx, x, MID_TOP - r * 0.6, r * 1.1, r, HEDGE, rnd, [1.2, 2], 1.9);
  }
}

// --- falujące zboże pierwszego planu ---
interface Band { y0: number; y1: number; stalk: number; lean: number; step: number; row: number }
const BANDS: Band[] = [
  { y0: GROUND_Y, y1: GROUND_Y + 28, stalk: 5, lean: 1, step: 1, row: 3 },
  { y0: GROUND_Y + 28, y1: GROUND_Y + 66, stalk: 9, lean: 1.5, step: 2, row: 4 },
  { y0: GROUND_Y + 66, y1: H + 4, stalk: 15, lean: 2.5, step: 2, row: 6 },
];
const TILE = 64;
const CHUNK = 8;
const FRAMES = 4;

/** Kafle zboża: [pas][klatka wychylenia] – rysowane raz. */
function wheatTiles(): HTMLCanvasElement[][] {
  return cached('wheat-tiles', () =>
    BANDS.map((b, bi) => {
      const th = b.y1 - b.y0 + b.stalk;
      return Array.from({ length: FRAMES }, (_, f) =>
        makeSprite(TILE, th, (ctx) => {
          const rnd = mulberry32(900 + bi); // te same źdźbła w każdej klatce
          const sway = (f - 1) * b.lean; // -1..2 × wychylenie pasa
          for (let yb = b.stalk + 1; yb < th; yb += b.row) {
            for (let x = 0; x < TILE; x += b.step) {
              if (rnd() < 0.25) continue;
              const h = Math.round(b.stalk * (0.65 + rnd() * 0.45));
              const lean = sway * (0.75 + rnd() * 0.5);
              const tone = rnd();
              for (let j = 0; j < h; j++) {
                const u = j / h; // 0 = nasada, 1 = czubek
                const px = (x + Math.round(lean * u * u) + TILE) % TILE;
                const c = u > 0.72 ? (tone < 0.35 ? PAL.wheatEar : PAL.wheatHi)
                  : u > 0.4 ? (tone < 0.5 ? PAL.wheat : PAL.wheatHi)
                  : tone < 0.5 ? PAL.wheatShade : PAL.wheatDark;
                ctx.fillStyle = c;
                ctx.fillRect(px, yb - j, 1, 1);
                // kłos na bliższych pasach – 2 px szerokości
                if (b.step > 1 && u > 0.72) ctx.fillRect((px + 1) % TILE, yb - j, 1, 1);
              }
            }
          }
        }),
      );
    }),
  );
}

export const fields: SegmentDef = {
  id: 'fields',
  kind: 'filler',
  width: WIDTH,
  weight: 6,
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    const l = getLayout(seed);
    drawMidFields(back, l, rnd);
    // pojedyncze drzewa na miedzach + zadrzewione miedze na brzegach
    for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
      const s = l.stripes[1 + Math.floor(rnd() * 3)];
      plantBackItem(back, 60 + Math.floor(rnd() * (WIDTH - 120)), rnd() < 0.8 ? 'tree' : 'pine', rnd, s.y1 - TRACK_Y);
    }
    // miedze: topole w rzędzie albo wierzby głowiaste; czasem kapliczka przy drodze polnej
    const rowY = l.stripes[1].y1;
    if (rnd() < 0.6) {
      const px0 = 80 + Math.floor(rnd() * (WIDTH - 220));
      for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) {
        const s = getPoplar(Math.floor(rnd() * POPLAR_VARIANTS));
        back.drawImage(s, px0 + k * (9 + Math.floor(rnd() * 4)), rowY - s.height);
      }
    }
    const wil = getWillow(Math.floor(rnd() * WILLOW_VARIANTS));
    back.drawImage(wil, 4, TRACK_Y + 2 - wil.height);
    plantBackItem(back, WIDTH - 12, rnd() < 0.5 ? 'tree' : 'bush', rnd, 2);
    if (rnd() < 0.35) {
      const sh = getShrine();
      back.drawImage(sh, 120 + Math.floor(rnd() * (WIDTH - 240)), TRACK_Y + 1 - sh.height);
    }
    drawBackStrip(back, 0, WIDTH, rnd);

    // pierwszy plan: miedza z trawą, pod spodem złote podłoże łanu (luki między źdźbłami)
    drawGround(bed, 0, WIDTH, rnd);
    const ramp = [PAL.wheatHi, PAL.wheat, PAL.wheatShade, PAL.wheatDark, PAL.wheatDeep];
    for (let y = GROUND_Y + 2; y < H; y++) {
      const ri = Math.min(ramp.length - 1, Math.floor(((y - GROUND_Y) / (H - GROUND_Y)) * ramp.length));
      const ragL = edgeL(y) + Math.floor(rnd() * 3);
      const ragR = edgeR(y) - Math.floor(rnd() * 3);
      rect(bed, ragL, y, ragR - ragL, 1, ramp[ri]);
      for (let x = ragL; x < ragR; x += 2 + Math.floor(rnd() * 4)) rect(bed, x, y, 1, 1, ramp[Math.min(ramp.length - 1, ri + 1)]);
    }
  },

  animate(ctx, x, env, seed) {
    // kombajn w pracy: jedzie wzdłuż pasa zboża, za nim kurz i ściernisko
    const c = getLayout(seed).combine;
    if (!c) return;
    const s = getLayout(seed).stripes[c.stripe];
    const span = WIDTH - 60;
    const cx = Math.round(x + 30 + ((c.phase + env.time * c.speed) % span));
    if (cx < -30 || cx > W + 30) return;
    const y = s.y1 - 1;
    rect(ctx, x + 30, y - 1, cx - x - 30, 2, PAL.stubble); // skoszony pas
    // heder (żniwiarka) z przodu i nagarniacz
    rect(ctx, cx + 10, y - 3, 4, 3, PAL.machine);
    rect(ctx, cx + 11, y - 5, 2, 2, PAL.machineShade);
    // korpus, kabina, rura wyładowcza
    rect(ctx, cx, y - 7, 11, 6, PAL.combine);
    rect(ctx, cx, y - 7, 11, 1, PAL.combineHi);
    rect(ctx, cx + 6, y - 10, 4, 3, PAL.glass);
    rect(ctx, cx + 6, y - 10, 4, 1, PAL.combineShade);
    rect(ctx, cx - 4, y - 8, 5, 1, PAL.combineShade);
    // koła
    rect(ctx, cx + 1, y - 2, 3, 2, PAL.wheelDark);
    rect(ctx, cx + 7, y - 2, 3, 2, PAL.wheelDark);
    // kurz za kombajnem
    for (let k = 0; k < 6; k++) {
      const u = (env.time * 0.8 + k / 6) % 1;
      ctx.globalAlpha = 0.5 * (1 - u);
      rect(ctx, Math.round(cx - 3 - u * 14), Math.round(y - 6 - u * 6 + Math.sin(k * 2) * 2), 2, 2, PAL.stubble);
    }
    ctx.globalAlpha = 1;
  },

  animateBed(ctx, x, env) {
    // falujące zboże: kafle wybierane per kolumna według fali wiatru
    const x0 = Math.max(x + EDGE, 0);
    const x1 = Math.min(x + WIDTH - EDGE, W);
    if (x1 <= x0) return;
    const tiles = wheatTiles();
    const t = env.time;
    // przycięcie do trapezu łanu (skośne miedze po bokach)
    const top = GROUND_Y - 20;
    ctx.save();
    // ścieżka „schodkowa" (tylko pionowe/poziome odcinki na całych pikselach) – clip
    // ukośną linią wygładzałby krawędź, a scena ma mieć ostre piksele
    ctx.beginPath();
    ctx.moveTo(x + edgeL(top), top);
    for (let y = top; y < H; y += 2) {
      ctx.lineTo(x + edgeL(y), y);
      ctx.lineTo(x + edgeL(y), y + 2);
    }
    for (let y = H; y > top; y -= 2) {
      ctx.lineTo(x + edgeR(y - 2), y);
      ctx.lineTo(x + edgeR(y - 2), y - 2);
    }
    ctx.closePath();
    ctx.clip();
    BANDS.forEach((b, bi) => {
      const th = b.y1 - b.y0 + b.stalk;
      for (let lx = Math.floor((x0 - x) / CHUNK) * CHUNK; x + lx < x1; lx += CHUNK) {
        const wave = Math.sin(lx * 0.016 - t * 1.8 + bi * 0.7) + 0.4 * Math.sin(lx * 0.047 - t * 2.9);
        const f = Math.max(0, Math.min(FRAMES - 1, Math.round(((wave + 1.4) / 2.8) * (FRAMES - 1))));
        ctx.drawImage(tiles[bi][f], lx % TILE, 0, CHUNK, th, x + lx, b.y0 - b.stalk, CHUNK, th);
      }
    });
    ctx.restore();
  },
};
