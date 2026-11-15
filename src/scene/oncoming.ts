// Drugi tor i pociągi z naprzeciwka. Tor leży za naszym (dalej od kamery, 10 px wyżej) z własną
// siecią trakcyjną. Co 1–3 min mija nas skład jadący w lewo: elektryczny zespół trakcyjny albo
// towarowy (lokomotywa + cysterny i platformy z kontenerami). Pociągi z naprzeciwka rysowane są
// odrobinę ciemniej i mniej nasyconie (dalszy plan), by skład JAXAN zostawał w centrum uwagi.
// Na stacjach czasem stoi inny skład na drugim torze. Logika (harmonogram, ruch) jest prosta
// i niezależna od rysowania – patrz tests/oncoming.test.ts.
import { H, TRACK_Y, TRAIN_X, W, PX_PER_KMH } from '../config';
import { PAL } from '../palette';
import { mulberry32 } from '../engine/rng';
import { makeSprite } from '../engine/sprite';
import { drawTrack } from './track';
import { CONTACT_WIRE_Y, drawWires } from './catenary';
import { LOCO_W } from '../sprites/dragon2';
import {
  OC_H, drawPanto, getEmuCar, getFlat, getFreightLoco, getTank, type OcCar,
} from '../sprites/oncoming';

/** Główka szyny drugiego toru. */
export const TRACK2_Y = TRACK_Y - 10;
/** O ile wyżej jest przewód drugiego toru. */
export const WIRE2_DY = 10;
const GAP = 1;

/** Odstęp między pociągami z naprzeciwka (s). */
export const ONCOMING_MIN_S = 60;
export const ONCOMING_MAX_S = 180;
const FIRST_S = 25;

export type OncomingKind = 'emu' | 'freight';

export interface Train {
  kind: OncomingKind;
  /** x świata lewego (przedniego) końca składu. */
  x: number;
  /** Prędkość (px/s świata), skład jedzie w lewo; 0 = stoi na stacji. */
  v: number;
  cars: OcCar[];
  len: number;
  /** Czy przywita nas klaksonem i czy już to zrobił. */
  salute: boolean;
  saluted: boolean;
}

export interface OncomingEvents {
  /** Początek przelotu: czas do minięcia środka (s), całkowity czas (s), ciężki skład (towarowy). */
  pass?: { peakS: number; totalS: number; heavy: boolean };
  horn?: boolean;
}

/** Skład z losowania: EZT (3–5 członów) albo towarowy (lokomotywa + 6–11 wagonów). */
export function buildTrain(kind: OncomingKind, rnd: () => number): { cars: OcCar[]; len: number } {
  const cars: OcCar[] = [];
  if (kind === 'emu') {
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) cars.push(getEmuCar(i === 0 ? 'head' : i === n - 1 ? 'tail' : 'mid', i === 1 || (i === 3 && n > 4)));
  } else {
    cars.push(getFreightLoco());
    const n = 6 + Math.floor(rnd() * 6);
    const tones = ['grey', 'black', 'brown'] as const;
    const conts = ['Red', 'Blue', 'Orange', 'Green', 'Grey'] as const;
    const mode = rnd();
    for (let i = 0; i < n; i++) {
      // całość cystern, całość platform albo mieszanka
      const tank = mode < 0.35 ? true : mode < 0.7 ? false : rnd() < 0.5;
      if (tank) cars.push(getTank(tones[Math.floor(rnd() * tones.length)]));
      else {
        const a = conts[Math.floor(rnd() * conts.length)];
        cars.push(getFlat(a, rnd() < 0.5 ? conts[Math.floor(rnd() * conts.length)] : null));
      }
    }
  }
  return { cars, len: cars.reduce((s, c) => s + c.w + GAP, -GAP) };
}

export class OncomingTrains {
  trains: Train[] = [];
  private timer = FIRST_S;
  private rnd: () => number;

  constructor(seed = 7771) {
    this.rnd = mulberry32(seed);
  }

