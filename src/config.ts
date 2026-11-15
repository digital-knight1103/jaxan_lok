// Stałe globalne sceny – jedno miejsce do strojenia.

/** Rozdzielczość wewnętrzna bufora (piksele gry). */
export const W = 640;
export const H = 360;

/** Górna krawędź szyny – ok. 62% wysokości kadru. */
export const TRACK_Y = 223;

/** Pozycja przodu lokomotywy na ekranie (lekko na lewo od środka). */
export const TRAIN_X = 230;

/** Prędkości (km/h). */
export const MAX_KMH = 120;
export const START_KMH = 80;
export const SPEED_STEP_KMH = 10;

/** Skala wizualna: 120 km/h ≈ 200 px/s warstwy toru. */
export const PX_PER_KMH = 200 / 120;

/** Bezczynność (ms). */
export const CURSOR_HIDE_MS = 3000;
export const HUD_HIDE_MS = 4000;
export const AUTO_RESUME_MS = 180_000;

/** Cykl dobowy (s). */
export const DAY_LENGTH_S = 480;
export const NIGHT_TOGGLE_S = 3;

/**
 * Odstęp (pola, lasy) między lokalizacjami trasy (px świata). Przy 100 km/h (≈167 px/s)
 * kolejna lokalizacja pojawia się co ok. 2,3–2,6 min.
 */
export const LANDMARK_SPACING_PX = 22000;

/** Domyślna liczba wagonów. */
export const DEFAULT_WAGONS = 6;

/** Ziarno generatora trasy. */
export const ROUTE_SEED = 20261114;

/**
 * Poziomy dźwięku – wszystkie w jednym miejscu (0..1 to wzmocnienie GainNode).
 * Silniki trakcyjne celowo ciche i stłumione filtrem – mają być „pod spodem".
 */
export const AUDIO = {
  /** Silniki: głośność na postoju / bazowa w ruchu / przyrost do 120 km/h. */
  motorIdle: 0.006,
  motorBase: 0.02,
  motorPerSpeed: 0.028,
  /** Udział wysokiego „gwizdu" falownika w miksie silnika. */
  motorWhineMix: 0.06,
  /** Filtr dolnoprzepustowy silnika (Hz): baza + przyrost na km/h. */
  motorLowpassBase: 180,
  motorLowpassPerKmh: 3,
  /** Wysokość tonu (Hz): niski szum i gwizd – rośnie łagodnie. */
  motorPitchBase: 35,
  motorPitchPerKmh: 0.35,
  whinePitchBase: 120,
  whinePitchPerKmh: 2.2,
  /** Stukot kół na złączach: baza + przyrost z prędkością. */
  clackBase: 0.18,
  clackPerSpeed: 0.12,
  /** Klakson (dwutonowy). */
  horn: 0.16,
  /** Pisk hamulców. */
  squealBase: 0.01,
  squealRange: 0.025,
  /** Alarm RADIOSTOP (przejechanie sygnału STÓJ). */
  radiostop: 0.07,
  /** Szum deszczu przy pełnym opadzie (cichy, w tle). */
  rain: 0.05,
  /** Przelot pociągu z naprzeciwka (szczyt szumu). */
  passby: 0.09,
  /** Dzwonek sygnalizatora przejazdowego (cichy). */
  bell: 0.02,
} as const;
