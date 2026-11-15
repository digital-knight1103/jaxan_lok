// Węglarka Eamos w barwach JAXAN – widok z boku (wzór: reference/eamos_jaxan.png).
// Czarne wysokie pudło z żebrami, zielony pas u góry przechodzący (nad „X") w magentę,
// duży „X" (zielone „>" + magentowe „<"). Pudło leży na ostojnicy (grubej ramie
// z czołownicami), a ostojnica bezpośrednio na wózkach Y25 – bez prześwitu.
// Zderzaki na tej samej wysokości co w lokomotywie (TRACK_Y−18…−15).
// Styl2: rampy 5 tonów, rim light od słońca, cień pod pudłem, rdza i brud przy dole.
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { ditherEdge, paint, bayer } from '../engine/pixbuf';
import { buildRimOverlays, type RimOverlays } from '../engine/light';
import { getWheelFrames } from './wheels';

export const WAGON_W = 96;
export const WAGON_H = 46;
/** Wiersz górnej krawędzi pudła (nad nim wystaje ładunek). */
export const WAGON_BODY_TOP = 4;
const BT = WAGON_BODY_TOP;
/** Wysokość pudła (bez ostojnicy). */
const BH = 24;
/** Ostojnica: wiersze SB..SB+3 (= zderzaki, TRACK_Y−18…−15 jak w lokomotywie). */
const SB = BT + BH;
const WHEEL_D = 11;
/** Środki kół: dwa wózki Y25, rozstaw osi 14 px. */
export const WAGON_WHEEL_X = [11, 25, 71, 85];
/**
 * Górna krawędź kół: dolny wiersz koła leży na wierszu główki szyny (TRACK_Y) –
 * obręcz styka się z szyną co do piksela, bez prześwitu.
 */
export const WAGON_WHEEL_Y = WAGON_H - WHEEL_D + 1;
const BOGIE_X = [18, 78];

/** Poziomy załadunku cache'owane osobno (0..LOAD_STEPS). */
export const LOAD_STEPS = 8;

const X0 = 3; // lewa krawędź pudła
const X1 = 92; // prawa krawędź pudła

/** Rampy: [blask, światło, baza, półcień, cień]. */
const BLACK = [PAL.locoGlint, PAL.locoGraphiteHi, PAL.wagonRib, PAL.wagonBlack, PAL.locoDeep] as const;
const AGG = [PAL.rockDust, PAL.aggregateHi, PAL.aggregate, PAL.aggregateShade, PAL.rockDark] as const;

/** Żebra (słupki) pudła – x lewej kolumny. */
const RIBS: number[] = [];
for (let x = X0 + 8; x < X1 - 4; x += 8) RIBS.push(x);

/**
 * „X" wg zdjęcia: zielone ramię „>" i magentowe „<" o szerokości ARM px (ok. 1/3
 * szerokości znaku), od góry do dołu pudła; groty STYKAJĄ SIĘ w połowie wysokości
 * (prawa krawędź zielonego = lewa krawędź magentowego). g, m = lewe x ramion w wierszu y.
 */
const ARM = 6;
const X_APEX = 72; // styk grotów (znak ok. 10 px od prawego końca, jak na zdjęciu)
const xArms = (y: number) => {
  const s = Math.round(Math.abs(y - (BH - 1) / 2) * 0.5);
  return { g: X_APEX - ARM - s, m: X_APEX + s };
};
/** Pas górny: zielony do górnego końca ramienia „>", magenta od górnego końca „<". */
const BAND_H = 3;
const GREEN_TO = xArms(0).g + ARM; // wyłącznie
const MAGENTA_FROM = xArms(0).m;

function drawLoad(ctx: CanvasRenderingContext2D, load: number): void {
  if (load <= 0) return;
  // kopiec kruszywa: kilka „pagórków", kamyki 2×2 z jasnym lewym-górnym pikselem
  const rnd = mulberry32(99);
  const maxUp = Math.round(load * 4);
  const top: number[] = [];
  for (let x = X0 + 1; x < X1; x++) {
    const hill = Math.sin(((x - X0) / (X1 - X0)) * Math.PI * 3) * 0.5 + 0.5;
    top.push(BT + 1 - Math.round(maxUp * (0.55 + 0.45 * hill)) + (rnd() < 0.3 ? 1 : 0));
  }
  const cell = (cx: number, cy: number) => {
    const h = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
    return h - Math.floor(h);
  };
  // tylko NAD pudłem – kruszywo nie zachodzi na zielony pas
  paint(ctx, X0 + 1, 0, X1 - X0 - 1, BT, (x, y) => {
    const t0 = top[x - X0 - 1];
    if (y < t0) return null;
    const v = cell(x >> 1, (y + (x >> 1)) >> 1); // przesunięte rzędy kamyków
    let t = 1.4 + v * 1.8;
    if ((x & 1) === 0 && ((y + (x >> 1)) & 1) === 0) t -= 0.9; // lewy-górny piksel kamyka w słońcu
    if ((x & 1) === 1 && ((y + (x >> 1)) & 1) === 1) t += 0.8; // prawy-dolny w cieniu
    if (y === t0) t -= 0.7; // wierzch kopca łapie światło
    return AGG[Math.max(0, Math.min(4, Math.round(t)))];
  });
}

