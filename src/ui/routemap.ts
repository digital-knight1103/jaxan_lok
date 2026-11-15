// Mapa trasy: cienki pasek na dole ekranu w stylu HUD. Pokazuje pozycję pociągu
// i punkty ±10 km (stacja, kopalnia, mosty, zakłady). Przeciąganie przewija podgląd,
// kliknięcie w punkt zwraca go do szybkiego przejazdu. Chowa się razem z HUD.
import { H, W } from '../config';
import { PAL } from '../palette';
import { drawText, textWidth } from '../engine/font';
import { KM_PX, MAP_RANGE_KM, type Poi, type RouteIndex } from '../scene/routeindex';
import type { MapIcon } from '../scene/segments/types';
import { SEM_BEFORE_STATION_PX } from '../train/signals';
import type { Zone } from '../train/limits';

/** Kolor znacznika sygnału na mapie (id stacji, rodzaj sygnału). */
export type SignalColorFn = (stationIndex: number, kind: 'warn' | 'sem') => string;

// geometria (piksele gry)
const PANEL = { x: 110, y: H - 18, w: 420, h: 15 };
const BAR = { x: PANEL.x + 24, y: H - 11, w: PANEL.w - 48 };
const PX_PER_KM = BAR.w / (2 * MAP_RANGE_KM);
const BAR_CX = BAR.x + BAR.w / 2;
/** Po tylu sekundach bez przeciągania podgląd wraca do pociągu. */
const RETURN_AFTER_S = 5;

// ikony 7×5: litera = kolor
const ICONS: Record<MapIcon, string[]> = {
  station: ['..bbb..', '.bbbbb.', 'bbbbbbb', '.w.w.w.', '.wwwww.'],
  quarry: ['...y...', '..yyy..', '..ggg..', '.ggggg.', 'ggggggg'],
  bridge: ['nnnnnnn', 'nn.n.nn', 'n..n..n', 'n..n..n', 'n..n..n'],
  plant: ['.s...s.', 's...s..', 'd...d..', 'd.d.d.d', 'ddddddd'],
  gravel: ['bbbbm..', '.w.m...', '.wm..a.', '.m..aaa', 'm..aaaa'],
  crossing: ['.......', 'w.....w', '.w...w.', '..w.w..', 'rrrrrrr'],
  city: ['...p...', '...p...', '..ppp..', 't.ppp.t', 'ttppptt'],
};
const ICON_COLORS: Record<string, string> = {
  b: PAL.signBlue, w: PAL.white, y: PAL.machine, g: PAL.rock, n: PAL.bridgeHi, s: PAL.smokeHi, d: PAL.plantHi,
  m: PAL.locoMagentaHi, r: PAL.barrierRed, a: PAL.sand, p: PAL.pkinHi, t: PAL.towerGlassHi,
};

export class RouteMap {
  /** Przesunięcie podglądu względem pociągu (px świata). */
  private offset = 0;
  private drag: { startX: number; startOffset: number; moved: number } | null = null;
  private sinceDrag = RETURN_AFTER_S;
  private hover: Poi | null = null;

  constructor(private index: RouteIndex) {}

  get dragging(): boolean {
    return this.drag !== null;
  }

  contains(x: number, y: number): boolean {
    return x >= PANEL.x && x < PANEL.x + PANEL.w && y >= PANEL.y - 4 && y < PANEL.y + PANEL.h;
  }

  private center(trainX: number): number {
    return trainX + this.offset;
  }

  private toMapX(wx: number, center: number): number {
    return Math.round(BAR_CX + ((wx - center) / KM_PX) * PX_PER_KM);
  }

  private visible(center: number): Poi[] {
    const r = MAP_RANGE_KM * KM_PX;
    return this.index.between(Math.max(0, center - r), center + r);
  }

  private poiAt(x: number, center: number): Poi | null {
    let best: Poi | null = null;
    let bestD = 5;
    for (const p of this.visible(center)) {
      const d = Math.abs(this.toMapX(p.anchorX, center) - x);
      // landmarki „wygrywają" z mostami/zakładami przy podobnej odległości
      const score = d - (rank(p.icon) === 1 ? 1.5 : 0);
      if (score < bestD) {
        bestD = score;
        best = p;
      }
    }
    return best;
  }

