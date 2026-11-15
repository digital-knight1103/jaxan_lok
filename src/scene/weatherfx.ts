// Pogoda – rysowanie: zachmurzenie nieba, skośny deszcz (2 głębie), płatki śniegu z paralaksą,
// mokry połysk szyn, biel śniegu na krawędziach (dachy, korony drzew, nasyp).
// Cząsteczki w tablicach o stałej pojemności – zero alokacji w pętli.
import { W, H, TRACK_Y } from '../config';
import { PAL } from '../palette';
import { lerpColor } from '../engine/color';

/** Siła przyciemnienia sceny przez pogodę 0..1 (do applyTint). */
export function gloom(cloud: number, rain: number): number {
  return 0.35 * cloud + 0.1 * rain;
}

/** Ciemniejsze, szare niebo: zasłona całego nieba + „pokrywa chmur” przy górnej krawędzi. */
export function drawOvercast(ctx: CanvasRenderingContext2D, cloud: number): void {
  if (cloud <= 0.01) return;
  ctx.globalAlpha = cloud * 0.72; // przy pełnym zachmurzeniu słońce ledwo prześwituje
  ctx.fillStyle = PAL.skyOvercast;
  ctx.fillRect(0, 0, W, H);
  // pokrywa chmur: ciemniejsza u góry, rzednie ku horyzontowi (pasy 2 px)
  ctx.fillStyle = PAL.rainTint;
  for (let y = 0; y < 150; y += 2) {
    ctx.globalAlpha = cloud * 0.55 * Math.pow(1 - y / 150, 1.3);
    ctx.fillRect(0, y, W, 2);
  }
  ctx.globalAlpha = 1;
}

// --- deszcz ---
const RAIN_N = 380;
/** Nachylenie: px w lewo na px w dół (kropla leci w dół i w lewo). */
const RAIN_SLANT = 0.22;

export class RainFx {
  private x = new Float32Array(RAIN_N);
  private y = new Float32Array(RAIN_N);
  private vy = new Float32Array(RAIN_N);
  /** y, na którym kropla uderza w ziemię. */
  private ground = new Float32Array(RAIN_N);
  /** > 0 = rozprysk (pozostały czas, s). */
  private splash = new Float32Array(RAIN_N);
  private near = new Uint8Array(RAIN_N);

  constructor() {
    for (let i = 0; i < RAIN_N; i++) {
      this.near[i] = i % 5 < 2 ? 1 : 0;
      this.respawn(i, true);
    }
  }

  private respawn(i: number, anywhere: boolean): void {
    const n = this.near[i] === 1;
    this.x[i] = Math.random() * (W + 100);
    this.y[i] = anywhere ? Math.random() * H : -8 - Math.random() * 20;
    this.vy[i] = n ? 380 + Math.random() * 80 : 240 + Math.random() * 50;
    // dalsze krople kończą na linii torów/tła, bliższe niżej na pierwszym planie
    this.ground[i] = n ? TRACK_Y + 8 + Math.random() * (H - TRACK_Y - 12) : TRACK_Y - 20 + Math.random() * 28;
    this.splash[i] = 0;
  }

