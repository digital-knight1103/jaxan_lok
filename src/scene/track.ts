// Tor w lekkiej perspektywie: widoczna górna powierzchnia tłucznia z podkładami
// (trapezy – bliższa krawędź szersza), bok nasypu z kamieniami, szyna z błyskiem.
// Przewija się z prędkością świata (factor 1); wzór kamieni przypięty do świata.
import { W, TRACK_Y } from '../config';
import { PAL } from '../palette';

const SLEEPER_STEP = 6;

/** Prosty hash całkowity → [0, 1). */
function hash(n: number): number {
  let h = (n | 0) * 374761393;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawTrack(ctx: CanvasRenderingContext2D, worldX: number): void {
  const wx = Math.floor(worldX);
  // górna powierzchnia tłucznia (jaśniejsza – widać ją z góry) i bok (ciemniejszy)
  ctx.fillStyle = PAL.ballastHi;
  ctx.fillRect(0, TRACK_Y + 2, W, 2);
  ctx.fillStyle = PAL.ballast;
  ctx.fillRect(0, TRACK_Y + 4, W, 2);
  ctx.fillStyle = PAL.ballastShade;
  ctx.fillRect(0, TRACK_Y + 6, W, 1);
  // kamienie tłucznia
  for (let x = 0; x < W; x++) {
    const r = hash(wx + x);
    if (r < 0.35) {
      ctx.fillStyle = r < 0.12 ? PAL.ballastShade : PAL.ballastHi;
      ctx.fillRect(x, TRACK_Y + 4 + (r < 0.2 ? 1 : 0), 1, 1);
    }
  }
  // podkłady: trapez (2 wiersze), jasna górna krawędź
  const off = wx % SLEEPER_STEP;
  for (let x = -off; x < W; x += SLEEPER_STEP) {
    ctx.fillStyle = PAL.sleeperHi;
    ctx.fillRect(x + 1, TRACK_Y + 2, 3, 1);
    ctx.fillStyle = PAL.sleeper;
    ctx.fillRect(x, TRACK_Y + 3, 5, 1);
    ctx.fillStyle = PAL.ballastShade;
    ctx.fillRect(x + 5, TRACK_Y + 3, 1, 1); // cień podkładu
  }
  // szyna: główka z błyskiem, stopka w cieniu
  ctx.fillStyle = PAL.railHead;
  ctx.fillRect(0, TRACK_Y, W, 1);
  ctx.fillStyle = PAL.railGlint;
  for (let x = -((wx >> 1) % 40); x < W; x += 40) ctx.fillRect(x, TRACK_Y, 6, 1);
  ctx.fillStyle = PAL.railFoot;
  ctx.fillRect(0, TRACK_Y + 1, W, 1);
}
