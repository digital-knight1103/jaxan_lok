// Szybki przejazd do punktu trasy: 1) krajobraz „mknie" z rozmyciem ruchu i ściemnia
// się, 2) przeskok, 3) rozjaśnienie i dojazd z hamowaniem – pociąg staje dokładnie
// w celu. Czas stały niezależnie od odległości. Dojazd zawsze do przodu.
import { MAX_KMH, PX_PER_KMH } from '../config';

export const TRAVEL = {
  /** Faza „mknięcia" i ściemnienia (s). */
  outS: 0.5,
  /** Faza dojazdu z hamowaniem (s). */
  inS: 3,
  /** Odcinek dojazdu przed celem (px). */
  runupPx: 260,
  /** Prędkość przewijania w fazie „mknięcia" (px/s). */
  rushPxS: 2400,
  /** Czas rozjaśniania na początku dojazdu (s). */
  fadeInS: 0.45,
};

export type TravelPhase = 'out' | 'in';

export interface TravelFrame {
  worldX: number;
  kmh: number;
  /** 0..1 – ściemnienie ekranu. */
  fade: number;
  /** 0..1 – siła rozmycia ruchu. */
  blur: number;
  phase: TravelPhase;
  done: boolean;
}

export class TravelAnim {
  active = false;
  private phase: TravelPhase = 'out';
  private t = 0;
  private target = 0;
  private dir = 1;

  start(fromX: number, toX: number): void {
    this.active = true;
    this.phase = 'out';
    this.t = 0;
    this.target = toX;
    this.dir = toX >= fromX ? 1 : -1;
  }

  update(dt: number, worldX: number): TravelFrame {
    if (!this.active) return { worldX, kmh: 0, fade: 0, blur: 0, phase: 'in', done: true };
    this.t += dt;
    const R = TRAVEL.runupPx;
    if (this.phase === 'out') {
      const u = Math.min(1, this.t / TRAVEL.outS);
      if (u >= 1) {
        // przeskok: start dojazdu tuż przed celem
        this.phase = 'in';
        this.t = 0;
        return { worldX: this.target - R, kmh: this.arrivalKmh(0), fade: 1, blur: 0, phase: 'in', done: false };
      }
      return {
        worldX: worldX + this.dir * TRAVEL.rushPxS * u * dt,
        kmh: MAX_KMH,
        fade: u,
        blur: u,
        phase: 'out',
        done: false,
      };
    }
    const u = Math.min(1, this.t / TRAVEL.inS);
    const fade = Math.max(0, 1 - this.t / TRAVEL.fadeInS);
    if (u >= 1) {
      this.active = false;
      return { worldX: this.target, kmh: 0, fade: 0, blur: 0, phase: 'in', done: true };
    }
    // jednostajne hamowanie: x = cel − R·(1−u)²
    return { worldX: this.target - R * (1 - u) ** 2, kmh: this.arrivalKmh(u), fade, blur: 0, phase: 'in', done: false };
  }

  /** Prędkość dojazdu (km/h) – pochodna toru x(u). */
  private arrivalKmh(u: number): number {
    return (2 * TRAVEL.runupPx * (1 - u)) / TRAVEL.inS / PX_PER_KMH;
  }
}
