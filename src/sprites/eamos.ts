// Węglarka Eamos w barwach JAXAN – widok z boku. Czarne wysokie pudło z żebrami,
// zielony pas u góry przechodzący w magentę, duży „X" (zielone „>" + magentowe „<").
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { getWheelFrames } from './wheels';

export const WAGON_W = 96;
export const WAGON_H = 44;
/** Wiersz górnej krawędzi pudła (nad nim wystaje ładunek). */
export const WAGON_BODY_TOP = 4;
const BT = WAGON_BODY_TOP;
const WHEEL_D = 9;
export const WAGON_WHEEL_X = [15, 29, 67, 81];
export const WAGON_WHEEL_Y = WAGON_H - WHEEL_D;
const BOGIE_X = [22, 74];

/** Poziomy załadunku cache'owane osobno (0..LOAD_STEPS). */
export const LOAD_STEPS = 8;

const X0 = 3; // lewa krawędź pudła
const X1 = 92; // prawa krawędź pudła

function drawWagon(ctx: CanvasRenderingContext2D, load: number): void {
  // --- ładunek kruszywa (nierówny wierzch, ziarna) ---
  if (load > 0) {
    const rnd = mulberry32(99);
    const maxUp = Math.round(load * 5); // ile px wystaje nad burtę
    for (let x = X0 + 1; x < X1; x++) {
      // „pagórki" kruszywa + szum
      const hill = Math.sin(((x - X0) / (X1 - X0)) * Math.PI * 3) * 0.5 + 0.5;
      const top = BT + 1 - Math.round(maxUp * (0.55 + 0.45 * hill)) + (rnd() < 0.3 ? 1 : 0);
      rect(ctx, x, top, 1, BT + 2 - top, PAL.aggregate);
      if (rnd() < 0.35) rect(ctx, x, top, 1, 1, PAL.aggregateHi);
      if (rnd() < 0.25) rect(ctx, x, top + 2, 1, 1, PAL.aggregateShade);
    }
  }

  // --- pudło ---
  rect(ctx, X0, BT, X1 - X0 + 1, 28, PAL.wagonBlack);
  // pionowe żebra
  for (let x = X0 + 6; x < X1 - 3; x += 9) {
    rect(ctx, x, BT + 2, 1, 24, PAL.wagonRib);
    rect(ctx, x + 1, BT + 2, 1, 24, PAL.wagonShade);
  }

  // --- „X": zielone ramię „>" i magentowe „<" (wiersze 2..25, środek 13) ---
  for (let y = 2; y <= 25; y++) {
    const s = Math.round(Math.abs(y - 13) * 0.55);
    rect(ctx, 73 - s, BT + y, 3, 1, PAL.wagonGreen); // „>" – szczyt w prawo
    rect(ctx, 77 + s, BT + y, 3, 1, PAL.wagonMagenta); // „<" – szczyt w lewo
  }

  // --- pas górny: zielony → czarny (nad X) → magenta ---
  rect(ctx, X0, BT, 69 - X0, 2, PAL.wagonGreen);
  rect(ctx, X0, BT + 1, 69 - X0, 1, PAL.wagonGreenShade);
  rect(ctx, 83, BT, X1 - 83 + 1, 2, PAL.wagonMagenta);
  rect(ctx, 83, BT + 1, X1 - 83 + 1, 1, PAL.wagonMagentaShade);

  // --- oznaczenia: tabliczka i napisy jako białe piksele ---
  rect(ctx, 17, BT + 10, 9, 1, PAL.white);
  rect(ctx, 17, BT + 13, 9, 1, PAL.white);
  rect(ctx, 17, BT + 10, 1, 4, PAL.white);
  rect(ctx, 25, BT + 10, 1, 4, PAL.white);
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 7; i++) if ((i + r) % 3 !== 0) rect(ctx, 29 + i, BT + 14 + r * 2, 1, 1, PAL.white);
  }
  rect(ctx, 14, BT + 17, 3, 3, PAL.white);

  // --- magentowe poręcze i drabinka na końcach ---
  rect(ctx, X0 + 1, BT + 6, 1, 14, PAL.wagonMagenta);
  rect(ctx, X1 - 1, BT + 6, 1, 14, PAL.wagonMagenta);
  for (let y = BT + 6; y < BT + 24; y += 3) rect(ctx, X0 + 3, y, 4, 1, PAL.wagonRib);

  // --- rama, zderzaki, podwozie ---
  rect(ctx, X0, BT + 26, X1 - X0 + 1, 2, PAL.wagonShade);
  rect(ctx, 0, BT + 26, 3, 2, PAL.steel);
  rect(ctx, X1 + 1, BT + 26, 3, 2, PAL.steel);
  rect(ctx, 38, BT + 28, 18, 2, PAL.wagonShade); // zbiornik hamulca
  rect(ctx, 31, BT + 28, 3, 3, PAL.white); // koło ręcznego hamulca
  rect(ctx, 32, BT + 29, 1, 1, PAL.wagonShade);
}

function drawBogies(ctx: CanvasRenderingContext2D): void {
  for (const cx of BOGIE_X) {
    // rama wózka na wysokości osi (koło: wiersze 31..39 pudła, oś ~35)
    rect(ctx, cx - 11, BT + 31, 23, 3, PAL.locoGraphite);
    rect(ctx, cx - 11, BT + 31, 23, 1, PAL.locoGraphiteHi);
    rect(ctx, cx - 2, BT + 28, 5, 3, PAL.locoGraphite); // łożysko skrętu
    for (const dx of [-7, 7]) {
      rect(ctx, cx + dx - 2, BT + 34, 5, 3, PAL.locoBlack); // maźnice
      rect(ctx, cx + dx, BT + 35, 1, 1, PAL.steel);
    }
  }
}

export interface EamosSprites {
  body: HTMLCanvasElement;
  bogies: HTMLCanvasElement;
  wheels: HTMLCanvasElement[];
}

/** Sprite węglarki dla poziomu załadunku 0..1 (kwantyzowany do LOAD_STEPS). */
export function getEamos(load: number): EamosSprites {
  const step = Math.round(Math.min(1, Math.max(0, load)) * LOAD_STEPS);
  return cached(`eamos-${step}`, () => ({
    body: makeSprite(WAGON_W, WAGON_H, (ctx) => drawWagon(ctx, step / LOAD_STEPS)),
    bogies: makeSprite(WAGON_W, WAGON_H, drawBogies),
    wheels: getWheelFrames(WHEEL_D),
  }));
}
