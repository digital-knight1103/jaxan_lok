// Pogoda – czysta logika (bez rysowania): rodzaj docelowy + płynne poziomy zachmurzenia,
// deszczu, śniegu i mgły (przejścia ~20 s). Tryb AUTO zmienia pogodę sam co kilka–kilkanaście minut:
// pogodnie → pochmurno → deszcz → pogodnie, rzadziej pochmurno → śnieg, rano czasem pogodnie → mgła.
// Wybór ręczny trzyma pogodę do powrotu na AUTO. Nie wpływa na fizykę jazdy.

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog';
/** Wybór użytkownika: AUTO albo konkretna pogoda. */
export type WeatherChoice = 'auto' | WeatherKind;

/** Czas płynnego przejścia między pogodami (s). */
export const WEATHER_FADE_S = 20;
/** Czas trwania jednej pogody w automacie (s). */
export const WEATHER_HOLD_MIN_S = 180;
export const WEATHER_HOLD_MAX_S = 600;
/** Szanse automatu: śnieg zamiast deszczu po pochmurnej pogodzie; mgła zamiast pochmurnej, gdy po pogodnym jest ranek. Zależą od pory roku. */
export interface Climate { snow: number; fog: number }
const DEFAULT_CLIMATE: Climate = { snow: 0.15, fog: 0.4 };

const TARGET: Record<WeatherKind, { cloud: number; rain: number; snow: number; fog: number }> = {
  clear: { cloud: 0, rain: 0, snow: 0, fog: 0 },
  cloudy: { cloud: 0.7, rain: 0, snow: 0, fog: 0 },
  rain: { cloud: 1, rain: 1, snow: 0, fog: 0 },
  snow: { cloud: 0.85, rain: 0, snow: 1, fog: 0 },
  fog: { cloud: 0.3, rain: 0, snow: 0, fog: 1 },
};
/** Kolejność przełączania klawiszem W (po śniegu wraca AUTO). */
export const CHOICES: WeatherChoice[] = ['auto', 'clear', 'cloudy', 'rain', 'fog', 'snow'];

const toward = (v: number, to: number, step: number) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));

export class Weather {
  kind: WeatherKind = 'clear';
  /** Poziomy 0..1 (płynnie dążą do wartości docelowych rodzaju). */
  cloud = 0;
  rain = 0;
  snow = 0;
  fog = 0;
  /** true = pogoda zmienia się sama; false = trzymana ręcznie. */
  auto = true;
  private hold: number;

  constructor(private rnd: () => number = Math.random) {
    this.hold = this.newHold();
  }

  private newHold(): number {
    return WEATHER_HOLD_MIN_S + this.rnd() * (WEATHER_HOLD_MAX_S - WEATHER_HOLD_MIN_S);
  }

  /** Bieżący wybór (do HUD): AUTO albo ręcznie ustawiona pogoda. */
  get choice(): WeatherChoice {
    return this.auto ? 'auto' : this.kind;
  }

  /** Ustawia pogodę (przejście płynne) i restartuje odliczanie automatu. */
  set(kind: WeatherKind): void {
    this.kind = kind;
    this.hold = this.newHold();
  }

  /** Ręczny wybór pogody – automat przestaje ją zmieniać. */
  setManual(kind: WeatherKind): void {
    this.auto = false;
    this.set(kind);
  }

  /** Powrót do automatycznych zmian (obecna pogoda dogrywa swój czas). */
  setAuto(): void {
    this.auto = true;
    this.hold = this.newHold();
  }

  /** Wybór z menu HUD. */
  choose(c: WeatherChoice): void {
    if (c === 'auto') this.setAuto();
    else this.setManual(c);
  }

  /** Kolejny wybór (klawisz W): AUTO → pogodnie → pochmurno → deszcz → mgła → śnieg → AUTO. */
  cycle(): void {
    this.choose(CHOICES[(CHOICES.indexOf(this.choice) + 1) % CHOICES.length]);
  }

  /** Następna pogoda w automacie. */
  private nextAuto(morning: boolean, climate: Climate): WeatherKind {
    switch (this.kind) {
      case 'clear': return morning && this.rnd() < climate.fog ? 'fog' : 'cloudy';
      case 'cloudy': return this.rnd() < climate.snow ? 'snow' : 'rain';
      default: return 'clear';
    }
  }

  /** morning: pora, w której automat może wywołać mgłę (rano). */
  update(dt: number, morning = false, climate: Climate = DEFAULT_CLIMATE): void {
    if (this.auto) {
      this.hold -= dt;
      if (this.hold <= 0) this.set(this.nextAuto(morning, climate));
    }
    const t = TARGET[this.kind];
    const step = dt / WEATHER_FADE_S;
    this.cloud = toward(this.cloud, t.cloud, step);
    this.rain = toward(this.rain, t.rain, step);
    this.snow = toward(this.snow, t.snow, step);
    this.fog = toward(this.fog, t.fog, step);
  }
}