  update(dt: number, level: number, kmh: number): void {
    const act = Math.floor(RAIN_N * level);
    // pociąg w ruchu „ściąga" krople mocniej w lewo
    const slant = RAIN_SLANT + (kmh / 120) * 0.2;
    for (let i = 0; i < act; i++) {
      if (this.splash[i] > 0) {
        this.splash[i] -= dt;
        if (this.splash[i] <= 0) this.respawn(i, false);
        continue;
      }
      this.y[i] += this.vy[i] * dt;
      this.x[i] -= this.vy[i] * dt * slant;
      if (this.x[i] < -10) this.x[i] += W + 100;
      if (this.y[i] >= this.ground[i]) {
        // nie wszystkie krople rozpryskują się widocznie – tylko bliskie
        if (this.near[i] === 1) this.splash[i] = 0.09;
        else this.respawn(i, false);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, level: number, night: number): void {
    const act = Math.floor(RAIN_N * level);
    if (act <= 0) return;
    const dim = 1 - night * 0.35;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? PAL.rainDropFar : PAL.rainDrop;
      ctx.globalAlpha = (pass === 0 ? 0.55 : 0.8) * dim * Math.min(1, level * 1.5);
      for (let i = 0; i < act; i++) {
        if (this.near[i] !== pass) continue;
        const x = Math.round(this.x[i]) - 20;
        const y = Math.round(this.y[i]);
        if (this.splash[i] > 0) {
          // rozprysk: dwa piksele po bokach punktu uderzenia
          ctx.fillRect(x - 1, y - 1, 1, 1);
          ctx.fillRect(x + 1, y - 1, 1, 1);
          continue;
        }
        // kropla: odcinki 2 px z przesunięciem w lewo (skos)
        const len = pass === 1 ? 3 : 2;
        for (let k = 0; k < len; k++) ctx.fillRect(x - Math.round(k * 2 * RAIN_SLANT * 1.6), y - k * 2, 1, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// --- śnieg ---
const SNOW_N = 240;

export class SnowFx {
  private bx = new Float32Array(SNOW_N);
  private y = new Float32Array(SNOW_N);
  private phase = new Float32Array(SNOW_N);
  /** Głębia 0.3..1: większa = bliżej (szybsza, większa, silniejsza paralaksa). */
  private depth = new Float32Array(SNOW_N);

  constructor() {
    for (let i = 0; i < SNOW_N; i++) {
      this.bx[i] = Math.random() * W;
      this.y[i] = Math.random() * H;
      this.phase[i] = Math.random() * 6.28;
      this.depth[i] = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.65 : 0.35;
    }
  }

  update(dt: number, level: number): void {
    const act = Math.floor(SNOW_N * level);
    for (let i = 0; i < act; i++) {
      this.y[i] += (14 + 34 * this.depth[i]) * dt;
      if (this.y[i] > H + 2) this.y[i] -= H + 4;
    }
  }

  draw(ctx: CanvasRenderingContext2D, level: number, worldX: number, time: number, night: number): void {
    const act = Math.floor(SNOW_N * level);
    if (act <= 0) return;
    ctx.fillStyle = PAL.snowFlake;
    for (let i = 0; i < act; i++) {
      const d = this.depth[i];
      // paralaksa: bliższe płatki uciekają szybciej wraz ze światem; do tego lekki dryf
      let x = this.bx[i] - worldX * (0.15 + 0.85 * d) + Math.sin(time * 0.8 + this.phase[i]) * 7 * d;
      x = ((x % W) + W) % W;
      ctx.globalAlpha = (0.45 + 0.5 * d) * (1 - night * 0.2) * Math.min(1, level * 1.5);
      const s = d >= 1 ? 2 : 1;
      ctx.fillRect(Math.round(x), Math.round(this.y[i]), s, s);
    }
    ctx.globalAlpha = 1;
  }
}

// --- mokre szyny i śnieg na torze ---
function hash(n: number): number {
  let h = (n | 0) * 374761393;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Rysowane po drawTrack: mokry połysk szyn i tłucznia albo biel śniegu na torowisku. */
export function drawTrackWeather(ctx: CanvasRenderingContext2D, worldX: number, rain: number, snow: number): void {
  const wx = Math.floor(worldX);
  if (rain > 0.01) {
    // mokry tłuczeń ciemnieje
    ctx.globalAlpha = rain * 0.4;
    ctx.fillStyle = PAL.rainTint;
    ctx.fillRect(0, TRACK_Y + 2, W, 5);
    // szyna odbija niebo: jaśniejsza główka + długie błyski przesuwające się ze światem
    ctx.globalAlpha = rain * 0.55;
    ctx.fillStyle = PAL.railWet;
    ctx.fillRect(0, TRACK_Y, W, 1);
    ctx.globalAlpha = rain * 0.9;
    for (let x = -(wx % 56); x < W; x += 56) ctx.fillRect(x, TRACK_Y, 14 + ((x + wx) & 7), 1);
    // wilgotne refleksy na tłuczniu
    ctx.globalAlpha = rain * 0.35;
    for (let x = -(wx % 34); x < W; x += 34) ctx.fillRect(x, TRACK_Y + 3, 9, 1);
    ctx.globalAlpha = 1;
  }
  if (snow > 0.01) {
    // śnieg między podkładami i na tłuczniu (szyna zostaje widoczna)
    ctx.fillStyle = PAL.snowCover;
    ctx.globalAlpha = snow * 0.85;
    for (let x = 0; x < W; x++) {
      const r = hash(wx + x + 977);
      if (r < 0.55) ctx.fillRect(x, TRACK_Y + 4 + (r < 0.2 ? 1 : 0), 1, 1 + (r < 0.12 ? 1 : 0));
    }
    ctx.globalAlpha = snow * 0.6;
    ctx.fillRect(0, TRACK_Y + 6, W, 1);
    ctx.globalAlpha = 1;
  }
}

// --- biel na krawędziach ---
let snowTmp: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

/**
 * Nakłada śnieg na górne krawędzie narysowanych kształtów (dachy, korony, nasyp, grzbiety):
 * zostają piksele, nad którymi (o 2 px wyżej) nic nie ma, i są malowane na biało.
 */
export function drawSnowCover(dst: CanvasRenderingContext2D, level: number): void {
  if (level <= 0.01) return;
  if (!snowTmp) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    snowTmp = [cv, c];
  }
  const [cv, t] = snowTmp;
  t.globalCompositeOperation = 'copy';
  t.drawImage(dst.canvas, 0, 0);
  t.globalCompositeOperation = 'destination-out';
  t.drawImage(dst.canvas, 0, 2);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = PAL.snowCover;
  t.fillRect(0, 0, W, H);
  t.globalCompositeOperation = 'source-over';
  dst.globalAlpha = level * 0.95;
  dst.drawImage(cv, 0, 0);
  dst.globalAlpha = 1;
}

/** Lekka biel na ziemi pod torem (pola, nasyp) – tylko na narysowanych pikselach. */
export function drawSnowGround(dst: CanvasRenderingContext2D, level: number): void {
  if (level <= 0.01) return;
  dst.globalCompositeOperation = 'source-atop';
  dst.globalAlpha = level * 0.38;
  dst.fillStyle = PAL.snowCover;
  dst.fillRect(0, TRACK_Y + 7, W, H - TRACK_Y - 7);
  dst.globalAlpha = 1;
  dst.globalCompositeOperation = 'source-over';
}

// --- mgła ---
const smoothstep = (u: number) => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};

/** Kolor mgły: jasny szary w dzień, ciemny granat nocą. */
export function fogColor(night: number): string {
  return lerpColor(PAL.fog, PAL.fogNight, night);
}

/** Mgliste „niebo”: poświata przy horyzoncie (rysowana pod grzbietami – te zlewają się z nią). */
export function drawFogSky(ctx: CanvasRenderingContext2D, fog: number, night: number): void {
  if (fog <= 0.01) return;
  ctx.fillStyle = fogColor(night);
  for (let y = 0; y < 270; y += 2) {
    ctx.globalAlpha = fog * (0.3 + 0.65 * smoothstep((y - 40) / 170));
    ctx.fillRect(0, y, W, 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * Zasłona mgły na już narysowanych pikselach warstwy (source-atop): gęstsza ku dołowi
 * (doliny, podnóża), strength = ile z tego zostaje dla danego planu (dalsze znikają prawie całkiem).
 * Kolor: dzień jasny; nocą ciemnieje razem z całą warstwą przez applyTint.
 */
export function drawFogVeil(c: CanvasRenderingContext2D, fog: number, strength: number, y0 = 150, y1 = 270): void {
  if (fog <= 0.01) return;
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = PAL.fog;
  for (let y = y0; y < H; y += 2) {
    c.globalAlpha = Math.min(1, fog * strength * (0.35 + 0.65 * smoothstep((y - y0) / (y1 - y0))));
    c.fillRect(0, y, W, 2);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

/** Lekko przesuwające się smugi mgły tuż nad ziemią (miękkie, trzy pasy ubywające ku brzegom). */
export function drawFogWisps(
  ctx: CanvasRenderingContext2D, fog: number, worldX: number, time: number, night: number,
  yMin: number, yMax: number, alpha: number,
): void {
  if (fog <= 0.01) return;
  ctx.fillStyle = fogColor(night);
  const span = W + 320;
  for (let i = 0; i < 14; i++) {
    const par = 0.25 + 0.5 * hash(i + 11); // paralaksa: dalsze smugi wolniej
    const x = ((hash(i * 7 + 3) * span - worldX * par + time * (3 + 5 * hash(i + 5))) % span + span) % span - 160;
    const w = 90 + hash(i + 31) * 160;
    const y = yMin + hash(i + 17) * (yMax - yMin);
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = fog * alpha * (k === 1 ? 1 : 0.55);
      const kw = w * (k === 1 ? 1 : 0.7);
      ctx.fillRect(Math.round(x + (w - kw) / 2), Math.round(y + k * 2), Math.round(kw), 2);
    }
  }
  ctx.globalAlpha = 1;
}
