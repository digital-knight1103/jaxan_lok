// Cząsteczki pór roku na wierzchu sceny: spadające liście (jesień) i płatki kwiatów (wiosna).
// Jak śnieg: kilka głębi z paralaksą, lekki dryf na boki i obrót (migotanie kształtu).
import { W, H } from '../config';
import { PAL } from '../palette';

const N = 90;

export class LeafFx {
  private bx = new Float32Array(N);
  private y = new Float32Array(N);
  private phase = new Float32Array(N);
  private depth = new Float32Array(N);
  private tone = new Uint8Array(N);

  constructor(private colors: readonly string[], private fall = 1) {
    for (let i = 0; i < N; i++) {
      this.bx[i] = Math.random() * W;
      this.y[i] = Math.random() * H;
      this.phase[i] = Math.random() * 6.28;
      this.depth[i] = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.65 : 0.35;
      this.tone[i] = i % colors.length;
    }
  }

  update(dt: number, level: number): void {
    const act = Math.floor(N * level);
    for (let i = 0; i < act; i++) {
      this.y[i] += (7 + 16 * this.depth[i]) * this.fall * dt;
      if (this.y[i] > H + 2) this.y[i] -= H + 4;
    }
  }

  draw(ctx: CanvasRenderingContext2D, level: number, worldX: number, time: number, night: number): void {
    const act = Math.floor(N * level);
    if (act <= 0) return;
    for (let i = 0; i < act; i++) {
      const d = this.depth[i];
      let x = this.bx[i] - worldX * (0.15 + 0.85 * d) + Math.sin(time * 1.3 + this.phase[i]) * 14 * d;
      x = ((x % W) + W) % W;
      ctx.globalAlpha = (0.55 + 0.4 * d) * (1 - night * 0.35);
      ctx.fillStyle = this.colors[this.tone[i]];
      const flip = Math.sin(time * 3 + this.phase[i] * 2) > 0; // liść obraca się w locie
      const px = Math.round(x);
      const py = Math.round(this.y[i]);
      if (d >= 1) ctx.fillRect(px, py, flip ? 3 : 2, flip ? 1 : 2);
      else ctx.fillRect(px, py, flip ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

/** Jesienne liście w kolorach złota, rudzi i czerwieni. */
export const autumnLeaves = (): LeafFx =>
  new LeafFx([PAL.autumnGoldHi, PAL.autumnOrangeHi, PAL.autumnRedHi, PAL.autumnGoldMid, PAL.autumnOrangeMid]);
/** Wiosenne płatki z kwitnących drzew – rzadsze i lżejsze. */
export const springPetals = (): LeafFx => new LeafFx([PAL.blossomWhite, PAL.blossomPink, PAL.blossomWhite], 0.7);
