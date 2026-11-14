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
const ORDER = [{ ids: ['quarry'] }, { ids: ['station'] }];

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
      expect(lm[i].id).toBe(ORDER[i % 2].ids[0]);
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

describe('Route – pętla lokalizacji (grupy segmentów)', () => {
  const reg: SegmentDef[] = [
    def('forest', 'filler', 640),
    def('bridge', 'filler', 480, true),
    def('sokolka', 'landmark', 1600),
    def('wisla', 'landmark', 1000, true),
    def('warszawa', 'landmark', 1400),
    def('quarry', 'landmark', 900),
    def('station', 'landmark', 800),
  ];
  const LOOP = [{ ids: ['sokolka'] }, { ids: ['wisla', 'warszawa'] }, { ids: ['quarry', 'station'], gapPx: 2400 }];
  const run = (seed: number, until: number) => {
    const r = new Route(seed, reg, LOOP);
    const seen = new Map<number, { id: string; startX: number; width: number; kind: string; bridge: boolean }>();
    for (let x = 0; x < until; x += 300) {
      for (const p of r.visible(x, x + 640)) seen.set(p.index, { id: p.def.id, startX: p.startX, width: p.def.width, kind: p.def.kind, bridge: !!p.def.bridge });
    }
    return [...seen.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  };

  it('kolejność w pętli: Sokółka → Wisła+Warszawa → kopalnia+stacja Kamieniec → Sokółka…', () => {
    const lm = run(11, 260000).filter((s) => s.kind === 'landmark').map((s) => s.id);
    const loop = ['sokolka', 'wisla', 'warszawa', 'quarry', 'station'];
    expect(lm.length).toBeGreaterThanOrEqual(10);
    lm.forEach((id, i) => expect(id).toBe(loop[i % loop.length]));
  });

  it('most na Wiśle tuż przed Warszawą; kopalnia i stacja Kamieńca w odstępie gapPx', () => {
    const segs = run(12, 200000);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].id === 'wisla') expect(segs[i + 1]?.id ?? 'warszawa').toBe('warszawa');
      if (segs[i].id === 'quarry') {
        const st = segs.slice(i + 1).find((s) => s.id === 'station');
        if (!st) continue;
        const gap = st.startX - (segs[i].startX + segs[i].width);
        expect(gap).toBeGreaterThanOrEqual(2400);
        expect(gap).toBeLessThan(2400 + 700);
      }
    }
  });

  it('między lokalizacjami co najmniej LANDMARK_SPACING_PX fillerów; pierwsza po FIRST_LANDMARK_PX', () => {
    const segs = run(13, 200000);
    const firstOf = segs.filter((s, i) => s.kind === 'landmark' && ['sokolka', 'wisla', 'quarry'].includes(s.id) && i >= 0);
    expect(firstOf[0].id).toBe('sokolka');
    expect(firstOf[0].startX).toBeGreaterThanOrEqual(FIRST_LANDMARK_PX);
    const lastEnd = (id: string, from: number) => {
      const s = segs.filter((q) => q.id === id && q.startX < from).pop()!;
      return s.startX + s.width;
    };
    for (const s of firstOf.slice(1)) {
      const prevEnd = s.id === 'wisla' ? lastEnd('sokolka', s.startX) : s.id === 'quarry' ? lastEnd('warszawa', s.startX) : lastEnd('station', s.startX);
      expect(s.startX - prevEnd).toBeGreaterThanOrEqual(LANDMARK_SPACING_PX);
    }
  });

  it('nigdy dwa mosty pod rząd – także przed mostem na Wiśle', () => {
    const segs = run(14, 400000);
    for (let i = 1; i < segs.length; i++) expect(segs[i].bridge && segs[i - 1].bridge).toBe(false);
  });
});
