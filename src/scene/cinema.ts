// Tryb kinowy – kamera: powolne przybliżanie i oddalanie, czasem przesunięcie wzdłuż składu.
// Czysta logika (bez rysowania): zwraca prostokąt bufora 640×360 do wyświetlenia na ekranie.
// Wejście/wyjście płynne (k 0..1); wyjście szybsze niż wejście.
import { W, H, TRACK_Y } from '../config';

/** Okres jednego przybliżenia i oddalenia (s). */
export const ZOOM_PERIOD_S = 80;
/** Okres przesuwania się wzdłuż składu (s). */
export const PAN_PERIOD_S = 150;
/** Największe przybliżenie. */
export const ZOOM_MAX = 1.3;
/** Czasy płynnego wejścia / wyjścia (s). */
const IN_S = 3;
const OUT_S = 1;

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class CinemaCam {
  /** Udział trybu kinowego 0..1 (0 = zwykły kadr). */
  k = 0;
  private t = 0;

  update(dt: number, active: boolean): void {
    if (active) {
      this.t += dt;
      this.k = Math.min(1, this.k + dt / IN_S);
    } else {
      this.k = Math.max(0, this.k - dt / OUT_S);
      if (this.k === 0) this.t = 0; // następne wejście zaczyna od szerokiego kadru
    }
  }

  /** Prostokąt źródłowy w buforze (zawsze mieści się w 0..W × 0..H, proporcje 16:9). */
  view(): View {
    if (this.k <= 0) return { x: 0, y: 0, w: W, h: H };
    const k = smooth(this.k);
    // zoom startuje od 1 (cos), więc wejście jest płynne
    const zoomWave = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.t) / ZOOM_PERIOD_S);
    const z = 1 + (ZOOM_MAX - 1) * zoomWave * k;
    const w = W / z;
    const h = H / z;
    // ostrość kadru: środek ekranu → pociąg; pan od lokomotywy ku tyłowi składu i z powrotem
    const pan = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.t) / PAN_PERIOD_S);
    const fx = lerp(W / 2, lerp(330, 150, pan), k);
    const fy = lerp(H / 2, TRACK_Y - 18, k);
    return {
      x: Math.max(0, Math.min(W - w, fx - w / 2)),
      y: Math.max(0, Math.min(H - h, fy - h / 2)),
      w,
      h,
    };
  }
}
