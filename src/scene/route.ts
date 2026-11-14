// Generator nieskończonej trasy: fillery losowane z seeda, a co LANDMARK_SPACING_PX
// kolejny punkt charakterystyczny z cyklu „opowieści" (kopalnia → stacja → …).
// Trzyma tylko okno segmentów wokół widoku – pamięć nie rośnie z dystansem.
import { LANDMARK_SPACING_PX } from '../config';
import { mulberry32 } from '../engine/rng';
import type { Placed, SegmentDef } from './segments/types';

/** Pierwszy landmark pojawia się szybko po starcie (~10 s jazdy). */
export const FIRST_LANDMARK_PX = 1500;

/** Ile px za lewą krawędzią trzymamy segmenty (wagony wystają poza ekran). */
const KEEP_BEHIND_PX = 640;

export class Route {
  private rnd: () => number;
  private fillers: SegmentDef[];
  private landmarks: SegmentDef[];
  private segs: Placed[] = [];
  private nextX = 0;
  private nextIndex = 0;
  private sinceLandmark = 0;
  private landmarkNo = 0;
  private gapNeeded = FIRST_LANDMARK_PX;

  constructor(seed: number, registry: SegmentDef[], landmarkOrder: string[]) {
    this.rnd = mulberry32(seed);
    this.fillers = registry.filter((d) => d.kind === 'filler');
    this.landmarks = landmarkOrder
      .map((id) => registry.find((d) => d.id === id))
      .filter((d): d is SegmentDef => !!d);
  }

  /** x świata najstarszego trzymanego segmentu. */
  get firstX(): number {
    return this.segs.length ? this.segs[0].startX : 0;
  }

  get cachedCount(): number {
    return this.segs.length;
  }

  private pickFiller(): SegmentDef {
    const prev = this.segs[this.segs.length - 1]?.def;
    // nigdy dwa mosty pod rząd
    const pool = this.fillers.filter((d) => !(d.bridge && prev?.bridge));
    const total = pool.reduce((s, d) => s + d.weight, 0);
    let r = this.rnd() * total;
    for (const d of pool) {
      r -= d.weight;
      if (r < 0) return d;
    }
    return pool[pool.length - 1];
  }

  private generateOne(): void {
    let def: SegmentDef;
    if (this.landmarks.length > 0 && this.sinceLandmark >= this.gapNeeded) {
      def = this.landmarks[this.landmarkNo % this.landmarks.length];
      this.landmarkNo++;
      this.sinceLandmark = 0;
      this.gapNeeded = LANDMARK_SPACING_PX;
    } else {
      def = this.pickFiller();
      this.sinceLandmark += def.width;
    }
    this.segs.push({
      def,
      startX: this.nextX,
      index: this.nextIndex++,
      seed: (this.rnd() * 0x7fffffff) | 0,
    });
    this.nextX += def.width;
  }

  /** Segmenty przecinające [x0, x1). Świat porusza się tylko do przodu. */
  visible(x0: number, x1: number): Placed[] {
    while (this.nextX < x1) {
      this.generateOne();
      this.trim(x0);
    }
    this.trim(x0);
    return this.segs.filter((p) => p.startX < x1 && p.startX + p.def.width > x0);
  }

  private trim(x0: number): void {
    let n = 0;
    while (n < this.segs.length - 1 && this.segs[n].startX + this.segs[n].def.width < x0 - KEEP_BEHIND_PX) n++;
    if (n > 0) this.segs.splice(0, n);
  }
}
