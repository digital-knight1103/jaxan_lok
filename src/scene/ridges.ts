// Zalesione pasma wzgórz w stylu styl2.png: łagodne grzbiety pokryte pojedynczymi
// koronami drzew (od tyłu do przodu – dolne nachodzą na górne), światło z lewej-góry:
// jasny złoty brzeg korony od słońca, chłodny niebiesko-zielony cień po drugiej stronie.
// Perspektywa powietrzna: im dalszy plan, tym mocniej kolory zlewają się z mgiełką.
// Każda warstwa prerenderowana raz do kafla (offscreen canvas) i przewijana z paralaksą.
import { W, H } from '../config';
import { PAL } from '../palette';
import { mulberry32 } from '../engine/rng';
import { lerpColor } from '../engine/color';
import { PixBuf, rgba, ditherIndex, ditherEdge, bayer } from '../engine/pixbuf';

export interface RidgeStyle {
  baseY: number; // linia podstawy profilu
  height: number; // maks. wysokość grzbietów
  roughness: number; // 0..1
  smooth: number; // promień wygładzania profilu (łagodne, „okrągłe" wzgórza)
  haze: number; // 0..1 – perspektywa powietrzna (0 = pełny kolor)
  crown: [number, number]; // promień korony min..maks
  conifers: number; // 0..1 udział świerków
  meadows: number; // 0..1 ile polan/pól na zboczach
  tile: number; // szerokość kafla
  mist: number; // 0..1 mgiełka u podnóża
}

/**
 * Profil grzbietu: midpoint displacement na 1024 próbkach, zawinięty w okrąg
 * i przeskalowany do `width` kolumn. Zwraca y grzbietu dla każdej kolumny.
 */
