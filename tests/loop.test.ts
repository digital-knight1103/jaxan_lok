import { describe, it, expect } from 'vitest';
import { clampDt } from '../src/engine/loop';
import { mulberry32 } from '../src/engine/rng';

describe('clampDt', () => {
  it('zwykła klatka bez zmian', () => expect(clampDt(0.016)).toBe(0.016));
  it('powrót z ukrytej karty → przycięte do 0,1 s', () => expect(clampDt(5)).toBe(0.1));
  it('ujemne dt → 0', () => expect(clampDt(-1)).toBe(0));
});

describe('mulberry32', () => {
  it('ten sam seed → ta sama sekwencja', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    const sa = Array.from({ length: 5 }, a);
    const sb = Array.from({ length: 5 }, b);
    expect(sa).toEqual(sb);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });
  it('inny seed → inna sekwencja', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
