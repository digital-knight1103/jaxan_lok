// Chmury pikselowe: kilka sprite'ów-kłębów, paralaksa 0.15 + własny wolny dryf.
import { W } from '../config';
import { PAL } from '../palette';
import { makeSprite } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { drawBlob, type Circle } from '../sprites/blob';

const WRAP = W * 2; // chmury zawijają się co 1280 px
const RAMP = [PAL.cloudLight, PAL.cloudLight, PAL.cloudMid, PAL.cloudShade, PAL.cloudDark] as const;

interface Cloud { sprite: HTMLCanvasElement; x: number; y: number; speed: number; drift: number }

function makeCloud(rnd: () => number): HTMLCanvasElement {
  const w = 70 + Math.floor(rnd() * 80);
  const h = 30 + Math.floor(rnd() * 22);
  return makeSprite(w, h, (ctx) => {
    const circles: Circle[] = [];
    // płaska podstawa + kłęby na górze
    for (let i = 0; i < 6; i++) {
      circles.push({ x: 10 + (i / 5) * (w - 20), y: h - 9, r: 8 + rnd() * 3 });
    }
    for (let i = 0; i < 4; i++) {
      circles.push({ x: w * (0.2 + rnd() * 0.6), y: h * (0.35 + rnd() * 0.2), r: h * (0.25 + rnd() * 0.15) });
    }
    drawBlob(ctx, circles, RAMP, rnd, 0, 0, undefined, 0.65);
  });
}

export class CloudLayer {
  private clouds: Cloud[] = [];

  constructor(seed: number, private factor = 0.15, count = 7) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        sprite: makeCloud(rnd),
        x: (i / count) * WRAP + rnd() * 80,
        y: 8 + Math.floor(rnd() * 110),
        speed: 0.6 + rnd() * 0.8,
        drift: 0,
      });
    }
  }

  update(dt: number): void {
    // wolny dryf niezależny od pociągu (zawijany – liczba nie rośnie)
    for (const c of this.clouds) c.drift = (c.drift + dt * 3 * c.speed) % WRAP;
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    for (const c of this.clouds) {
      // pozycja w [0, WRAP), a chmura wychodząca z lewej krawędzi – ujemna
      let x = (((c.x - worldX * this.factor - c.drift) % WRAP) + WRAP) % WRAP;
      if (x > WRAP - c.sprite.width) x -= WRAP;
      if (x > W) continue;
      ctx.drawImage(c.sprite, Math.floor(x), c.y);
    }
  }
}
