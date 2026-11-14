import { describe, it, expect } from 'vitest';
import {
  SignalSystem, autoSpeedCap, warnAspect, SLOW_KMH, STOP_GAP_PX, DECIDE_AHEAD_PX, RED_HOLD_PX,
  type StationRef,
} from '../src/train/signals';
import { stepSpeed } from '../src/train/physics';
import { PX_PER_KMH } from '../src/config';
import { KM_PX } from '../src/scene/routeindex';

/** Generator „losowy" z kolejki wartości (powtarza ostatnią). */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};

const ST: StationRef = { index: 7, startX: 20000, width: 800 };

describe('SignalSystem – stany sygnałów', () => {
  it('semafor wjazdowy 40 px przed stacją, tarcza ostrzegawcza 1 km przed semaforem', () => {
    const s = new SignalSystem(seq(0));
    s.sync([ST], 0);
    const p = s.posts[0];
    expect(p.semX).toBeLessThan(ST.startX);
    expect(p.warnX).toBeCloseTo(p.semX - KM_PX);
  });

  it('sygnał losowany dopiero przy zbliżaniu się pociągu', () => {
    const s = new SignalSystem(seq(0.1));
    s.sync([ST], 0);
    const p = s.posts[0];
    s.update(p.warnX - DECIDE_AHEAD_PX - 100, 80, 0.1);
    expect(p.aspect).toBeNull();
    s.update(p.warnX - DECIDE_AHEAD_PX + 10, 80, 0.1);
    expect(p.aspect).not.toBeNull();
  });

  it('losowanie: niskie = zielone, środek = pomarańczowe, wysokie = czerwone', () => {
    for (const [r, a] of [[0.1, 'green'], [0.6, 'orange'], [0.95, 'red']] as const) {
      const s = new SignalSystem(seq(r));
      s.sync([ST], 0);
      s.update(s.posts[0].warnX, 80, 0.01);
      expect(s.posts[0].aspect).toBe(a);
    }
  });

  it('czerwone odlicza 5–15 s dopiero blisko semafora, potem zmienia się na zielone/pomarańczowe', () => {
    // 0.95 → czerwone, 0 → 5 s, 0.1 → zielone
    const s = new SignalSystem(seq(0.95, 0, 0.1));
    s.sync([ST], 0);
    const p = s.posts[0];
    s.update(p.warnX, 80, 0.01);
    expect(p.aspect).toBe('red');
    // daleko i w ruchu: czerwone trzyma
    s.update(p.warnX + 100, 80, 30);
    expect(p.aspect).toBe('red');
    // blisko semafora: odliczanie
    const near = p.semX - RED_HOLD_PX + 10;
    s.update(near, 0, 4.9);
    expect(p.aspect).toBe('red');
    s.update(near, 0, 0.2);
    expect(p.aspect).toBe('green');
  });

  it('czas czerwonego mieści się w 5–15 s', () => {
    const s = new SignalSystem(seq(0.95, 0.999, 0.6));
    s.sync([ST], 0);
    const p = s.posts[0];
    s.update(p.semX - 100, 0, 0.01);
    s.update(p.semX - 100, 0, 14.8);
    expect(p.aspect).toBe('red');
    s.update(p.semX - 100, 0, 0.3);
    expect(p.aspect).toBe('orange');
  });

  it('po minięciu stacji sygnał jest zapominany (przy powrocie losuje się od nowa)', () => {
    const s = new SignalSystem(seq(0.1));
    s.sync([ST], 0);
    s.update(s.posts[0].warnX, 80, 0.1);
    s.sync([], ST.startX + ST.width + 2000);
    expect(s.posts).toHaveLength(0);
  });

  it('tarcza ostrzegawcza zapowiada semafor', () => {
    expect(warnAspect('green')).toBe('green');
    expect(warnAspect('orange')).toBe('greenBlink');
    expect(warnAspect('red')).toBe('orange');
    expect(warnAspect(null)).toBe('off');
  });

  it('nearest – najbliższy sygnał przed pociągiem (tarcza, potem semafor)', () => {
    const s = new SignalSystem(seq(0.1));
    s.sync([ST], 0);
    const p = s.posts[0];
    expect(s.nearest(p.warnX - 500)).toMatchObject({ kind: 'warn', dist: 500 });
    expect(s.nearest(p.warnX + 100)).toMatchObject({ kind: 'sem', dist: p.semX - p.warnX - 100 });
    expect(s.nearest(p.semX + 1)).toBeNull();
  });
});

