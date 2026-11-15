// Przejazdy kolejowo-drogowe – rysowanie: nawierzchnia na torach, rogatki biało-czerwone,
// krzyż św. Andrzeja z sygnalizatorem drogowym (dwa migające czerwone światła), wskaźnik W 6
// przed przejazdem, czekające i odjeżdżające auta (osobowe, traktor, ciężarówka z kruszywem).
// Droga biegnie w głąb sceny (od widza ku horyzontowi) i przecina oba tory. Stan (rogatki,
// światła, auta) liczy train/crossings.ts; tu tylko rysujemy – także nocą (poświata świateł).
import { TRACK_Y, W } from '../config';
import { PAL } from '../palette';
import { cached, makeSprite, rect, line, disc } from '../engine/sprite';
import { bayer } from '../engine/pixbuf';
import { crossingKind, type Crossing, type CrossingKind, type Vehicle } from '../train/crossings';
import { TRACK2_Y } from './oncoming';
import { GROUND_Y } from './segments/common';

/** x osi drogi względem początku segmentu przejazdu. */
export const CROSS_X = 240;

/** Połowa szerokości jezdni na wysokości y (perspektywa: bliżej widza szersza). */
export function roadHalf(y: number): number {
  return y >= GROUND_Y ? 16 + (y - GROUND_Y) * 0.3 : 16 + (y - GROUND_Y) * 0.2;
}

export interface CrossingRef { index: number; x: number }

/** Jezdnia w warstwach segmentu: przed torem (do dołu kadru) i za torami (w głąb). */
export function paintRoad(back: CanvasRenderingContext2D, bed: CanvasRenderingContext2D): void {
  for (let y = TRACK2_Y - 26; y < TRACK2_Y + 2; y++) {
    const h = Math.round(roadHalf(y));
    rect(back, CROSS_X - h, y, h * 2, 1, PAL.asphaltHi);
    rect(back, CROSS_X - h, y, 1, 1, PAL.asphaltShade);
    rect(back, CROSS_X + h - 1, y, 1, 1, PAL.asphaltShade);
  }
  for (let y = GROUND_Y - 6; y < bed.canvas.height; y++) {
    const h = Math.round(roadHalf(y));
    for (let x = CROSS_X - h; x < CROSS_X + h; x++) {
      const edge = x === CROSS_X - h || x === CROSS_X + h - 1;
      const t = y / 8;
      bed.fillStyle = edge ? PAL.asphaltShade : bayer(x, y) < 0.12 ? PAL.asphaltHi : bayer(x + 2, y) > 0.9 ? PAL.asphaltShade : PAL.asphalt;
      void t;
      bed.fillRect(x, y, 1, 1);
    }
    // oś jezdni: przerywana linia, dłuższe kreski bliżej widza
    const dash = 6 + Math.floor((y - GROUND_Y) / 24) * 2;
    if (((y - GROUND_Y) % (dash * 2)) < dash) rect(bed, CROSS_X - 1, y, 2, 1, PAL.roadLine);
    // białe krawędziowe linie jezdni
    rect(bed, CROSS_X - h + 2, y, 1, 1, PAL.roadLine);
    rect(bed, CROSS_X + h - 3, y, 1, 1, PAL.roadLine);
  }
}

/** Nawierzchnia przejazdu na obu torach (szyny zostają widoczne, równo z jezdnią). */
export function drawCrossingSlabs(ctx: CanvasRenderingContext2D, camX: number, list: CrossingRef[]): void {
  for (const c of list) {
    const cx = Math.round(c.x - camX);
    if (cx < -40 || cx > W + 40) continue;
    const h = Math.round(roadHalf(TRACK_Y));
    for (const [y0, y1] of [[TRACK2_Y + 2, TRACK_Y], [TRACK_Y + 2, TRACK_Y + 7]] as const) {
      rect(ctx, cx - h, y0, h * 2, y1 - y0, PAL.asphalt);
      rect(ctx, cx - h, y0, h * 2, 1, PAL.asphaltHi);
    }
    // płyty wzdłuż szyn
    for (const ty of [TRACK2_Y, TRACK_Y]) {
      rect(ctx, cx - h, ty - 1, h * 2, 1, PAL.crossPlank);
      rect(ctx, cx - h, ty + 2, h * 2, 1, PAL.crossPlank);
    }
    // oś i krawędzie jezdni przez tory
    rect(ctx, cx - 1, TRACK2_Y + 3, 2, 3, PAL.roadLine);
    rect(ctx, cx - 1, TRACK_Y + 3, 2, 3, PAL.roadLine);
  }
}

// --- wskaźnik W 6 ---
const W6_W = 25;
const W6_H = 22;

