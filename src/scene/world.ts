// Świat: trasa (Route) + cache wyrenderowanych warstw widocznych segmentów.
// Canvasy segmentów, które zjechały z ekranu, są zwalniane – pamięć stała.
import { W, H, ROUTE_SEED } from '../config';
import { makeSprite } from '../engine/sprite';
import { Route } from './route';
import { REGISTRY, LANDMARK_ORDER } from './segments/registry';
import type { Placed, SegmentEnv } from './segments/types';
import { buildRimOverlays, drawRim, type RimOverlays } from '../engine/light';

interface Rendered {
  back: HTMLCanvasElement; bed: HTMLCanvasElement; front: HTMLCanvasElement;
  /** Nakładki rim light (lewe/prawe słońce) – liczone raz, po jednej na klatkę (bez przycięć). */
  backRim?: RimOverlays; bedRim?: RimOverlays; frontRim?: RimOverlays;
}
interface Item { p: Placed; x: number; r: Rendered }

/** Ile px przed ekranem renderujemy segmenty zawczasu. */
const LOOKAHEAD = 640;

export class World {
  route = new Route(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
  private cache = new Map<number, Rendered>();
  private items: Item[] = [];

  private render(p: Placed): Rendered {
    const w = p.def.width;
    let backCtx!: CanvasRenderingContext2D;
    let bedCtx!: CanvasRenderingContext2D;
    let frontCtx!: CanvasRenderingContext2D;
    const back = makeSprite(w, H, (c) => (backCtx = c), true);
    const bed = makeSprite(w, H, (c) => (bedCtx = c), true);
    const front = makeSprite(w, H, (c) => (frontCtx = c), true);
    p.def.render({ back: backCtx, bed: bedCtx, front: frontCtx }, p.seed);
    return { back, bed, front };
  }

  /** Wywołać raz na klatkę przed rysowaniem. camX = Math.floor(worldX). */
  prepare(camX: number): void {
    // skok wstecz (mapa trasy): trasa jest deterministyczna – odbudowa z seeda
    if (camX < this.route.firstX) {
      this.route = new Route(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
      this.cache.clear();
    }
    // segmenty tuż za prawą krawędzią renderujemy zawczasu (max 1 na klatkę),
    // żeby wjazd nowego odcinka nie powodował przycięcia animacji
    const vis = this.route.visible(camX, camX + W + LOOKAHEAD);
    const keep = new Set<number>();
    let budget = 1;
    this.items = [];
    for (const p of vis) {
      keep.add(p.index);
      const onScreen = p.startX < camX + W;
      let r = this.cache.get(p.index);
      if (!r && (onScreen || budget-- > 0)) {
        r = this.render(p);
        this.cache.set(p.index, r);
      }
      if (onScreen && r) this.items.push({ p, x: p.startX - camX, r });
    }
    for (const k of this.cache.keys()) if (!keep.has(k)) this.cache.delete(k);
    // nakładki światła: jedna warstwa na klatkę, gdy nic innego się nie renderowało
    // (widoczne segmenty pierwsze – w kolejności trasy)
    if (budget > 0) {
      for (const r of this.cache.values()) {
        if (!r.backRim) { r.backRim = buildRimOverlays(r.back); break; }
        if (!r.bedRim) { r.bedRim = buildRimOverlays(r.bed); break; }
        if (!r.frontRim) { r.frontRim = buildRimOverlays(r.front); break; }
      }
    }
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
