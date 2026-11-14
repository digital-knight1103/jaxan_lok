import { describe, it, expect } from 'vitest';
import { mountainProfile } from '../src/scene/ridges';

describe('mountainProfile', () => {
  const style = { baseY: 200, height: 100, roughness: 0.7 };
  const p = mountainProfile(7, 640, style);

  it('każda kolumna ma wysokość w zakresie [baseY-height, baseY]', () => {
    expect(p).toHaveLength(640);
    for (const y of p) {
      expect(Number.isInteger(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(100);
      expect(y).toBeLessThanOrEqual(200);
    }
  });
  it('grzbiet jest ciągły – sąsiednie kolumny różnią się o mało (także na szwie)', () => {
    for (let x = 0; x < 640; x++) {
      expect(Math.abs(p[x] - p[(x + 1) % 640])).toBeLessThanOrEqual(6);
    }
  });
});
