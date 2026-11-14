// Pierwszy plan: kępy trawy i krzewów na dole kadru (paralaksa 1.3 – najszybsza).
import { W, H } from '../config';
import { PAL } from '../palette';
import { makeSprite } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { drawBlob, type Circle } from '../sprites/blob';

const TILE = W * 3;
const RAMP = [PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep] as const;

export class ForegroundLayer {
  private tile: HTMLCanvasElement;

  constructor(seed: number, private factor = 1.3) {
    const rnd = mulberry32(seed);
    this.tile = makeSprite(TILE, H, (ctx) => {
      // kępy z przerwami – nie zasłaniają doliny pod mostem w całości
      let x = 40;
      while (x < TILE - 60) {
        const w = 40 + Math.floor(rnd() * 90);
        const hgt = 14 + Math.floor(rnd() * 26);
        const circles: Circle[] = [];
        for (let i = 0; i < 5; i++) {
          circles.push({ x: x + (i / 4) * w, y: H + 6 - rnd() * 6, r: hgt * (0.6 + rnd() * 0.5) });
        }
        drawBlob(ctx, circles, RAMP, rnd, 0, 0, undefined, 0.5);
        // źdźbła trawy na krawędziach
        for (let i = 0; i < w / 2; i++) {
          const gx = x - 6 + Math.floor(rnd() * (w + 12));
          const gy = H - Math.floor(rnd() * hgt) - 2;
          ctx.fillStyle = rnd() > 0.5 ? PAL.grassHi : PAL.grass;
          ctx.fillRect(gx, gy - 3, 1, 3);
        }
        x += w + 60 + Math.floor(rnd() * 160);
      }
    });
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    const off = Math.floor((worldX * this.factor) % TILE);
    ctx.drawImage(this.tile, -off, 0);
    if (TILE - off < W) ctx.drawImage(this.tile, TILE - off, 0);
  }
}
