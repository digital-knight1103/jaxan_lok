// JAXAN Express – start i sklejenie modułów: stan, wejście, pętla, rysowanie warstw.
import {
  START_KMH, PX_PER_KMH, TRACK_Y, TRAIN_X, W, H, CURSOR_HIDE_MS, HUD_HIDE_MS, AUTO_RESUME_MS,
} from './config';
import { PAL } from './palette';
import { initialState } from './state';
import { createScreen } from './engine/screen';
import { startLoop } from './engine/loop';
import { bindInput, type Action } from './engine/input';
import { IdleTracker } from './engine/idle';
import { AudioEngine } from './engine/audio';
import { drawSky } from './scene/sky';
import { MountainLayer } from './scene/mountains';
import { CloudLayer } from './scene/clouds';
import { HillLayer } from './scene/hills';
import { ForegroundLayer } from './scene/foreground';
import { drawTrack } from './scene/track';
import { drawPoles, drawWires } from './scene/catenary';
import { Sparks } from './scene/sparks';
import { World } from './scene/world';
import { Consist } from './train/consist';
import { stepSpeed, adjustTarget } from './train/physics';
import { Hud } from './ui/hud';
import { DayCycle } from './scene/daycycle';
import { Celestial } from './scene/celestial';
import { LOCO_H, PANTO_CONTACT } from './sprites/dragon2';
import type { SegmentEnv } from './scene/segments/types';

const screen = createScreen();
const ctx = screen.buffer;
const params = new URLSearchParams(location.search);

const state = initialState();
if (params.has('stop')) {
  state.running = false;
  state.kmh = 0;
}
// Pozycja świata (px) – rośnie z prędkością pociągu. ?x= pozwala skoczyć w trasę (debug).
let worldX = Number(params.get('x') ?? 0) || 0;
let time = 0;
// Cykl dobowy; ?t=0..1 ustawia porę doby i zatrzymuje automat (debug/zrzuty).
const dayCycle = new DayCycle(params.has('t') ? Number(params.get('t')) : undefined);
if (params.has('t')) dayCycle.auto = false;
const celestial = new Celestial();

// Warstwy krajobrazu rysowane do osobnego płótna – nocą przyciemniane (source-atop)
// bez ruszania nieba, które ma własne kolory nocne.
// Dwa płótna: „za pociągiem" i „pociąg + pierwszy plan" – światła segmentów (okna,
// lampy) lądują między nimi, więc pociąg je zasłania.
function layerCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}
const [backCanvas, bctx] = layerCanvas();
const [frontCanvas, fctx] = layerCanvas();

