import { START_KMH, PX_PER_KMH, TRACK_Y } from './config';
import { PAL } from './palette';
import { createScreen } from './engine/screen';
import { startLoop } from './engine/loop';
import { drawSky } from './scene/sky';
import { MountainLayer } from './scene/mountains';
import { CloudLayer } from './scene/clouds';
import { HillLayer } from './scene/hills';
import { ForegroundLayer } from './scene/foreground';
import { drawTrack } from './scene/track';
import { drawPoles, drawWires } from './scene/catenary';
import { World } from './scene/world';
import { Consist } from './train/consist';
import { stepSpeed, adjustTarget } from './train/physics';
import type { SegmentEnv } from './scene/segments/types';

const screen = createScreen();
const ctx = screen.buffer;
const params = new URLSearchParams(location.search);

// Pozycja świata (px) – rośnie z prędkością pociągu. ?x= pozwala skoczyć w trasę (debug).
let worldX = Number(params.get('x') ?? 0) || 0;
let kmh = START_KMH;
let targetKmh = START_KMH;
let running = !params.has("stop");
if (!running) kmh = 0;
let time = 0;

const far = new MountainLayer(7, 0.05, {
  base: PAL.mountFar, light: PAL.mountFarHi, baseY: 200, height: 110, roughness: 0.8,
});
const near = new MountainLayer(13, 0.1, {
  base: PAL.mountNear, light: PAL.mountNearHi, shade: PAL.mountNearShade, baseY: 230, height: 90, roughness: 0.6,
});
const clouds = new CloudLayer(21);
const hills = new HillLayer(31);
const fore = new ForegroundLayer(41);
const world = new World();
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
    time += dt;
    kmh = stepSpeed(kmh, running ? targetKmh : 0, dt);
    worldX += kmh * PX_PER_KMH * dt;
    consist.update(dt, kmh);
    clouds.update(dt);
  },
  () => {
    const camX = Math.floor(worldX);
    const env: SegmentEnv = { night: 0, time };
    world.prepare(camX);

    // od tyłu do przodu
    drawSky(ctx, { top: PAL.skyTop, mid: PAL.skyMid, horizon: PAL.skyHorizon }, TRACK_Y);
    far.draw(ctx, worldX);
    clouds.draw(ctx, worldX);
    near.draw(ctx, worldX);
    hills.draw(ctx, worldX);
    world.drawBack(ctx, env);
    drawPoles(ctx, camX);
    world.drawBed(ctx);
    drawTrack(ctx, camX);
    consist.draw(ctx);
    drawWires(ctx, camX);
    world.drawFront(ctx);
    fore.draw(ctx, worldX);
    world.drawLights(ctx, env);
    screen.present();
  },
);

// --- uchwyt debugowy (tylko dev): zrzuty ekranu konkretnych miejsc trasy ---
if (import.meta.env.DEV) {
  void Promise.all([import('./scene/route'), import('./scene/segments/registry'), import('./config')]).then(
    ([{ Route }, { REGISTRY, LANDMARK_ORDER }, { ROUTE_SEED }]) => {
      (window as unknown as Record<string, unknown>).__jx = {
        /** x świata początku pierwszego segmentu o danym id. */
        find(id: string, nth = 0): number {
          const r = new Route(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
          const seen: number[] = [];
          for (let x = 0; x < 5e5; x += 400) {
            for (const p of r.visible(x, x + 640)) {
              if (p.def.id !== id || seen.includes(p.startX)) continue;
              if (seen.push(p.startX) > nth) return p.startX;
            }
          }
          return -1;
        },
      };
    },
  );
}
