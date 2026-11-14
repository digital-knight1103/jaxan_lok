// Lokomotywa elektryczna Newag Dragon 2 w barwach JAXAN – widok z boku,
// czoło w prawo (pociąg jedzie w prawo). Rysowana proceduralnie raz i cache'owana.
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { drawText } from '../engine/font';
import { getWheelFrames } from './wheels';

/** Wymiary płótna sprite'a (z miejscem na pantograf nad dachem). */
export const LOCO_W = 150;
export const LOCO_H = 60;
/** Wiersz, w którym zaczyna się pudło (nad nim urządzenia dachowe i pantograf). */
export const LOCO_BODY_TOP = 16;

const BT = LOCO_BODY_TOP;
const WHEEL_D = 11;
/** Środki kół (x) – układ Co'Co': dwa wózki trzyosiowe. */
export const LOCO_WHEEL_X = [20, 32, 44, 105, 117, 129];
/** Górna krawędź kół w układzie sprite'a (koła stoją na szynie: dół = LOCO_H-1). */
export const LOCO_WHEEL_Y = LOCO_H - WHEEL_D;
/** Środki wózków (do ramy wózka). */
const BOGIE_X = [32, 117];

/** Punkt styku ślizgu pantografu z przewodem (układ sprite'a). */
export const PANTO_CONTACT = { x: 70, y: 1 };

/** Pozycje świateł (układ sprite'a): czoło – białe, tył – czerwone. */
export const LOCO_LIGHTS = {
  front: [
    { x: 145, y: BT + 2 }, // górny reflektor
    { x: 148, y: BT + 21 }, // dolne reflektory (z boku widać jeden)
  ],
  rear: [{ x: 1, y: BT + 21 }],
};

/** Wcięcie skośnego czoła kabiny w wierszu y pudła (0 = dach). */
function noseInset(y: number): number {
  return y < 10 ? Math.round((9 - y) * 0.7) : 0;
}

/** Linia Bresenhama piksel po pikselu. */
function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: string): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = c;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawBody(ctx: CanvasRenderingContext2D): void {
  // --- sylwetka pudła z dwoma skośnymi czołami ---
  for (let y = 0; y < 30; y++) {
    const ins = noseInset(y);
    rect(ctx, ins, BT + y, LOCO_W - 2 * ins, 1, PAL.locoBlack);
  }
  // dach
  for (let y = 0; y < 2; y++) {
    const ins = noseInset(y);
    rect(ctx, ins, BT + y, LOCO_W - 2 * ins, 1, y === 0 ? PAL.locoGraphiteHi : PAL.locoGraphite);
  }

  // --- magentowy środek pudła + szewrony czarny-zielony-czarny przy obu kabinach ---
  for (let y = 3; y <= 25; y++) {
    const s = Math.floor(Math.abs(y - 14) * 0.5); // kształt „<"
    const magFrom = 31 + s;
    const magTo = 105 + s;
    const c = y === 3 ? PAL.locoMagentaHi : y >= 24 ? PAL.locoMagentaShade : PAL.locoMagenta;
    rect(ctx, magFrom, BT + y, magTo - magFrom + 1, 1, c);
    // tył (lewa kabina): ...czarny | zielony | czarny | magenta
    rect(ctx, 25 + s, BT + y, 4, 1, y >= 24 ? PAL.jaxanGreenShade : PAL.jaxanGreen);
    // czoło (prawa kabina): magenta | czarny | zielony | czarny...
    rect(ctx, 108 + s, BT + y, 4, 1, y >= 24 ? PAL.jaxanGreenShade : PAL.jaxanGreen);
  }

  // --- kratki wentylacyjne ---
  for (const gx of [82, 93]) {
    rect(ctx, gx, BT + 6, 9, 12, PAL.locoMagentaShade);
    for (let x = gx + 1; x < gx + 9; x += 2) rect(ctx, x, BT + 7, 1, 10, PAL.locoMagenta);
  }

  // --- logo JAXAN (litery na siatce 5 px, skala 2 dla czytelności) ---
  drawText(ctx, 'JAXAN', 38, BT + 9, PAL.logoDark, 2);

  // --- kabiny: okna boczne, drzwi, poręcze, szyby czołowe ---
  const cab = (winX: number, doorX: number, rail1: number, rail2: number) => {
    rect(ctx, winX, BT + 5, 7, 6, PAL.glass);
    rect(ctx, winX, BT + 5, 7, 1, PAL.glassHi);
    rect(ctx, doorX, BT + 4, 1, 22, PAL.locoGraphite);
    rect(ctx, doorX + 6, BT + 4, 1, 22, PAL.locoGraphite);
    rect(ctx, doorX + 2, BT + 6, 3, 5, PAL.glass);
    rect(ctx, rail1, BT + 11, 1, 12, PAL.white);
    rect(ctx, rail2, BT + 11, 1, 12, PAL.white);
  };
  cab(133, 119, 118, 126); // czoło
  cab(10, 17, 16, 24); // tył
  // szyby czołowe wzdłuż skosu
  for (let y = 1; y <= 8; y++) {
    const ins = noseInset(y);
    rect(ctx, LOCO_W - ins - 3, BT + y, 2, 1, y < 3 ? PAL.glassHi : PAL.glass);
    rect(ctx, ins + 1, BT + y, 2, 1, y < 3 ? PAL.glassHi : PAL.glass);
  }

  // --- rama i pas dolny ---
  rect(ctx, 0, BT + 26, LOCO_W, 1, PAL.locoGraphite);
  rect(ctx, 0, BT + 29, LOCO_W, 1, PAL.locoGraphite);
  // drobne białe oznaczenia (DRAGON 2, numer) – kilka pikseli
  for (const [x, n] of [[60, 9], [113, 5], [12, 5]] as const) {
    for (let i = 0; i < n; i++) if (i % 3 !== 2) rect(ctx, x + i, BT + 27, 1, 1, PAL.white);
  }
  // reflektory (wyłączone – w nocy rozświetlane w scenie)
  rect(ctx, LOCO_W - noseInset(2) - 1, BT + 2, 1, 1, PAL.headlightOff);
  rect(ctx, LOCO_W - 2, BT + 21, 2, 1, PAL.headlightOff);
  rect(ctx, 0, BT + 21, 2, 1, PAL.tailOff);

  // --- urządzenia dachowe ---
  rect(ctx, 34, BT - 3, 17, 3, PAL.locoGraphite);
  rect(ctx, 34, BT - 3, 17, 1, PAL.locoGraphiteHi);
  rect(ctx, 92, BT - 3, 20, 3, PAL.locoGraphite);
  rect(ctx, 92, BT - 3, 20, 1, PAL.locoGraphiteHi);
  rect(ctx, 96, BT - 4, 4, 1, PAL.steel);
  // izolatory pod pantografem
  rect(ctx, 61, BT - 2, 1, 2, PAL.steel);
  rect(ctx, 83, BT - 2, 1, 2, PAL.steel);

  // --- podwozie między wózkami: transformator, zbiorniki ---
  rect(ctx, 54, BT + 30, 42, 4, PAL.locoGraphite);
  rect(ctx, 54, BT + 30, 42, 1, PAL.locoGraphiteHi);
  rect(ctx, 60, BT + 31, 12, 2, PAL.locoBlack);
  rect(ctx, 80, BT + 31, 10, 2, PAL.locoBlack);
  // zgarniacze i zderzaki na końcach
  for (let i = 0; i < 4; i++) {
    rect(ctx, LOCO_W - 6 + i, BT + 30 + i, 6 - i, 1, PAL.locoBlack);
    rect(ctx, 0, BT + 30 + i, 6 - i, 1, PAL.locoBlack);
  }
  rect(ctx, LOCO_W - 2, BT + 27, 2, 2, PAL.steel);
  rect(ctx, 0, BT + 27, 2, 2, PAL.steel);
}

