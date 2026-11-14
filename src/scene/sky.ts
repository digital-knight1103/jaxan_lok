import { W } from '../config';
import { lerpColor } from '../engine/color';

export interface SkyColors {
  top: string;
  mid: string;
  horizon: string;
}

const BAND = 6; // wysokość pasa – schodkowy, pikselowy gradient

/** Niebo w pasach od góry do linii horyzontu `bottom`. */
export function drawSky(ctx: CanvasRenderingContext2D, c: SkyColors, bottom: number): void {
  const bands = Math.ceil(bottom / BAND);
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    ctx.fillStyle = t < 0.5 ? lerpColor(c.top, c.mid, t * 2) : lerpColor(c.mid, c.horizon, (t - 0.5) * 2);
    ctx.fillRect(0, i * BAND, W, BAND);
  }
}
