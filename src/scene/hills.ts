// Średni plan: zalesione wzgórza (paralaksa 0.4) – widać je za nasypem i pod mostem.
import { W, H } from '../config';
import { PAL } from '../palette';
import { makeSprite } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { mountainProfile } from './mountains';

const TILE = W * 2;

export class HillLayer {
  private tile: HTMLCanvasElement;

  constructor(seed: number, private factor = 0.4) {
    const rnd = mulberry32(seed);
    const top = mountainProfile(seed, TILE, { baseY: 262, height: 80, roughness: 0.3 });
    this.tile = makeSprite(TILE, H, (ctx) => {
      for (let x = 0; x < TILE; x++) {
        ctx.fillStyle = PAL.midHill;
        ctx.fillRect(x, top[x], 1, H - top[x]);
        // ciemniejsze dno doliny
        ctx.fillStyle = PAL.midHillShade;
        ctx.fillRect(x, top[x] + 40 + ((x >> 2) % 3), 1, H);
      }
      // korony drzew wzdłuż grzbietu i na zboczu – zaokrąglone garby
      for (let i = 0; i < 900; i++) {
        const x = Math.floor(rnd() * TILE);
        const r = 2 + Math.floor(rnd() * 4);
        const y = top[x] + Math.floor(rnd() * rnd() * 150) + r - 2;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const lit = dx + dy < -r * 0.4;
            ctx.fillStyle = lit ? PAL.midHillHi : dx + dy > r * 0.6 ? PAL.midHillShade : PAL.midHill;
            ctx.fillRect((x + dx + TILE) % TILE, y + dy, 1, 1);
          }
        }
      }
    });
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    const off = Math.floor((worldX * this.factor) % TILE);
    ctx.drawImage(this.tile, -off, 0);
    if (TILE - off < W) ctx.drawImage(this.tile, TILE - off, 0);
  }
}
