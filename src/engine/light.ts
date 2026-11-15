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

type RGB = [number, number, number];

// Maska „pełności” z ramką: 2 px po bokach i 1 wiersz nad warstwą. Poza płótnem = „pełne” –
// szwy między segmentami nie dostają fałszywej krawędzi. Ramka usuwa sprawdzanie granic
// z pętli; maska liczona raz na dane (także przy liczeniu porcjami wierszy).
const masks = new WeakMap<Uint8ClampedArray, Uint8Array>();
function solidMask(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  let m = masks.get(data);
  if (m) return m;
  const pw = w + 4;
  m = new Uint8Array(pw * (h + 1)).fill(1);
  for (let y = 0; y < h; y++) {
    const row = (y + 1) * pw + 2;
    for (let x = 0; x < w; x++) m[row + x] = data[(y * w + x) * 4 + 3] > 127 ? 1 : 0;
  }
  masks.set(data, m);
  return m;
}

/**
 * Czysta logika nakładki rim light: piksele RGBA wierszy [y0, y1) wpisane do `out`.
 * Piksel nakładki = kolor źródła zmieszany z `rim` (krawędź od słońca, góra sylwetki)
 * albo `cool` (krawędź w cieniu); reszta przezroczysta. soft = drugi, ditherowany piksel.
 */
export function rimPixels(
  data: Uint8ClampedArray, w: number, h: number, sun: -1 | 1, soft: boolean, rim: RGB, cool: RGB,
  y0 = 0, y1 = h, out = new Uint8ClampedArray(w * h * 4),
): Uint8ClampedArray {
  const m = solidMask(data, w, h);
  const pw = w + 4;
  const put = (i: number, c: RGB, k: number) => {
    out[i] = data[i] + (c[0] - data[i]) * k;
    out[i + 1] = data[i + 1] + (c[1] - data[i + 1]) * k;
    out[i + 2] = data[i + 2] + (c[2] - data[i + 2]) * k;
    out[i + 3] = 255;
  };
  for (let y = y0; y < y1; y++) {
    const row = (y + 1) * pw + 2;
    for (let x = 0; x < w; x++) {
      const j = row + x;
      if (!m[j]) continue;
      const i = (y * w + x) * 4;
      // od strony słońca pusto → krawędź oświetlona
      if (!m[j + sun]) put(i, rim, 0.5);
      else if (!m[j - pw]) put(i, rim, 0.32);
      else if (soft && !m[j + 2 * sun] && bayer(x, y) < 0.5) put(i, rim, 0.22); // miękkie wejście światła
      else if (!m[j - sun]) put(i, cool, 0.38);
      else if (soft && !m[j - 2 * sun] && bayer(x, y) < 0.5) put(i, cool, 0.2);
    }
  }
  return out;
}

/** Ile wierszy liczyć w jednym kroku zadania przyrostowego. */
const ROWS_PER_STEP = 24;

/**
 * Nakładki rim light jako zadanie przyrostowe: każdy `next()` liczy porcję wierszy,
 * wynik w `value` po zakończeniu. Pozwala rozłożyć pracę na wiele klatek (World).
 */
export function* rimOverlaysJob(src: HTMLCanvasElement, soft = true): Generator<void, RimOverlays> {
  const w = src.width;
  const h = src.height;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  yield;
  const rim = hexRgb(PAL.rimLight);
  const cool = hexRgb(PAL.coolShade);
  const make = function* (sun: -1 | 1): Generator<void, HTMLCanvasElement> {
    const img = new ImageData(w, h);
    for (let y = 0; y < h; y += ROWS_PER_STEP) {
      rimPixels(data, w, h, sun, soft, rim, cool, y, Math.min(h, y + ROWS_PER_STEP), img.data);
      yield;
    }
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c;
  };
  const left = yield* make(-1);
  const right = yield* make(1);
  return { left, right };
}

/** Nakładki rim light dla warstwy `src` – od razu, w całości (małe sprite'y taboru). */
export function buildRimOverlays(src: HTMLCanvasElement, soft = true): RimOverlays {
  const job = rimOverlaysJob(src, soft);
  for (;;) {
    const r = job.next();
    if (r.done) return r.value;
  }
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
