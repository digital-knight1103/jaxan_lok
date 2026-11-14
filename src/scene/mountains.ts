import { W, H } from '../config';
import { mulberry32 } from '../engine/rng';

export interface MountainStyle {
  base: string;
  light: string; // zbocza oświetlone z lewej
  shade?: string; // pas mgły/cienia u podstawy
  baseY: number; // linia podstawy (y)
  height: number; // maks. wysokość szczytów
  roughness: number; // 0..1 – postrzępienie grzbietu
}

/**
 * Profil grzbietu: midpoint displacement na 1024 próbkach (potęga 2 – całkowite
 * indeksy), zawinięty w okrąg i przeskalowany do `width` kolumn.
 * Zwraca y szczytu dla każdej kolumny (liczby całkowite).
 */
export function mountainProfile(
  seed: number,
  width: number,
  s: Pick<MountainStyle, 'baseY' | 'height' | 'roughness'>,
): number[] {
  const rnd = mulberry32(seed);
  const N = 1024;
  const h = new Float64Array(N + 1);
  const anchors = 8;
  const step0 = N / anchors;
  for (let i = 0; i < anchors; i++) h[i * step0] = 0.3 + rnd() * 0.7;
  h[N] = h[0];
  let amp = 0.35 + 0.25 * s.roughness;
  for (let seg = step0; seg > 1; seg /= 2) {
    const half = seg / 2;
    for (let x = half; x < N; x += seg) {
      h[x] = (h[x - half] + h[x + half]) / 2 + (rnd() - 0.5) * amp;
    }
    amp *= 0.5 + s.roughness * 0.08;
  }
  const out: number[] = [];
  for (let x = 0; x < width; x++) {
    const f = (x * N) / width;
    const i = Math.floor(f);
    const v = h[i] + (h[i + 1] - h[i]) * (f - i);
    out.push(Math.round(s.baseY - Math.max(0, Math.min(1, v)) * s.height));
  }
  return out;
}

/**
 * Warstwa gór: profil generowany raz (zawijany co W px – bez szwu),
 * rysowany do offscreen canvas i powtarzany z przesunięciem paralaksy.
 */
export class MountainLayer {
  private tile: HTMLCanvasElement;

  constructor(seed: number, private factor: number, style: MountainStyle) {
    this.tile = MountainLayer.build(seed, style);
  }

  private static build(seed: number, s: MountainStyle): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    const top = mountainProfile(seed, W, s);
    for (let x = 0; x < W; x++) {
      const y = top[x];
      ctx.fillStyle = s.base;
      ctx.fillRect(x, y, 1, H - y);
      // Zbocze wznoszące się w prawo „patrzy" w lewo, ku słońcu → jaśniejsze
      // smugi biegnące od grzbietu w dół (jak fasety na styl.jpg).
      const next = top[(x + 2) % W];
      if (next < y) {
        ctx.fillStyle = s.light;
        const len = 6 + ((x * 7) % 13) + (y - next) * 3;
        ctx.fillRect(x, y, 1, Math.min(len, H - y));
      }
    }
    if (s.shade) {
      // pas mgły u podstawy, schodkowy
      ctx.fillStyle = s.shade;
      for (let x = 0; x < W; x++) ctx.fillRect(x, s.baseY - 8 + ((x >> 3) % 3), 1, H);
    }
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    const off = Math.floor((worldX * this.factor) % W);
    ctx.drawImage(this.tile, -off, 0);
    ctx.drawImage(this.tile, W - off, 0);
  }
}
