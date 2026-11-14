// Wspólne elementy segmentów: zielony stok pod torem, pas trawy za torem, krzaki.
import { H, TRACK_Y } from '../../config';
import { PAL } from '../../palette';
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
  const RAMP: string[] = [PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep, PAL.frontDeep];
  for (let x = x0; x < x1; x++) {
    const top = topAt(x);
    if (top >= H) continue;
    for (let b = 0; b < bands.length; b++) {
      const from = Math.max(top, GROUND_Y + bands[b][0] + (b === 0 ? 0 : wave(x, b)));
      const to = b + 1 < bands.length ? GROUND_Y + bands[b + 1][0] + wave(x, b + 1) : H;
      if (to <= from) continue;
      ctx.fillStyle = bands[b][1];
      ctx.fillRect(x, from, 1, to - from);
      // tekstura: krótkie źdźbła jaśniejsze/ciemniejsze o ton
      const ri = RAMP.indexOf(bands[b][1]);
      for (let i = 0; i < (to - from) / 7; i++) {
        const y = from + Math.floor(rnd() * (to - from));
        ctx.fillStyle = RAMP[Math.max(0, Math.min(RAMP.length - 1, ri + (rnd() < 0.5 ? -1 : 1)))];
        ctx.fillRect(x, y, 1, 2);
      }
    }
    // żółtozielone refleksy na krawędzi i drobne źdźbła
    if (rnd() < 0.5) {
      ctx.fillStyle = PAL.grassHi;
      ctx.fillRect(x, top, 1, 1);
    }
    if (rnd() < 0.08) {
      ctx.fillStyle = PAL.grassHi;
      ctx.fillRect(x, top + 4 + Math.floor(rnd() * 30), 1, 2);
    }
  }
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

/** Tarcza pikselowa (bez wygładzania). */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  const R = Math.max(0, Math.round(r));
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(Math.sqrt(R * R - dy * dy));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}
