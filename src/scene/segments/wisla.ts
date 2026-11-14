// Most kolejowy nad Wisłą przed Warszawą: stalowa kratownica łukowa (cztery przęsła)
// na betonowych filarach, szeroka rzeka z piaszczystymi brzegami.
import { H, TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { line, rect } from '../../engine/sprite';
import type { SegmentDef } from './types';
import { GROUND_Y, drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';

const WIDTH = 1100;
const BANK = 120; // brzeg: grunt schodzi do rzeki
const SPAN_FROM = 90;
const SPAN_TO = WIDTH - 90;
const SPANS = 4;
const DECK_TOP = TRACK_Y + 4;
const DECK_BOTTOM = TRACK_Y + 14;
const WATER_Y = TRACK_Y + 52;
const TRUSS_LOW = TRACK_Y - 14;
const TRUSS_RISE = 26;

function groundTop(x: number): number {
  if (x < BANK) return GROUND_Y + Math.max(0, x - 50) * 1;
  if (x >= WIDTH - BANK) return GROUND_Y + Math.max(0, WIDTH - 1 - x - 50) * 1;
  return H;
}

const spanW = (SPAN_TO - SPAN_FROM) / SPANS;
/** Górny pas kratownicy łukowej nad x. */
function trussTop(x: number): number {
  const u = ((x - SPAN_FROM) % spanW) / spanW;
  return Math.round(TRUSS_LOW - TRUSS_RISE * Math.sin(Math.PI * u));
}

function drawRiver(bed: CanvasRenderingContext2D, rnd: () => number): void {
  const bands: [number, string][] = [[0, PAL.waterHi], [3, PAL.water], [30, PAL.waterShade], [80, PAL.waterDeep]];
  for (let i = 0; i < bands.length; i++) {
    const y0 = WATER_Y + bands[i][0];
    const y1 = i + 1 < bands.length ? WATER_Y + bands[i + 1][0] : H;
    rect(bed, 0, y0, WIDTH, y1 - y0, bands[i][1]);
  }
  // refleksy i fale – krótkie poziome kreski
  for (let k = 0; k < 260; k++) {
    const y = WATER_Y + 4 + Math.floor(rnd() * (H - WATER_Y - 4));
    const x = Math.floor(rnd() * WIDTH);
    rect(bed, x, y, 2 + Math.floor(rnd() * 6), 1, y < WATER_Y + 40 ? PAL.waterHi : PAL.water);
  }
  // piaszczyste łachy przy brzegach
  for (const [x0, x1] of [[BANK - 40, BANK + 60], [WIDTH - BANK - 60, WIDTH - BANK + 40]]) {
    for (let r = 0; r < 6; r++) rect(bed, x0 + r * 4, WATER_Y + r, x1 - x0 - r * 8, 1, r < 2 ? PAL.sandHi : PAL.sand);
  }
}

export const wisla: SegmentDef = {
  id: 'wisla',
  kind: 'landmark',
  width: WIDTH,
  weight: 0,
  bridge: true,
  mapIcon: 'bridge',
  mapLabel: 'MOST NA WIŚLE',
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    // za torem: daleka tafla rzeki i drzewa na brzegach
    rect(back, BANK, TRACK_Y - 5, WIDTH - 2 * BANK, 8, PAL.water);
    rect(back, BANK, TRACK_Y - 5, WIDTH - 2 * BANK, 1, PAL.waterHi);
    for (let x = BANK; x < WIDTH - BANK; x += 5 + Math.floor(rnd() * 9)) rect(back, x, TRACK_Y - 3 + Math.floor(rnd() * 4), 3, 1, PAL.waterHi);
    for (let x = 8; x < BANK + 10; x += 14 + Math.floor(rnd() * 10)) plantBackItem(back, x, 'tree', rnd, 0);
    for (let x = WIDTH - BANK - 10; x < WIDTH; x += 14 + Math.floor(rnd() * 10)) plantBackItem(back, x, 'tree', rnd, 0);
    drawBackStrip(back, 0, BANK, rnd);
    drawBackStrip(back, WIDTH - BANK, WIDTH, rnd);

    // kratownica łukowa (strona za pociągiem): pas górny, słupki, krzyżulce
    for (let x = SPAN_FROM; x <= SPAN_TO; x++) {
      const y = trussTop(x);
      rect(back, x, y, 1, 3, PAL.bridge);
      rect(back, x, y, 1, 1, PAL.bridgeHi);
    }
    rect(back, SPAN_FROM, TRACK_Y - 2, SPAN_TO - SPAN_FROM, 2, PAL.bridgeShade); // pas dolny
    for (let i = 0; i < SPANS; i++) {
      const s0 = SPAN_FROM + i * spanW;
      const n = 10;
      for (let k = 0; k <= n; k++) {
        const x = Math.round(s0 + (k * spanW) / n);
        rect(back, x, trussTop(x), 2, TRACK_Y - trussTop(x), PAL.bridge);
        if (k < n) {
          const x2 = Math.round(s0 + ((k + 1) * spanW) / n);
          if (k < n / 2) line(back, x, TRACK_Y - 2, x2, trussTop(x2) + 2, PAL.bridgeShade);
          else line(back, x2, TRACK_Y - 2, x, trussTop(x) + 2, PAL.bridgeShade);
        }
      }
      // portal przęsła
      rect(back, Math.round(s0) - 1, TRUSS_LOW - 4, 4, TRACK_Y - TRUSS_LOW + 4, PAL.bridgeShade);
    }
    rect(back, SPAN_TO - 1, TRUSS_LOW - 4, 4, TRACK_Y - TRUSS_LOW + 4, PAL.bridgeShade);

    // pod torem: rzeka, brzegi, filary, pomost
    drawRiver(bed, rnd);
    drawGround(bed, 0, WIDTH, rnd, groundTop, WIDTH);
    scatterBushes(bed, 0, 60, 3, rnd);
    scatterBushes(bed, WIDTH - 60, WIDTH, 3, rnd);
    for (let i = 0; i <= SPANS; i++) {
      const px = Math.round(SPAN_FROM + i * spanW) - 8;
      rect(bed, px, DECK_BOTTOM, 16, WATER_Y + 6 - DECK_BOTTOM, PAL.towerConcrete);
      rect(bed, px, DECK_BOTTOM, 2, WATER_Y + 6 - DECK_BOTTOM, PAL.pkinHi);
      rect(bed, px + 12, DECK_BOTTOM, 4, WATER_Y + 6 - DECK_BOTTOM, PAL.towerConcreteShade);
      rect(bed, px - 2, DECK_BOTTOM, 20, 3, PAL.towerConcreteShade);
      // odbicie filara w wodzie (przerywane)
      for (let y = WATER_Y + 8; y < WATER_Y + 40; y += 3) rect(bed, px + 2 + ((y >> 1) % 2), y, 12, 1, PAL.waterShade);
    }
    rect(bed, SPAN_FROM - 30, DECK_TOP, SPAN_TO - SPAN_FROM + 60, DECK_BOTTOM - DECK_TOP, PAL.bridge);
    rect(bed, SPAN_FROM - 30, DECK_TOP, SPAN_TO - SPAN_FROM + 60, 1, PAL.bridgeHi);
    rect(bed, SPAN_FROM - 30, DECK_BOTTOM - 1, SPAN_TO - SPAN_FROM + 60, 1, PAL.bridgeShade);
    for (let x = SPAN_FROM - 28; x < SPAN_TO + 28; x += 6) {
      rect(bed, x, DECK_TOP + 3, 1, 1, PAL.bridgeRivet);
      line(bed, x, DECK_TOP + 5, x + 3, DECK_BOTTOM - 2, PAL.bridgeShade);
    }
  },
};
