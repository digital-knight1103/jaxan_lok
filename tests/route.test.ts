import { describe, it, expect } from 'vitest';
import { Route, FIRST_LANDMARK_PX } from '../src/scene/route';
import type { SegmentDef } from '../src/scene/segments/types';
import { LANDMARK_SPACING_PX } from '../src/config';

const noop = () => {};
const def = (id: string, kind: 'filler' | 'landmark', width: number, bridge = false): SegmentDef =>
  ({ id, kind, width, bridge, weight: 1, render: noop });

const registry: SegmentDef[] = [
  def('forest', 'filler', 640),
  def('embankment', 'filler', 480),
  def('bridge', 'filler', 480, true),
  def('plant', 'filler', 560),
  def('quarry', 'landmark', 900),
  def('station', 'landmark', 800),
];
const ORDER = ['quarry', 'station'];

/** Przejeżdża trasę oknem 640 px od 0 do `until` i zbiera wszystkie segmenty. */
function drive(seed: number, until: number) {
  const r = new Route(seed, registry, ORDER);
  const seen = new Map<number, { id: string; startX: number; width: number; bridge: boolean; kind: string }>();
  for (let x = 0; x < until; x += 300) {
    for (const p of r.visible(x, x + 640)) {
      seen.set(p.index, { id: p.def.id, startX: p.startX, width: p.def.width, bridge: !!p.def.bridge, kind: p.def.kind });
    }
  }
  return { r, segs: [...seen.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]) };
}

describe('Route – generator trasy', () => {
  it('deterministyczny dla seeda', () => {
    expect(drive(5, 60000).segs).toEqual(drive(5, 60000).segs);
    expect(drive(5, 60000).segs).not.toEqual(drive(6, 60000).segs);
  });

  it('segmenty są ciągłe (bez dziur i zakładek)', () => {
    const { segs } = drive(1, 80000);
    expect(segs[0].startX).toBe(0);
    for (let i = 1; i < segs.length; i++) expect(segs[i].startX).toBe(segs[i - 1].startX + segs[i - 1].width);
  });

  it('pierwszy landmark szybko, potem na zmianę kopalnia/stacja w odstępach ≥ LANDMARK_SPACING_PX', () => {
    const { segs } = drive(2, 120000);
    const lm = segs.filter((s) => s.kind === 'landmark');
    expect(lm.length).toBeGreaterThanOrEqual(4);
    expect(lm[0].id).toBe('quarry');
    expect(lm[0].startX).toBeGreaterThanOrEqual(FIRST_LANDMARK_PX);
    expect(lm[0].startX).toBeLessThan(FIRST_LANDMARK_PX + 700);
    for (let i = 1; i < lm.length; i++) {
      expect(lm[i].id).toBe(ORDER[i % 2]);
      expect(lm[i].startX - (lm[i - 1].startX + lm[i - 1].width)).toBeGreaterThanOrEqual(LANDMARK_SPACING_PX);
    }
  });

  it('nigdy dwa mosty pod rząd', () => {
    const { segs } = drive(3, 200000);
    for (let i = 1; i < segs.length; i++) expect(segs[i].bridge && segs[i - 1].bridge).toBe(false);
  });

  it('pamięć ograniczona – po 1e8 px w cache najwyżej 16 segmentów', () => {
    const r = new Route(4, registry, ORDER);
    for (let x = 0; x <= 1e8; x += 50000) r.visible(x, x + 640);
    r.visible(1e8, 1e8 + 640);
    expect(r.cachedCount).toBeLessThanOrEqual(16);
  });

  it('visible zwraca tylko segmenty przecinające okno', () => {
    const r = new Route(7, registry, ORDER);
    for (const p of r.visible(10000, 10640)) {
      expect(p.startX).toBeLessThan(10640);
      expect(p.startX + p.def.width).toBeGreaterThan(10000);
    }
  });
});

describe('Route.firstX – wykrywanie skoku wstecz', () => {
  it('po przejechaniu daleko najstarszy trzymany segment jest blisko widoku', () => {
    const r = new Route(7, registry, ORDER);
    expect(r.firstX).toBe(0);
    r.visible(100000, 100640);
    expect(r.firstX).toBeGreaterThan(90000);
    expect(r.firstX).toBeLessThanOrEqual(100000);
  });
});
