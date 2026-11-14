import { PAL } from '../palette';
import { cached, makeSprite } from '../engine/sprite';

export const WHEEL_FRAMES = 4;

/**
 * Klatki obrotu koła o średnicy d: ciemna tarcza, jasna obręcz i szprycha
 * obracana co 45° (4 klatki wystarczą – szprycha jest symetryczna).
 */
export function getWheelFrames(d: number): HTMLCanvasElement[] {
  return cached(`wheel-${d}`, () => {
    const frames: HTMLCanvasElement[] = [];
    const r = d / 2;
    for (let f = 0; f < WHEEL_FRAMES; f++) {
      const a = (f * Math.PI) / 4;
      frames.push(
        makeSprite(d, d, (ctx) => {
          for (let y = 0; y < d; y++) {
            for (let x = 0; x < d; x++) {
              const dx = x + 0.5 - r;
              const dy = y + 0.5 - r;
              const dist = Math.hypot(dx, dy);
              if (dist > r) continue;
              let c: string = PAL.wheelDark;
              if (dist > r - 1.1) c = PAL.wheelRim;
              else {
                // odległość od szprychy (prostej przez środek pod kątem a)
                const off = Math.abs(dx * Math.sin(a) - dy * Math.cos(a));
                if (off < 0.6 && dist > 0.8) c = PAL.locoGraphiteHi;
              }
              ctx.fillStyle = c;
              ctx.fillRect(x, y, 1, 1);
            }
          }
          ctx.fillStyle = PAL.steel; // piasta
          ctx.fillRect(Math.floor(r - 0.5), Math.floor(r - 0.5), 1, 1);
        }),
      );
    }
    return frames;
  });
}
