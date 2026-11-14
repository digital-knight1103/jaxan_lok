import { describe, it, expect } from 'vitest';
import { RouteIndex, KM_PX, ANCHOR_SCREEN_X, stopWorldX } from '../src/scene/routeindex';
import { Route } from '../src/scene/route';
import type { SegmentDef } from '../src/scene/segments/types';

const noop = () => {};
const def = (id: string, kind: 'filler' | 'landmark', width: number, extra: Partial<SegmentDef> = {}): SegmentDef =>
  ({ id, kind, width, weight: 1, render: noop, ...extra });
const registry: SegmentDef[] = [
  def('forest', 'filler', 640),
  def('embankment', 'filler', 480),
  def('bridge', 'filler', 480, { bridge: true, mapIcon: 'bridge', mapLabel: 'MOST' }),
  def('plant', 'filler', 560, { mapIcon: 'plant', mapLabel: 'ZAKŁAD' }),
  def('quarry', 'landmark', 900, { mapIcon: 'quarry', mapLabel: 'KOPALNIA', mapAnchor: 560 }),
  def('station', 'landmark', 800, { mapIcon: 'station', mapLabel: 'KAMIENIEC ZĄBKOWICKI', mapAnchor: 325 }),
];
const ORDER = ['quarry', 'station'];

describe('RouteIndex – punkty na mapie trasy', () => {
  it('pozycje punktów zgadzają się z segmentami generatora trasy (ten sam seed)', () => {
    const idx = new RouteIndex(9, registry, ORDER);
    const r = new Route(9, registry, ORDER);
    const fromRoute: { id: string; anchorX: number }[] = [];
    const seen = new Set<number>();
    for (let x = 0; x < 60000; x += 300) {
      for (const p of r.visible(x, x + 640)) {
        if (seen.has(p.index) || !p.def.mapIcon) continue;
        seen.add(p.index);
        fromRoute.push({ id: p.def.id, anchorX: p.startX + (p.def.mapAnchor ?? p.def.width / 2) });
      }
    }
    const pois = idx.between(0, 60000).map((p) => ({ id: p.id, anchorX: p.anchorX }));
    expect(pois).toEqual(fromRoute.filter((p) => p.anchorX <= 60000));
  });

  it('kotwica landmarku = początek + mapAnchor (stacja: budynek, kopalnia: lej)', () => {
    const idx = new RouteIndex(9, registry, ORDER);
    const st = idx.between(0, 200000).find((p) => p.id === 'station')!;
    expect(st.anchorX).toBe(st.startX + 325);
    expect(st.label).toBe('KAMIENIEC ZĄBKOWICKI');
  });

  it('okno ±10 km zwraca tylko punkty w zakresie, posortowane', () => {
    const idx = new RouteIndex(9, registry, ORDER);
    const c = 200000;
    const list = idx.between(c - 10 * KM_PX, c + 10 * KM_PX);
    expect(list.length).toBeGreaterThan(5);
    for (const p of list) {
      expect(p.anchorX).toBeGreaterThanOrEqual(c - 10 * KM_PX);
      expect(p.anchorX).toBeLessThanOrEqual(c + 10 * KM_PX);
    }
    for (let i = 1; i < list.length; i++) expect(list[i].anchorX).toBeGreaterThan(list[i - 1].anchorX);
  });

  it('następny / poprzedni punkt względem pozycji', () => {
    const idx = new RouteIndex(9, registry, ORDER);
    const all = idx.between(0, 100000);
    const ref = all[3].anchorX;
    expect(idx.next(ref)!.anchorX).toBe(all[4].anchorX);
    expect(idx.prev(ref)!.anchorX).toBe(all[2].anchorX);
    expect(idx.prev(all[0].anchorX - 1)).toBeNull();
  });

  it('po skoku do punktu pociąg stoi tak, że punkt jest tuż przed lokomotywą', () => {
    expect(stopWorldX({ anchorX: 50000 })).toBe(50000 - ANCHOR_SCREEN_X);
    expect(stopWorldX({ anchorX: 100 })).toBe(0); // nie przed początek trasy
  });

  it('pamięć ograniczona: po przejeździe 1e7 px trzyma tylko punkty z okolicy', () => {
    const idx = new RouteIndex(9, registry, ORDER);
    for (let x = 0; x <= 1e7; x += 50000) idx.between(x - 10 * KM_PX, x + 10 * KM_PX);
    expect(idx.cachedCount).toBeLessThan(400);
    // cofnięcie daleko wstecz nadal działa (odbudowa z seeda)
    expect(idx.between(0, 20000).length).toBeGreaterThan(0);
  });
});
