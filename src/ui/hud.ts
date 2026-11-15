// HUD: minimalistyczny panel w barwach JAXAN (czerń + magenta + zieleń),
// rysowany w buforze 640×360 pikselową czcionką. Chowa się po bezczynności.
import { MAX_KMH, SPEED_STEP_KMH, W, H } from '../config';
import { PAL } from '../palette';
import { drawText, textWidth } from '../engine/font';
import type { Action } from '../engine/input';

type Icon = string[];

const ICONS: Record<string, Icon> = {
  horn: ['.........', '#......##', '##...####', '#########', '#########', '##...####', '#......##', '.........', '.........'],
  moon: ['..####...', '.##......', '##.......', '##.......', '##.......', '##.......', '.##......', '..####...', '.........'],
  sun: ['....#....', '.#.....#.', '...###...', '..#####..', '#.#####.#', '..#####..', '...###...', '.#.....#.', '....#....'],
  play: ['.#.......', '.##......', '.###.....', '.####....', '.#####...', '.####....', '.###.....', '.##......', '.#.......'],
  pause: ['.##..##..', '.##..##..', '.##..##..', '.##..##..', '.##..##..', '.##..##..', '.##..##..', '.##..##..', '.........'],
  slower: ['.........', '...#...#.', '..#...#..', '.#...#...', '#...#....', '.#...#...', '..#...#..', '...#...#.', '.........'],
  faster: ['.........', '.#...#...', '..#...#..', '...#...#.', '....#...#', '...#...#.', '..#...#..', '.#...#...', '.........'],
  sound: ['...#.....', '..##..#..', '####...#.', '####.#.#.', '####.#.#.', '####...#.', '..##..#..', '...#.....', '.........'],
  muted: ['...#.....', '..##.....', '####.#.#.', '####..#..', '####.#.#.', '####.....', '..##.....', '...#.....', '.........'],
  cinema: ['.........', '#########', '#.#.#.#.#', '#########', '#.......#', '#.......#', '#.......#', '#########', '.........'],
  help: ['..#####..', '.##...##.', '.##...##.', '.....##..', '....##...', '....##...', '.........', '....##...', '....##...'],
  full: ['###...###', '#.......#', '#.......#', '.........', '.........', '.........', '#.......#', '#.......#', '###...###'],
};

export interface HudState {
  kmh: number;
  targetKmh: number;
  running: boolean;
  night: boolean;
  muted: boolean;
  horn: boolean;
  /** Jazda automatyczna czy ręczna. */
  auto: boolean;
  /** Najbliższy sygnał przed pociągiem (podgląd). */
  signal: { label: string; km: number; color: string } | null;
}

interface Button { action: Action; key: string; icon: (s: HudState) => string; active: (s: HudState) => boolean }

const BUTTONS: Button[] = [
  { action: 'horn-down', key: 'H', icon: () => 'horn', active: (s) => s.horn },
  { action: 'toggle-night', key: 'N', icon: (s) => (s.night ? 'sun' : 'moon'), active: (s) => s.night },
  { action: 'toggle-run', key: 'SPC', icon: (s) => (s.running ? 'pause' : 'play'), active: (s) => s.running },
  { action: 'slower', key: '<', icon: () => 'slower', active: () => false },
  { action: 'faster', key: '>', icon: () => 'faster', active: () => false },
  { action: 'toggle-mute', key: 'M', icon: (s) => (s.muted ? 'muted' : 'sound'), active: (s) => !s.muted },
  { action: 'fullscreen', key: 'F', icon: () => 'full', active: () => false },
  { action: 'cinema', key: 'C', icon: () => 'cinema', active: () => false },
  { action: 'help', key: '?', icon: () => 'help', active: () => false },
];

// układ panelu (piksele gry)
const PX = 6;
const PY = 6;
const BTN = 13;
const BTN_STEP = 18;
const PW = 10 + (BUTTONS.length - 1) * BTN_STEP + BTN;
const PH = 60;
/** Wysokość paska podglądu sygnału pod panelem. */
const SIG_H = 12;
/** Szerokość klikalnego pola trybu jazdy (prawa część paska). */
const MODE_W = 52;
const BTN_Y = PY + 31;
const BTN_X0 = PX + 5;
const BAR = { x: PX + 62, y: PY + 17, w: PW - 62 - 6, h: 5 };

