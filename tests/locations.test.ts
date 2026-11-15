import { describe, it, expect } from 'vitest';
import { RouteIndex } from '../src/scene/routeindex';
import { REGISTRY, LANDMARK_ORDER } from '../src/scene/segments/registry';
import { ROUTE_SEED, PX_PER_KMH } from '../src/config';

/** Główne lokalizacje na mapie (bez drobnych mostów/zakładów). */
function locations(until: number) {
  const idx = new RouteIndex(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
  return idx.between(0, until).filter((p) => !['bridge', 'plant', 'crossing'].includes(p.icon));
}

describe('Lokalizacje trasy – prawdziwy rejestr', () => {
  it('pętla: SOKÓŁKA → WARSZAWA → kopalnia i stacja KAMIENIEC → SOKÓŁKA…', () => {
    const labels = locations(400000).map((p) => p.label);
    const loop = ['SOKÓŁKA', 'WARSZAWA', 'KOPALNIA KRUSZYWA', 'KAMIENIEC ZĄBKOWICKI'];
    expect(labels.length).toBeGreaterThanOrEqual(12);
    labels.forEach((l, i) => expect(l).toBe(loop[i % loop.length]));
  });

  it('przed Warszawą most na Wiśle', () => {
    const idx = new RouteIndex(ROUTE_SEED, REGISTRY, LANDMARK_ORDER);
    const all = idx.between(0, 200000);
    for (let i = 0; i < all.length; i++) {
      if (all[i].label === 'WARSZAWA') expect(all[i - 1].label).toBe('MOST NA WIŚLE');
    }
  });

  it('przy 100 km/h kolejne miasta co ok. 2–3 minuty', () => {
    const towns = locations(400000).filter((p) => p.label !== 'KOPALNIA KRUSZYWA');
    const pxPerS = 100 * PX_PER_KMH;
    for (let i = 1; i < towns.length; i++) {
      const s = (towns[i].anchorX - towns[i - 1].anchorX) / pxPerS;
      expect(s).toBeGreaterThan(120);
      expect(s).toBeLessThan(180);
    }
  });

  it('stacje mają semafory, kopalnia i most nie', () => {
    const sig = new Map(locations(100000).map((p) => [p.label, p.signals]));
    expect(sig.get('SOKÓŁKA')).toBe(true);
    expect(sig.get('WARSZAWA')).toBe(true);
    expect(sig.get('KAMIENIEC ZĄBKOWICKI')).toBe(true);
    expect(sig.get('KOPALNIA KRUSZYWA')).toBe(false);
  });
});
