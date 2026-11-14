import { describe, it, expect } from 'vitest';
import { computeViewport } from '../src/engine/screen';

describe('computeViewport', () => {
  it('1920×1080 → dokładnie ×3 bez pasów', () => {
    expect(computeViewport(1920, 1080)).toEqual({ scale: 3, offsetX: 0, offsetY: 0 });
  });
  it('1366×768 → ×2 z wyśrodkowaniem', () => {
    expect(computeViewport(1366, 768)).toEqual({ scale: 2, offsetX: 43, offsetY: 24 });
  });
  it('2560×1440 → ×4', () => {
    expect(computeViewport(2560, 1440)).toEqual({ scale: 4, offsetX: 0, offsetY: 0 });
  });
  it('okno mniejsze niż bufor → skala nigdy poniżej 1', () => {
    expect(computeViewport(600, 300).scale).toBe(1);
  });
  it('offsety zaokrąglone w dół (całkowite)', () => {
    const v = computeViewport(1367, 769);
    expect(Number.isInteger(v.offsetX)).toBe(true);
    expect(Number.isInteger(v.offsetY)).toBe(true);
  });
});
