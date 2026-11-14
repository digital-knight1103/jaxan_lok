import { START_KMH, PX_PER_KMH, TRACK_Y, W, H } from './config';
import { PAL } from './palette';
import { createScreen } from './engine/screen';
import { startLoop } from './engine/loop';
import { drawSky } from './scene/sky';
import { MountainLayer } from './scene/mountains';
import { drawTrack } from './scene/track';
import { Consist } from './train/consist';
import { stepSpeed, adjustTarget } from './train/physics';

const screen = createScreen();
const ctx = screen.buffer;

// Pozycja świata (px) – rośnie z prędkością pociągu.
let worldX = 0;
let kmh = START_KMH;
let targetKmh = START_KMH;
let running = true;

const far = new MountainLayer(7, 0.05, {
  base: PAL.mountFar, light: PAL.mountFarHi, baseY: 200, height: 110, roughness: 0.8,
});
const near = new MountainLayer(13, 0.1, {
  base: PAL.mountNear, light: PAL.mountNearHi, shade: PAL.mountNearShade, baseY: 230, height: 90, roughness: 0.6,
});
const consist = new Consist();

// Tymczasowe sterowanie (pełne w E4).
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyF') screen.toggleFullscreen();
  if (e.code === 'Space') running = !running;
  if (e.code === 'ArrowRight') targetKmh = adjustTarget(targetKmh, +1);
  if (e.code === 'ArrowLeft') targetKmh = adjustTarget(targetKmh, -1);
});

startLoop(
  (dt) => {
    kmh = stepSpeed(kmh, running ? targetKmh : 0, dt);
    worldX += kmh * PX_PER_KMH * dt;
    consist.update(dt, kmh);
  },
  () => {
    drawSky(ctx, { top: PAL.skyTop, mid: PAL.skyMid, horizon: PAL.skyHorizon }, TRACK_Y);
    far.draw(ctx, worldX);
    near.draw(ctx, worldX);
    // tymczasowy nasyp (E3 zastąpi segmentami)
    ctx.fillStyle = PAL.locoGraphite;
    ctx.fillRect(0, TRACK_Y + 6, W, H - TRACK_Y);
    drawTrack(ctx, worldX);
    consist.draw(ctx);
    screen.present();
  },
);