  /** Wymusza pojawienie się pociągu (podgląd ?oncoming=emu|freight, testy). */
  spawn(kind: OncomingKind, camX: number): Train {
    const { cars, len } = buildTrain(kind, this.rnd);
    const kmh = kind === 'emu' ? 100 + this.rnd() * 20 : 55 + this.rnd() * 25;
    const t: Train = { kind, x: camX + W + 8, v: kmh * PX_PER_KMH, cars, len, salute: this.rnd() < 0.5, saluted: false };
    this.trains.push(t);
    return t;
  }

  /**
   * Ruch i harmonogram. blocked – na ekranie stoi skład na stacji (nie puszczamy drugiego
   * przez niego). Zwraca zdarzenia dla dźwięku.
   */
  update(dt: number, camX: number, ourKmh: number, blocked = false): OncomingEvents {
    const ev: OncomingEvents = {};
    for (const t of this.trains) {
      t.x -= t.v * dt;
      const sx = t.x - camX;
      if (t.salute && !t.saluted && sx < TRAIN_X + LOCO_W + 140) {
        t.saluted = true;
        ev.horn = true;
      }
    }
    this.trains = this.trains.filter((t) => t.x + t.len > camX - 200);
    this.timer -= dt;
    if (this.timer <= 0) {
      if (blocked || this.trains.length > 0) this.timer = 5; // spróbuj za chwilę
      else {
        const t = this.spawn(this.rnd() < 0.5 ? 'emu' : 'freight', camX);
        this.timer = ONCOMING_MIN_S + this.rnd() * (ONCOMING_MAX_S - ONCOMING_MIN_S);
        const rel = Math.max(40, t.v + ourKmh * PX_PER_KMH); // prędkość względem ekranu
        ev.pass = {
          peakS: Math.max(0.3, (W + t.len / 2 - (TRAIN_X + LOCO_W / 2)) / rel),
          totalS: (W + t.len) / rel,
          heavy: t.kind === 'freight',
        };
      }
    }
    return ev;
  }
}

// --- rysowanie ---
let tmp: [HTMLCanvasElement, CanvasRenderingContext2D] | null = null;

function drawCars(ctx: CanvasRenderingContext2D, cars: OcCar[], sx: number): void {
  let x = sx;
  const y = TRACK2_Y - OC_H + 1;
  for (const c of cars) {
    if (x + c.w >= 0 && x < W) {
      ctx.drawImage(c.sprite, Math.round(x), y);
      if (c.panto !== undefined) drawPanto(ctx, Math.round(x) + c.panto, TRACK2_Y - c.roof + 1, CONTACT_WIRE_Y - WIRE2_DY);
    }
    x += c.w + GAP;
  }
}

/** Skład stojący na stacji w danym segmencie (deterministycznie z ziarna): ok. 45% stacji. */
/** Podgląd (?station-train): na każdej stacji stoi skład na drugim torze. */
export const preview = { forceParked: false };

export function parkedAt(seed: number, segW: number): { dx: number; train: { cars: OcCar[]; len: number } } | null {
  const rnd = mulberry32(seed ^ 0x9a2b);
  if (rnd() > 0.45 && !preview.forceParked) return null;
  const train = buildTrain(rnd() < 0.6 ? 'emu' : 'freight', rnd);
  return { dx: Math.max(10, Math.floor((segW - train.len) * (0.2 + rnd() * 0.6))), train };
}

const parkedCache = new Map<number, ReturnType<typeof parkedAt>>();
function parked(seed: number, w: number): ReturnType<typeof parkedAt> {
  let p = parkedCache.get(seed);
  if (p === undefined) {
    if (parkedCache.size > 16) parkedCache.clear();
    p = parkedAt(seed, w);
    parkedCache.set(seed, p);
  }
  return p;
}

export interface StationSpot { x: number; width: number; seed: number }

/** Czy w widoku stoi skład na stacji. */
export function parkedVisible(stations: StationSpot[]): boolean {
  return stations.some((s) => {
    const p = parked(s.seed, s.width);
    return !!p && s.x + p.dx + p.train.len > 0 && s.x + p.dx < W;
  });
}

/**
 * Drugi tor z siecią i pociągami – rysowane na warstwie tła (przed torem JAXAN).
 * Pociągi trafiają najpierw na osobny canvas, gdzie dostają „dalszoplanowy" welon
 * (ciemniej, mniej nasycone), i dopiero potem na scenę.
 */
