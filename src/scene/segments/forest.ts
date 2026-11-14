// Odcinek leśny: gęsty pas świerków i drzew liściastych za torem.
import { mulberry32 } from '../../engine/rng';
import type { SegmentDef } from './types';
import { drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';

const WIDTH = 640;

export const forest: SegmentDef = {
  id: 'forest',
  kind: 'filler',
  width: WIDTH,
  weight: 3,
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    // dalszy rząd (wyżej, częściej choinki), potem bliższy
    for (let x = 6; x < WIDTH; x += 7 + Math.floor(rnd() * 8)) {
      plantBackItem(back, x, rnd() < 0.6 ? 'pine' : 'tree', rnd, -2);
    }
    for (let x = 10; x < WIDTH; x += 14 + Math.floor(rnd() * 16)) {
      plantBackItem(back, x, rnd() < 0.5 ? 'tree' : 'pine', rnd, 2);
    }
    drawBackStrip(back, 0, WIDTH, rnd);
    drawGround(bed, 0, WIDTH, rnd);
    scatterBushes(bed, 0, WIDTH, 34, rnd);
  },
};
