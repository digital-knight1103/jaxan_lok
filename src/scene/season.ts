// Pory roku – czysta logika (bez rysowania). Cztery pory zmieniają się same co SEASON_LENGTH_PX
// przejechanej drogi (kilka pętli trasy), płynne przejście ~30 s; wybór ręczny (P) przełącza
// szybko (kilka sekund). Zależności: długość dnia, szanse na śnieg/mgłę w pogodzie AUTO.
// `look` – wspólny stan „wyglądu" odczytywany przy rysowaniu sprite'ów i segmentów.

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonChoice = 'auto' | Season;

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export const CHOICES: SeasonChoice[] = ['auto', 'spring', 'summer', 'autumn', 'winter'];

/** Czas płynnego przejścia w trybie AUTO (s) i przy ręcznym wyborze (s). */
export const SEASON_FADE_S = 30;
export const SEASON_MANUAL_FADE_S = 4;
/** Droga (px świata) jednej pory: ~2 pętle trasy (pętla = 3 lokalizacje po 22000 px). */
export const SEASON_LENGTH_PX = 132000;
/** Liczba stopni mieszania kolorów (każdy stopień = ponowny render widocznych segmentów). */
export const SEASON_STEPS = 6;

/** Przesunięcie progu nocy względem słońca: zimą dzień krótszy, latem dłuższy. */
const DAY_BIAS: Record<Season, number> = { spring: 0, summer: -0.06, autumn: 0.06, winter: 0.16 };

/** Parametry pogody AUTO zależne od pory: szansa na śnieg (zamiast deszczu) i na poranną mgłę. */
const CLIMATE: Record<Season, { snow: number; fog: number }> = {
  spring: { snow: 0.06, fog: 0.35 },
  summer: { snow: 0, fog: 0.2 },
  autumn: { snow: 0, fog: 0.75 },
  winter: { snow: 0.75, fog: 0.4 },
};

export class SeasonClock {
  from: Season;
  to: Season;
  /** 0 = from … 1 = to. */
  mix = 1;
  auto = true;
  private fadeS = SEASON_FADE_S;
  private nextChangeX: number;
  private lastX = 0;

  constructor(start: Season = 'summer') {
    this.from = this.to = start;
    this.nextChangeX = SEASON_LENGTH_PX;
  }

  /** Wybór do HUD: AUTO albo ręcznie ustawiona pora. */
  get choice(): SeasonChoice {
    return this.auto ? 'auto' : this.to;
  }

  /** Pora dominująca (strukturalne elementy: drzewa bezlistne, kwiaty, pola). */
  get current(): Season {
    return this.mix >= 0.5 ? this.to : this.from;
  }

  /** Udział pory w obecnym wyglądzie 0..1 (płynnie w przejściu). */
  weight(s: Season): number {
    if (this.from === this.to) return s === this.to ? 1 : 0;
    return (s === this.to ? this.mix : 0) + (s === this.from ? 1 - this.mix : 0);
  }

  /** Mieszanie 0..SEASON_STEPS (stopnie koloru). */
  get step(): number {
    return Math.round(this.mix * SEASON_STEPS);
  }

  /** Klucz wyglądu – zmienia się, gdy trzeba przemalować widoczne segmenty. */
  get key(): string {
    return this.from === this.to ? this.to : `${this.from}>${this.to}:${this.step}`;
  }

  /** Przesunięcie progu nocy (patrz DayCycle). */
  get dayBias(): number {
    return SEASONS.reduce((s, k) => s + this.weight(k) * DAY_BIAS[k], 0);
  }

  /** Szanse zmian pogody AUTO przy obecnej porze. */
  get climate(): { snow: number; fog: number } {
    return {
      snow: SEASONS.reduce((s, k) => s + this.weight(k) * CLIMATE[k].snow, 0),
      fog: SEASONS.reduce((s, k) => s + this.weight(k) * CLIMATE[k].fog, 0),
    };
  }

  private begin(to: Season, fadeS: number): void {
    if (to === this.to && this.mix >= 1) return;
    // przejście w trakcie przejścia: zaczynamy od pory dominującej
    this.from = this.current;
    this.to = to;
    this.mix = this.from === to ? 1 : 0;
    this.fadeS = fadeS;
  }

  /** Ustawia porę natychmiast, bez przejścia (parametr ?season=). */
  jump(s: Season): void {
    this.auto = false;
    this.from = this.to = s;
    this.mix = 1;
  }

  setManual(s: Season): void {
    this.auto = false;
    this.begin(s, SEASON_MANUAL_FADE_S);
  }

  setAuto(): void {
    this.auto = true;
    this.nextChangeX = this.lastX + SEASON_LENGTH_PX;
  }

  choose(c: SeasonChoice): void {
    if (c === 'auto') this.setAuto();
    else this.setManual(c);
  }

  /** Klawisz P: AUTO → wiosna → lato → jesień → zima → AUTO. */
  cycle(): void {
    this.choose(CHOICES[(CHOICES.indexOf(this.choice) + 1) % CHOICES.length]);
  }

  /** worldX – przejechana droga (px); dt – czas klatki (s). */
  update(dt: number, worldX: number): void {
    this.lastX = worldX;
    if (this.auto && worldX >= this.nextChangeX) {
      this.nextChangeX += SEASON_LENGTH_PX;
      this.begin(SEASONS[(SEASONS.indexOf(this.to) + 1) % SEASONS.length], SEASON_FADE_S);
    }
    if (this.mix < 1) this.mix = Math.min(1, this.mix + dt / this.fadeS);
  }
}

/** Wygląd odczytywany przy rysowaniu (ustawiany z SeasonClock co klatkę). */
export const look = {
  /** Pora strukturalna: kształty (drzewa, pola, śnieg na gałęziach). */
  season: 'summer' as Season,
  from: 'summer' as Season,
  to: 'summer' as Season,
  /** Stopień przebarwienia 0..SEASON_STEPS (from → to). */
  step: SEASON_STEPS,
  /** Zmienia się wraz z kluczem wyglądu – segmenty z innym numerem są przemalowywane. */
  epoch: 0,
  key: 'summer',
};

/** Przepisuje stan zegara do `look`; zwraca true, gdy wygląd się zmienił. */
export function syncLook(c: SeasonClock): boolean {
  look.season = c.current;
  look.from = c.from;
  look.to = c.to;
  look.step = c.from === c.to ? SEASON_STEPS : c.step;
  const k = c.key;
  if (k === look.key) return false;
  look.key = k;
  look.epoch++;
  return true;
}
