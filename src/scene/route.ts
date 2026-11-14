// Generator nieskończonej trasy: fillery (pola, lasy, mosty…) losowane z seeda, a co
// LANDMARK_SPACING_PX kolejna lokalizacja z pętli (Sokółka → Warszawa → Kamieniec → …).
// Lokalizacja = grupa segmentów (np. most na Wiśle + stacja Warszawa) ustawionych
// jeden za drugim, opcjonalnie z odstępem gapPx wypełnionym fillerami.
// Trzyma tylko okno segmentów wokół widoku – pamięć nie rośnie z dystansem.
import { LANDMARK_SPACING_PX } from '../config';
import { mulberry32 } from '../engine/rng';
import type { Placed, SegmentDef } from './segments/types';

/** Pierwsza lokalizacja szybko po starcie (~50 s jazdy; tarcza ostrzegawcza widoczna od razu). */
export const FIRST_LANDMARK_PX = 6800;

/** Lokalizacja na pętli trasy: segmenty po kolei, gapPx = odstęp między nimi. */
export interface LandmarkStop {
  ids: string[];
  gapPx?: number;
}

/** Ile px za lewą krawędzią trzymamy segmenty (wagony wystają poza ekran). */
const KEEP_BEHIND_PX = 640;

export class Route {
  private rnd: () => number;
  private fillers: SegmentDef[];
  private stops: { defs: SegmentDef[]; gapPx: number }[];
  /** Pozostałe segmenty bieżącej lokalizacji. */
  private pending: SegmentDef[] = [];
  private pendingGap = 0;
  private segs: Placed[] = [];
  private nextX = 0;
  private nextIndex = 0;
  private sinceLandmark = 0;
  private landmarkNo = 0;
  private gapNeeded = FIRST_LANDMARK_PX;

  constructor(seed: number, registry: SegmentDef[], landmarkOrder: LandmarkStop[]) {
    this.rnd = mulberry32(seed);
    this.fillers = registry.filter((d) => d.kind === 'filler');
    this.stops = landmarkOrder
      .map((st) => ({
        defs: st.ids.map((id) => registry.find((d) => d.id === id)).filter((d): d is SegmentDef => !!d),
        gapPx: st.gapPx ?? 0,
      }))
      .filter((st) => st.defs.length > 0);
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
    const prev = this.segs[this.segs.length - 1]?.def;
    if (this.pending.length === 0 && this.stops.length > 0 && this.sinceLandmark >= this.gapNeeded) {
      // początek kolejnej lokalizacji z pętli
      const st = this.stops[this.landmarkNo % this.stops.length];
      this.landmarkNo++;
      this.pending = [...st.defs];
      this.pendingGap = st.gapPx;
      this.sinceLandmark = this.gapNeeded = 0;
    }
    // nigdy dwa mosty pod rząd – także filler-most tuż przed mostem lokalizacji
    if (this.pending.length > 0 && this.sinceLandmark >= this.gapNeeded && !(this.pending[0].bridge && prev?.bridge)) {
      def = this.pending.shift()!;
      this.sinceLandmark = 0;
      this.gapNeeded = this.pending.length > 0 ? this.pendingGap : LANDMARK_SPACING_PX;
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
