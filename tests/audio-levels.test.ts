import { describe, it, expect } from 'vitest';
import { motorParams } from '../src/engine/audio';
import { AUDIO } from '../src/config';

// poprzednie wartości (przed poprawką): gain do 0.12, filtr do 1690 Hz, gwizd do 1260 Hz
const OLD_MAX_GAIN = 0.05 + 0.07;

describe('motorParams – ciszej i „pod spodem"', () => {
  it('głośność silników ~60% niższa niż wcześniej', () => {
    expect(motorParams(120).gain).toBeLessThanOrEqual(OLD_MAX_GAIN * 0.4 + 1e-9);
    expect(motorParams(120).gain).toBeGreaterThan(0);
  });
  it('filtr dolnoprzepustowy – brak wysokich częstotliwości nawet przy 120 km/h', () => {
    expect(motorParams(120).lowpass).toBeLessThanOrEqual(600);
  });
  it('ton rośnie z prędkością, ale łagodnie i bez pisku', () => {
    const a = motorParams(0);
    const b = motorParams(120);
    expect(b.pitch).toBeGreaterThan(a.pitch);
    expect(b.whine).toBeGreaterThan(a.whine);
    expect(b.whine).toBeLessThanOrEqual(420);
    expect(b.pitch / a.pitch).toBeLessThan(2.5);
  });
  it('stukot i klakson bez zmian (poziomy w config.ts)', () => {
    expect(AUDIO.horn).toBe(0.16);
    expect(AUDIO.clackBase).toBe(0.18);
    expect(AUDIO.clackPerSpeed).toBe(0.12);
  });
});
