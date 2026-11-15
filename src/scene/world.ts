// Świat: trasa (Route) + cache wyrenderowanych warstw widocznych segmentów.
// Canvasy segmentów, które zjechały z ekranu, są zwalniane – pamięć stała.
import { W, H, ROUTE_SEED } from '../config';
import { makeSprite } from '../engine/sprite';
import { Route } from './route';
import { REGISTRY, LANDMARK_ORDER } from './segments/registry';
import type { Placed, SegmentEnv } from './segments/types';
import { look } from './season';
import { colorFn, recolorJob } from '../engine/seasonskin';
import { rimOverlaysJob, drawRim, type RimOverlays } from '../engine/light';

interface Rendered {
  back: HTMLCanvasElement; bed: HTMLCanvasElement; front: HTMLCanvasElement;
  /** Nakładki rim light (lewe/prawe słońce) – liczone po zakończeniu renderu, porcjami. */
  backRim?: RimOverlays; bedRim?: RimOverlays; frontRim?: RimOverlays;
  /** Warstwy gotowe do rysowania (render skończony; nakładki mogą jeszcze dochodzić). */
  ready: boolean;
  /** Zadanie przyrostowe: render warstw, potem nakładki; undefined = wszystko gotowe. */
  job?: Generator<void, void>;
  /** Numer wyglądu (pora roku), w którym segment namalowano; inny niż look.epoch = do przemalowania. */
  epoch: number;
  /** Przemalowana kopia w trakcie budowy – podmienia segment, gdy gotowa (bez migotania). */
  next?: Rendered;
}
interface Item { p: Placed; x: number; r: Rendered }

/** Ile px przed ekranem renderujemy segmenty zawczasu. */
const LOOKAHEAD = 640;
/**
 * Budżet czasu prerenderu na klatkę (ms). Zadania są dzielone na kroki (yield w render
 * segmentu, porcje wierszy nakładek), więc żadna klatka nie dostaje całego segmentu naraz.
 */
const PREP_BUDGET_MS = 3;

