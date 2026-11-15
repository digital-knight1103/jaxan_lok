// Przebarwianie warstw pod porę roku. Segmenty i tła rysowane są zawsze „latem" (zieleń z palety),
// a potem każdy piksel przechodzi przez transformację koloru: zieleń → złoto/rudź (jesień),
// świeża zieleń (wiosna), biel i błękitne cienie (zima). Dla kolorów spoza zieleni (tabor,
// dachy, tor, drewno) transformacja jest tożsamością – malowanie JAXAN zostaje nietknięte.
import type { Season } from '../scene/season';
import { SEASON_STEPS } from '../scene/season';

/** Kolor jako 0xRRGGBB → 0xRRGGBB. */
export type ColorFn = (rgb: number) => number;

function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function fromHsl(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const q = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Przekształcenie jednego koloru dla pory (lato = bez zmian). */
export function mapSeason(season: Season, rgb: number): number {
  if (season === 'summer') return rgb;
  const [h, s, l] = toHsl((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255);
  const veg = h >= 56 && h <= 186 && s >= 0.1; // zieleń: trawa, liście, igły, łąki
  // ciemna turkusowa zieleń (świerki, cienie lasu) zostaje – igły nie żółkną
  const evergreen = h >= 160 && l < 0.42;
  if (season === 'spring') {
    if (!veg || evergreen) return rgb;
    // świeża, jasna, bardziej żółtozielona
    return fromHsl(h > 88 ? h + (88 - h) * 0.55 : h, clamp(s * 1.12 + 0.04, 0, 0.9), clamp(l + 0.05, 0, 0.94));
  }
  if (season === 'autumn') {
    if (!veg || evergreen) return rgb;
    // jasne = złoto, cień = ruda czerwień; głębsza zieleń (większy h) bardziej ku pomarańczowi
    const u = clamp((h - 56) / 130, 0, 1);
    const hue = clamp(50 - 24 * u - 22 * (1 - l), 8, 50);
    return fromHsl(hue, clamp(s * 0.9 + 0.22, 0.3, 0.86), clamp(l * 0.96 + 0.01, 0.08, 0.8));
  }
  // zima: zieleń i żółte łąki → śnieg (jasny = biel, cień = błękit)
  const warm = h >= 30 && h < 56 && s >= 0.3 && l >= 0.3;
  if (!veg && !warm) return rgb;
  const l2 = clamp(0.32 + 0.9 * l, 0.42, 0.95);
  return fromHsl(212, 0.12 + 0.3 * (1 - l2), l2);
}

const memo = new Map<string, ColorFn | null>();

/**
 * Transformacja dla wyglądu `from → to` w stopniu `step` (0..SEASON_STEPS).
 * null = tożsamość (nic do roboty). Wyniki zapamiętane po kolorach.
 */
export function colorFn(from: Season, to: Season, step: number): ColorFn | null {
  const t = from === to ? 1 : step / SEASON_STEPS;
  const key = `${from}>${to}:${t.toFixed(2)}`;
  if (memo.has(key)) return memo.get(key)!;
  let fn: ColorFn | null;
  if (from === 'summer' && (to === 'summer' || t <= 0)) fn = null;
  else {
    const cache = new Map<number, number>();
    fn = (rgb) => {
      let v = cache.get(rgb);
      if (v === undefined) {
        const a = mapSeason(t >= 1 ? to : from, rgb);
        if (t > 0 && t < 1) {
          const b = mapSeason(to, rgb);
          const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
          const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
          v = (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
        } else v = a;
        cache.set(rgb, v);
      }
      return v;
    };
  }
  memo.set(key, fn);
  return fn;
}

/** Wiersze przetwarzane między przerwami (yield) w zadaniach przyrostowych. */
const ROWS_PER_STEP = 60;

/** Przebarwia canvas w miejscu (porcjami wierszy). */
export function* recolorJob(ctx: CanvasRenderingContext2D, fn: ColorFn | null): Generator<void, void> {
  if (!fn) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const px = new Uint32Array(img.data.buffer);
  let lastIn = 0, lastOut = 0, has = false;
  for (let y0 = 0; y0 < h; y0 += ROWS_PER_STEP) {
    const y1 = Math.min(h, y0 + ROWS_PER_STEP);
    for (let i = y0 * w; i < y1 * w; i++) {
      const p = px[i];
      if (p >>> 24 === 0) continue;
      // little-endian ABGR → 0xRRGGBB
      const rgb = ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);
      let out: number;
      if (has && rgb === lastIn) out = lastOut;
      else { out = fn(rgb); lastIn = rgb; lastOut = out; has = true; }
      if (out === rgb) continue;
      px[i] = ((p >>> 24) << 24 | ((out & 255) << 16) | (out & 0xff00) | ((out >> 16) & 255)) >>> 0;
    }
    if (y1 < h) yield;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Kafel tła (grzbiety, pierwszy plan) z przebarwianiem: trzyma oryginał, a po zmianie wyglądu
 * buduje przebarwioną kopię w tle (porcjami) i dopiero gotową podmienia – bez migotania.
 */
export class SkinnedTile {
  shown: HTMLCanvasElement;
  private key = 'summer>summer:1.00';
  private job: Generator<void, void> | undefined;
  private next: HTMLCanvasElement | undefined;

  constructor(private src: HTMLCanvasElement) {
    this.shown = src;
  }

  /** Ustawia docelowy wygląd; no-op, jeśli to już on. */
  request(from: Season, to: Season, step: number): void {
    const t = from === to ? 1 : step / SEASON_STEPS;
    const key = `${from}>${to}:${t.toFixed(2)}`;
    if (key === this.key) return;
    this.key = key;
    const fn = colorFn(from, to, step);
    if (!fn) {
      this.shown = this.src;
      this.job = undefined;
      return;
    }
    const c = document.createElement('canvas');
    c.width = this.src.width;
    c.height = this.src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.src, 0, 0);
    this.next = c;
    this.job = recolorJob(ctx, fn);
  }

  /** Jeden krok pracy; false = nic do roboty. */
  step(): boolean {
    if (!this.job) return false;
    if (this.job.next().done) {
      this.shown = this.next!;
      this.job = undefined;
      return false;
    }
    return true;
  }
}
