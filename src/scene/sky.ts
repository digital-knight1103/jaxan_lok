// Niebo: pionowy gradient w pasach z ditheringiem Bayera na granicach (bez twardych
// schodków) + ciepła poświata wokół słońca. Gradient prerenderowany do wąskiego paska
// (4 px – okres Bayera) i kładziony wzorem; przebudowa tylko przy zmianie kolorów.
import { W, H } from '../config';
import { PAL } from '../palette';
import { lerpColor } from '../engine/color';
import { PixBuf, rgba, ditherIndex, ditherEdge } from '../engine/pixbuf';

export interface SkyColors {
  top: string;
  mid: string;
  horizon: string;
}

const BANDS = 28;

let stripKey = '';
let strip: HTMLCanvasElement | null = null;
let pattern: CanvasPattern | null = null;

function buildStrip(c: SkyColors): HTMLCanvasElement {
  const cols: number[] = [];
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1);
    cols.push(rgba(t < 0.55 ? lerpColor(c.top, c.mid, t / 0.55) : lerpColor(c.mid, c.horizon, (t - 0.55) / 0.45)));
  }
  const b = new PixBuf(4, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < 4; x++) b.set(x, y, cols[ditherIndex((y / (H - 1)) * (BANDS - 1), BANDS, x, y)]);
  }
  return b.toCanvas();
}

/** Poświata słońca: strefy o rosnącej krycia, dithering tylko na granicach stref. */
const GLOW_W = 560;
const GLOW_H = 320;
const glows = new Map<string, HTMLCanvasElement>();
function buildGlow(outer: string, mid: string, inner: string): HTMLCanvasElement {
  // kolor ze stałej palety, krycie w 6 krokach (alfa w ImageData – piksele dalej ostre)
  const ALPHA = [0, 0.16, 0.3, 0.45, 0.62, 0.8];
  const cols = [outer, outer, mid, mid, inner, inner];
  const ramp = ALPHA.map((a, i) => ((rgba(cols[i]) & 0xffffff) | (Math.round(a * 255) << 24)) >>> 0);
  const b = new PixBuf(GLOW_W, GLOW_H);
  for (let y = 0; y < GLOW_H; y++) {
    for (let x = 0; x < GLOW_W; x++) {
      const dx = (x - GLOW_W / 2) / (GLOW_W / 2);
      const dy = (y - GLOW_H / 2) / (GLOW_H / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1) continue;
      const k = Math.pow(1 - d, 1.6) * 5.2;
      const i = ditherEdge(k, ramp.length, x, y, 0.25);
      if (i > 0) b.set(x, y, ramp[i]);
    }
  }
  return b.toCanvas();
}

/**
 * Niebo od góry do `bottom`; `glowAmt` 0..1 – siła ciepłej poświaty wokół słońca
 * w punkcie (sunX, sunY).
 */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  c: SkyColors,
  bottom: number,
  sunX = W / 2,
  sunY = -999,
  glowAmt = 0,
): void {
  const key = c.top + c.mid + c.horizon;
  if (key !== stripKey || !pattern) {
    stripKey = key;
    strip = buildStrip(c);
    pattern = ctx.createPattern(strip, 'repeat');
  }
  ctx.fillStyle = pattern!;
  ctx.fillRect(0, 0, W, bottom);
  if (glowAmt > 0.01 && sunY > -GLOW_H / 2) drawGlow(ctx, 'sun', sunX, sunY, glowAmt);
}

/** Poświata ciała niebieskiego (słońce – ciepła, księżyc – chłodna), sprite'y cache'owane. */
export function drawGlow(ctx: CanvasRenderingContext2D, kind: 'sun' | 'moon', x: number, y: number, amt: number): void {
  let g = glows.get(kind);
  if (!g) {
    g = kind === 'sun'
      ? buildGlow(PAL.skyGlowOuter, PAL.skyGlowMid, PAL.skyGlowInner)
      : buildGlow(PAL.moonGlowOuter, PAL.moonGlowOuter, PAL.moonGlowInner);
    glows.set(kind, g);
  }
  ctx.globalAlpha = Math.min(1, amt);
  ctx.drawImage(g, Math.round(x - GLOW_W / 2), Math.round(y - GLOW_H / 2));
  ctx.globalAlpha = 1;
}
