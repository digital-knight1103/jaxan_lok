// JAXAN Express – start i sklejenie modułów: stan, wejście, pętla, rysowanie warstw.
import {
  START_KMH, PX_PER_KMH, TRACK_Y, TRAIN_X, W, H, ROUTE_SEED, CURSOR_HIDE_MS, HUD_HIDE_MS, AUTO_RESUME_MS,
} from './config';
import { PAL } from './palette';
import { initialState } from './state';
import { createScreen } from './engine/screen';
import { startLoop } from './engine/loop';
import { bindInput, type Action } from './engine/input';
import { IdleTracker } from './engine/idle';
import { AudioEngine } from './engine/audio';
import { drawSky } from './scene/sky';
import { ForestRidgeLayer } from './scene/ridges';
import { CloudLayer } from './scene/clouds';
import { ForegroundLayer } from './scene/foreground';
import { drawTrack } from './scene/track';
import { drawPoles, drawWires } from './scene/catenary';
import { Sparks } from './scene/sparks';
import { Birds } from './scene/birds';
import { World } from './scene/world';
import { Consist } from './train/consist';
import { stepSpeed, adjustTarget, emergencyStep } from './train/physics';
import { SignalSystem } from './train/signals';
import { drawSignalPosts, drawSignalLights, signalColor } from './scene/signals';
import { drawText, textWidth } from './engine/font';
import { Hud } from './ui/hud';
import { RouteMap } from './ui/routemap';
import { RouteIndex, ANCHOR_SCREEN_X, KM_PX, stopWorldX, type Poi } from './scene/routeindex';
import { TravelAnim, type TravelFrame } from './scene/travel';
import { REGISTRY, LANDMARK_ORDER } from './scene/segments/registry';
import { DayCycle } from './scene/daycycle';
import { Celestial } from './scene/celestial';
import { LOCO_H, LOCO_W, PANTO_CONTACT } from './sprites/dragon2';
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
// 6 planów tła (styl2): niebo, trzy pasma zalesionych wzgórz (dalej = bledsze,
// bardziej niebieskie), chmury między nimi i średni plan z polami na stokach
const RIDGE = { roughness: 0.4, conifers: 0, meadows: 0, mist: 0.5 };
const farthest = new ForestRidgeLayer(3, 0.02, {
  ...RIDGE, baseY: 196, height: 62, smooth: 10, haze: 0.6, crown: [1, 2], tile: W,
});
const far = new ForestRidgeLayer(7, 0.045, {
  ...RIDGE, baseY: 214, height: 78, smooth: 12, haze: 0.28, crown: [3, 4], meadows: 0.25, tile: W,
});
const clouds = new CloudLayer(21);
const near = new ForestRidgeLayer(13, 0.1, {
  ...RIDGE, baseY: 236, height: 74, smooth: 14, haze: 0.14, crown: [4, 5], conifers: 0.12, meadows: 0.4, tile: W * 2,
});
const hills = new ForestRidgeLayer(31, 0.4, {
  ...RIDGE, roughness: 0.3, baseY: 262, height: 72, smooth: 16, haze: 0.08, crown: [4, 6], conifers: 0.18,
  meadows: 0.55, mist: 0.7, tile: W * 2,
});
const fore = new ForegroundLayer(41);
const world = new World();
const consist = new Consist(state.wagons);
const sparks = new Sparks();
const hud = new Hud();
const audio = new AudioEngine();
const birds = new Birds(Math.floor(worldX));
// mapa trasy: osobny, deterministyczny indeks punktów (ten sam seed co trasa)
const routeIndex = new RouteIndex(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
const routeMap = new RouteMap(routeIndex);
const travel = new TravelAnim();
let travelFx: TravelFrame | null = null;
let travelTarget = 0;
// semafory przed stacjami
const signals = new SignalSystem();
/** Hamowanie nagłe po przejechaniu sygnału STÓJ (RADIOSTOP) – trwa do zatrzymania. */
let emergency = false;
/** Czas wyświetlania komunikatu o przejechaniu sygnału (s). */
let alertT = 0;

/** x świata czoła lokomotywy (do semaforów). */
function trainFront(): number {
  return worldX + TRAIN_X + LOCO_W;
}

/** Przejechanie sygnału STÓJ: alarm RADIOSTOP, hamowanie nagłe, komunikat. */
function radiostop(): void {
  emergency = true;
  state.running = false;
  state.targetKmh = 0;
  alertT = 6;
  audio.radiostop();
}

/** Pozycja „odniesienia" pociągu na trasie (ta sama, co kotwice punktów). */
function trainRef(): number {
  return worldX + ANCHOR_SCREEN_X;
}

/** Szybki przejazd do punktu – pociąg zatrzyma się przy nim. */
function jumpTo(p: Poi | null): void {
  if (!p) return;
  travelTarget = stopWorldX(p);
  travel.start(worldX, travelTarget);
}

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
        birds.scare(Math.floor(worldX)); // także przy wyciszonym dźwięku
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
      state.autoDrive = false;
      state.running = !state.running;
      if (state.running && state.targetKmh === 0) state.targetKmh = START_KMH;
      break;
    case 'faster':
      state.autoDrive = false;
      state.targetKmh = adjustTarget(state.targetKmh, +1);
      state.running = true;
      break;
    case 'slower':
      state.autoDrive = false;
      state.targetKmh = adjustTarget(state.targetKmh, -1);
      break;
    case 'toggle-mute':
      state.muted = !state.muted;
      audio.setMuted(state.muted);
      break;
    case 'fullscreen':
      screen.toggleFullscreen();
      break;
    case 'toggle-auto':
      // ręczna → AUTO: pociąg rusza z prędkością marszową i sam respektuje semafory
      state.autoDrive = !state.autoDrive;
      if (state.autoDrive) {
        state.running = true;
        if (state.targetKmh === 0) state.targetKmh = START_KMH;
      }
      break;
    case 'poi-next':
    case 'poi-prev': {
      // w trakcie przejazdu liczymy od celu – można „przeskakiwać" kilka punktów
      const ref = travel.active ? travelTarget + ANCHOR_SCREEN_X : trainRef();
      jumpTo(a === 'poi-next' ? routeIndex.next(ref) : routeIndex.prev(ref));
      break;
    }
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
    if (hud.alpha >= 0.5 && routeMap.pointerDown(p.x, p.y)) return;
    const hit = hud.hit(p.x, p.y);
    if (hit && 'action' in hit) {
      action(hit.action);
      if (hit.action === 'horn-down') pointerHorn = true;
      return;
    }
    if (hit && 'setTarget' in hit) {
      state.targetKmh = hit.setTarget;
      state.autoDrive = false;
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
  onPointerMove(cx, cy) {
    const p = screen.toGame(cx, cy);
    routeMap.pointerMove(p.x, p.y, trainRef());
  },
  onPointerUp(cx) {
    if (pointerHorn) {
      pointerHorn = false;
      action('horn-up');
    }
    // krótkie kliknięcie w punkt na mapie = szybki przejazd do niego
    jumpTo(routeMap.pointerUp(screen.toGame(cx, 0).x, trainRef()));
  },
});