export function mountainProfile(
  seed: number,
  width: number,
  s: { baseY: number; height: number; roughness: number },
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

/** Wygładzenie zawiniętego profilu średnią ruchomą (łagodne kopuły wzgórz). */
function smoothProfile(p: number[], r: number): number[] {
  const n = p.length;
  const out: number[] = [];
  for (let x = 0; x < n; x++) {
    let s = 0;
    for (let d = -r; d <= r; d++) s += p[(x + d + n) % n];
    out.push(Math.round(s / (2 * r + 1)));
  }
  return out;
}

/** Rampy materiałów: cień → półcień → baza → światło → blask (+ głęboki cień). */
const FOREST = [PAL.forestDeep, PAL.forestShade, PAL.forestMid, PAL.forestBase, PAL.forestLight, PAL.forestRim];
const MEADOW = [PAL.meadowShade, PAL.meadowMid, PAL.meadowBase, PAL.meadowLight, PAL.meadowRim];

export class ForestRidgeLayer {
  /** Kafle: słońce z lewej i z prawej – przenikane wg kierunku światła (etap C). */
  private tileL: HTMLCanvasElement;
  private tileR: HTMLCanvasElement;
  private tileW: number;

  constructor(seed: number, private factor: number, s: RidgeStyle) {
    this.tileW = s.tile;
    this.tileL = ForestRidgeLayer.build(seed, s, 1);
    this.tileR = ForestRidgeLayer.build(seed, s, -1);
  }

  /** dir: 1 = słońce z lewej, -1 = z prawej (ten sam las, inne światło). */
  private static build(seed: number, s: RidgeStyle, dir: 1 | -1): HTMLCanvasElement {
    const TW = s.tile;
    const rnd = mulberry32(seed * 97 + 13);
    const top = smoothProfile(mountainProfile(seed, TW, s), s.smooth);
    const at = (x: number) => top[((x % TW) + TW) % TW];
    const buf = new PixBuf(TW, H);

    // rampy z mgiełką: dalszy plan → bliżej koloru powietrza; dodatkowo mgiełka u podnóża
    const MIST = 4;
    const hazed = (ramp: string[], k: number) =>
      ramp.map((c) => rgba(lerpColor(c, PAL.hazeFar, s.haze + (1 - s.haze) * s.mist * (k / (MIST - 1)) * 0.6)));
    const forest = [0, 1, 2, 3].map((k) => hazed(FOREST, k));
    const meadow = [0, 1, 2, 3].map((k) => hazed(MEADOW, k));
    const mistAt = (x: number, y: number) =>
      ditherIndex(Math.max(0, (y - s.baseY + 4) / 40) * (MIST - 1) * s.mist, MIST, x, y);

    // nasłonecznienie zbocza: wznosi się w prawo → patrzy w lewo, ku słońcu
    const sun = (x: number) => Math.max(-1, Math.min(1, (dir * (at(x + 5) - at(x - 5))) / -6));

    // polany / pola na zboczach: niżej na stoku, plamami wzdłuż grzbietu
    const ph1 = rnd() * 6.28;
    const ph2 = rnd() * 6.28;
    const meadowTop = (x: number) => {
      const patch = Math.sin((x / TW) * 6.283 * 5 + ph1) + 0.6 * Math.sin((x / TW) * 6.283 * 13 + ph2);
      return patch > 1.1 - s.meadows * 1.6 ? at(x) + 14 + Math.round(10 * Math.sin(x * 0.05 + ph2)) : H;
    };
    const mTop: number[] = [];
    for (let x = 0; x < TW; x++) mTop.push(meadowTop(x));

    // 1. podszycie: ciemne tło między koronami, jaśniejsze na zboczach ku słońcu
    for (let x = 0; x < TW; x++) {
      const l = sun(x);
      for (let y = top[x]; y < H; y++) {
        const m = mistAt(x, y);
        if (y >= mTop[x]) {
          // pole: pasy uprawy wzdłuż stoku, jaśniejsze od słońca
          const stripe = ((y - mTop[x]) >> 2) & 1;
          const t = 2 + l * 1.3 + stripe * 0.5 - (y - mTop[x] < 2 ? 1.2 : 0);
          buf.set(x, y, meadow[m][ditherEdge(t, MEADOW.length, x, y)]);
        } else {
          buf.set(x, y, forest[m][ditherEdge(0.2 + l * 0.6, FOREST.length, x, y)]);
        }
      }
    }

    // 2. korony drzew – siatka z rozrzutem, rysowane rzędami od grzbietu w dół
    const [rMin, rMax] = s.crown;
    const step = rMin + (rMax - rMin) * 0.5;
    const crowns: { x: number; y: number; r: number; con: boolean }[] = [];
    for (let row = 0; row < 400; row++) {
      const dy = row * step * 1.05 - rMax * 0.6;
      let any = false;
      for (let x0 = 0; x0 < TW; x0 += step * 1.5) {
        const x = Math.floor(x0 + (rnd() - 0.5) * step * 1.2 + (row & 1) * step * 0.75);
        const xc = ((x % TW) + TW) % TW;
        const y = top[xc] + Math.floor(dy + (rnd() - 0.5) * step * 0.8);
        if (y > H + rMax) continue;
        any = true;
        // na polach tylko pojedyncze drzewa przy miedzach
        if (y > mTop[xc] - 1 && rnd() > 0.04) continue;
        if (rnd() < 0.06) continue; // prześwity
        const r = rMin + Math.floor(rnd() * (rMax - rMin + 1));
        crowns.push({ x, y, r, con: rnd() < s.conifers });
      }
      if (!any) break;
    }
    crowns.sort((a, b) => a.y - b.y);

    for (const c of crowns) {
      const l = sun(c.x);
      // mgiełka stała w obrębie jednej korony (bez szumu między odcieniami)
      const ramp = forest[mistAt(c.x, c.y)];
      if (c.con) drawConifer(buf, c.x, c.y, c.r, l, ramp, dir);
      else drawCrown(buf, c.x, c.y, c.r, l, ramp, dir);
    }
    return buf.toCanvas();
  }

  /** right: udział światła z prawej 0..1 (0 = rano, 1 = wieczór). */
  draw(ctx: CanvasRenderingContext2D, worldX: number, right = 0): void {
    const TW = this.tileW;
    const off = Math.floor((worldX * this.factor) % TW);
    const blit = (t: HTMLCanvasElement) => {
      ctx.drawImage(t, -off, 0);
      if (TW - off < W) ctx.drawImage(t, TW - off, 0);
    };
    if (right < 0.98) blit(this.tileL);
    if (right > 0.02) {
      ctx.globalAlpha = right >= 0.98 ? 1 : right;
      blit(this.tileR);
      ctx.globalAlpha = 1;
    }
  }
}

/** Okrągła korona liściasta: blask od lewej-góry, chłodny cień od prawej-dołu. */
function drawCrown(buf: PixBuf, cx: number, cy: number, r: number, l: number, ramp: number[], dir: number): void {
  const rx = r + 0.5;
  const ry = r * 0.85 + 0.5;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const nx = dx / rx;
      const ny = dy / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      // poszarpany brzeg korony (listowie), bez dziur w środku
      if (d > 0.7 && bayer(cx + dx, cy + dy) > 0.82) continue;
      const lit = -(nx * 0.7 * dir + ny * 0.75); // -1..1, + = ku słońcu
      let t = 2.0 + lit * 1.5 + l * 0.5;
      if (d > 0.6 && lit > 0.45) t += 1.1; // rim light na krawędzi od słońca
      if (d > 0.6 && lit < -0.2) t -= 1.0; // chłodny cień własny – korony się odcinają
      if (ny > 0.6) t -= 0.6; // cień pod koroną
      const x = cx + dx;
      const y = cy + dy;
      buf.setWrap(x, y, ramp[ditherEdge(t, ramp.length, x, y)]);
    }
  }
}

/** Świerk: trójkąt z piętrami gałęzi, oświetlona lewa krawędź. */
function drawConifer(buf: PixBuf, cx: number, cy: number, r: number, l: number, ramp: number[], dir: number): void {
  const h = Math.round(r * 2.6);
  const top = cy - h + r;
  for (let i = 0; i <= h; i++) {
    const tier = (i % 3) / 3; // piętra gałęzi
    const half = Math.max(0, Math.round((i / h) * r * (0.8 + tier * 0.4)));
    for (let dx = -half; dx <= half; dx++) {
      const u = half ? (dx / half) * dir : 0;
      let t = 1.8 - u * 1.5 + l * 0.5 + (i % 3 === 0 ? 0.5 : 0);
      if (u < -0.6 && i > 1) t += 0.8; // rim od słońca
      const x = cx + dx;
      const y = top + i;
      buf.setWrap(x, y, ramp[ditherEdge(t, ramp.length, x, y)]);
    }
  }
}
