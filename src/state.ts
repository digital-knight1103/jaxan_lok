// Jedno źródło prawdy dla sceny i HUD.
import { DEFAULT_WAGONS, START_KMH } from './config';

export interface AppState {
  running: boolean;
  targetKmh: number;
  kmh: number;
  muted: boolean;
  horn: boolean;
  dayAuto: boolean;
  wagons: number;
  hudVisible: boolean;
  /** Jazda automatyczna (sama respektuje semafory); false = prowadzi użytkownik. */
  autoDrive: boolean;
}

export function initialState(): AppState {
  return {
    running: true,
    targetKmh: START_KMH,
    kmh: START_KMH,
    muted: true,
    horn: false,
    dayAuto: true,
    wagons: DEFAULT_WAGONS,
    hudVisible: true,
    autoDrive: true,
  };
}
