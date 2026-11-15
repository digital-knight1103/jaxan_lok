// JAXAN Express – start i sklejenie modułów: stan, wejście, pętla, rysowanie warstw.
import {
  START_KMH, MAX_KMH, PX_PER_KMH, TRACK_Y, TRAIN_X, W, H, ROUTE_SEED, CURSOR_HIDE_MS, HUD_HIDE_MS, AUTO_RESUME_MS,
} from './config';
import { PAL } from './palette';
import { initialState } from './state';
import { createScreen } from './engine/screen';
import { startLoop } from './engine/loop';
import { bindInput, type Action } from './engine/input';
import { IdleTracker } from './engine/idle';
import { AudioEngine } from './engine/audio';
import { drawSky, drawGlow } from './scene/sky';
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
import { Hud, drawLimitPanel, drawHelp, drawHint, drawToast, WEATHER_NAMES, SEASON_NAMES } from './ui/hud';
import { RouteMap } from './ui/routemap';
import { RouteIndex, ANCHOR_SCREEN_X, KM_PX, stopWorldX, type Poi } from './scene/routeindex';
import { TravelAnim, type TravelFrame } from './scene/travel';
import { REGISTRY, LANDMARK_ORDER } from './scene/segments/registry';
import { DayCycle } from './scene/daycycle';
import { Celestial } from './scene/celestial';
import { Weather, type WeatherKind } from './scene/weather';
import { SeasonClock, SEASONS, syncLook, look, type Season } from './scene/season';
import { OncomingTrains, drawSecondTrack, drawOncomingLights, parkedVisible, type OncomingKind } from './scene/oncoming';
import { autumnLeaves, springPetals } from './scene/seasonfx';
import { CinemaCam } from './scene/cinema';
import { SpeedLimits, limitAt, capAt, nextChange, type Zone } from './train/limits';
import { drawLimitSigns } from './scene/limitsigns';
import { SEM_BEFORE_STATION_PX } from './train/signals';
import { WAGON_W } from './sprites/eamos';
import { RainFx, SnowFx, drawFogSky, drawFogVeil, drawFogWisps, drawOvercast, drawSnowCover, drawSnowGround, drawTrackWeather, gloom } from './scene/weatherfx';
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
// Pory roku: zmieniają się same co kilka pętli trasy; ?season=spring|summer|autumn|winter ustawia porę na starcie, P przełącza.
const seasons = new SeasonClock();

if (SEASONS.includes(params.get('season') as Season)) seasons.jump(params.get('season') as Season);
syncLook(seasons);
dayCycle.dayBias = seasons.dayBias;
dayCycle.pale = seasons.weight('winter');
// Pogoda zmienia się sama; ?w=cloudy|rain|snow ustawia ją na starcie (debug/zrzuty), W przełącza ręcznie.
const weather = new Weather();
if (params.has('w')) {
  weather.setManual(params.get('w') as WeatherKind);
  weather.update(60); // od razu pełne natężenie
}
// Tryb kinowy (C lub 3 min bezczynności): bez HUD i mapy, kamera przybliża/oddala/przesuwa się.
let cinema = params.has('cinema');
let cinemaWas = false;
const cinemaCam = new CinemaCam();
const rainFx = new RainFx();
const snowFx = new SnowFx();
const oncoming = new OncomingTrains();
// ?oncoming=emu|freight: skład z naprzeciwka od razu w kadrze (z ?stop – stoi; podgląd/zrzuty)
if (params.get('oncoming') === 'emu' || params.get('oncoming') === 'freight') {
  const t = oncoming.spawn(params.get('oncoming') as OncomingKind, worldX);
  t.x = worldX + 60;
  t.salute = false;
  if (params.has('stop')) t.v = 0;
}
const leafFx = autumnLeaves();
const petalFx = springPetals();

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
const [gCanvas, gctx] = layerCanvas();