let braking = false;

/** Jeden krok symulacji (bez wejścia i rysowania) – używany też przez test ?soak. */
function simulate(dt: number): void {
  time += dt;
  dayCycle.update(dt);
  const prev = state.kmh;
  const prevFront = trainFront();
  if (travel.active) {
    // szybki przejazd steruje pozycją i prędkością; na końcu pociąg stoi
    travelFx = travel.update(dt, worldX);
    worldX = travelFx.worldX;
    state.kmh = travelFx.kmh;
    braking = travelFx.phase === 'in';
    if (travelFx.done) {
      state.running = false;
      travelFx = null;
    }
  } else if (emergency) {
    state.kmh = emergencyStep(state.kmh, dt);
    braking = state.kmh > 0;
    worldX += state.kmh * PX_PER_KMH * dt;
    if (state.kmh === 0) emergency = false;
  } else {
    // jazda automatyczna sama respektuje semafory (zwalnia, staje przed czerwonym, rusza)
    const cap = state.autoDrive ? signals.cap(prevFront) : Infinity;
    state.kmh = stepSpeed(state.kmh, state.running ? Math.min(state.targetKmh, cap) : 0, dt);
    braking = state.kmh < prev - 1e-9;
    worldX += state.kmh * PX_PER_KMH * dt;
  }
  // semafory: stacje w pobliżu, zmiany świateł, wykrycie przejechania „stój"
  const front = trainFront();
  signals.sync(
    routeIndex.between(Math.max(0, front - 2 * KM_PX), front + 2 * KM_PX).filter((p) => p.signals)
      .map((p) => ({ index: p.index, startX: p.startX, width: p.width })),
    front,
  );
  signals.update(front, state.kmh, dt);
  // szybki przejazd z mapy omija semafory bez kar
  if (travel.active || Math.abs(front - prevFront) > 400) signals.skip(front);
  else if (signals.checkSpad(prevFront, front)) radiostop();
  alertT = Math.max(0, alertT - dt);
  routeMap.update(dt);
  consist.update(dt, state.kmh);
  // „pływająca" kamera: pociąg lekko wysuwa się przy przyspieszaniu, cofa przy hamowaniu
  const accel = dt > 0 ? (state.kmh - prev) / dt : 0;
  const target = Math.max(-6, Math.min(6, accel * 1.5));
  consist.shift += (target - consist.shift) * Math.min(1, dt * 1.2);
  clouds.update(dt);
  birds.update(dt, Math.floor(worldX), time);
  if (braking && state.kmh > 3) sparks.brake(consist.wheelXs(), TRACK_Y - 1, 3 + state.kmh / 20, dt);
  // nocą pantograf iskrzy na przewodzie – częściej przy dużej prędkości
  if (dayCycle.night > 0.3 && state.kmh > 10 && Math.random() < (0.3 + state.kmh / 60) * dt) {
    sparks.pantograph(consist.locoX + PANTO_CONTACT.x, TRACK_Y - LOCO_H + PANTO_CONTACT.y);
  }
  sparks.update(dt);
}

