// Fizyka jazdy: prędkość dąży do zadanej z ograniczonym przyspieszeniem/opóźnieniem
// (bezwładność ciężkiego składu). Jednostki: km/h i sekundy.
import { MAX_KMH, SPEED_STEP_KMH } from '../config';

/** Przyspieszenie składu (km/h na sekundę). */
export const ACCEL_KMH_S = 3;
/** Opóźnienie przy hamowaniu (km/h na sekundę). */
export const BRAKE_KMH_S = 6;

/** Jeden krok prędkości w stronę celu – liniowo, więc niezależny od FPS. */
export function stepSpeed(kmh: number, targetKmh: number, dt: number): number {
  if (kmh < targetKmh) return Math.min(targetKmh, kmh + ACCEL_KMH_S * dt);
  if (kmh > targetKmh) return Math.max(targetKmh, Math.max(0, kmh - BRAKE_KMH_S * dt));
  return kmh;
}

/** Zmiana prędkości zadanej o jeden krok (dir = +1 / -1), w granicach 0..MAX_KMH. */
export function adjustTarget(target: number, dir: number): number {
  return Math.min(MAX_KMH, Math.max(0, target + Math.sign(dir) * SPEED_STEP_KMH));
}