/**
 * Wskaźnik W 6a (jedna tablica) albo W 6b (dwie, jedna pod drugą): biały trójkąt równoboczny
 * wierzchołkiem ku górze z czarnym obramowaniem i czarną sylwetką pojazdu drogowego.
 * Stoi przy torze przed przejazdem.
 */
function w6Sprite(kind: CrossingKind): HTMLCanvasElement {
  const n = kind === 'b' ? 2 : 1;
  const post = kind === 'b' ? 12 : 24;
  return cached('w6' + kind, () =>
    makeSprite(W6_W, W6_H * n + post, (c) => {
      const cx = W6_W >> 1;
      rect(c, cx, W6_H * n - 1, 1, post + 1, PAL.sigMast);
      rect(c, cx + 1, W6_H * n - 1, 1, post + 1, PAL.sigMastShade);
      for (let k = 0; k < n; k++) {
        const y0 = k * W6_H;
        for (let r = 0; r < W6_H; r++) {
          const hw = Math.round(((W6_W - 1) / 2) * (r / (W6_H - 1)));
          rect(c, cx - hw, y0 + r, hw * 2 + 1, 1, PAL.ieBlack);
          if (r >= 5 && r < W6_H - 3 && hw > 4) rect(c, cx - hw + 3, y0 + r, hw * 2 - 5, 1, PAL.ieWhite);
        }
        // sylwetka auta (widok z boku) w dolnej części pola
        rect(c, cx - 5, y0 + 15, 11, 3, PAL.ieBlack);
        rect(c, cx - 3, y0 + 12, 7, 3, PAL.ieBlack);
        rect(c, cx - 4, y0 + 18, 3, 1, PAL.ieBlack);
        rect(c, cx + 2, y0 + 18, 3, 1, PAL.ieBlack);
      }
    }),
  );
}

/** Odległość W 6 przed przejazdem (px świata). */
export const W6_DIST = 380;

// --- pojazdy (widok z tyłu) ---
const TONES = [
  [PAL.carRed, PAL.carRedHi], [PAL.carBlue, PAL.carBlueHi], [PAL.carWhite, PAL.carWhite],
  [PAL.carGreen, PAL.carGreenHi], [PAL.carYellow, PAL.carYellowHi], [PAL.carSilver, PAL.carWhite],
] as const;
/** Dostępne skale rysowania (bez skali ułamkowej bitmapy – każdy rozmiar rysowany od nowa). */
const SCALES = [0.45, 0.6, 0.8, 1, 1.3, 1.7, 2.2];
const BASE_W: Record<Vehicle['kind'], number> = { car: 26, tractor: 22, truck: 28 };

function vehicleSprite(kind: Vehicle['kind'], tone: number, si: number): HTMLCanvasElement {
  return cached(`veh-${kind}-${tone}-${si}`, () => {
    const s = SCALES[si];
    const S = (v: number) => Math.max(1, Math.round(v * s));
    const [body, hi] = TONES[tone % TONES.length];
    const w = S(BASE_W[kind]);
    const h = S(kind === 'car' ? 16 : kind === 'tractor' ? 22 : 30);
    return makeSprite(w, h, (c) => {
      if (kind === 'car') {
        rect(c, 0, S(6), w, S(7), body); // nadwozie
        rect(c, 0, S(6), w, 1, hi);
        rect(c, S(4), 0, w - S(8), S(6), body); // kabina
        rect(c, S(5), S(1), w - S(10), S(4), PAL.carGlass); // tylna szyba
        rect(c, S(4), 0, w - S(8), 1, hi);
        rect(c, 0, S(13), w, S(2), PAL.locoBlack); // zderzak
        rect(c, 0, S(8), S(3), Math.max(1, S(2)), PAL.tailRed); // światła tylne
        rect(c, w - S(3), S(8), S(3), Math.max(1, S(2)), PAL.tailRed);
        rect(c, 0, h - S(4), S(4), S(4), PAL.wheelDark); // koła
        rect(c, w - S(4), h - S(4), S(4), S(4), PAL.wheelDark);
      } else if (kind === 'tractor') {
        rect(c, 0, S(8), S(6), h - S(8), PAL.wheelDark); // duże tylne koła
        rect(c, w - S(6), S(8), S(6), h - S(8), PAL.wheelDark);
        rect(c, S(6), S(4), w - S(12), S(12), PAL.tractorOrange);
        rect(c, S(6), S(4), w - S(12), 1, PAL.tractorOrangeHi);
        rect(c, S(5), 0, w - S(10), S(8), PAL.carGlass); // kabina
        rect(c, S(5), 0, w - S(10), 1, PAL.tractorOrange);
        rect(c, S(7), S(16), w - S(14), S(4), PAL.locoGraphite); // przekładnia / hak
      } else {
        // wywrotka z kruszywem: hałda nad skrzynią, skrzynia, tylna klapa, podwozie
        rect(c, S(2), 0, w - S(4), S(5), PAL.aggregate);
        rect(c, S(4), 0, w - S(10), 1, PAL.aggregateHi);
        rect(c, S(1), S(3), w - S(2), 1, PAL.aggregateShade);
        rect(c, 0, S(5), w, S(16), PAL.truckBed);
        rect(c, 0, S(5), w, 1, PAL.truckCabHi);
        rect(c, S(2), S(8), w - S(4), S(12), PAL.truckCab); // klapa
        rect(c, S(2), S(8), w - S(4), 1, PAL.truckCabHi);
        rect(c, 0, S(21), w, S(3), PAL.locoBlack); // zderzak
        rect(c, 0, S(11), S(2), Math.max(1, S(2)), PAL.tailRed);
        rect(c, w - S(2), S(11), S(2), Math.max(1, S(2)), PAL.tailRed);
        rect(c, S(1), h - S(7), S(6), S(7), PAL.wheelDark);
        rect(c, w - S(7), h - S(7), S(6), S(7), PAL.wheelDark);
      }
    });
  });
}