function drawWagon(ctx: CanvasRenderingContext2D, load: number): void {
  drawLoad(ctx, load);
  const rnd = mulberry32(4242);

  // --- pudło: czerń w 5 tonach – żebra z blaskiem i cieniem, pas, X ---
  const ribAt = new Int8Array(WAGON_W).fill(-1); // 0 = lewa kolumna żebra, 1 = prawa, 2 = cień rzucany
  for (const rx of RIBS) {
    ribAt[rx] = 0;
    ribAt[rx + 1] = 1;
    ribAt[rx + 2] = 2;
  }
  paint(ctx, X0, BT, X1 - X0 + 1, BH, (x, Y) => {
    const y = Y - BT;
    // czarna blacha: cień pod pasem, jaśniejszy górny panel (niebo), ciemniej ku dołowi
    let t = y === BAND_H ? 4 : y <= BAND_H + 3 ? 2.5 : y <= 19 ? 3 : 3.4;
    const rib = ribAt[x];
    if (rib === 0) t = 1.6; // żebro: krawędź od słońca
    else if (rib === 1) t = 3.6;
    else if (rib === 2) t = Math.max(t, 3.7); // cień żebra na blasze
    if (x === X0) t = Math.min(t, 1.2); // rim light na krawędzi pudła
    if (x === X1) t = 4;
    return BLACK[ditherEdge(t, 5, x, Y, 0.3)];
  });

  // --- rdza i brud przy dole pudła (wagon dalej czarny): zacieki od dołu i spod żeber ---
  for (let x = X0 + 1; x < X1; x++) {
    if (rnd() < 0.12) {
      const len = 1 + Math.floor(rnd() * 4);
      for (let j = 0; j < len; j++) {
        const y = SB - 1 - j;
        if (bayer(x, y) < 0.5) rect(ctx, x, y, 1, 1, j === 0 && rnd() < 0.3 ? PAL.rust : PAL.rustDeep);
      }
    }
    // brud tylko w dolnej 1/4 pudła
    if (rnd() < 0.05) {
      const y0 = SB - 5 + Math.floor(rnd() * 2);
      for (let j = 0; j < 2 + Math.floor(rnd() * 2); j++) if (bayer(x, y0 + j) < 0.5) rect(ctx, x, y0 + j, 1, 1, PAL.grime);
    }
  }
  for (const rx of RIBS) if (rnd() < 0.4) rect(ctx, rx + 1, SB - 2 - Math.floor(rnd() * 3), 1, 2, PAL.rustDeep); // rdza u stóp żeber

  // --- MALOWANIE JAXAN – na wierzchu, ma pierwszeństwo przed efektami (rdza, dithering) ---
  // pas górny: jednolity, stała grubość, ostra krawędź; 1 jasny wiersz światła u góry
  for (let j = 0; j < BAND_H; j++) {
    rect(ctx, X0, BT + j, GREEN_TO - X0, 1, j === 0 ? PAL.jaxanGreen : PAL.wagonGreen);
    rect(ctx, MAGENTA_FROM, BT + j, X1 - MAGENTA_FROM + 1, 1, j === 0 ? PAL.locoMagenta : PAL.wagonMagenta);
  }
  // „X": ramiona jednolite, ostre krawędzie, od góry do dołu pudła
  for (let y = 0; y < BH; y++) {
    const { g, m } = xArms(y);
    rect(ctx, g, BT + y, ARM, 1, PAL.wagonGreen);
    rect(ctx, m, BT + y, ARM, 1, PAL.wagonMagenta);
  }
  // rim light na malowaniu: tylko 1 px – krawędź ramienia od strony słońca (górna połowa)
  for (let y = 0; y < BH / 2; y++) {
    const { g, m } = xArms(y);
    rect(ctx, g, BT + y, 1, 1, PAL.jaxanGreen);
    rect(ctx, m, BT + y, 1, 1, PAL.locoMagenta);
  }

  // --- oznaczenia: małe, czytelne, rozdzielone czernią ---
  // tablica z siatką (rama + 2 rzędy kratek)
  rect(ctx, 22, BT + 8, 11, 1, PAL.white);
  rect(ctx, 22, BT + 12, 11, 1, PAL.white);
  rect(ctx, 22, BT + 8, 1, 5, PAL.white);
  rect(ctx, 32, BT + 8, 1, 5, PAL.white);
  for (let x = 24; x < 32; x += 2) {
    rect(ctx, x, BT + 10, 1, 1, PAL.white);
  }
  // 4 linie napisów (37 TEN / 84 NL-XAMX / 5800 008-1 / Eamos) – „litery" z przerwami
  const lines = [6, 7, 8, 5];
  lines.forEach((n, r) => {
    for (let i = 0; i < n; i++) if (i % 3 !== 2) rect(ctx, 38 + i, BT + 13 + r * 2, 1, 1, PAL.white);
  });
  // symbole po lewej od napisów (1 magentowy, 1 biały znak), osobno
  rect(ctx, 29, BT + 15, 3, 1, PAL.wagonMagenta);
  rect(ctx, 29, BT + 17, 3, 2, PAL.white);
  // kwadratowa tabliczka 3×3
  rect(ctx, 23, BT + 16, 3, 3, PAL.white);
  rect(ctx, 24, BT + 17, 1, 1, PAL.platformHi);
  // magentowa dźwignia na blasze
  rect(ctx, 52, BT + 18, 4, 1, PAL.wagonMagenta);

  // --- końce: magentowe poręcze, drabinka po lewej ---
  for (const hx of [X0 - 1, X1 + 1]) {
    rect(ctx, hx, BT + 7, 1, 13, PAL.wagonMagenta);
    rect(ctx, hx, BT + 7, 1, 1, PAL.locoMagentaHi);
    rect(ctx, hx, BT + 19, 1, 1, PAL.wagonMagentaShade);
  }
  for (let y = BT + 8; y < SB; y += 3) {
    rect(ctx, X0 + 1, y, 5, 1, PAL.locoGraphite); // szczeble drabinki
    rect(ctx, X0 + 1, y, 1, 1, PAL.locoGlint);
    rect(ctx, X0 + 1, y + 1, 5, 1, PAL.locoDeep);
  }

  // --- ostojnica (gruba rama) na całej długości + czołownice szersze niż pudło ---
  for (let j = 0; j < 4; j++) rect(ctx, 2, SB + j, WAGON_W - 4, 1, BLACK[[1, 3, 3, 4][j]]);
  rect(ctx, 2, SB, 1, 4, PAL.locoGlint);
  for (const hx of [1, WAGON_W - 3]) {
    rect(ctx, hx, SB - 1, 2, 6, PAL.locoBlack); // czołownica
    rect(ctx, hx, SB - 1, 2, 1, PAL.locoGraphiteHi);
    rect(ctx, hx, SB + 4, 2, 1, PAL.locoDeep);
  }
  // zderzaki (talerz z blaskiem) i hak sprzęgu
  for (const [bx, dir] of [[0, -1], [WAGON_W - 1, 1]] as const) {
    rect(ctx, bx, SB, 1, 4, PAL.steel);
    rect(ctx, bx, SB, 1, 1, PAL.railGlint);
    rect(ctx, bx, SB + 3, 1, 1, PAL.locoDeep);
    rect(ctx, bx - dir, SB + 4, 1, 2, PAL.steel); // hak pod zderzakami
    rect(ctx, bx - dir, SB + 5, 1, 1, PAL.locoDeep);
  }

  // --- podwozie między wózkami: przewód główny, cięgła, zbiornik i cylinder hamulca ---
  rect(ctx, 30, SB + 4, 37, 1, PAL.locoGraphite); // przewód hamulcowy
  for (let x = 31; x < 66; x += 6) rect(ctx, x, SB + 4, 1, 1, PAL.steel);
  rect(ctx, 32, SB + 7, 30, 1, PAL.locoDeep); // cięgło hamulcowe
  // zbiornik powietrza (walec)
  rect(ctx, 45, SB + 4, 12, 4, PAL.locoBlack);
  rect(ctx, 45, SB + 4, 12, 1, PAL.locoGraphiteHi);
  rect(ctx, 45, SB + 4, 1, 4, PAL.locoGraphite);
  rect(ctx, 56, SB + 5, 1, 3, PAL.locoDeep);
  rect(ctx, 44, SB + 5, 1, 2, PAL.locoGraphite); // dennica
  // cylinder hamulcowy i rozdzielacz
  rect(ctx, 59, SB + 4, 5, 3, PAL.locoGraphite);
  rect(ctx, 59, SB + 4, 5, 1, PAL.locoGlint);
  rect(ctx, 39, SB + 4, 3, 3, PAL.locoBlack);
  rect(ctx, 39, SB + 4, 1, 1, PAL.locoGraphiteHi);
  // koło ręcznego hamulca – białe (jak na zdjęciu), z przodu ostojnicy
  const hw = { x: 34, y: SB + 1 };
  for (const [dx, dy] of [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4]]) {
    rect(ctx, hw.x + dx, hw.y + dy, 1, 1, PAL.white);
  }
  rect(ctx, hw.x + 2, hw.y + 1, 1, 3, PAL.white);
  rect(ctx, hw.x + 1, hw.y + 2, 3, 1, PAL.white);
  rect(ctx, hw.x + 2, hw.y + 2, 1, 1, PAL.locoDeep);
  // stopnie manewrowego na końcach (białe)
  for (const sx of [2, WAGON_W - 6]) {
    rect(ctx, sx + 1, SB + 4, 1, 4, PAL.locoGraphite);
    rect(ctx, sx, SB + 8, 4, 1, PAL.white);
    rect(ctx, sx, SB + 9, 4, 1, PAL.platformHi);
  }
}

