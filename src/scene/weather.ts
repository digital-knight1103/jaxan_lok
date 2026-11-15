// Pogoda – czysta logika (bez rysowania): rodzaj docelowy + płynne poziomy zachmurzenia,
// deszczu i śniegu (przejścia ~20 s). Zmienia się sama co kilka–kilkanaście minut:
// pogodnie → pochmurno → deszcz → pogodnie, rzadziej pochmurno → śnieg. Nie wpływa na fizykę jazdy.

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow';

/** Czas płynnego przejścia między pogodami (s). */
export const WEATHER_FADE_S = 20;
/** Czas trwania jednej pogody w automacie (s). */
export const WEATHER_HOLD_MIN_S = 180;
export const WEATHER_HOLD_MAX_S = 600;
/** Szansa na śnieg zamiast deszczu po pochmurnej pogodzie. */
const SNOW_CHANCE = 0.15;

const TARGET: Record<WeatherKind, { cloud: number; rain: number; snow: number }> = {
  clear: { cloud: 0, rain: 0, snow: 0 },
  cloudy: { cloud: 0.7, rain: 0, snow: 0 },
  rain: { cloud: 1, rain: 1, snow: 0 },
  snow: { cloud: 0.85, rain: 0, snow: 1 },
};
/** Kolejność ręcznego przełączania klawiszem W. */
const MANUAL: WeatherKind[] = ['clear', 'cloudy', 'rain', 'snow'];

const toward = (v: number, to: number, step: number) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));

export class Weather {
  kind: WeatherKind = 'clear';
  /** Poziomy 0..1 (płynnie dążą do wartości docelowych rodzaju). */
  cloud = 0;
  rain = 0;
  snow = 0;
  private hold: number;

  constructor(private rnd: () => number = Math.random) {
    this.hold = this.newHold();
  }

  private newHold(): number {
    return WEATHER_HOLD_MIN_S + this.rnd() * (WEATHER_HOLD_MAX_S - WEATHER_HOLD_MIN_S);
  }

  /** Ustawia pogodę (przejście płynne) i restartuje odliczanie automatu. */
  set(kind: WeatherKind): void {
    this.kind = kind;
    this.hold = this.newHold();
  }

  /** Ręczne przełączenie na kolejną pogodę (klawisz W). */
  next(): void {
    this.set(MANUAL[(MANUAL.indexOf(this.kind) + 1) % MANUAL.length]);
  }

  /** Następna pogoda w automacie. */
  private auto(): WeatherKind {
    switch (this.kind) {
      case 'clear': return 'cloudy';
      case 'cloudy': return this.rnd() < SNOW_CHANCE ? 'snow' : 'rain';
      default: return 'clear';
    }
  }

  update(dt: number): void {
    this.hold -= dt;
    if (this.hold <= 0) this.set(this.auto());
    const t = TARGET[this.kind];
    const step = dt / WEATHER_FADE_S;
    this.cloud = toward(this.cloud, t.cloud, step);
    this.rain = toward(this.rain, t.rain, step);
    this.snow = toward(this.snow, t.snow, step);
  }
}