export type HudHit = { action: Action } | { setTarget: number } | null;

export class Hud {
  alpha = 1;

  /** Płynne pojawianie się / chowanie. */
  update(dt: number, visible: boolean): void {
    const target = visible ? 1 : 0;
    const step = dt * 4;
    this.alpha = this.alpha < target ? Math.min(target, this.alpha + step) : Math.max(target, this.alpha - step);
  }

  /** Trafienie w przycisk lub suwak prędkości (tylko gdy HUD widoczny). */
  hit(x: number, y: number): HudHit {
    if (this.alpha < 0.5) return null;
    for (let i = 0; i < BUTTONS.length; i++) {
      const bx = BTN_X0 + i * BTN_STEP;
      if (x >= bx && x < bx + BTN && y >= BTN_Y && y < BTN_Y + BTN) return { action: BUTTONS[i].action };
    }
    // pole trybu jazdy (AUTO / RĘCZNA) na pasku pod panelem = przełącznik
    const sy = PY + PH + 2;
    if (x >= PX + PW - MODE_W && x < PX + PW && y >= sy && y < sy + SIG_H) return { action: 'toggle-auto' };
    if (x >= BAR.x - 2 && x < BAR.x + BAR.w + 2 && y >= BAR.y - 5 && y < BAR.y + BAR.h + 5) {
      const v = ((x - BAR.x) / BAR.w) * MAX_KMH;
      return { setTarget: Math.max(0, Math.min(MAX_KMH, Math.round(v / SPEED_STEP_KMH) * SPEED_STEP_KMH)) };
    }
    return null;
  }

  /** Czy punkt leży na panelu (klik w panel nie trąbi itp.). */
  contains(x: number, y: number): boolean {
    return this.alpha >= 0.5 && x >= PX && x < PX + PW && y >= PY && y < PY + PH + 2 + SIG_H;
  }