/** Skala pojazdu na wysokości y: szerokość ≈ 85% pasa ruchu. */
function scaleIndex(kind: Vehicle['kind'], y: number): number {
  const want = (roadHalf(y) * 0.85) / BASE_W[kind];
  let best = 0;
  for (let i = 0; i < SCALES.length; i++) if (SCALES[i] <= want + 0.02) best = i;
  return best;
}

function drawVehicle(ctx: CanvasRenderingContext2D, cx: number, v: Vehicle): void {
  const s = vehicleSprite(v.kind, v.tone, scaleIndex(v.kind, v.y));
  const lane = Math.round(cx + roadHalf(v.y) * 0.5);
  ctx.drawImage(s, lane - (s.width >> 1), Math.round(v.y) - s.height);
}

// --- rogatki ---
/** Ramię rogatki: pas biało-czerwony, down 0 = pionowo w górę, 1 = poziomo; dir −1 = w lewo, +1 = w prawo. */
function drawBoom(ctx: CanvasRenderingContext2D, px: number, py: number, len: number, down: number, dir: number): { x: number; y: number } {
  const ang = (1 - down) * (Math.PI * 0.45);
  const dx = Math.cos(ang) * dir;
  const dy = -Math.sin(ang);
  let tip = { x: px, y: py };
  for (let i = 0; i <= len; i++) {
    const x = Math.round(px + dx * i);
    const y = Math.round(py + dy * i);
    ctx.fillStyle = Math.floor(i / 4) % 2 === 0 ? PAL.barrierRed : PAL.barrierWhite;
    ctx.fillRect(x, y, 1, 2);
    tip = { x, y };
  }
  return tip;
}

/** Krzyż św. Andrzeja: dwie skrzyżowane belki biało-czerwone (czerwone obrzeże, biały środek). */
function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  for (const d of [1, -1]) {
    const y0 = d === 1 ? y : y + size;
    line(ctx, x - size / 2, y0, x + size / 2, d === 1 ? y + size : y, PAL.barrierRed);
    line(ctx, x - size / 2 + 1, y0, x + size / 2 + 1, d === 1 ? y + size : y, PAL.barrierRed);
  }
  for (const d of [1, -1]) {
    const y0 = d === 1 ? y : y + size;
    line(ctx, x - size / 2 + 1, y0, x + size / 2 - 1, d === 1 ? y + size : y, PAL.barrierWhite);
  }
}

/** Słup z krzyżem i sygnalizatorem (dwa czerwone światła obok siebie, migają na przemian). */
function drawMast(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, size: number, c: Crossing): void {
  rect(ctx, x, base - h, 2, h, PAL.sigMast);
  rect(ctx, x + 1, base - h, 1, h, PAL.sigMastShade);
  drawCross(ctx, x + 1, base - h - size, size);
  const hw = Math.round(size * 1.2);
  const hy = base - h + 2;
  rect(ctx, x + 1 - (hw >> 1), hy, hw, Math.max(4, size >> 1), PAL.sigHead);
  const on = c.lights ? Math.floor(c.flash * 2) % 2 : -1;
  const r = size > 9 ? 2 : 1;
  for (let k = 0; k < 2; k++) {
    const lx = x + 1 - (hw >> 2) + k * (hw >> 1) - (k === 0 ? 0 : 0);
    disc(ctx, lx, hy + (Math.max(4, size >> 1) >> 1), r, on === k ? PAL.sigRed : PAL.sigOff);
  }
}