/**
 * Test wytrzymałości (?soak[=godziny]): symulacja wielu godzin bez rysowania,
 * z hamowaniem i trąbieniem co jakiś czas. Wynik: liczniki pamięci w konsoli
 * i w window.__soak – muszą być stałe niezależnie od czasu.
 */
function soak(hours: number): void {
  const dt = 0.1;
  const steps = Math.round((hours * 3600) / dt);
  const samples: { h: number; segments: number; canvases: number; sparks: number }[] = [];
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) {
    const s = i * dt;
    if (s % 90 < dt) state.running = !state.running; // co 1,5 min start/stop
    if (s % 300 < dt) birds.scare(Math.floor(worldX));
    simulate(dt);
    world.prepare(Math.floor(worldX));
    if (i % Math.round(3600 / dt) === 0 || i === steps - 1) {
      samples.push({
        h: +(s / 3600).toFixed(2),
        segments: world.route.cachedCount,
        canvases: world.cachedCanvases,
        sparks: sparks.alive,
      });
    }
  }
  // px → km: worldX = Σ(km/h · s) · PX_PER_KMH
  const result = { hours, km: Math.round(worldX / PX_PER_KMH / 3600), ms: Math.round(performance.now() - t0), samples };
  console.log('[soak]', JSON.stringify(result));
  (window as unknown as Record<string, unknown>).__soak = result;
}
if (params.has('soak')) soak(Number(params.get('soak')) || 8);

