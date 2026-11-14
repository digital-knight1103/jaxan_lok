// Nasyp wśród łąk: pojedyncze drzewa i krzaki, otwarty widok na wzgórza.
import { mulberry32 } from '../../engine/rng';
import type { SegmentDef } from './types';
import { drawBackStrip, drawGround, plantBackItem, scatterBushes } from './common';

const WIDTH = 480;

export const embankment: SegmentDef = {
  id: 'embankment',
  kind: 'filler',
  width: WIDTH,
  weight: 1.5,
  render({ back, bed }, seed) {
    const rnd = mulberry32(seed);
    let x = 20 + Math.floor(rnd() * 60);
    while (x < WIDTH - 20) {
      const r = rnd();
      plantBackItem(back, x, r < 0.35 ? 'tree' : r < 0.5 ? 'pine' : 'bush', rnd, 2);
      x += 40 + Math.floor(rnd() * 120);
    }
    drawBackStrip(back, 0, WIDTH, rnd);
    drawGround(bed, 0, WIDTH, rnd);
    scatterBushes(bed, 0, WIDTH, 26, rnd);
  },
};