/** Przyciemnienie nocą i ciepło zmierzchu – tylko na narysowanych pikselach. */
function applyTint(c: CanvasRenderingContext2D, night: number, warmth: number, strength = 0.72, golden = 0, dim = 0): void {
  c.globalCompositeOperation = 'source-atop';
  if (night > 0) {
    c.globalAlpha = night * strength;
    c.fillStyle = PAL.nightTint;
    c.fillRect(0, 0, W, H);
  }
  if (warmth > 0 || golden > 0) {
    c.globalAlpha = warmth * 0.2 + golden * 0.12; // zmierzch + złota godzina
    c.fillStyle = PAL.warmTint;
    c.fillRect(0, 0, W, H);
  }
  if (dim > 0) {
    c.globalAlpha = dim; // pogoda: szare, chłodne światło pod chmurami
    c.fillStyle = PAL.rainTint;
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
const skinned = [farthest, far, near, hills, fore]; // tła przebarwiane pod porę roku
for (const l of skinned) l.skin(look.from, look.to, look.step);
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
// ograniczenia prędkości (Ie-1): odcinki szlakowe z seeda + ograniczenia przy stacjach
const limits = new SpeedLimits(ROUTE_SEED, (x0, x1) =>
  routeIndex.between(x0 - 4000, x1 + 4000).filter((p) => p.signals)
    .map((p) => ({ index: p.index, semX: p.startX - SEM_BEFORE_STATION_PX, endX: p.startX + p.width }))
    .filter((s) => s.endX >= x0 && s.semX <= x1),
);
let zones: Zone[] = [];
// osobny generator dla mapy (zakres ±10 km, niezależny od okna jazdy)
const mapLimits = new SpeedLimits(ROUTE_SEED, (x0, x1) =>
  routeIndex.between(x0 - 4000, x1 + 4000).filter((p) => p.signals)
    .map((p) => ({ index: p.index, semX: p.startX - SEM_BEFORE_STATION_PX, endX: p.startX + p.width }))
    .filter((s) => s.endX >= x0 && s.semX <= x1),
);
/** Długość składu (px): od czoła lokomotywy do końca ostatniego wagonu. */
const trainLen = () => LOCO_W + state.wagons * (WAGON_W + 1);
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
let pointerHorn: 'lo' | 'hi' | 'both' | null = null;
// nakładka pomocy (?) i jednorazowa podpowiedź przy pierwszym uruchomieniu (8 s, zapamiętana w localStorage)
let helpOpen = false;
let helpWas = false;
let hintT = 0;
// krótki napis z nazwą wybranej pogody
let toastT = 0;
let toastText = '';
try {
  if (!localStorage.getItem('jaxan.hintSeen')) {
    hintT = 8;
    localStorage.setItem('jaxan.hintSeen', '1');
  }
} catch { /* localStorage niedostępny – podpowiedź pokaże się przy każdym starcie */ }

function toastSeason(): void {
  toastText = `PORA ROKU: ${SEASON_NAMES[seasons.choice]}`;
  toastT = 2;
}

/** Przebarwianie teł pod porę roku, porcjami w wolnym budżecie klatki. */
function stepSkins(): void {
  const t0 = performance.now();
  for (const l of skinned) while (l.skinStep()) if (performance.now() - t0 > 2) return;
}

function toast(): void {
  toastText = `POGODA: ${WEATHER_NAMES[weather.choice]}`;
  toastT = 2;
}

function action(a: Action): void {
  switch (a) {
    case 'horn-down':
      if (!state.horn) {
        state.horn = true;
        audio.hornStart('lo');
        birds.scare(Math.floor(worldX)); // także przy wyciszonym dźwięku
      }
      break;
    case 'horn-up':
      if (state.horn) {
        state.horn = false;
        audio.hornStop('lo');
      }
      break;
    case 'horn-hi-down':
      if (!state.hornHi) {
        state.hornHi = true;
        audio.hornStart('hi');
        birds.scare(Math.floor(worldX));
      }
      break;
    case 'horn-hi-up':
      if (state.hornHi) {
        state.hornHi = false;
        audio.hornStop('hi');
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
    case 'cinema':
      // dowolne zdarzenie wejścia już wyłączyło tryb (onActivity) – C przełącza względem stanu sprzed niego
      cinema = !cinemaWas;
      break;
    case 'help':
      helpOpen = !helpWas; // klawisz ? zamyka otwartą nakładkę (onKey już ją zamknął)
      hintT = 0;
      break;
    case 'weather':
      hud.menuOpen = false;
      weather.cycle(); // bez wpływu na fizykę jazdy
      toast();
      break;
    case 'weather-menu':
      hud.menuOpen = !hud.menuOpen;
      break;
    case 'season':
      hud.menuOpen = false;
      seasons.cycle();
      toastSeason();
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
  onKey(e) {
    helpWas = helpOpen;
    helpOpen = false;
    return helpWas && e.key !== '?'; // inne klawisze tylko zamykają nakładkę
  },
  onActivity() {
    const now = performance.now();
    cursorIdle.touch(now);
    hudIdle.touch(now);
    autoIdle.touch(now);
    cinemaWas = cinema;
    cinema = false; // dowolny klawisz lub ruch myszy = powrót
    audio.unlock();
  },
  onPointerDown(cx, cy) {
    if (helpOpen) {
      helpOpen = false; // kliknięcie zamyka nakładkę i nic więcej nie robi
      return;
    }
    const p = screen.toGame(cx, cy);
    if (hud.alpha >= 0.5 && routeMap.pointerDown(p.x, p.y)) return;
    const hit = hud.hit(p.x, p.y);
    if (hit && 'weather' in hit) {
      weather.choose(hit.weather);
      hud.menuOpen = false;
      toast();
      return;
    }
    if (!(hit && 'action' in hit && hit.action === 'weather-menu')) hud.menuOpen = false; // klik poza menu je zamyka
    if (hit && 'action' in hit) {
      action(hit.action);
      if (hit.action === 'horn-down') pointerHorn = 'lo';
      if (hit.action === 'horn-hi-down') pointerHorn = 'hi';
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
      action('horn-down'); // klik w lokomotywę = dwuton (obie trąbki)
      action('horn-hi-down');
      pointerHorn = 'both';
    }
    // każdy inny dotyk tylko pokazuje HUD (onActivity)
  },
  onPointerMove(cx, cy) {
    const p = screen.toGame(cx, cy);
    routeMap.pointerMove(p.x, p.y, trainRef());
  },
  onPointerUp(cx) {
    if (pointerHorn) {
      if (pointerHorn !== 'hi') action('horn-up');
      if (pointerHorn !== 'lo') action('horn-hi-up');
      pointerHorn = null;
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
    // AUTO: szlakowa 120 km/h, zwalnia przed W 9 i przyspiesza, gdy ogon minie koniec odcinka
    if (state.autoDrive) state.targetKmh = MAX_KMH;
    const cap = state.autoDrive ? Math.min(signals.cap(prevFront), capAt(zones, prevFront, trainLen())) : Infinity;
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
  zones = limits.near(front - trainLen() - 700, front + 3 * KM_PX);
  consist.update(dt, state.kmh);
  // „pływająca" kamera: pociąg lekko wysuwa się przy przyspieszaniu, cofa przy hamowaniu
  const accel = dt > 0 ? (state.kmh - prev) / dt : 0;
  const target = Math.max(-6, Math.min(6, accel * 1.5));
  consist.shift += (target - consist.shift) * Math.min(1, dt * 1.2);
  clouds.update(dt);
  // rano (wschód–przedpołudnie) automat może wywołać mgłę
  // pory roku: przejścia kolorów, dłuższy/krótszy dzień, szanse pogody AUTO
  {
    // pociągi z naprzeciwka (drugi tor): ruch, harmonogram, dźwięk przelotu i powitalny klakson
    const ev = oncoming.update(dt, Math.floor(worldX), state.kmh, parkedVisible(world.stations()));
    if (ev.pass) audio.passby(ev.pass.peakS, ev.pass.totalS, ev.pass.heavy);
    if (ev.horn) { audio.hornStart('hi'); setTimeout(() => audio.hornStop('hi'), 450); }
  }
  seasons.update(dt, worldX);
  if (syncLook(seasons)) for (const l of skinned) l.skin(look.from, look.to, look.step);
  dayCycle.dayBias = seasons.dayBias;
dayCycle.pale = seasons.weight('winter');
  weather.update(dt, dayCycle.t > 0.2 && dayCycle.t < 0.42, seasons.climate);
  leafFx.update(dt, seasons.weight('autumn'));
  petalFx.update(dt, seasons.weight('spring') * 0.5);
  rainFx.update(dt, weather.rain, state.kmh);
  snowFx.update(dt, weather.snow);
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
    hud.update(dt, !cinema && (!hudIdle.isIdle(now) || routeMap.dragging));
    cinemaCam.update(dt, cinema);
    cinemaWas = false;
    helpWas = false;
    hintT = Math.max(0, hintT - dt);
    toastT = Math.max(0, toastT - dt);
    if (hud.alpha < 0.5) hud.menuOpen = false;
    // po kilku minutach bez dotykania scena wraca do jazdy automatycznej
    if (autoIdle.isIdle(now)) {
      cinema = true; // po 3 min bezczynności
      state.running = true;
      state.targetKmh = START_KMH;
      state.dayAuto = true;
      state.autoDrive = true;
      dayCycle.resumeAuto();
    }
    simulate(dt);
    audio.update(state.kmh, braking, dt);
    audio.setRain(weather.rain);
  },
  () => {
    const camX = Math.floor(worldX);
    const night = dayCycle.night;
    const light = dayCycle.light;
    const env: SegmentEnv = { night, time, sunL: light.sunL, sunR: light.sunR }; // rim light wg słońca/księżyca
    const sway = Math.sin(time * 0.9) * 1.2; // kołysanie liny nośnej
    world.prepare(camX);
    stepSkins();
    const snowLvl = Math.max(weather.snow, seasons.weight('winter')); // zimą śnieg leży także bez opadów

    // 1. niebo, gwiazdy, słońce/księżyc
    {
      const sun = DayCycle.bodyPos(dayCycle.t);
      drawSky(ctx, dayCycle.skyColors(), H, sun.x, sun.y, (1 - night) * (0.45 + 0.55 * Math.max(dayCycle.golden, dayCycle.warmth)));
      const moon = DayCycle.bodyPos(dayCycle.t + 0.5);
      if (night > 0.05 && moon.up > -0.1) drawGlow(ctx, 'moon', moon.x, moon.y, night * 0.55); // księżycowa poświata
    }
    celestial.draw(ctx, dayCycle, time);
    drawOvercast(ctx, weather.cloud);
    drawFogSky(ctx, weather.fog, night);

    // 2. krajobraz za pociągiem (przyciemniany nocą) + światła okien i lamp
    bctx.clearRect(0, 0, W, H);
    // udział światła z prawej: rano 0 (słońce z lewej), wieczorem 1
    const right = light.sunR / Math.max(1e-3, light.sunL + light.sunR);
    // mgła: po każdym planie zasłona – im dalszy plan, tym mocniej znika (doliny gęstsze)
    const fogW = weather.fog;
    farthest.draw(bctx, worldX, right);
    drawFogVeil(bctx, fogW, 1.1);
    far.draw(bctx, worldX, right);
    drawFogVeil(bctx, fogW, 0.9);
    clouds.draw(bctx, worldX, right, (1 - 0.85 * weather.cloud) * (1 - fogW)); // przy zachmurzeniu białe cumulusy ustępują szarej pokrywie
    near.draw(bctx, worldX, right);
    drawFogVeil(bctx, fogW, 0.65);
    hills.draw(bctx, worldX, right);
    drawFogVeil(bctx, fogW, 0.4);
    world.drawBack(bctx, env);
    drawPoles(bctx, camX);
    drawSignalPosts(bctx, camX, signals.posts);
    drawLimitSigns(bctx, camX, zones);
    world.drawBed(bctx, env);
    drawSecondTrack(bctx, camX, oncoming, world.stations(), sway); // drugi tor, sieć i pociągi z naprzeciwka
    drawFogVeil(bctx, fogW, 0.45, TRACK_Y - 70, TRACK_Y + 10); // mgła przy ziemi: tło toru zlewa się z mgłą
    drawFogVeil(bctx, fogW, 0.3, TRACK_Y + 8, TRACK_Y + 9); // lekki welon także na polach przed torem
    drawFogWisps(bctx, fogW, worldX, time, 0, TRACK_Y - 40, TRACK_Y + 4, 0.35);
    drawSnowCover(bctx, snowLvl); // biel na dachach, koronach i nasypie (pod torem)
    drawSnowGround(bctx, weather.snow);
    drawTrack(bctx, camX);
    drawTrackWeather(bctx, camX, weather.rain, snowLvl);
    applyTint(bctx, night, dayCycle.warmth, 0.72, dayCycle.golden, gloom(weather.cloud, weather.rain));
    ctx.drawImage(backCanvas, 0, 0);
    world.drawLights(ctx, env);
    drawOncomingLights(ctx, camX, oncoming, world.stations(), night);
    drawSignalLights(ctx, camX, signals.posts, night, time);

    // 3. pociąg, przewody i pierwszy plan (też przyciemniane)
    fctx.clearRect(0, 0, W, H);
    consist.draw(fctx, light.sunL, light.sunR);
    drawWires(fctx, camX, sway);
    if (snowLvl > 0.01) {
      // pierwszy plan osobno, żeby śnieg nie przykrył malowania taboru
      gctx.clearRect(0, 0, W, H);
      world.drawFront(gctx, env);
      fore.draw(gctx, worldX);
      drawSnowCover(gctx, snowLvl);
      fctx.drawImage(gCanvas, 0, 0);
    } else {
      world.drawFront(fctx, env);
      fore.draw(fctx, worldX);
    }
    fore.draw(fctx, worldX);
    applyTint(fctx, night, dayCycle.warmth * 0.6, 0.5, dayCycle.golden * 0.35, gloom(weather.cloud, weather.rain) * 0.35); // pociąg – bohater sceny – czytelny także nocą
    ctx.drawImage(frontCanvas, 0, 0);

    // 4. światła pociągu i iskry (nie przyciemniane)
    consist.drawLights(ctx, night, weather.fog);
    // smugi tuż nad podkładami – nad kołami, malowanie wagonów zostaje czyste
    drawFogWisps(ctx, fogW, worldX, time, night, TRACK_Y - 3, TRACK_Y + 9, 0.3);
    sparks.draw(ctx);
    rainFx.draw(ctx, weather.rain, night); // opady na wierzchu
    snowFx.draw(ctx, weather.snow, worldX, time, night);
    leafFx.draw(ctx, seasons.weight('autumn'), worldX, time, night);
    petalFx.draw(ctx, seasons.weight('spring') * 0.5, worldX, time, night);

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
      night: night > 0.5, muted: state.muted, horn: state.horn, hornHi: state.hornHi,
      auto: state.autoDrive, weather: weather.choice, season: seasons.choice, signal: signalPreview(),
    });
    drawAlert();
    drawToast(ctx, toastText, toastT);
    drawHint(ctx, Math.min(1, hintT) * Math.min(1, (8 - hintT) * 2 + 0.01));
    if (helpOpen) drawHelp(ctx);
    drawLimits();
    routeMap.draw(ctx, trainRef(), hud.alpha, (id, kind) => {
      const p = signals.posts.find((q) => q.id === id);
      return p ? signalColor(kind, p, time) : PAL.sigMast;
    }, (x0, x1) => mapLimits.near(x0, x1));
    screen.present(cinemaCam.view());
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
        limits,
        cinemaCam,
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

/** Panel ograniczenia prędkości (prawy górny róg); miga przy przekroczeniu w jeździe ręcznej. */
function drawLimits(): void {
  const front = trainFront();
  const tail = trainLen();
  const limit = limitAt(zones, front, tail);
  const n = nextChange(zones, front, tail);
  const over = !state.autoDrive && state.kmh > limit + 1.5;
  // ostrzeżenie widać także, gdy reszta HUD jest schowana
  drawLimitPanel(
    ctx,
    { limit, next: n ? { kmh: n.kmh, km: n.dist / KM_PX } : null, kmh: state.kmh, over },
    time,
    cinema ? 0 : Math.max(hud.alpha, over ? 1 : 0),
  );
}
