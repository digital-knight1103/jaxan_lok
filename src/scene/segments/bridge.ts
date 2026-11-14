// Stalowy most łukowy nad doliną (jak na styl.jpg): pomost, łuki, filary.
// Pod mostem prześwituje średni plan (wzgórza).
import { H, TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import type { SegmentDef } from './types';
import { GROUND_Y, drawBackStrip, drawGround, scatterBushes } from './common';

const WIDTH = 480;
const ABUT = 56; // przyczółek: grunt schodzi w dolinę
const SPAN_FROM = 40;
const SPAN_TO = WIDTH - 40;
const ARCHES = 4;
const PIER_W = 10;
const DECK_TOP = TRACK_Y + 4;
const DECK_BOTTOM = TRACK_Y + 11;
const ARCH_DEPTH = 22;

/** Górna krawędź gruntu na przyczółkach (poza nimi – dolina). */
function groundTop(x: number): number {
  if (x < ABUT) return GROUND_Y + Math.max(0, x - 18) * 5;
  if (x >= WIDTH - ABUT) return GROUND_Y + Math.max(0, WIDTH - 1 - x - 18) * 5;
  return H;
}

export const bridge: SegmentDef = {
  id: 'bridge',
  kind: 'filler',
  width: WIDTH,
  bridge: true,
  weight: 2,
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    drawBackStrip(back, 0, 30, rnd);
    drawBackStrip(back, WIDTH - 30, WIDTH, rnd);

    // przyczółki – zielone stoki schodzące w dolinę
    drawGround(bed, 0, WIDTH, rnd, groundTop, WIDTH);
    scatterBushes(bed, 0, 30, 2, rnd);
    scatterBushes(bed, WIDTH - 40, WIDTH, 2, rnd);

    const span = (SPAN_TO - SPAN_FROM) / ARCHES;
    for (let x = SPAN_FROM - 6; x < SPAN_TO + 6; x++) {
      // pomost
      bed.fillStyle = PAL.bridge;
      bed.fillRect(x, DECK_TOP, 1, DECK_BOTTOM - DECK_TOP);
      // łuk: grubszy przy filarach, cienki w środku przęsła
      const u = ((x - SPAN_FROM) % span) / span;
      const archY = x < SPAN_FROM || x >= SPAN_TO ? DECK_BOTTOM : DECK_BOTTOM + Math.round(ARCH_DEPTH * (2 * u - 1) ** 2);
      bed.fillRect(x, DECK_BOTTOM, 1, archY - DECK_BOTTOM);
      bed.fillStyle = PAL.bridgeShade;
      bed.fillRect(x, archY, 1, 1); // cień pod łukiem
    }
    // światło na górnej krawędzi pomostu, nity
    bed.fillStyle = PAL.bridgeHi;
    bed.fillRect(SPAN_FROM - 6, DECK_TOP, SPAN_TO - SPAN_FROM + 12, 1);
    bed.fillStyle = PAL.bridgeRivet;
    for (let x = SPAN_FROM - 4; x < SPAN_TO + 4; x += 4) bed.fillRect(x, DECK_TOP + 3, 1, 1);
    bed.fillStyle = PAL.bridgeShade;
    bed.fillRect(SPAN_FROM - 6, DECK_BOTTOM - 1, SPAN_TO - SPAN_FROM + 12, 1);
    // kratownica w pomoście
    for (let x = SPAN_FROM; x < SPAN_TO; x += 8) {
      for (let i = 0; i < 5; i++) bed.fillRect(x + i, DECK_TOP + 1 + i, 1, 1);
    }

    // filary do dna doliny, poszerzone u podstawy
    for (let i = 0; i <= ARCHES; i++) {
      const px = Math.round(SPAN_FROM + i * span - PIER_W / 2);
      for (let y = DECK_BOTTOM; y < H; y++) {
        const widen = y > H - 30 ? Math.floor((y - (H - 30)) / 8) : 0;
        bed.fillStyle = PAL.bridge;
        bed.fillRect(px - widen, y, PIER_W + 2 * widen, 1);
        bed.fillStyle = PAL.bridgeHi;
        bed.fillRect(px - widen, y, 1, 1);
        bed.fillStyle = PAL.bridgeShade;
        bed.fillRect(px + PIER_W + widen - 2, y, 2, 1);
      }
      // głowica filara
      bed.fillStyle = PAL.bridgeHi;
      bed.fillRect(px - 2, DECK_BOTTOM + 2, PIER_W + 4, 1);
    }
  },
};
