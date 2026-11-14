import { describe, it, expect } from 'vitest';
import { DayCycle } from '../src/scene/daycycle';
import { DAY_LENGTH_S, NIGHT_TOGGLE_S } from '../src/config';

const at = (t: number) => {
  const d = new DayCycle(t);
  return d;
};

describe('DayCycle – noc i dzień', () => {
  it('północ = pełna noc, południe = pełny dzień', () => {
    expect(at(0).night).toBe(1);
    expect(at(0.5).night).toBe(0);
  });
  it('przejście ciągłe (brak skoków)', () => {
    let prev = at(0).night;
    for (let t = 0.001; t < 1; t += 0.001) {
      const n = at(t).night;
      expect(Math.abs(n - prev)).toBeLessThan(0.05);
      prev = n;
    }
  });
  it('tryb automatyczny: DAY_LENGTH_S sekund = pełny obieg doby', () => {
    const d = at(0.3);
    for (let i = 0; i < DAY_LENGTH_S * 10; i++) d.update(0.1);
    expect(d.t).toBeCloseTo(0.3, 5);
  });
  it('N w dzień → po 3 s pełna noc i auto wyłączone', () => {
    const d = at(0.5);
    d.toggleManual();
    expect(d.auto).toBe(false);
    for (let i = 0; i < NIGHT_TOGGLE_S * 60; i++) d.update(1 / 60);
    expect(d.night).toBeCloseTo(1, 5);
    // ręcznie ustawiona noc trwa (nie płynie dalej)
    for (let i = 0; i < 600; i++) d.update(1);
    expect(d.night).toBeCloseTo(1, 5);
  });
  it('N w nocy → po 3 s pełny dzień', () => {
    const d = at(0.95);
    d.toggleManual();
    for (let i = 0; i < NIGHT_TOGGLE_S * 60 + 1; i++) d.update(1 / 60);
    expect(d.night).toBe(0);
  });
  it('kolory nieba to poprawne #rrggbb, a o zachodzie jest ciepło', () => {
    for (const t of [0, 0.25, 0.5, 0.74]) {
      const c = at(t).skyColors();
      for (const v of [c.top, c.mid, c.horizon]) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(at(0.74).warmth).toBeGreaterThan(0.5);
    expect(at(0.5).warmth).toBe(0);
  });
});

describe('DayCycle – światło styl2 (kierunek, złota godzina, księżyc)', () => {
  it('złota godzina rano i wieczorem, chłodniej w południe', () => {
    expect(at(0.3).golden).toBeGreaterThan(0.6); // rano, słońce nisko
    expect(at(0.7).golden).toBeGreaterThan(0.6); // wieczór
    expect(at(0.5).golden).toBeLessThan(0.15); // południe
    expect(at(0).golden).toBe(0); // noc
  });
  it('rano światło z lewej, wieczorem z prawej, w południe z góry (obie strony słabiej)', () => {
    const m = at(0.3).light;
    const e = at(0.7).light;
    const n = at(0.5).light;
    expect(m.sunL).toBeGreaterThan(0.7);
    expect(m.sunR).toBeLessThan(0.1);
    expect(e.sunR).toBeGreaterThan(0.7);
    expect(e.sunL).toBeLessThan(0.1);
    expect(n.sunL).toBeCloseTo(n.sunR, 1);
    expect(n.sunL + n.sunR).toBeLessThan(m.sunL + m.sunR);
  });
  it('nocą słabe światło księżyca (kierunek wg księżyca), ciągłość bez skoków', () => {
    const night = at(0.02).light;
    expect(night.sunL + night.sunR).toBeGreaterThan(0.1);
    expect(night.sunL + night.sunR).toBeLessThan(0.5);
    expect(night.moon).toBe(true);
    let prev = at(0).light;
    for (let t = 0.001; t < 1; t += 0.001) {
      const l = at(t).light;
      expect(Math.abs(l.sunL - prev.sunL)).toBeLessThan(0.06);
      expect(Math.abs(l.sunR - prev.sunR)).toBeLessThan(0.06);
      prev = l;
    }
  });
});
