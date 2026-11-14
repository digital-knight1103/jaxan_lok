// Warstwy gór z płaskimi „fasetami" jak na styl.jpg: lewe zbocza oświetlone,
// za skośną linią cienia od każdego szczytu – strona w cieniu; ku podstawie
// mgiełka (perspektywa powietrzna) z ditheringiem 2×2.
import { W, H } from '../config';
import { mulberry32 } from '../engine/rng';
import { lerpColor } from '../engine/color';

export interface MountainStyle {
  light: string; // zbocza oświetlone z lewej
  shade: string; // zbocza w cieniu
  haze: string; // kolor mgiełki u podstawy
  hazeAmount: number; // 0..1 – jak mocno mgiełka zjada kolor u podstawy
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

const HAZE_STEPS = 4;

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
    const rnd = mulberry32(seed * 31 + 7);
    const top = mountainProfile(seed, W, s);
    const at = (x: number) => top[((x % W) + W) % W];

    // szczyty = lokalne minima y w oknie ±10 kolumn
    const peaks: number[] = [];
    for (let x = 0; x < W; x++) {
      let isPeak = true;
      for (let d = -10; d <= 10 && isPeak; d++) if (d !== 0 && at(x + d) < at(x)) isPeak = false;
      if (isPeak && (peaks.length === 0 || x - peaks[peaks.length - 1] > 4)) peaks.push(x);
    }
    // najbliższy szczyt po lewej (z zawinięciem)
    const leftPeak = (x: number): number => {
      let best = -Infinity;
      for (const p of peaks) {
        const px = p <= x ? p : p - W;
        if (px > best) best = px;
      }
      return best === -Infinity ? x : best;
    };

    // paleta: 2 strony × kroki mgiełki
    const tone = (lit: boolean, step: number) =>
      lerpColor(lit ? s.light : s.shade, s.haze, (step / (HAZE_STEPS - 1)) * s.hazeAmount);
    const tones = [0, 1, 2, 3].map((k) => [tone(true, k), tone(false, k)]);

    for (let x = 0; x < W; x++) {
      const y0 = top[x];
      const ascending = at(x + 3) < at(x - 3); // zbocze wznosi się w prawo → patrzy w lewo, ku słońcu
      const pl = leftPeak(x);
      const py = at(pl);
      const wobble = Math.sin(x * 0.21) * 1.5;
      for (let y = y0; y < H; y++) {
        // skośna linia cienia od szczytu po lewej: na lewo od niej jasna faseta
        const shadowX = pl + (y - py) * 0.42 + wobble;
        const lit = ascending || x < shadowX;
        // mgiełka rośnie w dół od grzbietu (perspektywa powietrzna)
        const depth = Math.min(1, (y - y0) / 80 + (y - (s.baseY - s.height)) / (s.height * 2.5));
        const fs = depth * (HAZE_STEPS - 1);
        const edge = fs - Math.floor(fs) > 0.82 && ((x + y) & 1) === 0 ? 1 : 0; // dithering tylko na granicy pasów
        const step = Math.max(0, Math.min(HAZE_STEPS - 1, Math.floor(fs) + edge));
        ctx.fillStyle = tones[step][lit ? 0 : 1];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // żłobienia na jasnych ścianach: krótkie skośne kreski w dół-w lewo od grzbietu
    for (const p of peaks) {
      for (let k = 0; k < 3; k++) {
        let x = p - 2 - Math.floor(rnd() * 14);
        let y = at(x) + 2;
        const len = 8 + Math.floor(rnd() * 16);
        ctx.fillStyle = tones[1][1];
        for (let i = 0; i < len && y < H; i++) {
          ctx.fillRect(((x % W) + W) % W, y, 1, 1);
          y += 1;
          if (i % 2 === 0) x -= 1;
        }
      }
    }
    return c;
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    const off = Math.floor((worldX * this.factor) % W);
    ctx.drawImage(this.tile, -off, 0);
    ctx.drawImage(this.tile, W - off, 0);
  }
}
