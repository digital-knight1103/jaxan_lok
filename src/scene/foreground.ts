// Pierwszy plan: bujne kępy trawy i krzewów na dole kadru (paralaksa 1.3 – najszybsza).
// Kępy z kępek listowia + źdźbła z żółtozielonymi refleksami, jak na styl.jpg.
import { W, H } from '../config';
import { PAL } from '../palette';
import { makeSprite } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { SkinnedTile } from '../engine/seasonskin';
import type { Season } from './season';
import { drawFoliage } from '../sprites/blob';

const TILE = W * 3;
const RAMP = [PAL.grassGlint, PAL.grassHi, PAL.grass, PAL.grassMid, PAL.grassDark, PAL.grassDeep, PAL.frontDeep] as const;

export class ForegroundLayer {
  private skinned: SkinnedTile;
  private get tile(): HTMLCanvasElement { return this.skinned.shown; }

  constructor(seed: number, private factor = 1.3) {
    const rnd = mulberry32(seed);
    this.skinned = new SkinnedTile(makeSprite(TILE, H, (ctx) => {
      // kępy z przerwami – nie zasłaniają doliny pod mostem w całości
      let x = 40;
      while (x < TILE - 80) {
        const w = 50 + Math.floor(rnd() * 90);
        const hgt = 16 + Math.floor(rnd() * 24);
        // 2–3 nakładające się garby listowia
        const parts = 2 + Math.floor(rnd() * 2);
        for (let p = 0; p < parts; p++) {
          const cx = x + ((p + 0.5) / parts) * w + (rnd() - 0.5) * 10;
          const ry = hgt * (0.75 + rnd() * 0.35);
          drawFoliage(ctx, cx, H + 4 - ry * 0.35, (w / parts) * 0.75, ry, RAMP, rnd, [2.5, 4.5], 2.6);
        }
        // źdźbła wystające ponad kępę: ciemna nasada, jasny czubek
        for (let i = 0; i < w / 2.5; i++) {
          const gx = x - 4 + Math.floor(rnd() * (w + 8));
          const gy = H - Math.floor(rnd() * hgt * 0.9) - 2;
          const len = 3 + Math.floor(rnd() * 4);
          for (let j = 0; j < len; j++) {
            ctx.fillStyle = j === len - 1 ? PAL.grassGlint : j > len / 2 ? PAL.grassHi : PAL.grass;
            ctx.fillRect(gx + (j > 1 && rnd() < 0.4 ? 1 : 0), gy - j, 1, 1);
          }
        }
        x += w + 70 + Math.floor(rnd() * 170);
      }
    }));
  }

  skin(from: Season, to: Season, step: number): void {
    this.skinned.request(from, to, step);
  }

  skinStep(): boolean {
    return this.skinned.step();
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    const off = Math.floor((worldX * this.factor) % TILE);
    ctx.drawImage(this.tile, -off, 0);
    if (TILE - off < W) ctx.drawImage(this.tile, TILE - off, 0);
  }
}
