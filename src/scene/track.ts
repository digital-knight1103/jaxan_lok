// Tor: szyny + podkłady na tłucznia; przewija się z prędkością świata (factor 1).
import { W, TRACK_Y } from '../config';
import { PAL } from '../palette';

const SLEEPER_STEP = 6;

export function drawTrack(ctx: CanvasRenderingContext2D, worldX: number): void {
  // tłuczeń
  ctx.fillStyle = PAL.ballast;
  ctx.fillRect(0, TRACK_Y + 2, W, 4);
  ctx.fillStyle = PAL.ballastShade;
  ctx.fillRect(0, TRACK_Y + 5, W, 1);
  // podkłady
  const off = Math.floor(worldX % SLEEPER_STEP);
  ctx.fillStyle = PAL.sleeper;
  for (let x = -off; x < W; x += SLEEPER_STEP) ctx.fillRect(x, TRACK_Y + 2, 4, 2);
  // szyna (główka jasna, stopka ciemna)
  ctx.fillStyle = PAL.railHead;
  ctx.fillRect(0, TRACK_Y, W, 1);
  ctx.fillStyle = PAL.railFoot;
  ctx.fillRect(0, TRACK_Y + 1, W, 1);
}
