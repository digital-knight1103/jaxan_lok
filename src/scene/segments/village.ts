// Odcinek WIEŚ: za torem pastwisko i zagrody – drewniana stodoła, domy z czerwoną
// dachówką i płotami, wiatrak koźlak, bocian na słupie, kapliczka, topole i wierzby.
// Dalszy rząd (wyżej) to mniejsze domy i topole – perspektywa.
import { TRACK_Y } from '../../config';
import { PAL } from '../../palette';
import { mulberry32 } from '../../engine/rng';
import { ditherIndex, paint } from '../../engine/pixbuf';
import type { SegmentDef } from './types';
import { drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';
import {
  getBarn, getHouse, getPoplar, getShrine, getStorkNest, getWillow, getWindmill, drawFence,
  POPLAR_VARIANTS, WILLOW_VARIANTS,
} from '../../sprites/village';

const WIDTH = 640;
const MEADOW_TOP = TRACK_Y - 26;
const GRASS = [PAL.grassGlint, PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark] as const;

function put(ctx: CanvasRenderingContext2D, s: HTMLCanvasElement, cx: number, base: number): void {
  ctx.drawImage(s, Math.round(cx - s.width / 2), base - s.height);
}

/** Pastwisko: od jaśniejszego, zamglonego tła do soczystszej zieleni przy torze (dithering). */
function drawPasture(ctx: CanvasRenderingContext2D): void {
  paint(ctx, 0, MEADOW_TOP, WIDTH, TRACK_Y + 2 - MEADOW_TOP, (x, y) => {
    const t = 1.2 + ((y - MEADOW_TOP) / (TRACK_Y - MEADOW_TOP)) * 1.9;
    return GRASS[ditherIndex(t + Math.sin(x * 0.03 + y * 0.4) * 0.25, GRASS.length, x, y)];
  });
  // złoty pas skoszonej łąki w oddali
  for (let x = 0; x < WIDTH; x++) {
    ctx.fillStyle = (x + MEADOW_TOP) % 3 ? PAL.meadowLight : PAL.meadowBase;
    ctx.fillRect(x, MEADOW_TOP, 1, 2);
  }
}

export const village: SegmentDef = {
  id: 'village',
  kind: 'filler',
  width: WIDTH,
  weight: 3,
  // generator: yield = miejsce na przerwę między klatkami (World rozkłada render w czasie)
  *render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    drawPasture(back);
    yield;

    // dalszy rząd: małe domy i topole
    const farBase = MEADOW_TOP + 8;
    for (let x = 20 + Math.floor(rnd() * 30); x < WIDTH - 20; x += 36 + Math.floor(rnd() * 70)) {
      if (rnd() < 0.55) put(back, getHouse(2 + Math.floor(rnd() * 2)), x, farBase);
      else put(back, getPoplar(Math.floor(rnd() * POPLAR_VARIANTS)), x, farBase);
    }

    yield;
    // bliższy rząd: zagrody (kolejność losowa), płoty między budynkami
    const near = TRACK_Y;
    const kinds = ['barn', 'house', 'windmill', 'stork', 'house', 'willow', 'shrine', 'poplars'];
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    let x = 26;
    for (const k of kinds) {
      if (x > WIDTH - 30) break;
      let s: HTMLCanvasElement;
      switch (k) {
        case 'barn': s = getBarn(Math.floor(rnd() * 2)); break;
        case 'house': s = getHouse(Math.floor(rnd() * 2)); break;
        case 'windmill': s = getWindmill(); break;
        case 'stork': s = getStorkNest(); break;
        case 'shrine': s = getShrine(); break;
        case 'willow': s = getWillow(Math.floor(rnd() * WILLOW_VARIANTS)); break;
        default: s = getPoplar(Math.floor(rnd() * POPLAR_VARIANTS));
      }
      if (x + s.width / 2 > WIDTH - 6) break;
      put(back, s, x + s.width / 2, near - 1);
      if (k === 'poplars') put(back, getPoplar(Math.floor(rnd() * POPLAR_VARIANTS)), x + s.width + 4, near - 1);
      if (k === 'house' && x + s.width + 30 < WIDTH) drawFence(back, x + s.width + 2, x + s.width + 26, near);
      x += s.width + 14 + Math.floor(rnd() * 26) + (k === 'house' ? 26 : 0);
      yield;
    }
    drawBackStrip(back, 0, WIDTH, rnd);
    yield;
    // wierzby przy rowie wzdłuż toru
    plantBackItem(back, 8, 'bush', rnd, 2);
    yield;
    drawGround(bed, 0, WIDTH, rnd);
    yield;
    scatterBushes(bed, 0, WIDTH, 22, rnd);
  },
};
