// Przejazd kolejowo-drogowy: jezdnia przecina oba tory w osi segmentu (CROSS_X). Statyczne
// warstwy: jezdnia (przed torem i za torami), trawa, drzewa z dala od drogi. Rogatki, światła,
// W 6 i auta rysuje scene/crossingfx.ts wg stanu z train/crossings.ts (zależy od pociągów).
import { mulberry32 } from '../../engine/rng';
import type { SegmentDef } from './types';
import { drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';
import { CROSS_X, paintRoad } from '../crossingfx';

const WIDTH = 480;

export const crossing: SegmentDef = {
  id: 'crossing',
  kind: 'filler',
  width: WIDTH,
  weight: 0.9,
  mapIcon: 'crossing',
  mapLabel: 'PRZEJAZD',
  mapAnchor: CROSS_X,
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    let x = 14 + Math.floor(rnd() * 30);
    while (x < WIDTH - 14) {
      if (Math.abs(x - CROSS_X) > 56) {
        const r = rnd();
        plantBackItem(back, x, r < 0.4 ? 'tree' : r < 0.55 ? 'pine' : 'bush', rnd, 2);
      }
      x += 34 + Math.floor(rnd() * 90);
    }
    drawBackStrip(back, 0, WIDTH, rnd);
    drawGround(bed, 0, WIDTH, rnd);
    scatterBushes(bed, 0, CROSS_X - 60, 10, rnd);
    scatterBushes(bed, CROSS_X + 60, WIDTH, 10, rnd);
    paintRoad(back, bed);
  },
};