export function drawSecondTrack(
  ctx: CanvasRenderingContext2D, camX: number, o: OncomingTrains, stations: StationSpot[], sway: number,
): void {
  // nasyp drugiego toru: ciemna skarpa pod tłuczniem, żeby tor nie wisiał w powietrzu
  ctx.fillStyle = PAL.ballastShade;
  ctx.fillRect(0, TRACK2_Y + 7, W, 3);
  ctx.fillStyle = PAL.earthShade;
  ctx.fillRect(0, TRACK2_Y + 10, W, 2);
  drawTrack(ctx, camX, TRACK2_Y);
  if (!tmp) {
    let c!: CanvasRenderingContext2D;
    const cv = makeSprite(W, H, (x) => (c = x));
    tmp = [cv, c];
  }
  const [cv, t] = tmp;
  t.clearRect(0, 0, W, H);
  let any = false;
  for (const tr of o.trains) {
    drawCars(t, tr.cars, tr.x - camX);
    any = true;
  }
  for (const s of stations) {
    const p = parked(s.seed, s.width);
    if (!p) continue;
    drawCars(t, p.train.cars, s.x + p.dx);
    any = true;
  }
  if (any) {
    // dalszy plan: lekko ciemniej i mniej nasycone
    t.globalCompositeOperation = 'source-atop';
    t.globalAlpha = 0.2;
    t.fillStyle = PAL.hazeFar;
    t.fillRect(0, 0, W, H);
    t.globalAlpha = 0.1;
    t.fillStyle = PAL.shadow;
    t.fillRect(0, 0, W, H);
    t.globalAlpha = 1;
    t.globalCompositeOperation = 'source-over';
    ctx.drawImage(cv, 0, 0);
  }
  drawWires(ctx, camX, sway, WIRE2_DY);
}

/** Nocą: oświetlone okna EZT, reflektory (z przodu) i czerwone światła tylne każdego składu. */
export function drawOncomingLights(
  ctx: CanvasRenderingContext2D, camX: number, o: OncomingTrains, stations: StationSpot[], night: number,
): void {
  if (night <= 0.02) return;
  const lamp = (x: number, y: number, col: string, cone: boolean) => {
    if (x < -8 || x > W + 8) return;
    ctx.fillStyle = col;
    ctx.globalAlpha = night * 0.4;
    ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.globalAlpha = night;
    ctx.fillRect(x - 1, y - 1, 2, 2);
    if (cone) {
      // stożek reflektora w stronę jazdy (w lewo)
      for (let dx = 4; dx < 90; dx++) {
        ctx.globalAlpha = night * 0.2 * (1 - dx / 90);
        ctx.fillRect(x - dx, y - 1 - (dx >> 4), 1, 3 + (dx >> 3));
      }
    }
    ctx.globalAlpha = 1;
  };
  const light = (sx: number, cars: OcCar[], moving: boolean) => {
    let x = sx;
    cars.forEach((c, i) => {
      const y0 = TRACK2_Y - OC_H + 1;
      for (const [wx, wy, ww, wh] of c.windows) {
        const px = Math.round(x) + wx;
        if (px + ww < 0 || px > W) continue;
        ctx.globalAlpha = night * 0.95;
        ctx.fillStyle = PAL.windowLit;
        ctx.fillRect(px, y0 + wy, ww, wh);
        ctx.globalAlpha = night * 0.5;
        ctx.fillStyle = PAL.windowGlow;
        ctx.fillRect(px, y0 + wy, ww, 2);
      }
      if (i === 0) lamp(Math.round(x) + 3, TRACK2_Y - 6, PAL.headlight, moving);
      if (i === cars.length - 1) lamp(Math.round(x) + c.w - 3, TRACK2_Y - 6, PAL.tailRed, false);
      x += c.w + GAP;
    });
  };
  for (const t of o.trains) light(t.x - camX, t.cars, true);
  for (const s of stations) {
    const p = parked(s.seed, s.width);
    if (p) light(s.x + p.dx, p.train.cars, false);
  }
}