/** Wózki Y25 – rysowane NA kołach. Czop skrętu i belka bezpośrednio pod ostojnicą. */
function drawBogies(ctx: CanvasRenderingContext2D): void {
  for (const cx of BOGIE_X) {
    // belka bujakowa z czopem: sięga 1 wiersz w ostojnicę – przy podskoku pudła (±1 px,
    // wózek stoi) nie otwiera się szpara między pudłem a wózkiem
    rect(ctx, cx - 5, SB + 3, 11, 3, PAL.locoBlack);
    rect(ctx, cx - 5, SB + 3, 11, 2, PAL.locoDeep); // w cieniu pudła
    rect(ctx, cx - 1, SB + 4, 3, 1, PAL.locoGraphite);
    // rama boczna: górny pas (cień pod pudłem), dolny pas łapie odbite światło
    rect(ctx, cx - 11, SB + 6, 23, 1, PAL.locoDeep);
    rect(ctx, cx - 11, SB + 7, 23, 2, PAL.locoBlack);
    rect(ctx, cx - 11, SB + 6, 1, 3, PAL.locoGraphiteHi); // brzeg od słońca
    rect(ctx, cx - 4, SB + 8, 9, 3, PAL.locoGraphite); // dolny pas ramy między osiami
    rect(ctx, cx - 4, SB + 10, 9, 1, PAL.locoGraphiteHi);
    rect(ctx, cx - 2, SB + 7, 5, 2, PAL.locoDeep); // okno ramy
    for (const dx of [-7, 7]) {
      const ax = cx + dx;
      // sprężyny nad maźnicą: zwoje jasne/ciemne
      for (let j = 0; j < 3; j++) {
        rect(ctx, ax - 1, SB + 6 + j, 3, 1, j % 2 ? PAL.locoDeep : PAL.steel);
        if (j % 2 === 0) rect(ctx, ax - 1, SB + 6 + j, 1, 1, PAL.railGlint);
      }
      // maźnica z blaskiem i pokrywą osi
      // (pokrywa osi na wysokości piasty koła)
      rect(ctx, ax - 2, SB + 9, 5, 5, PAL.locoBlack);
      rect(ctx, ax - 2, SB + 9, 5, 1, PAL.locoGraphiteHi);
      rect(ctx, ax - 2, SB + 9, 1, 5, PAL.locoGraphite);
      rect(ctx, ax + 2, SB + 10, 1, 4, PAL.locoDeep);
      rect(ctx, ax, SB + 11, 1, 2, PAL.steel);
      rect(ctx, ax, SB + 11, 1, 1, PAL.railGlint);
    }
    // klocki hamulcowe przy wewnętrznych stronach kół
    for (const kx of [cx - 1, cx + 1]) {
      rect(ctx, kx, SB + 11, 1, 4, PAL.locoGraphite);
      rect(ctx, kx, SB + 11, 1, 1, PAL.locoGlint);
    }
  }
}

export interface EamosSprites {
  body: HTMLCanvasElement;
  bogies: HTMLCanvasElement;
  wheels: HTMLCanvasElement[];
  /** Nakładki rim light pudła (lewe/prawe słońce). */
  rim: RimOverlays;
}

/** Sprite węglarki dla poziomu załadunku 0..1 (kwantyzowany do LOAD_STEPS). */
export function getEamos(load: number): EamosSprites {
  const step = Math.round(Math.min(1, Math.max(0, load)) * LOAD_STEPS);
  return cached(`eamos-${step}`, () => {
    const body = makeSprite(WAGON_W, WAGON_H, (ctx) => drawWagon(ctx, step / LOAD_STEPS));
    return {
      body,
      bogies: makeSprite(WAGON_W, WAGON_H, drawBogies),
      wheels: getWheelFrames(WHEEL_D),
      rim: buildRimOverlays(body, false), // tylko 1 px – malowanie bez ditheringu
    };
  });
}
