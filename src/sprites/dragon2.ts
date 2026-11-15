// Lokomotywa elektryczna Newag Dragon 2 w barwach JAXAN – widok z boku,
// czoło w prawo (pociąg jedzie w prawo). Rysowana proceduralnie raz i cache'owana.
//
// Styl2: geometria rysowana kolorami bazowymi materiałów, potem jeden przebieg
// cieniowania zamienia każdy materiał na rampę 5 tonów wg wysokości na pudle:
// blask krawędzi dachu → cień pod okapem → miękki pas połysku lakieru (dithering) →
// baza → półcień ku ramie. Na to detale: szyby z odbiciem nieba, wycieraczki, kratki,
// drzwi z uchwytami, poręcze, sprzęgi i bufory, przewody pod ramą.
import { PAL } from '../palette';
import { cached, line, makeSprite, rect } from '../engine/sprite';
import { drawText, textWidth } from '../engine/font';
import { ditherEdge, paint, bayer } from '../engine/pixbuf';
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
/** Górna krawędź kół: dolny wiersz koła leży na wierszu główki szyny (TRACK_Y) – styk co do piksela. */
export const LOCO_WHEEL_Y = LOCO_H - WHEEL_D + 1;
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

/** Rampy materiałów taboru: [blask, światło, baza, półcień, cień]. */
const BLACK = [PAL.locoGlint, PAL.locoGraphiteHi, PAL.locoGraphite, PAL.locoBlack, PAL.locoDeep] as const;
const MAGENTA = [PAL.magentaGloss, PAL.locoMagentaHi, PAL.locoMagenta, PAL.locoMagentaShade, PAL.magentaDeep] as const;
const GREEN = [PAL.greenGlint, PAL.greenHi, PAL.jaxanGreen, PAL.jaxanGreenShade, PAL.greenDeep] as const;

/** Wcięcie skośnego czoła kabiny w wierszu y pudła (0 = dach). */
function noseInset(y: number): number {
  return y < 10 ? Math.round((9 - y) * 0.7) : 0;
}

/**
 * Profil światła na boku pudła (y = wiersz pudła 0..29) w jednostkach rampy:
 * 0 = blask … 4 = cień. Bok lekko wypukły: górą łapie niebo (połysk), dołem ciemnieje.
 */
function profile(y: number): number {
  if (y === 0) return 0.2; // krawędź dachu w słońcu
  if (y === 1) return 1.2;
  if (y === 2) return 3.9; // cień pod okapem dachu
  if (y === 3) return 3.0;
  if (y <= 8) return [1.25, 0.55, 0.6, 1.2, 1.75][y - 4]; // miękki pas połysku (dithering na brzegach)
  if (y <= 18) return 2.0;
  if (y <= 23) return 2.0 + (y - 18) * 0.24;
  if (y <= 25) return 3.4;
  return 3.7; // pas dolny / rama
}

