// Sieć trakcyjna: słupy co POLE_STEP px (prędkość toru), lina nośna ze zwisem,
// wieszaki i prosty przewód jezdny, po którym ślizga się pantograf.
import { W, TRACK_Y } from '../config';
import { PAL } from '../palette';
import { LOCO_H, PANTO_CONTACT } from '../sprites/dragon2';

export const POLE_STEP = 120;
/** Przewód jezdny tuż nad ślizgiem pantografu. */
export const CONTACT_WIRE_Y = TRACK_Y - LOCO_H + PANTO_CONTACT.y - 1;
const POLE_TOP = CONTACT_WIRE_Y - 16;
const MESSENGER_Y = CONTACT_WIRE_Y - 11;
const SAG = 5;

/** y liny nośnej w punkcie świata wx (słupy stoją co POLE_STEP od 0). */
export function messengerYAt(wx: number, sway = 0): number {
  const u = (((wx % POLE_STEP) + POLE_STEP) % POLE_STEP) / POLE_STEP;
  return MESSENGER_Y + Math.round((SAG + sway) * 4 * u * (1 - u));
}

/** Ekranowe x słupów dla danego worldX. */
function poleXs(worldX: number): number[] {
  const first = Math.floor(worldX / POLE_STEP) * POLE_STEP - Math.floor(worldX);
  const out: number[] = [];
  for (let x = first; x < W + POLE_STEP; x += POLE_STEP) out.push(x);
  return out;
}

/** Słupy – za pociągiem. */
export function drawPoles(ctx: CanvasRenderingContext2D, worldX: number): void {
  for (const x of poleXs(worldX)) {
    ctx.fillStyle = PAL.pole;
    ctx.fillRect(x, POLE_TOP, 2, TRACK_Y + 3 - POLE_TOP);
    ctx.fillStyle = PAL.poleHi;
    ctx.fillRect(x, POLE_TOP, 1, TRACK_Y + 3 - POLE_TOP);
    // wysięgnik i odciąg
    ctx.fillStyle = PAL.pole;
    ctx.fillRect(x - 4, MESSENGER_Y - 1, 10, 1);
    ctx.fillRect(x - 3, CONTACT_WIRE_Y - 2, 8, 1);
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 2 + i, MESSENGER_Y + i, 1, 1);
    ctx.fillRect(x - 1, TRACK_Y + 1, 4, 3); // fundament
  }
}

/** Przewody – nad pociągiem (rysowane po nim). sway: kołysanie liny nośnej w px. */
export function drawWires(ctx: CanvasRenderingContext2D, worldX: number, sway = 0): void {
  ctx.fillStyle = PAL.wire;
  ctx.fillRect(0, CONTACT_WIRE_Y, W, 1);
  for (const x0 of poleXs(worldX)) {
    const start = x0 - POLE_STEP;
    for (let i = 0; i < POLE_STEP; i++) {
      const sx = start + i;
      if (sx < 0 || sx >= W) continue;
      const u = i / POLE_STEP;
      const y = MESSENGER_Y + Math.round((SAG + sway) * 4 * u * (1 - u));
      ctx.fillRect(sx, y, 1, 1);
      if (i % 20 === 10) ctx.fillRect(sx, y, 1, CONTACT_WIRE_Y - y); // wieszak
    }
  }
}
