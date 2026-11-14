// Niebo nocą i za dnia: gwiazdy (migoczące), słońce i księżyc na łuku nad horyzontem.
import { W } from '../config';
import { PAL } from '../palette';
import { mulberry32 } from '../engine/rng';
import { lerpColor } from '../engine/color';
import { disc } from '../engine/sprite';
import { DayCycle } from './daycycle';

interface Star { x: number; y: number; big: boolean; phase: number }

export class Celestial {
  private stars: Star[] = [];

  constructor(seed = 77) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < 110; i++) {
      this.stars.push({ x: Math.floor(rnd() * W), y: Math.floor(rnd() * rnd() * 190), big: rnd() < 0.1, phase: rnd() * 6.28 });
    }
  }

  draw(ctx: CanvasRenderingContext2D, day: DayCycle, time: number): void {
    const night = day.night;
    // gwiazdy
    if (night > 0.05) {
      ctx.fillStyle = PAL.star;
      for (const s of this.stars) {
        ctx.globalAlpha = night * (0.55 + 0.45 * Math.sin(time * 1.7 + s.phase));
        ctx.fillRect(s.x, s.y, 1, 1);
        if (s.big) {
          ctx.fillRect(s.x - 1, s.y, 3, 1);
          ctx.fillRect(s.x, s.y - 1, 1, 3);
        }
      }
      ctx.globalAlpha = 1;
    }
    // słońce (cieplejsze przy horyzoncie)
    const sun = DayCycle.bodyPos(day.t);
    if (sun.up > -0.15) {
      const c = lerpColor(PAL.sun, PAL.warmTint, day.warmth * 0.6);
      ctx.globalAlpha = 0.3;
      disc(ctx, sun.x, sun.y, 14, PAL.sunGlow);
      ctx.globalAlpha = 1;
      disc(ctx, sun.x, sun.y, 9, c);
    }
    // księżyc
    const moon = DayCycle.bodyPos(day.t + 0.5);
    if (moon.up > -0.15) {
      ctx.globalAlpha = Math.max(0.25, night);
      disc(ctx, moon.x, moon.y, 7, PAL.moon);
      ctx.fillStyle = PAL.moonShade;
      ctx.fillRect(moon.x - 3, moon.y - 2, 2, 2);
      ctx.fillRect(moon.x + 1, moon.y + 2, 2, 1);
      ctx.fillRect(moon.x + 2, moon.y - 3, 1, 1);
      ctx.globalAlpha = 1;
    }
  }
}