  draw(ctx: CanvasRenderingContext2D, s: HudState): void {
    if (this.alpha <= 0) return;
    ctx.globalAlpha = this.alpha;
    // panel
    ctx.fillStyle = PAL.hudBg;
    ctx.fillRect(PX, PY, PW, PH);
    ctx.fillStyle = PAL.locoMagenta;
    ctx.fillRect(PX, PY, PW, 1);
    ctx.fillRect(PX, PY + PH - 1, PW, 1);
    ctx.fillRect(PX, PY, 1, PH);
    ctx.fillRect(PX + PW - 1, PY, 1, PH);
    ctx.fillStyle = PAL.jaxanGreen;
    ctx.fillRect(PX + 1, PY + 1, PW - 2, 1);

    // tytuł
    drawText(ctx, 'JAXAN', PX + 5, PY + 5, PAL.locoMagentaHi);
    drawText(ctx, 'EXPRESS', PX + 5 + textWidth('JAXAN') + 4, PY + 5, PAL.hudText);

    // prędkościomierz
    const v = String(Math.round(s.kmh));
    drawText(ctx, v, PX + 5, PY + 15, PAL.hudText, 2);
    drawText(ctx, 'KM/H', PX + 7 + textWidth(v, 2), PY + 20, PAL.hudDim);
    ctx.fillStyle = PAL.hudButton;
    ctx.fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
    ctx.fillStyle = PAL.jaxanGreen;
    ctx.fillRect(BAR.x, BAR.y, Math.round((s.kmh / MAX_KMH) * BAR.w), BAR.h);
    const tx = BAR.x + Math.round((s.targetKmh / MAX_KMH) * BAR.w);
    ctx.fillStyle = PAL.locoMagentaHi;
    ctx.fillRect(Math.min(tx, BAR.x + BAR.w - 1), BAR.y - 2, 1, BAR.h + 4);
    const tLabel = `CEL ${s.targetKmh}`;
    drawText(ctx, tLabel, BAR.x + BAR.w - textWidth(tLabel), PY + 5, PAL.hudDim);
    drawText(ctx, s.running ? '' : 'STOP', BAR.x, PY + 25, PAL.locoMagentaHi);

    // podgląd najbliższego sygnału i tryb jazdy – pasek pod panelem
    const sy = PY + PH + 2;
    ctx.fillStyle = PAL.hudBg;
    ctx.fillRect(PX, sy, PW, SIG_H);
    ctx.fillStyle = PAL.locoMagenta;
    ctx.fillRect(PX, sy + SIG_H - 1, PW, 1);
    // przełącznik trybu: przycisk z podpisem i skrótem A
    const mode = s.auto ? 'AUTO' : 'RĘCZNA';
    const mx = PX + PW - MODE_W;
    ctx.fillStyle = s.auto ? PAL.jaxanGreenShade : PAL.hudButton;
    ctx.fillRect(mx, sy + 1, MODE_W - 1, SIG_H - 3);
    ctx.fillStyle = s.auto ? PAL.jaxanGreen : PAL.hudButtonHi;
    ctx.fillRect(mx, sy + 1, MODE_W - 1, 1);
    drawText(ctx, 'A', mx + 3, sy + 4, PAL.hudDim);
    drawText(ctx, mode, PX + PW - 5 - textWidth(mode), sy + 4, s.auto ? PAL.hudText : PAL.locoMagentaHi);
    if (s.signal) {
      ctx.fillStyle = PAL.sigHead;
      ctx.fillRect(PX + 4, sy + 2, 7, 8);
      ctx.fillStyle = s.signal.color;
      ctx.fillRect(PX + 6, sy + 4, 3, 3);
      drawText(ctx, `${s.signal.label} ${s.signal.km.toFixed(1)} KM`, PX + 15, sy + 4, PAL.hudText);
    } else {
      drawText(ctx, 'BRAK SYGNAŁÓW', PX + 5, sy + 4, PAL.hudDim);
    }

    // przyciski + skróty klawiszowe pod spodem
    BUTTONS.forEach((b, i) => {
      const bx = BTN_X0 + i * BTN_STEP;
      const active = b.active(s);
      ctx.fillStyle = active ? PAL.jaxanGreenShade : PAL.hudButton;
      ctx.fillRect(bx, BTN_Y, BTN, BTN);
      ctx.fillStyle = active ? PAL.jaxanGreen : PAL.hudButtonHi;
      ctx.fillRect(bx, BTN_Y, BTN, 1);
      const icon = ICONS[b.icon(s)];
      ctx.fillStyle = PAL.hudText;
      for (let r = 0; r < icon.length; r++) {
        for (let c = 0; c < icon[r].length; c++) if (icon[r][c] === '#') ctx.fillRect(bx + 2 + c, BTN_Y + 2 + r, 1, 1);
      }
      drawText(ctx, b.key, bx + ((BTN - textWidth(b.key)) >> 1), BTN_Y + BTN + 3, PAL.hudDim);
    });
    ctx.globalAlpha = 1;
  }
}

/** Dane panelu ograniczenia prędkości (prawy górny róg). */
export interface LimitHud {
  /** Obowiązująca prędkość (km/h). */
  limit: number;
  /** Najbliższa zmiana: nowa prędkość i odległość w km; null = brak. */
  next: { kmh: number; km: number } | null;
  kmh: number;
  /** Przekroczenie (tylko jazda ręczna) – panel miga na pomarańczowo. */
  over: boolean;
}

const LP = { w: 152, h: 50 };

/** Panel „obowiązuje: N" – duża liczba, pod nią następna zmiana, obok aktualna prędkość. */
export function drawLimitPanel(ctx: CanvasRenderingContext2D, s: LimitHud, time: number, alpha: number): void {
  if (alpha <= 0) return;
  const x = W - 6 - LP.w;
  const y = 6;
  const blink = s.over && time % 0.5 < 0.25;
  const col = s.over ? (blink ? PAL.hudBg : PAL.sigOrange) : PAL.jaxanGreen;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PAL.hudBg;
  ctx.fillRect(x, y, LP.w, LP.h);
  ctx.fillStyle = s.over ? PAL.sigOrange : PAL.locoMagenta;
  ctx.fillRect(x, y, LP.w, 1);
  ctx.fillRect(x, y + LP.h - 1, LP.w, 1);
  ctx.fillRect(x, y, 1, LP.h);
  ctx.fillRect(x + LP.w - 1, y, 1, LP.h);
  drawText(ctx, 'OBOWIĄZUJE', x + 6, y + 5, PAL.hudDim);
  drawText(ctx, String(s.limit), x + 6, y + 14, s.over ? PAL.sigOrange : PAL.jaxanGreen, 4);
  // aktualna prędkość – po prawej, kolor jak ograniczenie (zielony / pomarańczowy)
  const v = String(Math.round(s.kmh));
  const vx = x + LP.w - 6;
  drawText(ctx, 'PRĘDKOŚĆ', vx - textWidth('PRĘDKOŚĆ'), y + 5, PAL.hudDim);
  drawText(ctx, v, vx - textWidth(v, 3), y + 14, col, 3);
  drawText(ctx, 'KM/H', vx - textWidth('KM/H'), y + 31, PAL.hudDim);
  ctx.fillStyle = PAL.hudButton;
  ctx.fillRect(x + 4, y + 38, LP.w - 8, 1);
  const nt = s.next ? `NASTĘPNE: ${s.next.kmh} ZA ${s.next.km.toFixed(1).replace('.', ',')} KM` : 'NASTĘPNE: BRAK ZMIAN';
  drawText(ctx, nt, x + 6, y + 41, s.next ? PAL.hudText : PAL.hudDim);
  ctx.globalAlpha = 1;
}

