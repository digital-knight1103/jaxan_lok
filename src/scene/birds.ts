// Ptaki: siedzą na linie nośnej sieci trakcyjnej (przesuwają się ze światem),
// a na dźwięk syreny zrywają się i odlatują. Stała liczba ptaków – po odlocie
// albo zjechaniu z ekranu „siadają" ponownie daleko przed pociągiem.
import { W } from '../config';
import { PAL } from '../palette';
import { mulberry32 } from '../engine/rng';
import { messengerYAt } from './catenary';

interface Bird {
  perched: boolean;
  wx: number; // x świata (siedzący)
  x: number; // x ekranu (lecący)
  y: number;
  vx: number;
  vy: number;
  flap: number;
}

const COUNT = 12;

export class Birds {
  private birds: Bird[] = [];
  private rnd = mulberry32(555);

  constructor(camX: number) {
    for (let i = 0; i < COUNT; i++) {
      this.birds.push({ perched: true, wx: 0, x: 0, y: 0, vx: 0, vy: 0, flap: 0 });
      this.perch(this.birds[i], camX + 120 + this.rnd() * (W + 600));
    }
  }

  private perch(b: Bird, wx: number): void {
    b.perched = true;
    // małe stadka: kilka ptaków obok siebie
    b.wx = Math.floor(wx);
    b.flap = this.rnd() * 6;
  }

  /** Syrena – wszystkie siedzące ptaki na ekranie zrywają się. */
  scare(camX: number): void {
    for (const b of this.birds) {
      const sx = b.wx - camX;
      if (!b.perched || sx < -4 || sx > W + 4) continue;
      b.perched = false;
      b.x = sx;
      b.y = messengerYAt(b.wx) - 2;
      b.vx = 25 + this.rnd() * 45;
      b.vy = -35 - this.rnd() * 30;
    }
  }

  update(dt: number, camX: number, time: number): void {
    for (const b of this.birds) {
      if (b.perched) {
        // zjechał z lewej – siada daleko przed pociągiem
        if (b.wx - camX < -10) this.perch(b, camX + W + 40 + this.rnd() * 900);
        continue;
      }
      b.flap += dt * 14;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += Math.sin(time * 3 + b.flap) * 8 * dt; // falisty lot
      if (b.y < -10 || b.x > W + 10) this.perch(b, camX + W + 60 + this.rnd() * 900);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, sway: number): void {
    ctx.fillStyle = PAL.bird;
    for (const b of this.birds) {
      if (b.perched) {
        const x = b.wx - camX;
        if (x < -3 || x > W + 3) continue;
        const y = messengerYAt(b.wx, sway);
        ctx.fillRect(x, y - 2, 2, 2); // tułów
        ctx.fillRect(x + (Math.floor(b.flap) % 2 ? 2 : -1), y - 3, 1, 1); // głowa
      } else {
        const x = Math.round(b.x);
        const y = Math.round(b.y);
        if (Math.floor(b.flap) % 2) {
          ctx.fillRect(x - 2, y - 1, 1, 1); // skrzydła w górze: „V"
          ctx.fillRect(x + 2, y - 1, 1, 1);
          ctx.fillRect(x - 1, y, 3, 1);
        } else {
          ctx.fillRect(x - 2, y, 5, 1); // skrzydła płasko
        }
      }
    }
  }
}
