import { START_KMH, PX_PER_KMH, TRACK_Y, W, H } from './config';
import { PAL } from './palette';
import { createScreen } from './engine/screen';
import { startLoop } from './engine/loop';
import { drawSky } from './scene/sky';
import { MountainLayer } from './scene/mountains';

const screen = createScreen();
const ctx = screen.buffer;

// Pozycja świata (px) – rośnie z prędkością pociągu.
let worldX = 0;

const far = new MountainLayer(7, 0.05, {
  base: PAL.mountFar, light: PAL.mountFarHi, baseY: 200, height: 110, roughness: 0.8,
});
const near = new MountainLayer(13, 0.1, {
  base: PAL.mountNear, light: PAL.mountNearHi, shade: PAL.mountNearShade, baseY: 230, height: 90, roughness: 0.6,
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') screen.toggleFullscreen();
});

startLoop(
  (dt) => {
    worldX += START_KMH * PX_PER_KMH * dt;
  },
  () => {
    drawSky(ctx, { top: PAL.skyTop, mid: PAL.skyMid, horizon: PAL.skyHorizon }, TRACK_Y);
    far.draw(ctx, worldX);
    near.draw(ctx, worldX);
    // tymczasowy grunt pod torem (E3 zastąpi segmentami)
    ctx.fillStyle = PAL.locoGraphite;
    ctx.fillRect(0, TRACK_Y + 8, W, H - TRACK_Y);
    screen.present();
  },
);