/** Za torami: W 6 przy torze, rogatka i słup po dalszej stronie, jezdnia w głąb. Przed drugim torem. */
export function drawCrossingsFar(ctx: CanvasRenderingContext2D, camX: number, list: CrossingRef[], get: (i: number) => Crossing): void {
  for (const c of list) {
    const cx = Math.round(c.x - camX);
    // W 6 stoi przy torze ok. W6_DIST przed przejazdem
    const sx = Math.round(c.x - W6_DIST - camX);
    if (sx > -20 && sx < W + 20) {
      const s = w6Sprite(crossingKind(c.index));
      ctx.drawImage(s, sx - (s.width >> 1), TRACK2_Y + 6 - s.height);
    }
    if (cx < -80 || cx > W + 80) continue;
    const st = get(c.index);
    const h = roadHalf(TRACK2_Y - 4);
    // dalsza rogatka: słupek po lewej, ramię przez lewy pas (w prawo ku osi)
    const px = Math.round(cx - h - 2);
    const py = TRACK2_Y - 4;
    rect(ctx, px - 1, py - 4, 3, 5, PAL.sigMastShade);
    drawBoom(ctx, px + 1, py - 3, Math.round(h + 4), st.down, 1);
    drawMast(ctx, Math.round(cx + h + 5), TRACK2_Y - 2, 20, 8, st);
  }
}

/** Przed pociągiem: bliższa rogatka, słup z krzyżem, kolejka aut. */
export function drawCrossingsNear(ctx: CanvasRenderingContext2D, camX: number, list: CrossingRef[], get: (i: number) => Crossing): void {
  for (const c of list) {
    const cx = Math.round(c.x - camX);
    if (cx < -120 || cx > W + 120) continue;
    const st = get(c.index);
    const base = TRACK_Y + 15;
    const h = roadHalf(base);
    // auta dalej od widza rysujemy pierwsze (zakrywają je bliższe)
    const cars = [...st.cars].sort((a, b) => a.y - b.y);
    // rogatka za autami (jest dalej niż kolejka), słup po lewej stronie jezdni
    const px = Math.round(cx + h + 3);
    rect(ctx, px - 1, base - 5, 4, 6, PAL.sigMastShade);
    rect(ctx, px, base - 6, 2, 1, PAL.sigMast);
    drawBoom(ctx, px, base - 6, Math.round(h + 5), st.down, -1);
    drawMast(ctx, Math.round(cx - h - 7), base, 40, 12, st);
    for (const v of cars) drawVehicle(ctx, cx, v);
  }
}

/** Nocą: poświata czerwonych świateł sygnalizatorów, końcówek rogatek i tylnych świateł aut. */
export function drawCrossingLights(ctx: CanvasRenderingContext2D, camX: number, list: CrossingRef[], get: (i: number) => Crossing, night: number): void {
  if (night <= 0.02) return;
  for (const c of list) {
    const cx = Math.round(c.x - camX);
    if (cx < -120 || cx > W + 120) continue;
    const st = get(c.index);
    if (st.lights) {
      const on = Math.floor(st.flash * 2) % 2;
      const hn = roadHalf(TRACK_Y + 15);
      const hf = roadHalf(TRACK2_Y - 4);
      // lampy bliższego (duży) i dalszego (mały) sygnalizatora
      const lamps: [number, number, number][] = [
        [cx - hn - 7 - 4 + on * 6 + 1, TRACK_Y + 15 - 40 + 5, 6],
        [cx + hf + 5 - 2 + on * 4 + 1, TRACK2_Y - 2 - 20 + 4, 4],
      ];
      for (const [lx, ly, r] of lamps) {
        ctx.globalAlpha = night * 0.35;
        disc(ctx, lx, ly, r, PAL.signalGlow);
        ctx.globalAlpha = night * 0.6;
        disc(ctx, lx, ly, r >> 1, PAL.signalGlow);
      }
      // czerwone światełko na końcach ramion opuszczonych rogatek
      if (st.down > 0.5 && on === 0) {
        ctx.globalAlpha = night * 0.9;
        ctx.fillStyle = PAL.signalGlow;
        ctx.fillRect(Math.round(cx - 2), TRACK_Y + 15 - 6, 2, 2);
      }
    }
    // tylne światła aut z poświatą
    ctx.fillStyle = PAL.tailRed;
    for (const v of st.cars) {
      const lane = Math.round(cx + roadHalf(v.y) * 0.5);
      const half = Math.round(roadHalf(v.y) * 0.85 * 0.5);
      for (const sx of [-half + 1, half - 1]) {
        ctx.globalAlpha = night * 0.35;
        ctx.fillRect(lane + sx - 2, Math.round(v.y) - 8, 5, 3);
        ctx.globalAlpha = night;
        ctx.fillRect(lane + sx - 1, Math.round(v.y) - 7, 2, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
}
