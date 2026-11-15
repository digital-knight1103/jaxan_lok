// Przejazdy kolejowo-drogowe – czysta logika (bez rysowania): kiedy włączają się światła,
// kiedy opadają i podnoszą się rogatki oraz jak zachowują się czekające samochody.
// Pozycje: x świata. Nasz skład jedzie w prawo (przód > ogon), pociągi z naprzeciwka w lewo.

/** Ostrzeżenie: odległość przed przejazdem, od której świecą światła (px świata). */
export const WARN_PX = 900;
/** Rogatki podnoszą się, gdy ogon minie przejazd o tyle px. */
export const CLEAR_PX = 160;
/** Światła migają tyle sekund przed opadaniem rogatek. */
export const LIGHT_LEAD_S = 1.6;
/** Czas opadania / podnoszenia rogatek (s). */
export const BARRIER_S = 2.2;

export interface Extent { front: number; tail: number; dir: 1 | -1 }

/** Czy skład zajmuje przejazd (zbliża się, jedzie przez niego albo dopiero go opuszcza). */
export function occupies(cx: number, e: Extent): boolean {
  if (e.dir === 1) return e.front > cx - WARN_PX && e.tail < cx + CLEAR_PX;
  return e.front < cx + WARN_PX && e.tail > cx - CLEAR_PX;
}

export type CarKind = 'car' | 'tractor' | 'truck';

export interface Vehicle {
  kind: CarKind;
  /** Indeks koloru/odmiany. */
  tone: number;
  /** y stóp pojazdu na ekranie (maleje: jedzie w głąb sceny, od widza). */
  y: number;
  v: number;
}

/** Linia zatrzymania przed rogatką (y ekranu). */
export const STOP_Y = 250;
/** Pojazd, który minął tę linię, przejeżdża mimo rogatek. */
const COMMITTED_Y = STOP_Y - 6;
/** Pojazd znika za horyzontem drogi. */
export const GONE_Y = 190;
const SPEED = 62;
const GAP = 8;
/** Długość pojazdu w perspektywie (px y) wg rodzaju. */
const LEN: Record<CarKind, number> = { car: 20, tractor: 20, truck: 26 };

export class Crossing {
  lights = false;
  /** Rogatki: 0 = podniesione … 1 = opuszczone. */
  down = 0;
  /** Czas migania świateł (s). */
  flash = 0;
  private lead = 0;
  cars: Vehicle[] = [];
  private idle: number;

  constructor(private rnd: () => number = Math.random) {
    this.idle = 4 + rnd() * 10;
  }

  /** Rogatki podniesione i światła zgaszone. */
  get open(): boolean {
    return !this.lights && this.down === 0;
  }

  /** Droga zamknięta dla aut, które jeszcze nie minęły linii zatrzymania. */
  get blocked(): boolean {
    return this.lights || this.down > 0.02;
  }

  private newVehicle(y: number): Vehicle {
    const r = this.rnd();
    const kind: CarKind = r < 0.7 ? 'car' : r < 0.85 ? 'tractor' : 'truck';
    return { kind, tone: Math.floor(this.rnd() * 6), y, v: 0 };
  }

  /** occupied – pociąg zbliża się/jedzie; near – przejazd jest w pobliżu kadru (symulujemy ruch aut). */
  update(dt: number, occupied: boolean, near = true): void {
    const wasLit = this.lights;
    if (occupied) {
      if (!this.lights) { this.lights = true; this.lead = 0; }
      this.lead += dt;
      if (this.lead >= LIGHT_LEAD_S) this.down = Math.min(1, this.down + dt / BARRIER_S);
    } else {
      this.down = Math.max(0, this.down - dt / BARRIER_S);
      if (this.down === 0) { this.lights = false; this.lead = 0; }
    }
    if (this.lights) this.flash += dt; else this.flash = 0;
    if (!near) { this.cars = []; return; }

    // nowe auta: po włączeniu świateł dojeżdża kolejka 1–3, a przy otwartym przejeździe od czasu do czasu przejeżdża pojedyncze
    const behind = Math.max(STOP_Y + 40, ...this.cars.map((c) => c.y + 40));
    if (!wasLit && this.lights) {
      const n = 1 + Math.floor(this.rnd() * 3);
      for (let i = 0; i < n; i++) this.cars.push(this.newVehicle(behind + 130 + i * 56));
    }
    this.idle -= dt;
    if (this.idle <= 0) {
      this.idle = 9 + this.rnd() * 16;
      if (this.open && this.cars.length < 2) this.cars.push(this.newVehicle(380));
    }

    // ruch: od najbliższego przejazdu (najmniejsze y) ku widzowi
    this.cars.sort((a, b) => a.y - b.y);
    this.cars.forEach((c, i) => {
      const lead = this.cars[i - 1];
      let stop = -Infinity; // brak przeszkody
      if (lead) stop = lead.y + LEN[lead.kind] + GAP;
      if (this.blocked && c.y >= COMMITTED_Y) stop = Math.max(stop, STOP_Y);
      const room = c.y - stop;
      const want = room <= 0 ? 0 : Math.min(SPEED, room * 4);
      c.v += (want - c.v) * Math.min(1, dt * 5);
      c.y -= c.v * dt;
      if (c.y < stop) { c.y = stop; c.v = 0; } // nie wjeżdżaj w poprzedni pojazd ani w rogatkę
    });
    this.cars = this.cars.filter((c) => c.y > GONE_Y);
  }
}

/** Zbiór stanów przejazdów po indeksie segmentu. */
export class Crossings {
  private map = new Map<number, Crossing>();

  constructor(private rnd: () => number = Math.random) {}

  get(index: number): Crossing {
    let c = this.map.get(index);
    if (!c) this.map.set(index, (c = new Crossing(this.rnd)));
    return c;
  }

  /** Zapomina przejazdy spoza listy aktywnych (pamięć stała). */
  keepOnly(indices: Set<number>): void {
    for (const k of this.map.keys()) if (!indices.has(k)) this.map.delete(k);
  }
}