/** Przyciemnienie nocą i ciepło zmierzchu – tylko na narysowanych pikselach. */
function applyTint(c: CanvasRenderingContext2D, night: number, warmth: number, strength = 0.72): void {
  c.globalCompositeOperation = 'source-atop';
  if (night > 0) {
    c.globalAlpha = night * strength;
    c.fillStyle = PAL.nightTint;
    c.fillRect(0, 0, W, H);
  }
  if (warmth > 0) {
    c.globalAlpha = warmth * 0.2;
    c.fillStyle = PAL.warmTint;
    c.fillRect(0, 0, W, H);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

// --- warstwy sceny ---
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
const consist = new Consist(state.wagons);
const sparks = new Sparks();
const hud = new Hud();
const audio = new AudioEngine();

// --- bezczynność: kursor, HUD, powrót do automatu ---
const cursorIdle = new IdleTracker(CURSOR_HIDE_MS);
const hudIdle = new IdleTracker(HUD_HIDE_MS);
const autoIdle = new IdleTracker(AUTO_RESUME_MS);
let pointerHorn = false;

function action(a: Action): void {
  switch (a) {
    case 'horn-down':
      if (!state.horn) {
        state.horn = true;
        audio.hornStart();
      }
      break;
    case 'horn-up':
      if (state.horn) {
        state.horn = false;
        audio.hornStop();
      }
      break;
    case 'toggle-night':
      dayCycle.toggleManual();
      state.dayAuto = false;
      break;
    case 'toggle-run':
      state.running = !state.running;
      if (state.running && state.targetKmh === 0) state.targetKmh = START_KMH;
      break;
    case 'faster':
      state.targetKmh = adjustTarget(state.targetKmh, +1);
      state.running = true;
      break;
    case 'slower':
      state.targetKmh = adjustTarget(state.targetKmh, -1);
      break;
    case 'toggle-mute':
      state.muted = !state.muted;
      audio.setMuted(state.muted);
      break;
    case 'fullscreen':
      screen.toggleFullscreen();
      break;
    default:
      break; // etap 2
  }
}

bindInput(screen.canvas, {
  onAction: action,
  onActivity() {
    const now = performance.now();
    cursorIdle.touch(now);
    hudIdle.touch(now);
    autoIdle.touch(now);
    audio.unlock();
  },
  onPointerDown(cx, cy) {
    const p = screen.toGame(cx, cy);
    const hit = hud.hit(p.x, p.y);
    if (hit && 'action' in hit) {
      action(hit.action);
      if (hit.action === 'horn-down') pointerHorn = true;
      return;
    }
    if (hit && 'setTarget' in hit) {
      state.targetKmh = hit.setTarget;
      if (hit.setTarget > 0) state.running = true;
      return;
    }
    if (hud.contains(p.x, p.y)) return;
    // klik/dotyk w lokomotywę = trąbienie (także gdy HUD był ukryty)
    const r = consist.locoRect();
    if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
      action('horn-down');
      pointerHorn = true;
    }
    // każdy inny dotyk tylko pokazuje HUD (onActivity)
  },
  onPointerUp() {
    if (pointerHorn) {
      pointerHorn = false;
      action('horn-up');
    }
  },
});

startLoop(
  (dt) => {
    const now = performance.now();
    time += dt;
    document.body.classList.toggle('hide-cursor', cursorIdle.isIdle(now));
    hud.update(dt, !hudIdle.isIdle(now));
    // po kilku minutach bez dotykania scena wraca do jazdy automatycznej
    if (autoIdle.isIdle(now)) {
      state.running = true;
      state.targetKmh = START_KMH;
      state.dayAuto = true;
      dayCycle.resumeAuto();
    }
    dayCycle.update(dt);

    const prev = state.kmh;
    state.kmh = stepSpeed(state.kmh, state.running ? state.targetKmh : 0, dt);
    const braking = state.kmh < prev - 1e-9;
    worldX += state.kmh * PX_PER_KMH * dt;
    consist.update(dt, state.kmh);
    clouds.update(dt);
    if (braking && state.kmh > 3) sparks.brake(consist.wheelXs(), TRACK_Y - 1, 3 + state.kmh / 20, dt);
    // nocą pantograf iskrzy na przewodzie – częściej przy dużej prędkości
    if (dayCycle.night > 0.3 && state.kmh > 10 && Math.random() < (0.3 + state.kmh / 60) * dt) {
      sparks.pantograph(TRAIN_X + PANTO_CONTACT.x, TRACK_Y - LOCO_H + PANTO_CONTACT.y);
    }
    sparks.update(dt);
    audio.update(state.kmh, braking, dt);
  },
  () => {
    const camX = Math.floor(worldX);
    const night = dayCycle.night;
    const env: SegmentEnv = { night, time };
    world.prepare(camX);

    // 1. niebo, gwiazdy, słońce/księżyc
    drawSky(ctx, dayCycle.skyColors(), H);
    celestial.draw(ctx, dayCycle, time);

    // 2. krajobraz za pociągiem (przyciemniany nocą) + światła okien i lamp
    bctx.clearRect(0, 0, W, H);
    far.draw(bctx, worldX);
    clouds.draw(bctx, worldX);
    near.draw(bctx, worldX);
    hills.draw(bctx, worldX);
    world.drawBack(bctx, env);
    drawPoles(bctx, camX);
    world.drawBed(bctx);
    drawTrack(bctx, camX);
    applyTint(bctx, night, dayCycle.warmth);
    ctx.drawImage(backCanvas, 0, 0);
    world.drawLights(ctx, env);

    // 3. pociąg, przewody i pierwszy plan (też przyciemniane)
    fctx.clearRect(0, 0, W, H);
    consist.draw(fctx);
    drawWires(fctx, camX);
    world.drawFront(fctx);
    fore.draw(fctx, worldX);
    applyTint(fctx, night, dayCycle.warmth, 0.5); // pociąg – bohater sceny – czytelny także nocą
    ctx.drawImage(frontCanvas, 0, 0);

    // 4. światła pociągu i iskry (nie przyciemniane)
    consist.drawLights(ctx, night);
    sparks.draw(ctx);

    // 5. HUD
    hud.draw(ctx, {
      kmh: state.kmh, targetKmh: state.targetKmh, running: state.running,
      night: night > 0.5, muted: state.muted, horn: state.horn,
    });
    screen.present();
  },
);

// --- uchwyt debugowy (tylko dev): zrzuty ekranu konkretnych miejsc trasy ---
if (import.meta.env.DEV) {
  void Promise.all([import('./scene/route'), import('./scene/segments/registry'), import('./config')]).then(
    ([{ Route }, { REGISTRY, LANDMARK_ORDER }, { ROUTE_SEED }]) => {
      (window as unknown as Record<string, unknown>).__jx = {
        state,
        /** x świata początku n-tego segmentu o danym id. */
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
