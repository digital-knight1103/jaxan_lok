// Wspólne elementy segmentów: zielony stok pod torem, pas trawy za torem, krzaki.
import { H, TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { rgba } from '../../engine/pixbuf';
import { getBush, getPine, getTree, BUSH_VARIANTS, PINE_VARIANTS, TREE_VARIANTS } from '../../sprites/nature';

/** Pierwszy wiersz gruntu pod tłuczniem. */
export const GROUND_Y = TRACK_Y + 6;

/**
 * Zielony stok pod torem w kolumnach [x0, x1). topAt(x) pozwala obniżyć grunt
 * (przyczółki mostu schodzące w dolinę).
 */
export function drawGround(
  ctx: CanvasRenderingContext2D, x0: number, x1: number, rnd: () => number,
  topAt: (x: number) => number = () => GROUND_Y,
  segW = x1,
): void {
  const bands: [number, string][] = [
    [0, PAL.grass], [3, PAL.grassMid], [24, PAL.grassDark], [62, PAL.grassDeep], [104, PAL.frontDeep],
  ];
  // falujące granice pasów; sin(π·k·x/segW) = 0 na brzegach → segmenty łączą się bez szwu
  const k1 = 1 + Math.floor(rnd() * 3);
  const k2 = 4 + Math.floor(rnd() * 5);
  const wave = (x: number, b: number) =>
    Math.round((3 + b * 2) * Math.sin((Math.PI * k1 * x) / segW + b) * Math.sin((Math.PI * x) / segW) +
      2 * Math.sin((Math.PI * k2 * x) / segW) * Math.sin((Math.PI * x) / segW));
  const RAMP: string[] = [PAL.grassGlint, PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep, PAL.frontDeep];
  const RC = RAMP.map(rgba);
  // całość na buforze pikseli (getImageData raz) – zamiast dziesiątek tysięcy fillRect
  const bx0 = Math.max(0, x0 - 1);
  const bx1 = Math.min(ctx.canvas.width, x1 + 3);
  const by0 = GROUND_Y - 8;
  const bw = bx1 - bx0;
  const bh = H - by0;
  if (bw <= 0) return;
  const img = ctx.getImageData(bx0, by0, bw, bh);
  const buf = new Uint32Array(img.data.buffer);
  const set = (x: number, y: number, c: number) => {
    const ix = x - bx0;
    const iy = y - by0;
    if (ix >= 0 && iy >= 0 && ix < bw && iy < bh) buf[iy * bw + ix] = c;
  };
  // 1. pasy kolorów; na granicach 2 wiersze ditheringu (miękkie przejście)
  const spans: { from: number; to: number; ri: number }[][] = [];
  for (let x = x0; x < x1; x++) {
    const top = topAt(x);
    const col: { from: number; to: number; ri: number }[] = [];
    spans.push(col);
    if (top >= H) continue;
    for (let b = 0; b < bands.length; b++) {
      const from = Math.max(top, GROUND_Y + bands[b][0] + (b === 0 ? 0 : wave(x, b)));
      const to = b + 1 < bands.length ? GROUND_Y + bands[b + 1][0] + wave(x, b + 1) : H;
      if (to <= from) continue;
      const ri = RAMP.indexOf(bands[b][1]);
      for (let y = from; y < to; y++) set(x, y, RC[ri]);
      if (b > 0 && from > top) {
        const prev = RC[RAMP.indexOf(bands[b - 1][1])];
        for (let y = from; y < Math.min(to, from + 3); y++) if ((x + y) % 2 === 0 && y - from < 2 + (x % 2)) set(x, y, prev);
      }
      col.push({ from, to, ri });
    }
  }
  // 2. źdźbła: skośne kreski w górę-w prawo, jaśniejsze o ton, z refleksem na
  //    czubku i cieniem u nasady – trawa „pod wiatr"
  for (let i = 0; i < spans.length; i++) {
    const x = x0 + i;
    for (const sp of spans[i]) {
      const n = Math.floor((sp.to - sp.from) / 6);
      for (let k = 0; k < n; k++) {
        const y = sp.from + 2 + Math.floor(rnd() * Math.max(1, sp.to - sp.from - 2));
        const hgt = 2 + Math.floor(rnd() * 3);
        const c = RC[Math.max(0, sp.ri - 1)];
        for (let j = 0; j < hgt; j++) set(x + (j >> 1), y - j, c);
        if (sp.ri <= 3 && rnd() < 0.35) set(x + ((hgt - 1) >> 1), y - hgt + 1, RC[Math.max(0, sp.ri - 2)]);
        set(x - 1, y + 1, RC[Math.min(RC.length - 1, sp.ri + 1)]);
      }
    }
    // żółtozielone refleksy na samej krawędzi stoku (rim light)
    const top = topAt(x);
    if (top < H && rnd() < 0.55) set(x, top, rnd() < 0.3 ? RC[0] : RC[1]);
  }
  ctx.putImageData(img, bx0, by0);
}

/** Krzaki rozsiane po stoku. */
export function scatterBushes(ctx: CanvasRenderingContext2D, x0: number, x1: number, n: number, rnd: () => number): void {
  for (let i = 0; i < n; i++) {
    const b = getBush(Math.floor(rnd() * BUSH_VARIANTS));
    const x = x0 + Math.floor(rnd() * Math.max(1, x1 - x0 - b.width));
    // częściej niżej (bliżej widza) – gęstsza zieleń u dołu kadru
    const y = GROUND_Y + 8 + Math.floor(Math.sqrt(rnd()) * (H - GROUND_Y - 4));
    ctx.drawImage(b, x, y - b.height);
  }
}

/** Pas trawy za torem (górna krawędź nasypu widoczna nad tłuczniem). */
export function drawBackStrip(ctx: CanvasRenderingContext2D, x0: number, x1: number, rnd: () => number): void {
  for (let x = x0; x < x1; x++) {
    const top = TRACK_Y - 2 - Math.floor(rnd() * 2);
    ctx.fillStyle = PAL.grassMid;
    ctx.fillRect(x, top, 1, TRACK_Y + 3 - top);
    if (rnd() < 0.4) {
      ctx.fillStyle = PAL.grass;
      ctx.fillRect(x, top - (rnd() < 0.3 ? 2 : 1), 1, 1);
    }
  }
}

/** Drzewo/choinka/krzak stojące za torem (podstawa na TRACK_Y + dy). */
export function plantBackItem(
  ctx: CanvasRenderingContext2D, x: number, kind: 'tree' | 'pine' | 'bush', rnd: () => number, dy = 2,
): number {
  const s =
    kind === 'tree' ? getTree(Math.floor(rnd() * TREE_VARIANTS))
    : kind === 'pine' ? getPine(Math.floor(rnd() * PINE_VARIANTS))
    : getBush(Math.floor(rnd() * BUSH_VARIANTS));
  ctx.drawImage(s, x - (s.width >> 1), TRACK_Y + dy - s.height);
  return s.width;
}

export { disc } from '../../engine/sprite';