  update(dt: number): void {
    if (this.drag) return;
    this.sinceDrag += dt;
    if (this.sinceDrag > RETURN_AFTER_S) this.offset *= Math.max(0, 1 - dt * 3); // płynny powrót do pociągu
    if (Math.abs(this.offset) < 1) this.offset = 0;
  }

  /** true = zdarzenie obsłużone przez mapę. */
  pointerDown(x: number, y: number): boolean {
    if (!this.contains(x, y)) return false;
    this.drag = { startX: x, startOffset: this.offset, moved: 0 };
    return true;
  }

  pointerMove(x: number, y: number, trainX: number): void {
    if (this.drag) {
      const dx = x - this.drag.startX;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dx));
      // przeciągnięcie w prawo = podgląd wstecz (jak przesuwanie mapy palcem)
      const off = this.drag.startOffset - (dx / PX_PER_KM) * KM_PX;
      this.offset = Math.max(-trainX, Math.min(50 * KM_PX, off));
      return;
    }
    this.hover = this.contains(x, y) ? this.poiAt(x, this.center(trainX)) : null;
  }

  /** Koniec przeciągania; krótkie kliknięcie w punkt zwraca ten punkt (do przejazdu). */
  pointerUp(x: number, trainX: number): Poi | null {
    const d = this.drag;
    this.drag = null;
    if (!d) return null;
    this.sinceDrag = 0;
    if (d.moved >= 3) return null;
    return this.poiAt(x, this.center(trainX));
  }

  draw(
    ctx: CanvasRenderingContext2D, trainX: number, alpha: number, sigColor?: SignalColorFn,
    zonesFn?: (x0: number, x1: number) => Zone[],
  ): void {
    if (alpha <= 0) return;
    const center = this.center(trainX);
    ctx.globalAlpha = alpha;
    // panel
    ctx.fillStyle = PAL.hudBg;
    ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    ctx.fillStyle = PAL.locoMagenta;
    ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, 1);
    ctx.fillRect(PANEL.x, PANEL.y + PANEL.h - 1, PANEL.w, 1);
    ctx.fillRect(PANEL.x, PANEL.y, 1, PANEL.h);
    ctx.fillRect(PANEL.x + PANEL.w - 1, PANEL.y, 1, PANEL.h);
    drawText(ctx, `-${MAP_RANGE_KM}`, PANEL.x + 4, PANEL.y + 5, PAL.hudDim);
    drawText(ctx, `+${MAP_RANGE_KM}`, PANEL.x + PANEL.w - 4 - textWidth(`+${MAP_RANGE_KM}`), PANEL.y + 5, PAL.hudDim);

    // tor: przejechany (przyciemniony) i przed pociągiem (zielony)
    const trainMx = this.toMapX(trainX, center);
    const split = Math.max(BAR.x, Math.min(BAR.x + BAR.w, trainMx));
    const lineY = BAR.y + 2;
    ctx.fillStyle = PAL.hudButtonHi;
    ctx.fillRect(BAR.x, lineY, split - BAR.x, 1);
    ctx.fillStyle = PAL.jaxanGreen;
    ctx.fillRect(split, lineY, BAR.x + BAR.w - split, 1);
    // podziałka co 1 km (co 5 km wyższa) – przypięta do trasy, przesuwa się
    const firstKm = Math.ceil((center - MAP_RANGE_KM * KM_PX) / KM_PX);
    for (let km = firstKm; km * KM_PX <= center + MAP_RANGE_KM * KM_PX; km++) {
      if (km < 0) continue;
      const mx = this.toMapX(km * KM_PX, center);
      ctx.fillStyle = km % 5 === 0 ? PAL.hudText : PAL.hudDim;
      ctx.fillRect(mx, lineY + 1, 1, km % 5 === 0 ? 2 : 1);
    }

    // ograniczenia prędkości: cienki pasek pod torem (100 jasny, 80 pomarańczowy, 60 czerwony)
    if (zonesFn) {
      for (const z of zonesFn(center - MAP_RANGE_KM * KM_PX, center + MAP_RANGE_KM * KM_PX)) {
        const a = Math.max(BAR.x, this.toMapX(z.startX, center));
        const b = Math.min(BAR.x + BAR.w, this.toMapX(z.endX, center));
        if (b <= a) continue;
        ctx.fillStyle = z.kmh >= 100 ? PAL.hudText : z.kmh >= 80 ? PAL.sigOrange : PAL.sigRed;
        ctx.fillRect(a, lineY + 4, Math.max(1, b - a), 1);
      }
    }

    // semafory: drobne znaczniki nad torem (tarcza 1 km przed semaforem), kolor = sygnał
    for (const p of this.visible(center)) {
      if (!p.signals) continue;
      const semX = p.startX - SEM_BEFORE_STATION_PX;
      for (const [kind, wx] of [['warn', semX - Math.round(KM_PX)], ['sem', semX]] as const) {
        const mx = this.toMapX(wx, center);
        if (mx < BAR.x || mx > BAR.x + BAR.w) continue;
        ctx.fillStyle = PAL.sigHead;
        ctx.fillRect(mx - 1, lineY - 3, 3, 3);
        ctx.fillStyle = sigColor ? sigColor(p.index, kind) : PAL.sigMast;
        ctx.fillRect(mx, lineY - 2, 1, 1);
      }
    }

    // punkty: najpierw mosty/zakłady, na wierzchu landmarki
    const pois = this.visible(center).sort((a, b) => rank(a.icon) - rank(b.icon));
    for (const p of pois) {
      const mx = this.toMapX(p.anchorX, center);
      if (mx < BAR.x - 3 || mx > BAR.x + BAR.w + 3) continue;
      // mosty i zakłady są częste – drobny znacznik pod torem (pełna ikona po najechaniu)
      if (rank(p.icon) === 0 && this.hover !== p) {
        ctx.fillStyle = p.icon === 'bridge' ? PAL.bridgeHi : PAL.plantHi;
        ctx.fillRect(mx - 1, lineY + 2, 3, 2);
        continue;
      }
      const icon = ICONS[p.icon];
      for (let r = 0; r < icon.length; r++) {
        for (let c = 0; c < icon[r].length; c++) {
          const ch = icon[r][c];
          if (ch === '.') continue;
          ctx.fillStyle = this.hover === p ? PAL.locoMagentaHi : ICON_COLORS[ch];
          ctx.fillRect(mx - 3 + c, BAR.y - 4 + r, 1, 1);
        }
      }
    }

    // znacznik pociągu: mała lokomotywa w barwach JAXAN
    if (trainMx >= BAR.x - 4 && trainMx <= BAR.x + BAR.w + 4) {
      ctx.fillStyle = PAL.locoBlack;
      ctx.fillRect(trainMx - 4, BAR.y - 1, 9, 5);
      ctx.fillStyle = PAL.locoMagentaHi;
      ctx.fillRect(trainMx - 3, BAR.y, 7, 3);
      ctx.fillStyle = PAL.jaxanGreen;
      ctx.fillRect(trainMx + 2, BAR.y, 1, 3);
    }

    // podpis: najechany punkt albo najbliższy landmark przed pociągiem
    const label = this.hover ?? this.index.between(trainX, trainX + MAP_RANGE_KM * KM_PX).find((p) => rank(p.icon) === 1);
    if (label) {
      const km = (label.anchorX - trainX) / KM_PX;
      const kmText = Math.abs(km).toFixed(1);
      const text = `${label.label} ${km < 0 && kmText !== '0.0' ? '-' : ''}${kmText} KM`;
      const tw = textWidth(text);
      const tx = Math.max(4, Math.min(W - tw - 8, Math.round(this.toMapX(label.anchorX, center) - tw / 2)));
      ctx.fillStyle = PAL.hudBg;
      ctx.fillRect(tx - 3, PANEL.y - 12, tw + 6, 10);
      ctx.fillStyle = PAL.locoMagenta;
      ctx.fillRect(tx - 3, PANEL.y - 12, tw + 6, 1);
      drawText(ctx, text, tx, PANEL.y - 9, PAL.hudText);
    }
    ctx.globalAlpha = 1;
  }
}

function rank(icon: MapIcon): number {
  return icon === 'bridge' || icon === 'plant' || icon === 'crossing' ? 0 : 1;
}
