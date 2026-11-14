import { PAL } from '../palette';
import { cached, makeSprite } from '../engine/sprite';

export const WHEEL_FRAMES = 8;

/**
 * Klatki obrotu koła o średnicy d: ciemna tarcza, jasna obręcz, szprycha i znacznik
 * obracane co 45° (8 klatek na obrót).
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
              if (dist > r - 1.1) c = dx + dy < -r * 0.9 ? PAL.railGlint : PAL.wheelRim; // stały błysk z lewej-góry
              else {
                // odległość od szprychy (prostej przez środek pod kątem a)
                const off = Math.abs(dx * Math.sin(a) - dy * Math.cos(a));
                if (off < 0.6 && dist > 0.8) c = PAL.locoGraphiteHi;
              }
              ctx.fillStyle = c;
              ctx.fillRect(x, y, 1, 1);
            }
          }
          // piasta + znacznik na końcu szprychy (asymetryczny → widać obrót)
          ctx.fillStyle = PAL.steel;
          ctx.fillRect(Math.floor(r - 1), Math.floor(r - 1), 2, 2);
          ctx.fillStyle = PAL.railGlint;
          ctx.fillRect(Math.round(r - 0.5 + Math.cos(a) * (r - 2)), Math.round(r - 0.5 + Math.sin(a) * (r - 2)), 1, 1);
        }),
      );
    }
    return frames;
  });
}
