// Średni plan: zalesione wzgórza (paralaksa 0.4) – widać je za nasypem i pod mostem.
// Trzy odcienie, mgiełka przy grzbiecie (dalej = jaśniej), ciemniejsze dno doliny
// i korony drzew z kępek oświetlonych z lewej-góry.
import { W, H } from '../config';
import { PAL } from '../palette';
import { makeSprite } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';
import { lerpColor } from '../engine/color';
import { mountainProfile } from './mountains';

const TILE = W * 2;

export class HillLayer {
  private tile: HTMLCanvasElement;

  constructor(seed: number, private factor = 0.4) {
    const rnd = mulberry32(seed);
    const top = mountainProfile(seed, TILE, { baseY: 262, height: 80, roughness: 0.3 });
    // odcienie od najjaśniejszego (mgiełka) do najciemniejszego (dno doliny)
    const tones = [
      lerpColor(PAL.midHillHi, PAL.hillHaze, 0.5),
      PAL.midHillHi,
      PAL.midHill,
      PAL.midHillShade,
      lerpColor(PAL.midHillShade, PAL.bridgeShadow, 0.35),
    ];
    this.tile = makeSprite(TILE, H, (ctx) => {
      for (let x = 0; x < TILE; x++) {
        for (let y = top[x]; y < H; y++) {
          // grzbiet zamglony, potem zbocze, im niżej tym ciemniej
          const d = (y - top[x]) / 120 + (y - 200) / 400;
          const fs = 1 + d * 3.2;
          const edge = fs - Math.floor(fs) > 0.85 && ((x + y) & 1) === 0 ? 1 : 0; // dithering tylko na granicy
          const t = Math.max(0, Math.min(tones.length - 1, Math.floor(fs) + edge - (y - top[x] < 3 ? 1 : 0)));
          ctx.fillStyle = tones[t];
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // korony drzew na zboczach – kępki z jasnym lewym-górnym brzegiem
      for (let i = 0; i < 1100; i++) {
        const x = Math.floor(rnd() * TILE);
        const r = 2 + Math.floor(rnd() * 3);
        const y = top[x] + Math.floor(rnd() * rnd() * 150) + r - 1;
        const depth = Math.max(0, Math.min(3, Math.floor((y - top[x]) / 45)));
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const s = dx + dy;
            const k = s < -r * 0.5 ? 0 : s > r * 0.5 ? 2 : 1;
            ctx.fillStyle = tones[Math.min(tones.length - 1, depth + k)];
            ctx.fillRect((x + dx + TILE) % TILE, y + dy, 1, 1);
          }
        }
      }
      // mgiełka nad dnem doliny
      ctx.fillStyle = PAL.hillHaze;
      ctx.globalCompositeOperation = 'source-atop'; // tylko na wzgórzach
      ctx.globalAlpha = 0.15;
      ctx.fillRect(0, H - 50, TILE, 25);
      ctx.globalAlpha = 0.28;
      ctx.fillRect(0, H - 25, TILE, 25);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    const off = Math.floor((worldX * this.factor) % TILE);
    ctx.drawImage(this.tile, -off, 0);
    if (TILE - off < W) ctx.drawImage(this.tile, TILE - off, 0);
  }
}
