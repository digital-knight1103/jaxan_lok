import { PAL } from '../palette';
import { cached, makeSprite } from '../engine/sprite';

export const WHEEL_FRAMES = 8;

/**
 * Klatki obrotu koła o średnicy d (styl2): obręcz (bandaż) z jasnym blaskiem od
 * lewej-góry, ciemny pierścień obrzeża, ciemna tarcza, stalowa piasta z blaskiem
 * i dwa przeciwległe znaczniki na tarczy obracane co 45° – widać obrót.
 * Dolny wiersz koła = punkt styku z szyną.
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
              let c: string;
              if (dist > r - 1.1) {
                // bandaż: blask na łuku od słońca, stal po bokach, ciemniej od dołu
                const ang = Math.atan2(dy, dx); // -π..π, 0 = w prawo
                c = ang < -1.2 && ang > -2.9 ? PAL.railGlint : dy > r * 0.6 ? PAL.wheelRim : PAL.steel;
              } else if (dist > r - 2.1) {
                c = PAL.locoBlack; // obrzeże – ciemny pierścień oddziela obręcz od tarczy
              } else {
                // tarcza: lekko jaśniejsza lewa-górna ćwiartka
                c = dx + dy < -1.5 ? PAL.locoGraphite : PAL.wheelDark;
                // znaczniki (otwory) obracające się z kołem
                for (const k of [0, Math.PI]) {
                  const mx = Math.cos(a + k) * r * 0.5;
                  const my = Math.sin(a + k) * r * 0.5;
                  if (Math.hypot(dx - mx, dy - my) < 0.75) c = PAL.wheelRim;
                }
              }
              ctx.fillStyle = c;
              ctx.fillRect(x, y, 1, 1);
            }
          }
          // piasta z blaskiem
          const h = Math.floor(r - 1);
          ctx.fillStyle = PAL.steel;
          ctx.fillRect(h, h, 2, 2);
          ctx.fillStyle = PAL.railGlint;
          ctx.fillRect(h, h, 1, 1);
        }),
      );
    }
    return frames;
  });
}
