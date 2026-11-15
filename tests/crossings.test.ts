import { describe, it, expect } from 'vitest';
import { Crossing, occupies, WARN_PX, CLEAR_PX, BARRIER_S, LIGHT_LEAD_S, STOP_Y } from '../src/train/crossings';

const run = (c: Crossing, s: number, occ: boolean) => { for (let i = 0; i < s * 20; i++) c.update(0.05, occ); };

describe('occupies', () => {
  it('nasz pociąg (w prawo): od WARN_PX przed przejazdem do CLEAR_PX za ogonem', () => {
    const cx = 5000;
    expect(occupies(cx, { front: cx - WARN_PX - 1, tail: cx - WARN_PX - 700, dir: 1 })).toBe(false);
    expect(occupies(cx, { front: cx - WARN_PX + 5, tail: cx - WARN_PX - 700, dir: 1 })).toBe(true);
    expect(occupies(cx, { front: cx + 400, tail: cx - 300, dir: 1 })).toBe(true);
    expect(occupies(cx, { front: cx + 900, tail: cx + CLEAR_PX + 1, dir: 1 })).toBe(false);
  });
  it('pociąg z naprzeciwka (w lewo) też zamyka przejazd', () => {
    const cx = 5000;
    expect(occupies(cx, { front: cx + WARN_PX - 5, tail: cx + WARN_PX + 300, dir: -1 })).toBe(true);
    expect(occupies(cx, { front: cx - 800, tail: cx - CLEAR_PX - 1, dir: -1 })).toBe(false);
  });
});

describe('Crossing', () => {
  it('światła, potem rogatki opadają w BARRIER_S; po przejeździe podnoszą się i gasną', () => {
    const c = new Crossing(() => 0.5);
    run(c, 0.5, true);
    expect(c.lights).toBe(true);
    expect(c.down).toBe(0); // jeszcze świecą same światła
    run(c, LIGHT_LEAD_S + BARRIER_S, true);
    expect(c.down).toBe(1);
    run(c, BARRIER_S + 0.2, false);
    expect(c.down).toBe(0);
    expect(c.lights).toBe(false);
    expect(c.open).toBe(true);
  });
  it('auta czekają przed zamkniętymi rogatkami i ruszają po otwarciu', () => {
    const c = new Crossing(() => 0.3);
    run(c, LIGHT_LEAD_S + BARRIER_S + 8, true);
    expect(c.cars.length).toBeGreaterThan(0);
    for (const a of c.cars) expect(a.y).toBeGreaterThanOrEqual(STOP_Y - 0.5);
    expect(c.cars[0].y).toBeCloseTo(STOP_Y, 0);
    run(c, BARRIER_S + 4, false);
    expect(c.cars.length === 0 || c.cars[0].y < STOP_Y - 10).toBe(true);
  });
  it('kolejka: auta nie nakładają się', () => {
    const c = new Crossing(() => 0.9);
    run(c, 14, true);
    const ys = c.cars.map((a) => a.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(18);
  });
});