function drawBody(ctx: CanvasRenderingContext2D): void {
  // --- 1. geometria w kolorach bazowych materiałów ---
  for (let y = 0; y < 30; y++) {
    const ins = noseInset(y);
    rect(ctx, ins, BT + y, LOCO_W - 2 * ins, 1, PAL.locoBlack);
  }
  // magenta + lustrzane szewrony czarny-zielony-czarny przy obu kabinach
  // (przy lewej kabinie grot „<", przy prawej „>"; odbicie względem x = 74,5)
  const CHEV = 4;
  const mirror = (x: number) => LOCO_W - 1 - x;
  for (let y = 3; y <= 25; y++) {
    const s = Math.floor(Math.abs(y - 14) * 0.5);
    const outer = 21 + s;
    const greenL = outer + CHEV;
    const innerL = greenL + CHEV;
    const magFrom = innerL + CHEV;
    rect(ctx, magFrom, BT + y, mirror(magFrom) - magFrom + 1, 1, PAL.locoMagenta);
    rect(ctx, greenL, BT + y, CHEV, 1, PAL.jaxanGreen);
    rect(ctx, mirror(greenL + CHEV - 1), BT + y, CHEV, 1, PAL.jaxanGreen);
  }

  // --- 2. cieniowanie: materiał → rampa wg profilu (dithering tylko na granicach tonów) ---
  const base = new Map<string, readonly string[]>([
    [PAL.locoBlack, BLACK], [PAL.locoMagenta, MAGENTA], [PAL.jaxanGreen, GREEN],
  ]);
  const img = ctx.getImageData(0, BT, LOCO_W, 30);
  const hex = (i: number) => '#' + ((1 << 24) | (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]).toString(16).slice(1);
  paint(ctx, 0, BT, LOCO_W, 30, (x, Y) => {
    const i = ((Y - BT) * LOCO_W + x) * 4;
    if (img.data[i + 3] < 128) return null;
    const ramp = base.get(hex(i).toUpperCase());
    if (!ramp) return null;
    const y = Y - BT;
    // czarne kabiny o ton ciemniejsze (lakier czarny), magenta i zieleń nasycone
    const t = profile(y) + (ramp === BLACK ? 0.9 : 0);
    return ramp[ditherEdge(t, 5, x, Y, 0.3)];
  });

  // --- 3. kratki wentylacyjne: żaluzje z jasną wargą u góry każdej lamelki ---
  for (const gx of [41, 99]) {
    rect(ctx, gx - 1, BT + 5, 11, 14, PAL.magentaDeep);
    for (let y = BT + 6; y < BT + 18; y += 2) {
      rect(ctx, gx, y, 9, 1, PAL.locoMagentaHi);
      rect(ctx, gx, y + 1, 9, 1, PAL.locoMagentaShade);
    }
    rect(ctx, gx - 1, BT + 5, 11, 1, PAL.magentaDeep);
    rect(ctx, gx - 1, BT + 19, 11, 1, PAL.magentaGloss); // dolna krawędź ramki łapie światło
  }

  // --- 4. logo JAXAN na środku: cień liter + litery + blask ---
  const lx = Math.round(LOCO_W / 2 - textWidth('JAXAN', 2) / 2);
  drawText(ctx, 'JAXAN', lx + 1, BT + 10, PAL.magentaDeep, 2);
  drawText(ctx, 'JAXAN', lx, BT + 9, PAL.logoDark, 2);

  // --- 5. kabiny: okno boczne z odbiciem nieba, drzwi z uchwytem, poręcze, stopnie ---
  const sideWindow = (x: number, y: number, w: number, h: number) => {
    rect(ctx, x - 1, y - 1, w + 2, h + 2, PAL.locoDeep); // uszczelka
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j / (h - 1);
        let c: string = k < 0.25 ? PAL.skyReflect : k < 0.55 ? PAL.glassHi : PAL.glass;
        if (k >= 0.25 && k < 0.55 && bayer(x + i, y + j) < 0.35) c = PAL.skyReflect;
        if (i + j === Math.round(w * 0.6)) c = PAL.skyReflectHi; // ukośny refleks
        rect(ctx, x + i, y + j, 1, 1, c);
      }
    }
  };
  const cab = (winX: number, doorX: number, rail1: number, rail2: number) => {
    sideWindow(winX, BT + 5, 7, 6);
    // drzwi: szczeliny (ciemna + jasna krawędź), okienko, uchwyt
    rect(ctx, doorX, BT + 4, 1, 22, PAL.locoDeep);
    rect(ctx, doorX + 1, BT + 4, 1, 22, PAL.locoGraphiteHi);
    rect(ctx, doorX + 6, BT + 4, 1, 22, PAL.locoDeep);
    rect(ctx, doorX, BT + 4, 7, 1, PAL.locoDeep);
    sideWindow(doorX + 2, BT + 6, 3, 5);
    rect(ctx, doorX + 4, BT + 15, 2, 1, PAL.steel); // klamka
    rect(ctx, doorX + 4, BT + 15, 1, 1, PAL.railGlint);
    // poręcze: biała rura z cieniem po prawej i mocowaniami
    for (const rx of [rail1, rail2]) {
      rect(ctx, rx, BT + 11, 1, 13, PAL.white);
      rect(ctx, rx + 1, BT + 12, 1, 12, PAL.locoDeep);
      rect(ctx, rx, BT + 11, 1, 1, PAL.railGlint);
      rect(ctx, rx, BT + 23, 2, 1, PAL.steel);
    }
    // stopnie wejściowe pod drzwiami
    for (const sy of [BT + 27, BT + 30]) {
      rect(ctx, doorX + 1, sy, 5, 1, PAL.steel);
      rect(ctx, doorX + 1, sy + 1, 5, 1, PAL.locoDeep);
    }
  };
  cab(133, 126, 125, 133); // czoło
  cab(10, 17, 16, 24); // tył

  // szyby czołowe wzdłuż skosu: odbicie nieba u góry, ciemniej w dół, wycieraczka
  for (let y = 1; y <= 8; y++) {
    const ins = noseInset(y);
    const c = y < 3 ? PAL.skyReflectHi : y < 5 ? PAL.skyReflect : y < 7 ? PAL.glassHi : PAL.glass;
    rect(ctx, LOCO_W - ins - 3, BT + y, 2, 1, c);
    rect(ctx, ins + 1, BT + y, 2, 1, c);
  }
  rect(ctx, LOCO_W - noseInset(6) - 3, BT + 6, 1, 2, PAL.locoDeep); // wycieraczki
  rect(ctx, noseInset(6) + 2, BT + 6, 1, 2, PAL.locoDeep);

  // --- 6. pas dolny: drobne białe oznaczenia (DRAGON 2, numer) ---
  rect(ctx, 0, BT + 26, LOCO_W, 1, PAL.locoGraphiteHi); // krawędź pasa łapie światło
  for (const [x, n] of [[60, 9], [113, 5], [12, 5]] as const) {
    for (let i = 0; i < n; i++) if (i % 3 !== 2) rect(ctx, x + i, BT + 27, 1, 1, PAL.white);
  }
  // reflektory (wyłączone – w nocy rozświetlane w scenie)
  rect(ctx, LOCO_W - noseInset(2) - 1, BT + 2, 1, 1, PAL.headlightOff);
  rect(ctx, LOCO_W - 3, BT + 20, 3, 3, PAL.locoDeep);
  rect(ctx, LOCO_W - 2, BT + 21, 2, 1, PAL.headlightOff);
  rect(ctx, 0, BT + 20, 3, 3, PAL.locoDeep);
  rect(ctx, 0, BT + 21, 2, 1, PAL.tailOff);

  // --- 7. dach: urządzenia z blaskiem u góry i cieniem z boku, cień pantografu ---
  const roofBox = (x: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) rect(ctx, x, BT - h + j, w, 1, j === 0 ? PAL.locoGlint : j === h - 1 ? PAL.locoBlack : PAL.locoGraphite);
    rect(ctx, x, BT - h, 1, h, PAL.locoGraphiteHi);
    rect(ctx, x + w - 1, BT - h + 1, 1, h - 1, PAL.locoDeep);
    rect(ctx, x + w, BT, 3, 1, PAL.locoDeep); // cień rzucany na dach
  };
  roofBox(34, 17, 3);
  roofBox(92, 20, 3);
  rect(ctx, 96, BT - 4, 4, 1, PAL.steel);
  rect(ctx, 96, BT - 4, 1, 1, PAL.railGlint);
  // izolatory pod pantografem (z blaskiem)
  for (const ix of [61, 83]) {
    rect(ctx, ix, BT - 2, 1, 2, PAL.steel);
    rect(ctx, ix, BT - 2, 1, 1, PAL.railGlint);
  }
  // cień pantografu na dachu: ukośne pasmo pod ramionami
  for (let x = 64; x < 86; x++) if ((x & 1) === 0) rect(ctx, x, BT + 1, 1, 1, PAL.locoDeep);

  // --- 8. podwozie: transformator i zbiorniki (5 tonów), przewody pod ramą ---
  for (let j = 0; j < 4; j++) rect(ctx, 54, BT + 30 + j, 42, 1, BLACK[[1, 2, 3, 4][j]]);
  rect(ctx, 54, BT + 30, 1, 4, PAL.locoGlint);
  for (const [bx, bw] of [[60, 12], [80, 10]] as const) {
    rect(ctx, bx, BT + 31, bw, 2, PAL.locoDeep);
    rect(ctx, bx + 1, BT + 31, bw - 2, 1, PAL.locoGraphite);
  }
  // przewody: zwisające kable między wózkami i rura hamulcowa wzdłuż ramy
  rect(ctx, 50, BT + 34, 50, 1, PAL.locoGraphite);
  for (let x = 50; x < 100; x++) {
    const sag = Math.round(Math.sin(((x - 50) / 50) * Math.PI) * 2);
    rect(ctx, x, BT + 34 + sag, 1, 1, x % 9 === 0 ? PAL.steel : PAL.locoDeep);
  }
  // zgarniacze (pługi) na końcach
  for (let i = 0; i < 4; i++) {
    rect(ctx, LOCO_W - 6 + i, BT + 30 + i, 6 - i, 1, i === 0 ? PAL.locoGraphiteHi : PAL.locoBlack);
    rect(ctx, 0, BT + 30 + i, 6 - i, 1, i === 0 ? PAL.locoGraphiteHi : PAL.locoBlack);
  }
  // bufory (talerz z blaskiem, trzon) i sprzęg śrubowy z hakiem
  const buffer = (x: number, dir: 1 | -1) => {
    rect(ctx, x, BT + 26, 1, 4, PAL.steel); // talerz
    rect(ctx, x, BT + 26, 1, 1, PAL.railGlint);
    rect(ctx, x, BT + 29, 1, 1, PAL.locoDeep);
    rect(ctx, x - dir, BT + 27, 1, 2, PAL.locoGraphite); // trzon
    rect(ctx, x - dir * 2, BT + 29, 1, 2, PAL.steel); // hak
    rect(ctx, x - dir * 2, BT + 30, 1, 1, PAL.locoDeep);
  };
  buffer(LOCO_W - 1, 1);
  buffer(0, -1);
}

