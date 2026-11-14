// Zakład przemysłowy za torem (jak na styl.jpg): kominy z dymem, zbiorniki,
// hale z oknami świecącymi w nocy, rurociągi. Układ liczony z seeda – ten sam
// dla renderu, świateł i dymu, bez przechowywania stanu.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { rect } from '../../engine/sprite';
import type { SegmentDef, SegmentEnv } from './types';
import { disc, drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';

const WIDTH = 560;
const BASE = TRACK_Y + 2;

type Kind = 'chimney' | 'tank' | 'hall';
interface Part { kind: Kind; x: number; w: number; h: number }
interface Layout { parts: Part[]; windows: { x: number; y: number }[]; chimneys: { x: number; top: number }[] }

export function plantLayout(seed: number): Layout {
  const rnd = mulberry32(seed ^ 0x5eed);
  const parts: Part[] = [];
  const windows: Layout['windows'] = [];
  const chimneys: Layout['chimneys'] = [];
  let x = 60 + Math.floor(rnd() * 30);
  const end = WIDTH - 70;
  while (x < end) {
    const r = rnd();
    const kind: Kind = r < 0.3 ? 'chimney' : r < 0.65 ? 'tank' : 'hall';
    const w = kind === 'chimney' ? 9 + Math.floor(rnd() * 3) : kind === 'tank' ? 26 + Math.floor(rnd() * 16) : 44 + Math.floor(rnd() * 30);
    const h = kind === 'chimney' ? 115 + Math.floor(rnd() * 35) : kind === 'tank' ? 55 + Math.floor(rnd() * 40) : 30 + Math.floor(rnd() * 26);
    if (x + w > end) break;
    parts.push({ kind, x, w, h });
    if (kind === 'chimney') chimneys.push({ x: x + (w >> 1), top: BASE - h });
    if (kind === 'hall') {
      for (let wy = BASE - h + 8; wy < BASE - 8; wy += 9) {
        for (let wx = x + 4; wx < x + w - 5; wx += 7) windows.push({ x: wx, y: wy });
      }
    }
    if (kind === 'tank') {
      for (let wy = BASE - h + 14; wy < BASE - 10; wy += 16) windows.push({ x: x + (w >> 1) - 1, y: wy });
    }
    x += w + 2 + Math.floor(rnd() * 10);
  }
  return { parts, windows, chimneys };
}

/** Pionowe cieniowanie walca (światło z lewej). */
function cylinderColor(i: number, w: number): string {
  const t = i / Math.max(1, w - 1);
  return t < 0.2 ? PAL.plantHi : t < 0.62 ? PAL.plant : t < 0.85 ? PAL.plantShade : PAL.plantDark;
}

function drawPart(ctx: CanvasRenderingContext2D, p: Part): void {
  const top = BASE - p.h;
  if (p.kind === 'hall') {
    rect(ctx, p.x, top, p.w, p.h, PAL.plantShade);
    rect(ctx, p.x, top, p.w, 2, PAL.plantHi);
    rect(ctx, p.x + p.w - 3, top, 3, p.h, PAL.plantDark);
    // dachowe rury i wentylatory
    rect(ctx, p.x + 6, top - 5, 3, 5, PAL.plant);
    rect(ctx, p.x + 5, top - 6, 5, 1, PAL.plantHi);
    rect(ctx, p.x + p.w - 14, top - 3, 8, 3, PAL.plant);
    return;
  }
  for (let i = 0; i < p.w; i++) rect(ctx, p.x + i, top, 1, p.h, cylinderColor(i, p.w));
  if (p.kind === 'tank') {
    // kopuła, pierścienie, balustrada na górze, drabina
    for (let i = 0; i < p.w; i++) {
      const u = (i / (p.w - 1)) * 2 - 1;
      const dome = Math.round(4 * Math.sqrt(1 - u * u));
      rect(ctx, p.x + i, top - dome, 1, dome, cylinderColor(i, p.w));
    }
    for (let y = top + 10; y < BASE; y += 12) rect(ctx, p.x, y, p.w, 1, PAL.plantDark);
    rect(ctx, p.x - 1, top - 8, p.w + 2, 1, PAL.plantDark);
    for (let i = 0; i <= p.w; i += 4) rect(ctx, p.x - 1 + i, top - 8, 1, 4, PAL.plantDark);
    rect(ctx, p.x + p.w + 1, top - 8, 1, p.h + 8, PAL.plantDark);
    for (let y = top - 6; y < BASE; y += 3) rect(ctx, p.x + p.w + 1, y, 3, 1, PAL.plantDark);
    rect(ctx, p.x + p.w + 3, top - 8, 1, p.h + 8, PAL.plantDark);
  } else {
    // komin: pierścienie, rdzawa czapa, drabinka
    for (let y = top + 8; y < BASE; y += 14) rect(ctx, p.x, y, p.w, 1, PAL.plantDark);
    rect(ctx, p.x - 1, top, p.w + 2, 3, PAL.rust);
    rect(ctx, p.x - 1, top, p.w + 2, 1, PAL.plantDark);
    for (let y = top + 4; y < BASE; y += 3) rect(ctx, p.x + 1, y, 2, 1, PAL.plantDark);
  }
}

export const plant: SegmentDef = {
  id: 'plant',
  kind: 'filler',
  width: WIDTH,
  weight: 1.5,
  mapIcon: 'plant',
  mapLabel: 'ZAKŁAD',
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    const L = plantLayout(seed);
    // rurociąg łączący obiekty
    const pipeY = BASE - 26 - Math.floor(rnd() * 10);
    if (L.parts.length > 1) {
      const a = L.parts[0].x;
      const b = L.parts[L.parts.length - 1].x + L.parts[L.parts.length - 1].w;
      rect(back, a, pipeY, b - a, 3, PAL.rust);
      rect(back, a, pipeY, b - a, 1, PAL.plantHi);
      for (let x = a + 10; x < b; x += 24) rect(back, x, pipeY + 3, 2, BASE - pipeY - 3, PAL.plantDark);
    }
    // od najwyższych (z tyłu) do najniższych
    for (const p of [...L.parts].sort((m, n) => n.h - m.h)) drawPart(back, p);
    for (const w of L.windows) rect(back, w.x, w.y, 3, 4, PAL.windowDay);
    // ogrodzenie i trochę zieleni przy torze
    for (let x = 0; x < WIDTH; x += 5) rect(back, x, BASE - 6, 1, 6, PAL.plantDark);
    rect(back, 0, BASE - 6, WIDTH, 1, PAL.plantDark);
    for (let x = 12; x < WIDTH; x += 50 + Math.floor(rnd() * 60)) plantBackItem(back, x, 'bush', rnd, 3);
    drawBackStrip(back, 0, WIDTH, rnd);
    drawGround(bed, 0, WIDTH, rnd);
    scatterBushes(bed, 0, WIDTH, 28, rnd);
  },

  animate(ctx, x, env: SegmentEnv, seed) {
    // dym z kominów: kłęby liczone z czasu (bez cząsteczek w pamięci)
    const L = plantLayout(seed);
    L.chimneys.forEach((c, ci) => {
      const N = 9;
      for (let k = N - 1; k >= 0; k--) {
        const p = (env.time * 0.08 + k / N + ci * 0.37) % 1;
        const px = x + c.x - p * 70 + Math.sin(p * 6 + ci) * 3;
        const py = c.top - 3 - p * 70;
        const r = 3 + p * 11;
        disc(ctx, px, py, r, p < 0.3 ? PAL.smokeDark : PAL.smoke);
        disc(ctx, px - r * 0.3, py - r * 0.3, r * 0.5, p < 0.3 ? PAL.smoke : PAL.smokeHi);
      }
    });
  },

  lights(ctx, x, env, seed) {
    if (env.night <= 0) return;
    const L = plantLayout(seed);
    ctx.globalAlpha = Math.min(1, env.night * 1.5);
    for (const w of L.windows) {
      // część okien zgaszona (stała dla okna)
      if (((w.x * 7 + w.y * 13) % 5) === 0) continue;
      rect(ctx, x + w.x, w.y, 3, 4, PAL.windowLit);
      rect(ctx, x + w.x, w.y, 3, 1, PAL.windowGlow);
    }
    ctx.globalAlpha = 1;
  },
};