/** Skróty pokazywane w nakładce pomocy: [klawisz, opis]. */
export const HELP_LINES: [string, string][] = [
  ['H', 'TRĄBIENIE (PRZYTRZYMAJ)'],
  ['N', 'DZIEŃ / NOC'],
  ['SPACJA', 'START / STOP'],
  ['< >', 'PRĘDKOŚĆ -/+ 10 KM/H'],
  ['A', 'JAZDA AUTO / RĘCZNA'],
  ['M', 'DŹWIĘK WŁ. / WYŁ.'],
  ['F', 'PEŁNY EKRAN'],
  ['W', 'POGODA: AUTO, POGODNIE, POCHMURNO...'],
  ['C', 'TRYB KINOWY'],
  ['+ -', 'DODAJ / ODEJMIJ WAGON'],
  ['[ ]', 'POPRZEDNI / NASTĘPNY PUNKT TRASY'],
  ['?', 'TA POMOC'],
];

/** Półprzezroczysta nakładka z listą skrótów (barwy JAXAN); zamykana dowolnym klawiszem lub kliknięciem. */
export function drawHelp(ctx: CanvasRenderingContext2D): void {
  const kw = 46;
  let tw = 0;
  for (const [, d] of HELP_LINES) tw = Math.max(tw, textWidth(d));
  const w = 12 + kw + tw + 12;
  const rowH = 11;
  const h = 34 + HELP_LINES.length * rowH + 14;
  const x = (W - w) >> 1;
  const y = (H - h) >> 1;
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = PAL.hudBg;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.locoMagenta;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = PAL.jaxanGreen;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  drawText(ctx, 'JAXAN', x + 12, y + 10, PAL.locoMagentaHi, 2);
  drawText(ctx, 'STEROWANIE', x + 12 + textWidth('JAXAN', 2) + 8, y + 10, PAL.hudText, 2);
  HELP_LINES.forEach(([k, d], i) => {
    const ry = y + 34 + i * rowH;
    ctx.fillStyle = PAL.hudButton;
    ctx.fillRect(x + 12, ry - 3, textWidth(k) + 6, 9);
    ctx.fillStyle = PAL.hudButtonHi;
    ctx.fillRect(x + 12, ry - 3, textWidth(k) + 6, 1);
    drawText(ctx, k, x + 15, ry, PAL.locoMagentaHi);
    drawText(ctx, d, x + 12 + kw, ry, PAL.hudText);
  });
  drawText(ctx, 'DOWOLNY KLAWISZ LUB KLIKNIĘCIE ZAMYKA', x + 12, y + h - 12, PAL.hudDim);
}

/** Podpowiedź przy pierwszym uruchomieniu (u góry, na środku); alpha 0..1. */
export function drawHint(ctx: CanvasRenderingContext2D, alpha: number): void {
  if (alpha <= 0) return;
  const t = '? - STEROWANIE';
  const w = textWidth(t) + 14;
  const x = (W - w) >> 1;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PAL.hudBg;
  ctx.fillRect(x, 8, w, 15);
  ctx.fillStyle = PAL.locoMagenta;
  ctx.fillRect(x, 8, w, 1);
  ctx.fillRect(x, 22, w, 1);
  drawText(ctx, t, x + 7, 13, PAL.hudText);
  ctx.globalAlpha = 1;
}
