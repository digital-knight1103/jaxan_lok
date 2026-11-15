import { describe, it, expect } from 'vitest';
import { SpeedLimits, limitAt, capAt, nextChange, brakeDistance, brakeCurve, LINE_KMH, type Zone } from '../src/train/limits';
import { KM_PX } from '../src/scene/routeindex';
import { stepSpeed } from '../src/train/physics';
import { PX_PER_KMH } from '../src/config';

const z = (a: number, b: number, kmh: number, station = false): Zone => ({ startX: a, endX: b, kmh, station });
const TAIL = 700;

describe('obowiązująca prędkość', () => {
  const zones = [z(10000, 20000, 80)];
  it('poza odcinkiem – szlakowa 120', () => {
    expect(limitAt(zones, 5000, TAIL)).toBe(LINE_KMH);
    expect(limitAt(zones, 20000 + TAIL + 1, TAIL)).toBe(LINE_KMH);
  });
  it('od czoła przy W 9 do przejechania końca ostatnim wagonem', () => {
    expect(limitAt(zones, 10000, TAIL)).toBe(80);
    expect(limitAt(zones, 20000 + 100, TAIL)).toBe(80);
    expect(limitAt(zones, 20000 + TAIL, TAIL)).toBe(LINE_KMH);
  });
  it('nakładające się odcinki: ostrzejsze wygrywa', () => {
    expect(limitAt([z(0, 9000, 100), z(5000, 8000, 60)], 6000, TAIL)).toBe(60);
  });
});

describe('AUTO', () => {
  const zones = [z(30000, 40000, 60)];
  it('przed W 9 kapuje wg krzywej hamowania, w odcinku trzyma limit, za końcem puszcza', () => {
    expect(capAt(zones, 0, TAIL)).toBe(LINE_KMH);
    expect(capAt(zones, 29999, TAIL)).toBeCloseTo(60, 0);
    expect(capAt(zones, 35000, TAIL)).toBe(60);
    expect(capAt(zones, 40000 + TAIL, TAIL)).toBe(LINE_KMH);
  });
  it('symulacja: pociąg jadący 120 zwalnia płynnie i wjeżdża w odcinek ≤ limit, potem przyspiesza', () => {
    let v = 120;
    let x = 0;
    const dt = 1 / 60;
    let maxOver = 0;
    while (x < 36000) {
      v = stepSpeed(v, capAt(zones, x, TAIL), dt);
      x += v * PX_PER_KMH * dt;
      if (x >= 30000) maxOver = Math.max(maxOver, v - 60);
    }
    expect(maxOver).toBeLessThan(0.5);
    while (x < 40000 + TAIL + 4000) {
      v = stepSpeed(v, capAt(zones, x, TAIL), dt);
      x += v * PX_PER_KMH * dt;
    }
    expect(v).toBeGreaterThan(70);
  });
  it('droga hamowania zgodna z krzywą', () => {
    expect(brakeCurve(brakeDistance(120, 80), 80)).toBeCloseTo(120, 3);
  });
});

describe('następna zmiana (HUD)', () => {
  it('przed odcinkiem: jego limit i odległość; w odcinku: powrót do 120 za koniec', () => {
    const zones = [z(10000, 20000, 100)];
    expect(nextChange(zones, 4000, TAIL)).toEqual({ kmh: 100, dist: 6000 });
    expect(nextChange(zones, 12000, TAIL)).toEqual({ kmh: LINE_KMH, dist: 20000 + TAIL - 12000 });
    expect(nextChange(zones, 30000, TAIL)).toBeNull();
  });
});

describe('generator odcinków', () => {
  const stations = (x0: number, x1: number) =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
      .map((i) => ({ index: i, semX: 6760 + i * 22000, endX: 6760 + i * 22000 + 800 }))
      .filter((s) => s.endX >= x0 && s.semX <= x1);
  it('deterministyczny dla seeda', () => {
    const a = new SpeedLimits(7, stations).near(0, 200000);
    expect(new SpeedLimits(7, stations).near(0, 200000)).toEqual(a);
    expect(new SpeedLimits(8, stations).near(0, 200000)).not.toEqual(a);
  });
  it('odcinki szlakowe: 60/80/100, długość 1–3 km, bez nakładania na stacje', () => {
    const zs = new SpeedLimits(3, stations).near(0, 200000);
    const open = zs.filter((q) => !q.station);
    expect(open.length).toBeGreaterThan(3);
    for (const q of open) {
      expect([60, 80, 100]).toContain(q.kmh);
      expect(q.endX - q.startX).toBeGreaterThanOrEqual(KM_PX - 1);
      expect(q.endX - q.startX).toBeLessThanOrEqual(3 * KM_PX + 1);
      for (const s of stations(0, 400000)) expect(q.endX < s.semX - 2000 || q.startX > s.endX).toBe(true);
    }
    const st = zs.filter((q) => q.station);
    expect(st.length).toBeGreaterThan(3);
    for (const q of st) expect([60, 80]).toContain(q.kmh);
  });
  it('pamięć ograniczona przy długiej jeździe, skok wstecz odtwarza to samo', () => {
    const g = new SpeedLimits(3, stations);
    const first = g.near(0, 100000);
    for (let x = 0; x < 5e6; x += 5000) g.near(x, x + 5000);
    expect(g.cachedCount).toBeLessThan(20);
    expect(g.near(0, 100000)).toEqual(first);
  });
});
