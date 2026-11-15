// Pojazdy pociągów z naprzeciwka (drugi tor): fikcyjny elektryczny zespół trakcyjny w neutralnym
// malowaniu (biel + turkusowy pas, bez barw prawdziwych przewoźników) oraz skład towarowy:
// lokomotywa elektryczna, cysterny i platformy z kontenerami. Widok z boku, pojazd jedzie w LEWO –
// przód (kabina) po lewej. Sprite'y proceduralne, rysowane raz; koła w klatce 0 (przy takiej
// prędkości obrotu i tak nie widać). Dolny wiersz sprite'a = główka szyny.
import { PAL } from '../palette';
import { cached, makeSprite, rect, line } from '../engine/sprite';
import { getWheelFrames } from './wheels';

/** Wysokość płótna pojazdu (dolny wiersz = szyna). */
export const OC_H = 46;
const WD = 9; // średnica kół
/** Wysokość od szyny do przewodu jezdnego drugiego toru (pantograf dotyka go końcówką). */
export const OC_WIRE_H = 60;

export interface OcCar {
  w: number;
  sprite: HTMLCanvasElement;
  /** Okna rozświetlane nocą: [x, y, szer., wys.]. */
  windows: [number, number, number, number][];
  /** Środek pantografu (x) – rysowany osobno, wyciągnięty do przewodu. */
  panto?: number;
  /** Wysokość dachu nad szyną (px) pod pantograf. */
  roof: number;
}

function wheels(ctx: CanvasRenderingContext2D, xs: number[]): void {
  const f = getWheelFrames(WD)[0];
  for (const x of xs) ctx.drawImage(f, x - (WD >> 1), OC_H - WD);
}

/** Ramka podwozia z wózkami. */
function undercarriage(ctx: CanvasRenderingContext2D, x0: number, x1: number, bogies: number[]): void {
  rect(ctx, x0, OC_H - 12, x1 - x0, 3, PAL.emuSkirt);
  rect(ctx, x0, OC_H - 12, x1 - x0, 1, PAL.locoGraphite);
  for (const b of bogies) {
    rect(ctx, b - 12, OC_H - 11, 24, 2, PAL.locoBlack); // belka wózka
  }
  // zderzaki
  rect(ctx, x0 - 1, OC_H - 15, 2, 2, PAL.steel);
  rect(ctx, x1 - 1, OC_H - 15, 2, 2, PAL.steel);
}

// --- elektryczny zespół trakcyjny (EZT) ---
export const EMU_W = 88;
const EMU_TOP = 6;
const EMU_BOT = OC_H - 12;

/** Wagon EZT: 'head' – kabina z lewej (przód), 'tail' – kabina z prawej, 'mid' – przejścia. */
export function getEmuCar(kind: 'head' | 'mid' | 'tail', panto: boolean): OcCar {
  return cached(`emu-${kind}-${panto ? 1 : 0}`, () => {
    const windows: OcCar['windows'] = [];
    const sprite = makeSprite(EMU_W, OC_H, (ctx) => {
      const left = kind === 'head';
      const right = kind === 'tail';
      // sylwetka: skos czoła kabiny (górna część cofnięta)
      const edgeL = (y: number) => (left ? Math.max(0, Math.round((14 - (y - EMU_TOP)) * 0.7)) : 0);
      const edgeR = (y: number) => (right ? Math.max(0, Math.round((14 - (y - EMU_TOP)) * 0.7)) : 0);
      for (let y = EMU_TOP; y < EMU_BOT; y++) {
        const x0 = 1 + edgeL(y);
        const x1 = EMU_W - 1 - edgeR(y);
        const top = y - EMU_TOP;
        const c = top < 2 ? PAL.emuBodyHi : y >= EMU_BOT - 4 ? PAL.emuBodyShade : PAL.emuBody;
        rect(ctx, x0, y, x1 - x0, 1, c);
        rect(ctx, x0, y, 1, 1, PAL.emuBodyHi); // blask na krawędzi
      }
      // dach: instalacje (klimatyzacja)
      rect(ctx, 6 + (left ? 8 : 0), EMU_TOP - 2, 22, 2, PAL.emuRoof);
      rect(ctx, 38, EMU_TOP - 2, 22, 2, PAL.emuRoof);
      // turkusowy pas pod oknami
      for (let y = EMU_BOT - 11; y < EMU_BOT - 7; y++) {
        const x0 = 1 + edgeL(y);
        const x1 = EMU_W - 1 - edgeR(y);
        rect(ctx, x0, y, x1 - x0, 1, y === EMU_BOT - 11 ? PAL.emuStripeHi : PAL.emuStripe);
      }
      // okna: rząd pod dachem; kabina ma szerszą szybę czołową
      const wy = EMU_TOP + 5;
      const startX = left ? 17 : 6;
      const endX = right ? EMU_W - 17 : EMU_W - 6;
      for (let x = startX; x + 8 <= endX; x += 11) {
        rect(ctx, x, wy, 8, 9, PAL.glass);
        rect(ctx, x, wy, 8, 1, PAL.glassHi);
        rect(ctx, x, wy, 1, 9, PAL.glassHi);
        windows.push([x, wy, 8, 9]);
      }
      // drzwi dwuskrzydłowe (ciemniejsze pola)
      for (const dx of [left ? 12 : 1, right ? EMU_W - 13 : EMU_W - 5, 40]) {
        if (dx < 1 || dx > EMU_W - 6) continue;
        rect(ctx, dx, EMU_TOP + 4, 4, EMU_BOT - EMU_TOP - 6, PAL.emuBodyDeep);
        rect(ctx, dx + 1, EMU_TOP + 5, 2, 8, PAL.glassHi);
      }
      // czoło kabiny: ciemna szyba czołowa i reflektory
      if (left || right) {
        const fx = left ? 2 : EMU_W - 12;
        rect(ctx, fx, EMU_TOP + 6, 10, 10, PAL.glass);
        rect(ctx, fx, EMU_TOP + 6, 10, 1, PAL.glassHi);
        rect(ctx, left ? 1 : EMU_W - 3, EMU_BOT - 8, 2, 2, left ? PAL.headlightOff : PAL.tailOff);
      }
      undercarriage(ctx, 1, EMU_W - 1, [14, EMU_W - 14]);
      wheels(ctx, [8, 20, EMU_W - 20, EMU_W - 8]);
    });
    return { w: EMU_W, sprite, windows, panto: panto ? 44 : undefined, roof: OC_H - EMU_TOP + 2 };
  });
}