/** Rama wózka – rysowana NA kołach, żeby zakryć ich górę. W cieniu pudła. */
function drawBogieFrames(ctx: CanvasRenderingContext2D): void {
  for (const cx of BOGIE_X) {
    // belka skrętu z czopem: styka się z dolną krawędzią ramy pudła (bez prześwitu)
    // (sięga 1 wiersz w ramę pudła – przy podskoku pudła ±1 px nie ma szpary)
    rect(ctx, cx - 7, BT + 29, 15, 4, PAL.locoBlack);
    rect(ctx, cx - 7, BT + 29, 15, 2, PAL.locoDeep);
    rect(ctx, cx - 1, BT + 31, 3, 2, PAL.locoGraphite);
    // rama: górny wiersz w cieniu pudła, środek półcień, dół odbite światło od ziemi
    rect(ctx, cx - 19, BT + 33, 39, 1, PAL.locoDeep);
    rect(ctx, cx - 19, BT + 34, 39, 1, PAL.locoBlack);
    rect(ctx, cx - 19, BT + 35, 39, 1, PAL.locoGraphite);
    rect(ctx, cx - 19, BT + 33, 1, 3, PAL.locoGraphiteHi); // brzeg ramy od słońca
    rect(ctx, cx - 21, BT + 34, 2, 2, PAL.locoGraphite);
    rect(ctx, cx + 20, BT + 34, 2, 2, PAL.locoBlack);
    for (const dx of [-12, 0, 12]) {
      // maźnica: blok z blaskiem lewy-górny i pokrywą osi
      rect(ctx, cx + dx - 2, BT + 36, 5, 4, PAL.locoBlack);
      rect(ctx, cx + dx - 2, BT + 36, 5, 1, PAL.locoGraphiteHi);
      rect(ctx, cx + dx - 2, BT + 36, 1, 4, PAL.locoGraphite);
      rect(ctx, cx + dx + 2, BT + 37, 1, 3, PAL.locoDeep);
      rect(ctx, cx + dx, BT + 37, 1, 2, PAL.steel);
      rect(ctx, cx + dx, BT + 37, 1, 1, PAL.railGlint);
      // sprężyna śrubowa: zwoje na przemian jasne i ciemne
      for (let j = 0; j < 4; j++) {
        rect(ctx, cx + dx - 6, BT + 30 + j, 3, 1, j % 2 ? PAL.locoDeep : PAL.steel);
        if (j % 2 === 0) rect(ctx, cx + dx - 6, BT + 30 + j, 1, 1, PAL.railGlint);
      }
    }
    // cylinder hamulcowy między osiami
    rect(ctx, cx - 7, BT + 38, 3, 2, PAL.locoGraphite);
    rect(ctx, cx + 5, BT + 38, 3, 2, PAL.locoGraphite);
  }
}

function drawPantograph(ctx: CanvasRenderingContext2D): void {
  // pantograf jednoramienny, podniesiony: ramiona w dwóch tonach (strona w słońcu jaśniejsza)
  rect(ctx, 60, 15, 25, 1, PAL.steel); // podstawa
  rect(ctx, 60, 15, 1, 1, PAL.railGlint);
  line(ctx, 66, 15, 82, 8, PAL.locoGraphite); // cieniowana (dolna) strona ramienia dolnego
  line(ctx, 66, 14, 82, 7, PAL.steel); // ramię dolne
  line(ctx, 81, 8, 69, 3, PAL.locoGraphite);
  line(ctx, 82, 7, 70, 2, PAL.steel); // ramię górne
  rect(ctx, 81, 6, 2, 2, PAL.locoGraphite); // przegub kolanowy
  rect(ctx, 63, 1, 15, 1, PAL.steel); // ślizg
  rect(ctx, 63, 1, 6, 1, PAL.railGlint); // blask na ślizgu
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