startLoop(
  (dt) => {
    const now = performance.now();
    document.body.classList.toggle('hide-cursor', cursorIdle.isIdle(now));
    hud.update(dt, !hudIdle.isIdle(now) || routeMap.dragging);
    // po kilku minutach bez dotykania scena wraca do jazdy automatycznej
    if (autoIdle.isIdle(now)) {
      state.running = true;
      state.targetKmh = START_KMH;
      state.dayAuto = true;
      state.autoDrive = true;
      dayCycle.resumeAuto();
    }
    simulate(dt);
    audio.update(state.kmh, braking, dt);
  },
  () => {
    const camX = Math.floor(worldX);
    const night = dayCycle.night;
    const env: SegmentEnv = { night, time, sunL: 1, sunR: 0 }; // kierunek światła – etap C
    const sway = Math.sin(time * 0.9) * 1.2; // kołysanie liny nośnej
    world.prepare(camX);

    // 1. niebo, gwiazdy, słońce/księżyc
    {
      const sun = DayCycle.bodyPos(dayCycle.t);
      drawSky(ctx, dayCycle.skyColors(), H, sun.x, sun.y, (1 - night) * (0.85 + 0.15 * dayCycle.warmth));
    }
    celestial.draw(ctx, dayCycle, time);

    // 2. krajobraz za pociągiem (przyciemniany nocą) + światła okien i lamp
    bctx.clearRect(0, 0, W, H);
    farthest.draw(bctx, worldX);
    far.draw(bctx, worldX);
    clouds.draw(bctx, worldX);
    near.draw(bctx, worldX);
    hills.draw(bctx, worldX);
    world.drawBack(bctx, env);
    drawPoles(bctx, camX);
    drawSignalPosts(bctx, camX, signals.posts);
    world.drawBed(bctx, env);
    drawTrack(bctx, camX);
    applyTint(bctx, night, dayCycle.warmth);
    ctx.drawImage(backCanvas, 0, 0);
    world.drawLights(ctx, env);
    drawSignalLights(ctx, camX, signals.posts, night, time);

    // 3. pociąg, przewody i pierwszy plan (też przyciemniane)
    fctx.clearRect(0, 0, W, H);
    consist.draw(fctx);
    drawWires(fctx, camX, sway);
    birds.draw(fctx, camX, sway);
    world.drawFront(fctx, env);
    fore.draw(fctx, worldX);
    applyTint(fctx, night, dayCycle.warmth, 0.5); // pociąg – bohater sceny – czytelny także nocą
    ctx.drawImage(frontCanvas, 0, 0);

    // 4. światła pociągu i iskry (nie przyciemniane)
    consist.drawLights(ctx, night);
    sparks.draw(ctx);

    // 5. szybki przejazd: rozmycie ruchu (smugi) i ściemnienie
    if (travelFx && travelFx.blur > 0) {
      const dir = travelTarget >= worldX ? 1 : -1; // krajobraz ucieka w lewo przy jeździe do przodu
      for (const [dx, a] of [[8, 0.5], [18, 0.35], [32, 0.2]] as const) {
        ctx.globalAlpha = a * travelFx.blur;
        ctx.drawImage(ctx.canvas, dir * dx, 0);
      }
      ctx.globalAlpha = 0.5 * travelFx.blur;
      ctx.fillStyle = PAL.white;
      for (let i = 0; i < 14; i++) {
        const y = (i * 53 + Math.floor(time * 400)) % H;
        ctx.fillRect(((i * 97) % W) - 40, y, 60 + (i % 3) * 30, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (travelFx && travelFx.fade > 0) {
      ctx.globalAlpha = Math.min(1, travelFx.fade) * 0.95;
      ctx.fillStyle = PAL.letterbox;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // 6. HUD i mapa trasy (chowają się razem)
    hud.draw(ctx, {
      kmh: state.kmh, targetKmh: state.targetKmh, running: state.running,
      night: night > 0.5, muted: state.muted, horn: state.horn,
      auto: state.autoDrive, signal: signalPreview(),
    });
    drawAlert();
    routeMap.draw(ctx, trainRef(), hud.alpha, (id, kind) => {
      const p = signals.posts.find((q) => q.id === id);
      return p ? signalColor(kind, p, time) : PAL.sigMast;
    });
    screen.present();
  },
);

/** Podgląd najbliższego sygnału do HUD. */
function signalPreview(): { label: string; km: number; color: string } | null {
  const n = signals.nearest(trainFront());
  if (!n) return null;
  return { label: n.kind === 'sem' ? 'SEMAFOR' : 'TARCZA', km: n.dist / KM_PX, color: signalColor(n.kind, n.post, time) };
}

/** Komunikat o przejechaniu sygnału STÓJ (miga, niezależnie od HUD). */
function drawAlert(): void {
  if (alertT <= 0) return;
  const l1 = 'PRZEJECHANIE SYGNAŁU STÓJ!';
  const l2 = 'RADIOSTOP - HAMOWANIE NAGŁE';
  const w1 = textWidth(l1, 2);
  const bw = w1 + 24;
  const bx = (W - bw) >> 1;
  const by = 92;
  ctx.globalAlpha = Math.min(1, alertT);
  ctx.fillStyle = PAL.hudBg;
  ctx.fillRect(bx, by, bw, 38);
  ctx.fillStyle = time % 0.6 < 0.3 ? PAL.sigAlert : PAL.locoMagenta;
  ctx.fillRect(bx, by, bw, 2);
  ctx.fillRect(bx, by + 36, bw, 2);
  drawText(ctx, l1, bx + 12, by + 10, PAL.sigAlert, 2);
  drawText(ctx, l2, (W - textWidth(l2)) >> 1, by + 27, PAL.hudText);
  ctx.globalAlpha = 1;
}

// --- uchwyt debugowy (tylko dev): zrzuty ekranu konkretnych miejsc trasy ---
if (import.meta.env.DEV) {
  void Promise.all([import('./scene/route'), import('./scene/segments/registry'), import('./config')]).then(
    ([{ Route }, { REGISTRY, LANDMARK_ORDER }, { ROUTE_SEED }]) => {
      (window as unknown as Record<string, unknown>).__jx = {
        state,
        travel,
        signals,
        get worldX() {
          return worldX;
        },
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
