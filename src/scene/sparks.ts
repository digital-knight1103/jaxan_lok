// Iskry: spod kół przy hamowaniu i z pantografu (w nocy). Pula o stałej pojemności.
import { PAL } from '../palette';
import { Pool } from '../engine/pool';

interface Spark { x: number; y: number; vx: number; vy: number; life: number; hot: boolean }

export class Sparks {
  private pool = new Pool<Spark>(160, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, hot: true }));

  get alive(): number {
    return this.pool.alive;
  }

  private emit(x: number, y: number, vx: number, vy: number, life: number): void {
    const s = this.pool.spawn();
    if (!s) return;
    s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.life = life; s.hot = Math.random() < 0.5;
  }

  /** Iskry spod kół (iskry lecą do tyłu – świat jedzie w lewo). */
  brake(wheelXs: number[], y: number, rate: number, dt: number): void {
    for (const x of wheelXs) {
      if (Math.random() < rate * dt) {
        this.emit(x, y, -20 - Math.random() * 50, -10 - Math.random() * 25, 0.25 + Math.random() * 0.3);
      }
    }
  }

  /** Iskra z pantografu – krótki błysk przy przewodzie. */
  pantograph(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      this.emit(x + (Math.random() - 0.5) * 6, y, (Math.random() - 0.7) * 40, (Math.random() - 0.3) * 30, 0.15 + Math.random() * 0.2);
    }
  }

  update(dt: number): void {
    this.pool.update((s) => {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 120 * dt; // grawitacja
      return s.life <= 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.pool.forEach((s) => {
      ctx.fillStyle = s.hot ? PAL.sparkHot : PAL.spark;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    });
  }
}
