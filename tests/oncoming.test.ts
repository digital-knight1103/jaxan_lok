import { describe, it, expect, vi } from 'vitest';

// sprite'y wymagają canvasa – w testach logiki podstawiamy puste pojazdy o właściwych szerokościach
vi.mock('../src/sprites/oncoming', () => {
  const car = (w: number) => ({ w, sprite: {}, windows: [], roof: 30 });
  return {
    OC_H: 46, drawPanto: () => {},
    getEmuCar: () => car(88), getFreightLoco: () => car(92), getTank: () => car(58), getFlat: () => car(74),
  };
});
vi.mock('../src/sprites/dragon2', () => ({ LOCO_W: 150, LOCO_H: 60, PANTO_CONTACT: { x: 70, y: 1 } }));

import { OncomingTrains, ONCOMING_MIN_S, ONCOMING_MAX_S, parkedAt, buildTrain } from '../src/scene/oncoming';
import { mulberry32 } from '../src/engine/rng';

describe('OncomingTrains', () => {
  it('pierwszy pociąg po ~25 s, kolejne co 1–3 min, ruch w lewo', () => {
    const o = new OncomingTrains(1);
    const times: number[] = [];
    let t = 0;
    for (let i = 0; i < 20000; i++) {
      t += 0.1;
      const ev = o.update(0.1, 0, 0);
      if (ev.pass) times.push(t);
    }
    expect(times[0]).toBeGreaterThan(24);
    expect(times[0]).toBeLessThan(27);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(ONCOMING_MIN_S - 1);
      expect(times[i] - times[i - 1]).toBeLessThanOrEqual(ONCOMING_MAX_S + 20);
    }
  });
  it('skład jedzie w lewo i znika za lewą krawędzią; nigdy dwa naraz', () => {
    const o = new OncomingTrains(2);
    const tr = o.spawn('emu', 0);
    const x0 = tr.x;
    o.update(1, 0, 0);
    expect(tr.x).toBeLessThan(x0);
    for (let i = 0; i < 300; i++) o.update(0.1, 0, 0);
    expect(o.trains.length).toBeLessThanOrEqual(1);
  });
  it('blokada stacją odkłada pojawienie się pociągu', () => {
    const o = new OncomingTrains(3);
    let n = 0;
    for (let i = 0; i < 600; i++) if (o.update(0.1, 0, 0, true).pass) n++;
    expect(n).toBe(0);
  });
  it('skład towarowy ma lokomotywę i 6–11 wagonów, EZT 3–5 członów', () => {
    for (let s = 1; s < 30; s++) {
      const f = buildTrain('freight', mulberry32(s));
      expect(f.cars.length).toBeGreaterThanOrEqual(7);
      expect(f.cars.length).toBeLessThanOrEqual(12);
      const e = buildTrain('emu', mulberry32(s));
      expect(e.cars.length).toBeGreaterThanOrEqual(3);
      expect(e.cars.length).toBeLessThanOrEqual(5);
    }
  });
  it('skład na stacji jest deterministyczny z ziarna i mieści się w segmencie lub jest nieobecny', () => {
    let some = 0;
    for (let s = 0; s < 200; s++) {
      const a = parkedAt(s, 1400);
      const b = parkedAt(s, 1400);
      expect(!!a).toBe(!!b);
      if (a) { some++; expect(a.dx).toBeGreaterThanOrEqual(10); }
    }
    expect(some).toBeGreaterThan(40);
    expect(some).toBeLessThan(140);
  });
});