describe('Przejechanie sygnału STÓJ', () => {
  it('wykrywa przejechanie czerwonego tylko raz', () => {
    const s = new SignalSystem(seq(0.95));
    s.sync([ST], 0);
    const p = s.posts[0];
    s.update(p.warnX, 80, 0.01);
    expect(s.checkSpad(p.semX - 5, p.semX + 5)).toBe(true);
    expect(s.checkSpad(p.semX + 5, p.semX + 15)).toBe(false);
  });

  it('nie wykrywa przy zielonym ani pomarańczowym', () => {
    for (const r of [0.1, 0.6]) {
      const s = new SignalSystem(seq(r));
      s.sync([ST], 0);
      const p = s.posts[0];
      s.update(p.warnX, 80, 0.01);
      expect(s.checkSpad(p.semX - 5, p.semX + 5)).toBe(false);
    }
  });
});

describe('Jazda automatyczna – reakcja na sygnały', () => {
  const post = (aspect: 'green' | 'orange' | 'red') => ({ warnX: 0, semX: 10000, endX: 11000, aspect });

  it('zielone – bez ograniczeń', () => {
    expect(autoSpeedCap(9000, post('green'))).toBe(Infinity);
  });

  it('pomarańczowe – 40 km/h od semafora do końca stacji, wcześniej łagodne hamowanie', () => {
    expect(autoSpeedCap(10000, post('orange'))).toBeCloseTo(SLOW_KMH);
    expect(autoSpeedCap(10500, post('orange'))).toBe(SLOW_KMH);
    expect(autoSpeedCap(11100, post('orange'))).toBe(Infinity);
    const far = autoSpeedCap(5000, post('orange'));
    expect(far).toBeGreaterThan(100);
  });

  it('czerwone – staje przed semaforem i nie przejeżdża go (symulacja)', () => {
    const p = post('red');
    let x = 0;
    let kmh = 100;
    for (let i = 0; i < 20000; i++) {
      const dt = 1 / 60;
      kmh = stepSpeed(kmh, Math.min(100, autoSpeedCap(x, p)), dt);
      x += kmh * PX_PER_KMH * dt;
    }
    expect(kmh).toBe(0);
    expect(x).toBeLessThan(p.semX);
    expect(x).toBeGreaterThan(p.semX - STOP_GAP_PX - 40);
  });

  it('po zmianie na zielone rusza', () => {
    const p = post('red');
    expect(autoSpeedCap(p.semX - STOP_GAP_PX, p)).toBe(0);
    expect(autoSpeedCap(p.semX - STOP_GAP_PX, { ...p, aspect: 'green' })).toBe(Infinity);
  });

  it('pomarańczowe – w symulacji mija semafor z prędkością ≤ 40 km/h', () => {
    const p = post('orange');
    let x = 0;
    let kmh = 100;
    let atSem = -1;
    while (x < p.semX + 50) {
      const dt = 1 / 60;
      kmh = stepSpeed(kmh, Math.min(100, autoSpeedCap(x, p)), dt);
      const nx = x + kmh * PX_PER_KMH * dt;
      if (x < p.semX && nx >= p.semX) atSem = kmh;
      x = nx;
    }
    expect(atSem).toBeGreaterThan(30);
    expect(atSem).toBeLessThanOrEqual(SLOW_KMH + 0.5);
  });
});
