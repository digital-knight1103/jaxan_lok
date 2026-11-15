// Ograniczenia prędkości wg Ie-1 – czysta logika (bez rysowania).
// Odcinek ograniczenia: W 8 (zapowiedź) stoi w odległości drogi hamowania przed początkiem,
// W 9 oznacza początek, W 9 (odwrotna strona) – koniec. Ograniczenie obowiązuje od czoła
// pociągu przy znaku początku do chwili, gdy przejedzie je OSTATNI wagon.
// Odcinki szlakowe: 100 / 80 / rzadziej 60 km/h, 1–3 km; przy stacjach 60 lub 80 km/h
// od semafora wjazdowego do końca stacji. Deterministycznie z seeda.
import { MAX_KMH, PX_PER_KMH } from '../config';
import { mulberry32 } from '../engine/rng';
import { KM_PX } from '../scene/routeindex';

/** Prędkość szlakowa (km/h). */
export const LINE_KMH = MAX_KMH;
/** Planowane opóźnienie automatu (km/h/s) – mniejsze niż hamowanie fizyczne, z zapasem. */
export const PLAN_DECEL_KMH_S = 4.5;

export interface Zone {
  startX: number;
  endX: number;
  kmh: number;
  /** Ograniczenie przy stacji (od semafora wjazdowego do końca stacji). */
  station: boolean;
}

/** Stacja widziana przez generator: semafor wjazdowy i koniec stacji (px świata). */
export interface StationSpan {
  index: number;
  semX: number;
  endX: number;
}

/** Droga hamowania (px) z prędkości `from` do `to` przy opóźnieniu planowym – miejsce W 8. */
export function brakeDistance(from: number, to: number): number {
  if (from <= to) return 0;
  return ((from * from - to * to) * PX_PER_KMH) / (2 * PLAN_DECEL_KMH_S);
}

/** Dopuszczalna prędkość tak, by zdążyć zwolnić do `to` na drodze d px. */
export function brakeCurve(d: number, to: number): number {
  return Math.sqrt(to * to + (2 * PLAN_DECEL_KMH_S * Math.max(0, d)) / PX_PER_KMH);
}

/** Obowiązująca prędkość na pozycji czoła (tailLen = długość składu, px). */
export function limitAt(zones: Zone[], front: number, tailLen: number): number {
  let v = LINE_KMH;
  for (const z of zones) if (front >= z.startX && front - tailLen < z.endX) v = Math.min(v, z.kmh);
  return v;
}

/** Górna granica prędkości dla AUTO: obowiązujące ograniczenie + krzywa hamowania przed początkiem. */
export function capAt(zones: Zone[], front: number, tailLen: number): number {
  let c = limitAt(zones, front, tailLen);
  for (const z of zones) if (front < z.startX) c = Math.min(c, brakeCurve(z.startX - front, z.kmh));
  return c;
}

export interface NextLimit {
  kmh: number;
  /** Odległość czoła od miejsca zmiany (px). */
  dist: number;
}

/** Najbliższa zmiana obowiązującej prędkości: początek następnego odcinka albo koniec bieżącego. */
export function nextChange(zones: Zone[], front: number, tailLen: number): NextLimit | null {
  const cur = limitAt(zones, front, tailLen);
  let best: NextLimit | null = null;
  const consider = (kmh: number, dist: number) => {
    if (dist >= 0 && (!best || dist < best.dist)) best = { kmh, dist };
  };
  for (const z of zones) {
    if (front < z.startX) {
      if (z.kmh !== cur) consider(z.kmh, z.startX - front);
    } else if (front - tailLen < z.endX && z.kmh <= cur) {
      // koniec bieżącego ograniczenia: wracamy do tego, co obowiązuje bez niego
      const rest = limitAt(zones.filter((q) => q !== z), z.endX + tailLen, tailLen);
      consider(rest, z.endX + tailLen - front);
    }
  }
  return best;
}

const PICK: [number, number][] = [[0.5, 100], [0.88, 80], [1, 60]];
/** Zapas przed stacją i za nią, w którym nie zaczyna się odcinek szlakowy (px). */
const STATION_PAD_PX = 500;
/** Strefa przed semaforem stacji (tarcza ostrzegawcza 1 km + W 8), wolna od odcinków szlakowych. */
const STATION_APPROACH_PX = 2600;
const KEEP_BEHIND_PX = 4 * KM_PX;

/** Prędkość ograniczenia stacyjnego (60 lub 80) – z numeru stacji, deterministycznie. */
export function stationKmh(seed: number, index: number): number {
  const r = mulberry32(seed ^ (index * 2654435761))();
  return r < 0.5 ? 60 : 80;
}

export class SpeedLimits {
  private rnd: () => number;
  private open: Zone[] = [];
  private cursor = 3 * KM_PX;
  private keptFrom = 0;

  /** stationsIn(x0,x1) – stacje z semaforami przecinające przedział (deterministyczne). */
  constructor(
    private seed: number,
    private stationsIn: (x0: number, x1: number) => StationSpan[],
  ) {
    this.rnd = mulberry32(seed);
  }

  get cachedCount(): number {
    return this.open.length;
  }

  private reset(): void {
    this.rnd = mulberry32(this.seed);
    this.open = [];
    this.cursor = 3 * KM_PX;
    this.keptFrom = 0;
  }

  private pick(): number {
    const r = this.rnd();
    return PICK.find(([p]) => r < p)![1];
  }

  private generate(): void {
    const kmh = this.pick();
    const len = (1 + this.rnd() * 2) * KM_PX; // 1–3 km
    const gap = (1.5 + this.rnd() * 2.5) * KM_PX;
    const d = brakeDistance(LINE_KMH, kmh);
    let s = this.cursor + gap;
    // odcinek szlakowy nie wchodzi w strefę stacji (tarcza, semafor, peron, W 8 stacji)
    for (let guard = 0; guard < 20; guard++) {
      const near = this.stationsIn(s - d - STATION_PAD_PX, s + len + STATION_APPROACH_PX + STATION_PAD_PX);
      const hit = near.find(
        (st) => s - d < st.endX + STATION_PAD_PX && s + len > st.semX - STATION_APPROACH_PX - STATION_PAD_PX,
      );
      if (!hit) break;
      s = hit.endX + STATION_PAD_PX + d;
    }
    this.open.push({ startX: s, endX: s + len, kmh, station: false });
    this.cursor = s + len;
  }

  /** Odcinki (szlakowe i stacyjne) w pobliżu [x0, x1], rosnąco po początku. */
  near(x0: number, x1: number): Zone[] {
    if (x0 - KEEP_BEHIND_PX < this.keptFrom) this.reset();
    while (this.cursor < x1 + KM_PX) this.generate();
    const limit = x0 - KEEP_BEHIND_PX;
    if (limit > this.keptFrom) {
      let n = 0;
      while (n < this.open.length && this.open[n].endX < limit) n++;
      this.open.splice(0, n);
      this.keptFrom = limit;
    }
    const out = this.open.filter((z) => z.endX >= x0 && z.startX <= x1);
    for (const st of this.stationsIn(x0, x1 + STATION_APPROACH_PX)) {
      out.push({ startX: st.semX, endX: st.endX, kmh: stationKmh(this.seed, st.index), station: true });
    }
    return out.sort((a, b) => a.startX - b.startX);
  }
}
