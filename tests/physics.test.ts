import { describe, it, expect } from 'vitest';
import { stepSpeed, adjustTarget, ACCEL_KMH_S, BRAKE_KMH_S } from '../src/train/physics';

describe('stepSpeed – bezwładność', () => {
  it('przyspiesza z ograniczonym przyspieszeniem', () => {
    expect(stepSpeed(0, 80, 1)).toBeCloseTo(ACCEL_KMH_S);
  });
  it('nie przestrzeliwuje celu', () => {
    expect(stepSpeed(79, 80, 1)).toBe(80);
    expect(stepSpeed(81, 80, 1)).toBe(80);
  });
  it('hamuje szybciej niż przyspiesza, nie schodzi poniżej 0', () => {
    expect(BRAKE_KMH_S).toBeGreaterThan(ACCEL_KMH_S);
    expect(stepSpeed(50, 0, 1)).toBeCloseTo(50 - BRAKE_KMH_S);
    expect(stepSpeed(1, 0, 1)).toBe(0);
  });
  it('wynik niezależny od FPS: 60 kroków po 1/60 s = 1 krok 1 s', () => {
    let v = 20;
    for (let i = 0; i < 60; i++) v = stepSpeed(v, 100, 1 / 60);
    expect(v).toBeCloseTo(stepSpeed(20, 100, 1), 2);
  });
});

describe('adjustTarget – prędkość zadana', () => {
  it('krok 10 km/h', () => expect(adjustTarget(80, +1)).toBe(90));
  it('nie powyżej 120', () => expect(adjustTarget(115, +1)).toBe(120));
  it('nie poniżej 0', () => expect(adjustTarget(5, -1)).toBe(0));
});