// --- lokomotywa towarowa ---
export const FLOCO_W = 92;
const FL_TOP = 9;
const FL_BOT = OC_H - 12;

export function getFreightLoco(): OcCar {
  return cached('floco', () => {
    const sprite = makeSprite(FLOCO_W, OC_H, (ctx) => {
      for (let y = FL_TOP; y < FL_BOT; y++) {
        const top = y - FL_TOP;
        const c = top < 2 ? PAL.fLocoHi : y >= FL_BOT - 5 ? PAL.fLocoShade : PAL.fLoco;
        rect(ctx, 1, y, FLOCO_W - 2, 1, c);
      }
      rect(ctx, 1, FL_TOP, FLOCO_W - 2, 1, PAL.fLocoHi);
      // żółte pasy ostrzegawcze na czołach
      rect(ctx, 1, FL_BOT - 8, 5, 6, PAL.fLocoBand);
      rect(ctx, FLOCO_W - 6, FL_BOT - 8, 5, 6, PAL.fLocoBand);
      // kabiny z szybami z obu końców
      rect(ctx, 5, FL_TOP + 3, 10, 9, PAL.glass);
      rect(ctx, 5, FL_TOP + 3, 10, 1, PAL.glassHi);
      rect(ctx, FLOCO_W - 15, FL_TOP + 3, 10, 9, PAL.glass);
      rect(ctx, FLOCO_W - 15, FL_TOP + 3, 10, 1, PAL.glassHi);
      // kratki wentylacyjne w środkowej części
      for (let x = 22; x < FLOCO_W - 22; x += 7) {
        rect(ctx, x, FL_TOP + 4, 5, 12, PAL.fLocoDeep);
        for (let k = 0; k < 12; k += 2) rect(ctx, x, FL_TOP + 4 + k, 5, 1, PAL.fLocoShade);
      }
      rect(ctx, 1, FL_BOT - 1, FLOCO_W - 2, 1, PAL.fLocoDeep);
      // dach: oporniki i izolatory pod pantograf
      rect(ctx, 30, FL_TOP - 2, 32, 2, PAL.emuRoof);
      rect(ctx, 44, FL_TOP - 4, 4, 2, PAL.steel);
      undercarriage(ctx, 1, FLOCO_W - 1, [18, FLOCO_W - 18]);
      wheels(ctx, [10, 22, 34, FLOCO_W - 34, FLOCO_W - 22, FLOCO_W - 10]);
    });
    return { w: FLOCO_W, sprite, windows: [], panto: 46, roof: OC_H - FL_TOP + 4 };
  });
}

// --- wagony towarowe ---
export const TANK_W = 58;

type Tone = 'grey' | 'black' | 'brown';
const TANK: Record<Tone, [string, string, string]> = {
  grey: [PAL.tankGreyHi, PAL.tankGrey, PAL.tankGreyShade],
  black: [PAL.tankBlackHi, PAL.tankBlack, PAL.locoDeep],
  brown: [PAL.tankBrownHi, PAL.tankBrown, PAL.tankBrownShade],
};

