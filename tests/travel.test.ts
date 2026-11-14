import { describe, it, expect } from 'vitest';
import { TravelAnim, TRAVEL } from '../src/scene/travel';
import { MAX_KMH } from '../src/config';

function run(from: number, to: number, dt = 1 / 60) {
  const a = new TravelAnim();
  a.start(from, to);
  let x = from;
  const frames = [];
  for (let i = 0; i < 2000 && a.active; i++) {
    const f = a.update(dt, x);
    x = f.worldX;
    frames.push(f);
  }
  return { a, x, frames };
}

describe('TravelAnim – szybki przejazd do punktu', () => {
  it('kończy dokładnie w punkcie docelowym, z prędkością 0', () => {
    const { a, x, frames } = run(1000, 80000);
    expect(a.active).toBe(false);
    expect(x).toBe(80000);
    expect(frames[frames.length - 1].kmh).toBe(0);
    expect(frames[frames.length - 1].done).toBe(true);
  });
  it('trwa ok. TRAVEL.outS + TRAVEL.inS sekund niezależnie od odległości', () => {
    const n1 = run(0, 30000).frames.length;
    const n2 = run(0, 900000).frames.length;
    expect(Math.abs(n1 - n2)).toBeLessThanOrEqual(1);
    expect(n1 / 60).toBeCloseTo(TRAVEL.outS + TRAVEL.inS, 0);
  });
  it('ściemnienie: rośnie do 1 przy przeskoku, potem znika', () => {
    const { frames } = run(0, 50000);
    const maxFade = Math.max(...frames.map((f) => f.fade));
    expect(maxFade).toBeCloseTo(1, 1);
    expect(frames[frames.length - 1].fade).toBe(0);
  });
  it('dojazd: pozycja rośnie monotonicznie, prędkość maleje i nie przekracza MAX_KMH', () => {
    const { frames } = run(0, 50000);
    const arrival = frames.filter((f) => f.phase === 'in');
    for (let i = 1; i < arrival.length; i++) {
      expect(arrival[i].worldX).toBeGreaterThanOrEqual(arrival[i - 1].worldX);
      expect(arrival[i].kmh).toBeLessThanOrEqual(arrival[i - 1].kmh + 1e-9);
    }
    expect(arrival[0].kmh).toBeLessThanOrEqual(MAX_KMH);
  });
  it('skok wstecz też kończy w celu (dojazd zawsze do przodu)', () => {
    const { x, frames } = run(90000, 20000);
    expect(x).toBe(20000);
    const arrival = frames.filter((f) => f.phase === 'in');
    expect(arrival[0].worldX).toBeLessThan(20000);
  });
});
