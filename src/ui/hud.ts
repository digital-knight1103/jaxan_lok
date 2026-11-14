// HUD: minimalistyczny panel w barwach JAXAN (czerń + magenta + zieleń),
// rysowany w buforze 640×360 pikselową czcionką. Chowa się po bezczynności.
import { MAX_KMH, SPEED_STEP_KMH } from '../config';
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
  { action: 'toggle-run', key: 'SP', icon: (s) => (s.running ? 'pause' : 'play'), active: (s) => s.running },
  { action: 'slower', key: '<', icon: () => 'slower', active: () => false },
  { action: 'faster', key: '>', icon: () => 'faster', active: () => false },
  { action: 'toggle-mute', key: 'M', icon: (s) => (s.muted ? 'muted' : 'sound'), active: (s) => !s.muted },
  { action: 'fullscreen', key: 'F', icon: () => 'full', active: () => false },
];

// układ panelu (piksele gry)
const PX = 6;
const PY = 6;
const PW = 140;
const PH = 60;
const BTN = 13;
/** Wysokość paska podglądu sygnału pod panelem. */
const SIG_H = 12;
/** Szerokość klikalnego pola trybu jazdy (prawa część paska). */
const MODE_W = 52;
const BTN_Y = PY + 31;
const BTN_X0 = PX + 5;
const BTN_STEP = 18;
const BAR = { x: PX + 62, y: PY + 17, w: 72, h: 5 };

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
