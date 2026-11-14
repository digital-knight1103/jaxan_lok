// Indeks punktów trasy dla mapy: własna, deterministyczna kopia generatora trasy
// (ten sam seed → te same segmenty), z której wyciągamy punkty z ikoną mapy.
// Pamięć ograniczona: dawne punkty są usuwane; zapytanie daleko wstecz odbudowuje
// indeks od zera (generator jest szybki i deterministyczny).
import { PX_PER_KMH } from '../config';
import { Route, type LandmarkStop } from './route';
import type { MapIcon, SegmentDef } from './segments/types';

/** 1 km „wizualny" w px świata (spójny z prędkościomierzem: px = km/h·s·PX_PER_KMH). */
export const KM_PX = 3600 * PX_PER_KMH;
/** Zasięg mapy w każdą stronę (km). */
export const MAP_RANGE_KM = 10;
/** Po szybkim przejeździe punkt stoi w tej kolumnie ekranu – tuż przed lokomotywą. */
export const ANCHOR_SCREEN_X = 420;

export interface Poi {
  index: number;
  id: string;
  icon: MapIcon;
  label: string;
  startX: number;
  width: number;
  /** x świata punktu (stacja: dworzec, kopalnia: lej, most/zakład: środek). */
  anchorX: number;
  /** Stacja z semaforami. */
  signals: boolean;
}

/** worldX, przy którym pociąg ma stanąć dla danego punktu. */
export function stopWorldX(p: { anchorX: number }): number {
  return Math.max(0, p.anchorX - ANCHOR_SCREEN_X);
}

const STEP = 640;
/** Punkty starsze niż (x0 − PRUNE_PX) są usuwane. */
const PRUNE_PX = 2 * MAP_RANGE_KM * KM_PX;
const EPS = 8;

export class RouteIndex {
  private route!: Route;
  private pois: Poi[] = [];
  private frontier = 0;
  private lastIndex = -1;
  private keptFrom = 0;

  constructor(private seed: number, private registry: SegmentDef[], private order: LandmarkStop[]) {
    this.reset();
  }

  get cachedCount(): number {
    return this.pois.length;
  }

  private reset(): void {
    this.route = new Route(this.seed, this.registry, this.order);
    this.pois = [];
    this.frontier = 0;
    this.lastIndex = -1;
    this.keptFrom = 0;
  }

  /** Generuje trasę, aż znane będą wszystkie punkty z kotwicą ≤ x1. */
  private ensure(x1: number): void {
    while (this.frontier <= x1 + 2 * STEP) {
      for (const p of this.route.visible(this.frontier, this.frontier + STEP)) {
        if (p.index <= this.lastIndex) continue;
        this.lastIndex = p.index;
        if (!p.def.mapIcon) continue;
        this.pois.push({
          index: p.index,
          id: p.def.id,
          icon: p.def.mapIcon,
          label: p.def.mapLabel ?? p.def.id.toUpperCase(),
          startX: p.startX,
          width: p.def.width,
          anchorX: p.startX + (p.def.mapAnchor ?? Math.round(p.def.width / 2)),
          signals: !!p.def.signals,
        });
      }
      this.frontier += STEP;
    }
  }

  /** Przygotowuje indeks na zapytanie od x0 (odbudowa, jeśli dane już usunięte). */
  private from(x0: number): void {
    if (x0 < this.keptFrom) this.reset();
    const limit = x0 - PRUNE_PX;
    if (limit > this.keptFrom) {
      let n = 0;
      while (n < this.pois.length && this.pois[n].anchorX < limit) n++;
      if (n > 0) this.pois.splice(0, n);
      this.keptFrom = limit;
    }
  }

  /** Punkty z kotwicą w [x0, x1], rosnąco. */
  between(x0: number, x1: number): Poi[] {
    this.from(x0);
    this.ensure(x1);
    return this.pois.filter((p) => p.anchorX >= x0 && p.anchorX <= x1);
  }

  /** Pierwszy punkt za pozycją x. */
  next(x: number): Poi | null {
    this.from(x);
    for (let ahead = KM_PX; ahead < 100 * KM_PX; ahead *= 2) {
      this.ensure(x + ahead);
      const p = this.pois.find((q) => q.anchorX > x + EPS);
      if (p) return p;
    }
    return null;
  }

  /** Ostatni punkt przed pozycją x (null na początku trasy). */
  prev(x: number): Poi | null {
    this.from(Math.max(0, x - PRUNE_PX / 2));
    this.ensure(x);
    for (let i = this.pois.length - 1; i >= 0; i--) if (this.pois[i].anchorX < x - EPS) return this.pois[i];
    return null;
  }
}