/** Rama wózka – rysowana NA kołach, żeby zakryć ich górę. */
function drawBogieFrames(ctx: CanvasRenderingContext2D): void {
  for (const cx of BOGIE_X) {
    // rama wózka na wysokości osi kół (koło: wiersze 33..43 pudła, oś ~38)
    rect(ctx, cx - 19, BT + 33, 39, 3, PAL.locoGraphite);
    rect(ctx, cx - 19, BT + 33, 39, 1, PAL.locoGraphiteHi);
    rect(ctx, cx - 21, BT + 34, 2, 2, PAL.locoGraphite);
    rect(ctx, cx + 20, BT + 34, 2, 2, PAL.locoGraphite);
    for (const dx of [-12, 0, 12]) {
      rect(ctx, cx + dx - 2, BT + 36, 5, 4, PAL.locoBlack); // maźnice na osiach
      rect(ctx, cx + dx, BT + 37, 1, 2, PAL.steel);
      rect(ctx, cx + dx - 6, BT + 31, 2, 2, PAL.steel); // sprężyny
    }
  }
}

function drawPantograph(ctx: CanvasRenderingContext2D): void {
  // pantograf jednoramienny, podniesiony – cienkie linie
  rect(ctx, 60, 15, 25, 1, PAL.steel); // podstawa
  line(ctx, 66, 14, 82, 7, PAL.steel); // ramię dolne
  line(ctx, 67, 14, 83, 7, PAL.wheelRim);
  line(ctx, 82, 7, 70, 2, PAL.steel); // ramię górne
  rect(ctx, 63, 1, 15, 1, PAL.steel); // ślizg
  rect(ctx, 63, 2, 1, 1, PAL.wheelRim);
  rect(ctx, 77, 2, 1, 1, PAL.wheelRim);
}

export interface Dragon2Sprites {
  body: HTMLCanvasElement;
  bogies: HTMLCanvasElement;
  pantograph: HTMLCanvasElement;
  wheels: HTMLCanvasElement[];
}

export function getDragon2(): Dragon2Sprites {
  return cached('dragon2', () => ({
    body: makeSprite(LOCO_W, LOCO_H, drawBody),
    bogies: makeSprite(LOCO_W, LOCO_H, drawBogieFrames),
    pantograph: makeSprite(LOCO_W, LOCO_BODY_TOP, drawPantograph),
    wheels: getWheelFrames(WHEEL_D),
  }));
}
