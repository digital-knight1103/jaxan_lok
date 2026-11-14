// Semafory przed stacjami – czysta logika (bez rysowania).
// Przed każdą stacją: tarcza ostrzegawcza 1 km przed semaforem wjazdowym, semafor tuż
// przed peronem. Sygnał losowany przy zbliżaniu się pociągu; czerwone po 5–15 s
// (odliczanych, gdy pociąg jest blisko albo stoi) zmienia się na zielone/pomarańczowe.
// Wszystkie pozycje w px świata; „front" = x czoła lokomotywy.
import { PX_PER_KMH } from '../config';
import { KM_PX } from '../scene/routeindex';

export type Aspect = 'green' | 'orange' | 'red';
/** Tarcza ostrzegawcza (PKP Os1–Os3): pomarańczowe = semafor „stój", zielone migające = „zwolnij", zielone = „wolna". */
export type WarnAspect = 'green' | 'greenBlink' | 'orange' | 'off';

/** Prędkość przy sygnale pomarańczowym (km/h). */
export const SLOW_KMH = 40;
/** Semafor stoi tyle px przed początkiem stacji. */
export const SEM_BEFORE_STATION_PX = 40;
/** Pociąg w automacie staje tyle px przed semaforem „stój". */
export const STOP_GAP_PX = 30;
/** Sygnał losowany, gdy czoło jest tyle px przed tarczą ostrzegawczą. */
export const DECIDE_AHEAD_PX = 900;
/** Czerwone odlicza czas, gdy pociąg jest bliżej semafora niż tyle px (albo stoi). */
export const RED_HOLD_PX = 600;
/** Planowane opóźnienie automatu (km/h/s) – mniejsze niż BRAKE_KMH_S, z zapasem. */
const PLAN_DECEL_KMH_S = 4.5;
/** Po minięciu końca stacji o tyle px stan sygnału jest zapominany. */
const FORGET_PX = 1000;

/** Stacja z semaforami (z indeksu trasy). */
export interface StationRef {
  index: number;
  startX: number;
  width: number;
}

export interface SignalPost {
  /** Numer segmentu stacji na trasie. */
  id: number;
  warnX: number;
  semX: number;
  /** Koniec stacji – do tego miejsca obowiązuje ograniczenie 40 km/h. */
  endX: number;
  /** null = jeszcze nie wylosowany (pociąg daleko). */
  aspect: Aspect | null;
  /** Pozostały czas czerwonego (s). */
  redLeft: number;
  /** Czoło minęło już semafor (przejechanie liczone tylko raz). */
  passed: boolean;
}

export interface NearestSignal {
  kind: 'warn' | 'sem';
  /** Odległość czoła od sygnału (px). */
  dist: number;
  post: SignalPost;
}

export function warnAspect(a: Aspect | null): WarnAspect {
  if (a === null) return 'off';
  return a === 'red' ? 'orange' : a === 'orange' ? 'greenBlink' : 'green';
}

/** Prędkość (km/h), z której da się wyhamować na drodze d px do prędkości v0. */
function brakeCurve(d: number, v0: number): number {
  return Math.sqrt(v0 * v0 + (2 * PLAN_DECEL_KMH_S * Math.max(0, d)) / PX_PER_KMH);
}

/** Górne ograniczenie prędkości dla jazdy automatycznej przy danym semaforze (Infinity = brak). */
export function autoSpeedCap(front: number, p: Pick<SignalPost, 'semX' | 'endX' | 'aspect'>): number {
  if (p.aspect === 'red') {
    if (front >= p.semX) return Infinity; // już za semaforem – nie dotyczy
    const d = p.semX - STOP_GAP_PX - front;
    return d < 1 ? 0 : brakeCurve(d, 0);
  }
  if (p.aspect === 'orange') {
    if (front >= p.endX) return Infinity;
    if (front >= p.semX) return SLOW_KMH;
    return brakeCurve(p.semX - front, SLOW_KMH);
  }
  return Infinity;
}

export class SignalSystem {
  posts: SignalPost[] = [];

  constructor(private rnd: () => number = Math.random) {}

  /** Uzgadnia listę semaforów ze stacjami w pobliżu pociągu. */
  sync(stations: StationRef[], front: number): void {
    const ids = new Set(stations.map((s) => s.index));
    this.posts = this.posts.filter((p) => ids.has(p.id) && front <= p.endX + FORGET_PX);
    for (const s of stations) {
      if (this.posts.some((p) => p.id === s.index)) continue;
      if (front > s.startX + s.width + FORGET_PX) continue;
      const semX = s.startX - SEM_BEFORE_STATION_PX;
      this.posts.push({
        id: s.index, semX, warnX: semX - Math.round(KM_PX), endX: s.startX + s.width,
        aspect: null, redLeft: 0, passed: front >= semX,
      });
    }
    this.posts.sort((a, b) => a.semX - b.semX);
  }

  private decide(): Aspect {
    const r = this.rnd();
    return r < 0.5 ? 'green' : r < 0.8 ? 'orange' : 'red';
  }

  update(front: number, kmh: number, dt: number): void {
    for (const p of this.posts) {
      if (p.aspect === null && front >= p.warnX - DECIDE_AHEAD_PX && front < p.endX) {
        p.aspect = this.decide();
        if (p.aspect === 'red') p.redLeft = 5 + this.rnd() * 10;
      }
      if (p.aspect === 'red' && front < p.semX && (front >= p.semX - RED_HOLD_PX || kmh < 1)) {
        p.redLeft -= dt;
        if (p.redLeft <= 0) p.aspect = this.rnd() < 0.6 ? 'green' : 'orange';
      }
    }
  }

  /** Najbardziej restrykcyjne ograniczenie automatu ze wszystkich semaforów. */
  cap(front: number): number {
    let c = Infinity;
    for (const p of this.posts) c = Math.min(c, autoSpeedCap(front, p));
    return c;
  }

  /** true, jeśli czoło właśnie minęło semafor wskazujący „stój" (każdy liczony raz). */
  checkSpad(prevFront: number, front: number): boolean {
    let spad = false;
    for (const p of this.posts) {
      if (p.passed || prevFront >= p.semX || front < p.semX) continue;
      p.passed = true;
      if (p.aspect === 'red') spad = true;
    }
    return spad;
  }

  /** Oznacza semafory jako minięte bez kar (szybki przejazd z mapy). */
  skip(front: number): void {
    for (const p of this.posts) if (front >= p.semX) p.passed = true;
  }

  /** Najbliższy sygnał przed czołem pociągu (do podglądu w HUD). */
  nearest(front: number): NearestSignal | null {
    for (const p of this.posts) {
      if (front < p.warnX) return { kind: 'warn', dist: Math.round(p.warnX - front), post: p };
      if (front < p.semX) return { kind: 'sem', dist: Math.round(p.semX - front), post: p };
    }
    return null;
  }
}
