// Wspólne elementy nowych stacji (Sokółka, Warszawa): peron z lampami, tablica z nazwą
// stacji, nocne światła lamp. Kamieniec ma własne, niezmienione rysowanie (station.ts).
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { rect, disc } from '../../engine/sprite';
import { drawText, textWidth } from '../../engine/font';

export const PLATFORM_TOP = TRACK_Y - 5;

/** Peron [x0, x1) z krawędzią ostrzegawczą, fugami i lampami. */
export function drawPlatform(ctx: CanvasRenderingContext2D, x0: number, x1: number, lamps: number[], rnd: () => number): void {
  rect(ctx, x0, PLATFORM_TOP, x1 - x0, TRACK_Y + 2 - PLATFORM_TOP, PAL.platform);
  rect(ctx, x0, PLATFORM_TOP, x1 - x0, 1, PAL.platformEdge);
  rect(ctx, x0, PLATFORM_TOP + 1, x1 - x0, 1, PAL.platformHi);
  for (let x = x0 + 4; x < x1 - 4; x += 12 + Math.floor(rnd() * 3)) rect(ctx, x, PLATFORM_TOP + 2, 1, 4, PAL.rockShade);
  for (const lx of lamps) {
    rect(ctx, lx, TRACK_Y - 58, 1, 53, PAL.pole);
    rect(ctx, lx - 2, TRACK_Y - 59, 5, 2, PAL.roof);
    rect(ctx, lx - 1, TRACK_Y - 57, 3, 1, PAL.headlightOff);
  }
}

/** Duża niebieska tablica z nazwą stacji na dwóch słupkach (nad pociągiem). */
export function drawNameBoard(ctx: CanvasRenderingContext2D, name: string, x0: number, y0 = TRACK_Y - 90): void {
  const tw = textWidth(name, 2);
  const w = tw + 10;
  const h = 18;
  rect(ctx, x0 + 10, y0 + h, 2, PLATFORM_TOP - y0 - h, PAL.pole);
  rect(ctx, x0 + w - 12, y0 + h, 2, PLATFORM_TOP - y0 - h, PAL.pole);
  rect(ctx, x0, y0, w, h, PAL.signBorder);
  rect(ctx, x0 + 1, y0 + 1, w - 2, h - 2, PAL.signBlue);
  drawText(ctx, name, x0 + 5, y0 + 5, PAL.white, 2);
}

/** Nocne światła lamp peronowych (jasny punkt + poświata). */
export function drawLampLights(ctx: CanvasRenderingContext2D, x: number, lamps: number[], night: number): void {
  if (night <= 0) return;
  const a = Math.min(1, night * 1.5);
  for (const lx of lamps) {
    ctx.globalAlpha = a * 0.35;
    disc(ctx, x + lx, TRACK_Y - 55, 6, PAL.lampGlow);
    ctx.globalAlpha = a;
    rect(ctx, x + lx - 1, TRACK_Y - 57, 3, 2, PAL.headlight);
  }
  ctx.globalAlpha = 1;
}
