// Wspólne światło sceny (styl2): z prerenderowanej warstwy liczymy RAZ dwie nakładki –
// słońce z lewej i słońce z prawej. Krawędź sylwetki od strony słońca dostaje ciepły
// rim light, krawędź przeciwna – chłodny niebiesko-zielony cień. Co klatkę nakładki
// są tylko rysowane z kryciem zależnym od położenia słońca (etap C).
import { PAL } from '../palette';
import { bayer } from './pixbuf';

export interface RimOverlays {
  /** Słońce z lewej. */
  left: HTMLCanvasElement;
  /** Słońce z prawej. */
  right: HTMLCanvasElement;
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Nakładki rim light dla warstwy `src`. Piksele nakładki = kolor piksela źródła
 * zmieszany z PAL.rimLight / PAL.coolShade (pochodne kolorów palety), reszta przezroczysta.
 */
export function buildRimOverlays(src: HTMLCanvasElement, soft = true): RimOverlays {
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const rim = hexRgb(PAL.rimLight);
  const cool = hexRgb(PAL.coolShade);
  // poza płótnem = „pełne” – szwy między segmentami nie dostają fałszywej krawędzi
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] > 127;

  const make = (sun: -1 | 1): HTMLCanvasElement => {
    const out = new ImageData(w, h);
    const o = out.data;
    const put = (i: number, c: [number, number, number], k: number) => {
      o[i] = data[i] + (c[0] - data[i]) * k;
      o[i + 1] = data[i + 1] + (c[1] - data[i + 1]) * k;
      o[i + 2] = data[i + 2] + (c[2] - data[i + 2]) * k;
      o[i + 3] = 255;
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) continue;
        const sunEdge = !solid(x + sun, y); // od strony słońca pusto → krawędź oświetlona
        const sunEdge2 = soft && !sunEdge && !solid(x + 2 * sun, y);
        const topEdge = !solid(x, y - 1);
        const shadeEdge = !solid(x - sun, y);
        const shadeEdge2 = soft && !shadeEdge && !solid(x - 2 * sun, y);
        if (sunEdge) put(i, rim, 0.5);
        else if (topEdge) put(i, rim, 0.32);
        else if (sunEdge2 && bayer(x, y) < 0.5) put(i, rim, 0.22); // miękkie wejście światła
        else if (shadeEdge) put(i, cool, 0.38);
        else if (shadeEdge2 && bayer(x, y) < 0.5) put(i, cool, 0.2);
      }
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.putImageData(out, 0, 0);
    return c;
  };
  return { left: make(-1), right: make(1) };
}

/** Rysuje nakładki z kryciem wg kierunku słońca (sunL/sunR 0..1). */
export function drawRim(ctx: CanvasRenderingContext2D, r: RimOverlays, x: number, sunL: number, sunR: number, y = 0): void {
  if (sunL > 0.01) {
    ctx.globalAlpha = Math.min(1, sunL);
    ctx.drawImage(r.left, x, y);
  }
  if (sunR > 0.01) {
    ctx.globalAlpha = Math.min(1, sunR);
    ctx.drawImage(r.right, x, y);
  }
  ctx.globalAlpha = 1;
}
