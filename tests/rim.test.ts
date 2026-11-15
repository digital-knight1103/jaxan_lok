import { describe, expect, it } from 'vitest';
import { rimPixels } from '../src/engine/light';
import { bayer } from '../src/engine/pixbuf';

type RGB = [number, number, number];

/** Wzorzec: pierwotny algorytm buildRimOverlays (wersja sprzed optymalizacji). */
function reference(data: Uint8ClampedArray, w: number, h: number, sun: -1 | 1, soft: boolean, rim: RGB, cool: RGB) {
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] > 127;
  const o = new Uint8ClampedArray(w * h * 4);
  const put = (i: number, c: RGB, k: number) => {
    o[i] = data[i] + (c[0] - data[i]) * k;
    o[i + 1] = data[i + 1] + (c[1] - data[i + 1]) * k;
    o[i + 2] = data[i + 2] + (c[2] - data[i + 2]) * k;
    o[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const sunEdge = !solid(x + sun, y);
      const sunEdge2 = soft && !sunEdge && !solid(x + 2 * sun, y);
      const topEdge = !solid(x, y - 1);
      const shadeEdge = !solid(x - sun, y);
      const shadeEdge2 = soft && !shadeEdge && !solid(x - 2 * sun, y);
      if (sunEdge) put(i, rim, 0.5);
      else if (topEdge) put(i, rim, 0.32);
      else if (sunEdge2 && bayer(x, y) < 0.5) put(i, rim, 0.22);
      else if (shadeEdge) put(i, cool, 0.38);
      else if (shadeEdge2 && bayer(x, y) < 0.5) put(i, cool, 0.2);
    }
  }
  return o;
}

/** Losowa warstwa: plamy pełnych pikseli, alfa także 127/128 (próg). */
function randomLayer(w: number, h: number, seed: number): Uint8ClampedArray {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = rnd() * 256;
    d[i * 4 + 1] = rnd() * 256;
    d[i * 4 + 2] = rnd() * 256;
    const r = rnd();
    d[i * 4 + 3] = r < 0.45 ? 0 : r < 0.5 ? 127 : r < 0.55 ? 128 : 255;
  }
  return d;
}

const RIM: RGB = [255, 214, 140];
const COOL: RGB = [40, 70, 110];

describe('rimPixels – nakładka rim light', () => {
  for (const [w, h] of [[1, 1], [3, 2], [17, 11], [64, 40]] as const) {
    for (const sun of [-1, 1] as const) {
      for (const soft of [true, false]) {
        it(`zgodna ze wzorcem ${w}×${h}, słońce ${sun}, soft=${soft}`, () => {
          const data = randomLayer(w, h, w * 31 + h + (soft ? 7 : 0) + sun);
          expect(rimPixels(data, w, h, sun, soft, RIM, COOL)).toEqual(reference(data, w, h, sun, soft, RIM, COOL));
        });
      }
    }
  }

  it('liczona porcjami wierszy daje ten sam wynik co w całości', () => {
    const [w, h] = [50, 37];
    const data = randomLayer(w, h, 99);
    const whole = rimPixels(data, w, h, 1, true, RIM, COOL);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 8) rimPixels(data, w, h, 1, true, RIM, COOL, y, Math.min(h, y + 8), out);
    expect(out).toEqual(whole);
  });
});