/** Cysterna dwuosiowa: walec z kopułą i pomostem. */
export function getTank(tone: Tone): OcCar {
  return cached(`tank-${tone}`, () => {
    const [hi, base, shade] = TANK[tone];
    const sprite = makeSprite(TANK_W, OC_H, (ctx) => {
      const top = 12;
      const bot = OC_H - 14;
      const h = bot - top;
      for (let y = top; y < bot; y++) {
        const u = (y - top) / h;
        // zaokrąglone czoła walca
        const inset = Math.round(3 * Math.pow(Math.abs(u - 0.5) * 2, 3));
        const c = u < 0.2 ? hi : u > 0.7 ? shade : base;
        rect(ctx, 4 + inset, y, TANK_W - 8 - inset * 2, 1, c);
      }
      rect(ctx, 10, top - 3, 6, 3, base); // kopuła
      rect(ctx, 10, top - 3, 6, 1, hi);
      rect(ctx, 6, top - 1, TANK_W - 12, 1, PAL.locoGraphite); // pomost
      // opaski walca
      for (const x of [16, 29, 42]) rect(ctx, x, top + 1, 1, h - 2, shade);
      // rama i bufory
      rect(ctx, 1, bot, TANK_W - 2, 3, PAL.emuSkirt);
      rect(ctx, 1, bot, TANK_W - 2, 1, PAL.locoGraphite);
      rect(ctx, 0, bot - 1, 2, 2, PAL.steel);
      rect(ctx, TANK_W - 2, bot - 1, 2, 2, PAL.steel);
      rect(ctx, 14, bot + 3, 30, 2, PAL.locoBlack); // resor
      wheels(ctx, [14, TANK_W - 14]);
    });
    return { w: TANK_W, sprite, windows: [], roof: OC_H - 9 };
  });
}

export const FLAT_W = 74;

type Cont = 'Red' | 'Blue' | 'Orange' | 'Green' | 'Grey';
const CONT_COL: Record<Cont, [string, string, string]> = {
  Red: [PAL.contRedHi, PAL.contRed, PAL.contRedShade],
  Blue: [PAL.contBlueHi, PAL.contBlue, PAL.contBlueShade],
  Orange: [PAL.contOrangeHi, PAL.contOrange, PAL.contOrangeShade],
  Green: [PAL.contGreenHi, PAL.contGreen, PAL.contGreenShade],
  Grey: [PAL.contGreyHi, PAL.contGrey, PAL.contGreyShade],
};

/** Platforma z kontenerami: jeden 40-stopowy albo dwa 20-stopowe (kolory kontenerów). */
export function getFlat(a: Cont, b: Cont | null): OcCar {
  return cached(`flat-${a}-${b ?? 'x'}`, () => {
    const sprite = makeSprite(FLAT_W, OC_H, (ctx) => {
      const deck = OC_H - 17;
      const cont = (x: number, w: number, col: Cont) => {
        const [hi, base, shade] = CONT_COL[col];
        const y0 = deck - 17;
        rect(ctx, x, y0, w, 17, base);
        rect(ctx, x, y0, w, 2, hi);
        rect(ctx, x, y0 + 15, w, 2, shade);
        for (let k = x + 2; k < x + w - 1; k += 3) rect(ctx, k, y0 + 2, 1, 13, shade); // żebra
        rect(ctx, x, y0, 1, 17, shade);
        rect(ctx, x + w - 1, y0, 1, 17, shade);
      };
      if (b) {
        cont(4, 32, a);
        cont(38, 32, b);
      } else cont(4, 66, a);
      rect(ctx, 1, deck, FLAT_W - 2, 3, PAL.emuSkirt);
      rect(ctx, 1, deck, FLAT_W - 2, 1, PAL.locoGraphite);
      rect(ctx, 0, deck - 1, 2, 2, PAL.steel);
      rect(ctx, FLAT_W - 2, deck - 1, 2, 2, PAL.steel);
      rect(ctx, 8, deck + 3, 20, 2, PAL.locoBlack);
      rect(ctx, FLAT_W - 28, deck + 3, 20, 2, PAL.locoBlack);
      wheels(ctx, [11, 23, FLAT_W - 23, FLAT_W - 11]);
    });
    return { w: FLAT_W, sprite, windows: [], roof: OC_H - 12 };
  });
}

/** Pantograf wyciągnięty do przewodu: dolna rama, górny łącznik i ślizg na wysokości drutu. */
export function drawPanto(ctx: CanvasRenderingContext2D, x: number, roofY: number, wireY: number): void {
  const mid = roofY - Math.round((roofY - wireY) * 0.55);
  line(ctx, x, roofY, x + 5, mid, PAL.steel);
  line(ctx, x + 5, mid, x, wireY + 1, PAL.steel);
  rect(ctx, x - 5, wireY + 1, 11, 1, PAL.railGlint); // ślizg
  rect(ctx, x - 2, roofY, 5, 1, PAL.locoBlack);
}
