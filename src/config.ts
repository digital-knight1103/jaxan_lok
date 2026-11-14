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

/** Odstęp między punktami charakterystycznymi trasy (px świata). */
export const LANDMARK_SPACING_PX = 20000;

/** Domyślna liczba wagonów. */
export const DEFAULT_WAGONS = 6;

/** Ziarno generatora trasy. */
export const ROUTE_SEED = 20261114;