export class World {
  route = new Route(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
  private cache = new Map<number, Rendered>();
  private items: Item[] = [];
  /**
   * Rozgrzewka w tle: każdy typ segmentu renderowany raz do roboczych canvasów, gdy
   * zostaje wolny budżet klatki. Tworzy cache'owane sprite'y (pałac, wieżowce, drzewa)
   * zawczasu – pierwszy prawdziwy wjazd lokalizacji nie płaci za ich zimny start.
   */
  private warm: Generator<void, void> | undefined = warmUpJob();

  /** Nowy wpis cache z zadaniem: render (krokami, jeśli segment to generator) → nakładki. */
  private start(p: Placed): Rendered {
    const w = p.def.width;
    let backCtx!: CanvasRenderingContext2D;
    let bedCtx!: CanvasRenderingContext2D;
    let frontCtx!: CanvasRenderingContext2D;
    const back = makeSprite(w, H, (c) => (backCtx = c));
    const bed = makeSprite(w, H, (c) => (bedCtx = c));
    const front = makeSprite(w, H, (c) => (frontCtx = c));
    const r: Rendered = { back, bed, front, ready: false, epoch: look.epoch };
    const def = p.def;
    r.job = (function* () {
      const g = def.render({ back: backCtx, bed: bedCtx, front: frontCtx }, p.seed);
      if (g) yield* g;
      // pora roku: przebarwienie zieleni (malowanie taboru i reszta kolorów bez zmian)
      const fn = colorFn(look.from, look.to, look.step);
      for (const c of [backCtx, bedCtx, frontCtx]) yield* recolorJob(c, fn);
      r.ready = true;
      yield;
      r.backRim = yield* rimOverlaysJob(back);
      r.bedRim = yield* rimOverlaysJob(bed);
      r.frontRim = yield* rimOverlaysJob(front);
    })();
    return r;
  }

  /** Jeden krok zadania; false = zadanie skończone. */
  private step(r: Rendered): boolean {
    if (!r.job) return false;
    if (r.job.next().done) r.job = undefined;
    return !!r.job;
  }

  /** Wywołać raz na klatkę przed rysowaniem. camX = Math.floor(worldX). */
  prepare(camX: number): void {
    // skok wstecz (mapa trasy): trasa jest deterministyczna – odbudowa z seeda
    if (camX < this.route.firstX) {
      this.route = new Route(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
      this.cache.clear();
    }
    // segmenty tuż za prawą krawędzią zaczynamy renderować zawczasu, żeby wjazd nowego
    // odcinka nie powodował przycięcia animacji
    const vis = this.route.visible(camX, camX + W + LOOKAHEAD);
    const keep = new Set<number>();
    this.items = [];
    for (const p of vis) {
      keep.add(p.index);
      let r = this.cache.get(p.index);
      if (!r) this.cache.set(p.index, (r = this.start(p)));
      else if ((r.next ? r.next.epoch : r.epoch) !== look.epoch) r.next = this.start(p);
      const onScreen = p.startX < camX + W;
      // segment już na ekranie (np. po skoku z mapy) – render dokańczamy od razu
      if (onScreen) while (!r.ready && this.step(r));
      if (onScreen) this.items.push({ p, x: p.startX - camX, r });
    }
    for (const k of this.cache.keys()) if (!keep.has(k)) this.cache.delete(k);
    // reszta pracy w budżecie czasu, w kolejności trasy (najbliższe segmenty pierwsze);
    // co najmniej jeden krok na klatkę – praca zawsze posuwa się do przodu
    const t0 = performance.now();
    const spent = () => performance.now() - t0 > PREP_BUDGET_MS;
    for (const [k, r] of this.cache) {
      while (this.step(r)) if (spent()) return;
      const n = r.next;
      if (n) {
        while (this.step(n)) if (spent()) return;
        this.cache.set(k, n); // gotowa przemalowana kopia zastępuje starą
      }
    }
    while (this.warm && !spent()) if (this.warm.next().done) this.warm = undefined;
  }

  get cachedCanvases(): number {
    return this.cache.size;
  }

  /** Segment pod danym ekranowym x (np. czy lokomotywa jest pod lejem). */
  at(screenX: number): Item | undefined {
    return this.items.find((it) => screenX >= it.x && screenX < it.x + it.p.def.width);
  }

  drawBack(ctx: CanvasRenderingContext2D, env: SegmentEnv): void {
    for (const it of this.items) {
      ctx.drawImage(it.r.back, it.x, 0);
      if (it.r.backRim) drawRim(ctx, it.r.backRim, it.x, env.sunL, env.sunR);
    }
    for (const it of this.items) it.p.def.animate?.(ctx, it.x, env, it.p.seed);
  }

  drawBed(ctx: CanvasRenderingContext2D, env: SegmentEnv): void {
    for (const it of this.items) {
      ctx.drawImage(it.r.bed, it.x, 0);
      if (it.r.bedRim) drawRim(ctx, it.r.bedRim, it.x, env.sunL, env.sunR);
    }
    for (const it of this.items) it.p.def.animateBed?.(ctx, it.x, env, it.p.seed);
  }

  drawFront(ctx: CanvasRenderingContext2D, env: SegmentEnv): void {
    for (const it of this.items) {
      ctx.drawImage(it.r.front, it.x, 0);
      if (it.r.frontRim) drawRim(ctx, it.r.frontRim, it.x, env.sunL, env.sunR);
    }
  }

  drawLights(ctx: CanvasRenderingContext2D, env: SegmentEnv): void {
    for (const it of this.items) it.p.def.lights?.(ctx, it.x, env, it.p.seed);
  }
}

/** Zadanie rozgrzewki: render każdej definicji segmentu do roboczych canvasów (potem do GC). */
function* warmUpJob(): Generator<void, void> {
  const w = Math.max(...REGISTRY.map((d) => d.width));
  let back!: CanvasRenderingContext2D;
  let bed!: CanvasRenderingContext2D;
  let front!: CanvasRenderingContext2D;
  makeSprite(w, H, (c) => (back = c));
  makeSprite(w, H, (c) => (bed = c));
  makeSprite(w, H, (c) => (front = c));
  yield;
  for (const d of REGISTRY) {
    for (const c of [back, bed, front]) c.clearRect(0, 0, w, H);
    const g = d.render({ back, bed, front }, 1);
    if (g) yield* g;
    yield;
  }
}
