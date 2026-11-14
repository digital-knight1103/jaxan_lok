// Rysowanie semaforów świetlnych PKP: tarcza ostrzegawcza (2 komory) i semafor wjazdowy
// (3 komory), na słupie z białą tablicą numeru. Słupy stoją za torem (warstwa „za
// pociągiem", nocą przyciemniana), światła z poświatą rysowane osobno po nakładce nocy.
import { TRACK_Y, W } from '../config';
import { PAL } from '../palette';
import { cached, disc, makeSprite, rect } from '../engine/sprite';
import { drawText, textWidth } from '../engine/font';
import { warnAspect, type SignalPost } from '../train/signals';

interface Kind {
  /** Wysokość słupa (px nad szyną). */
  mast: number;
  /** Kolory komór od góry. */
  lamps: string[];
  label: string;
}

const SEM: Kind = { mast: 66, lamps: [PAL.sigGreen, PAL.sigOrange, PAL.sigRed], label: 'A' };
const WARN: Kind = { mast: 50, lamps: [PAL.sigOrange, PAL.sigGreen], label: 'OA' };

const HEAD_W = 7;
const LAMP_STEP = 5;
const headH = (k: Kind) => k.lamps.length * LAMP_STEP + 2;
/** Górna krawędź głowicy (y ekranu). */
const headTop = (k: Kind) => TRACK_Y - k.mast;
/** Środek komory i (y ekranu). */
const lampY = (k: Kind, i: number) => headTop(k) + 3 + i * LAMP_STEP;

/** Środek słupa w sprite'cie (sprite szerszy niż głowica – mieści tablicę „OA”). */
const CX = 6;

/** Statyczny słup z głowicą i tablicą – sprite cache'owany. */
function postSprite(k: Kind): HTMLCanvasElement {
  return cached('signal-' + k.label, () =>
    makeSprite(CX * 2 + 1, k.mast + 4, (c) => {
      const hh = headH(k);
      const hx = CX - 4; // lewa krawędź głowicy (z obwódką)
      // słup (z cieniem po prawej) i podstawa
      rect(c, CX - 1, hh, 2, k.mast + 4 - hh, PAL.sigMast);
      rect(c, CX, hh, 1, k.mast + 4 - hh, PAL.sigMastShade);
      rect(c, CX - 3, k.mast + 1, 7, 3, PAL.sigMastShade);
      // głowica: czarna tarcza tła z białą obwódką i komorami
      rect(c, hx, 0, HEAD_W + 2, hh, PAL.sigPlate);
      rect(c, hx + 1, 1, HEAD_W, hh - 2, PAL.sigHead);
      k.lamps.forEach((_, i) => {
        rect(c, CX - 1, 2 + i * LAMP_STEP, 3, 3, PAL.sigOff);
        rect(c, CX - 2, 1 + i * LAMP_STEP, 5, 1, PAL.shadow); // daszek komory
      });
      // tablica numeru pod głowicą
      const tw = textWidth(k.label);
      const px = CX - ((tw + 4) >> 1);
      const py = hh + 3;
      rect(c, px, py, tw + 4, 9, PAL.sigHead);
      rect(c, px + 1, py + 1, tw + 2, 7, PAL.sigPlate);
      drawText(c, k.label, px + 2, py + 2, PAL.sigHead);
    }),
  );
}

function each(camX: number, posts: SignalPost[], fn: (k: Kind, sx: number, p: SignalPost) => void): void {
  for (const p of posts) {
    for (const [k, wx] of [[WARN, p.warnX], [SEM, p.semX]] as const) {
      const sx = Math.round(wx - camX);
      if (sx > -20 && sx < W + 20) fn(k, sx, p);
    }
  }
}

/** Słupy z głowicami (warstwa za pociągiem). */
export function drawSignalPosts(ctx: CanvasRenderingContext2D, camX: number, posts: SignalPost[]): void {
  each(camX, posts, (k, sx) => ctx.drawImage(postSprite(k), sx - CX, headTop(k)));
}

/** Zapalone komory z poświatą – mocniejszą nocą. */
export function drawSignalLights(
  ctx: CanvasRenderingContext2D, camX: number, posts: SignalPost[], night: number, time: number,
): void {
  each(camX, posts, (k, sx, p) => {
    let lit = -1;
    if (k === SEM) {
      lit = p.aspect === 'green' ? 0 : p.aspect === 'orange' ? 1 : p.aspect === 'red' ? 2 : -1;
    } else {
      const w = warnAspect(p.aspect);
      if (w === 'orange') lit = 0;
      else if (w === 'green' || (w === 'greenBlink' && time % 1 < 0.55)) lit = 1;
    }
    if (lit < 0) return;
    const color = k.lamps[lit];
    const cy = lampY(k, lit);
    ctx.globalAlpha = 0.18 + 0.35 * night;
    disc(ctx, sx, cy, 4 + night * 3, color);
    ctx.globalAlpha = 0.35 + 0.3 * night;
    disc(ctx, sx, cy, 2 + night, color);
    ctx.globalAlpha = 1;
    rect(ctx, sx - 1, cy - 1, 3, 3, color);
    rect(ctx, sx - 1, cy - 1, 1, 1, PAL.sparkHot); // błysk soczewki
  });
}

/** Kolor światła sygnału do podglądu w HUD i na mapie. */
export function signalColor(kind: 'warn' | 'sem', p: SignalPost, time: number): string {
  if (kind === 'sem') {
    return p.aspect === 'green' ? PAL.sigGreen : p.aspect === 'orange' ? PAL.sigOrange : p.aspect === 'red' ? PAL.sigRed : PAL.sigOff;
  }
  const w = warnAspect(p.aspect);
  if (w === 'orange') return PAL.sigOrange;
  if (w === 'green' || (w === 'greenBlink' && time % 1 < 0.55)) return PAL.sigGreen;
  return PAL.sigOff;
}
