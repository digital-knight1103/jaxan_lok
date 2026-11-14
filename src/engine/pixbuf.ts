// Bufor pikseli na ImageData – szybkie prerenderowanie warstw piksel po pikselu
// (zamiast setek tysięcy fillRect) oraz uporządkowany dithering Bayera 4×4.

const rgbaCache = new Map<string, number>();

/** '#rrggbb' → piksel 32-bit (little-endian ABGR) dla Uint32Array nad ImageData. */
export function rgba(hex: string): number {
  let v = rgbaCache.get(hex);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
    rgbaCache.set(hex, v);
  }
  return v;
}

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Próg Bayera 4×4 w [0,1) dla piksela (x,y). */
export function bayer(x: number, y: number): number {
  return (B4[(x & 3) + (y & 3) * 4] + 0.5) / 16;
}

/** Ditherowany indeks w rampie: t ciągłe (0..n-1) → całkowity indeks. */
export function ditherIndex(t: number, n: number, x: number, y: number): number {
  const f = Math.floor(t);
  const i = t - f > bayer(x, y) ? f + 1 : f;
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/**
 * Jak ditherIndex, ale dithering tylko w wąskiej strefie (±band) wokół granicy tonów –
 * czyste plamy koloru z miękkim przejściem, bez szumu na całej powierzchni.
 */
export function ditherEdge(t: number, n: number, x: number, y: number, band = 0.18): number {
  const r = Math.round(t);
  const f = t - r; // -0.5..0.5 od najbliższego tonu
  let i = r;
  if (Math.abs(f) > 0.5 - band) {
    const u = (Math.abs(f) - (0.5 - band)) / (2 * band); // 0..0.5
    if (u > bayer(x, y)) i += f > 0 ? 1 : -1;
  }
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

export class PixBuf {
  readonly img: ImageData;
  readonly px: Uint32Array;

  constructor(readonly w: number, readonly h: number) {
    this.img = new ImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
  }

  set(x: number, y: number, c: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  /** Jak set, ale x zawijany (kafle bez szwu). */
  setWrap(x: number, y: number, c: number): void {
    if (y < 0 || y >= this.h) return;
    this.px[y * this.w + (((x % this.w) + this.w) % this.w)] = c;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d')!.putImageData(this.img, 0, 0);
    return c;
  }
}
