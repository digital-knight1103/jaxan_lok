import { describe, it, expect } from 'vitest';
import { CinemaCam, ZOOM_MAX, ZOOM_PERIOD_S } from '../src/scene/cinema';
import { W, H } from '../src/config';

const run = (c: CinemaCam, s: number, active: boolean) => { for (let i = 0; i < s * 10; i++) c.update(0.1, active); };

describe('CinemaCam', () => {
  it('poza trybem kinowym – pełny kadr', () => {
    expect(new CinemaCam().view()).toEqual({ x: 0, y: 0, w: W, h: H });
  });
  it('kadr zawsze mieści się w buforze, zoom 1..ZOOM_MAX, proporcje 16:9', () => {
    const c = new CinemaCam();
    let maxZoom = 1;
    for (let i = 0; i < 4000; i++) {
      c.update(0.1, true);
      const v = c.view();
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.x + v.w).toBeLessThanOrEqual(W + 1e-6);
      expect(v.y + v.h).toBeLessThanOrEqual(H + 1e-6);
      expect(v.w / v.h).toBeCloseTo(W / H, 6);
      maxZoom = Math.max(maxZoom, W / v.w);
    }
    expect(maxZoom).toBeGreaterThan(1.4);
    expect(maxZoom).toBeLessThanOrEqual(ZOOM_MAX + 1e-6);
  });
  it('kamera naprawdę przesuwa się wzdłuż składu', () => {
    const c = new CinemaCam();
    const xs: number[] = [];
    for (let i = 0; i < 2000; i++) { c.update(0.1, true); if (i % ZOOM_PERIOD_S === 0) xs.push(c.view().x); }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(20);
  });
  it('wyjście wraca do pełnego kadru w ~1 s i resetuje kamerę', () => {
    const c = new CinemaCam();
    run(c, 60, true);
    run(c, 1.1, false);
    expect(c.view()).toEqual({ x: 0, y: 0, w: W, h: H });
  });
});
