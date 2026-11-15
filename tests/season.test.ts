import { describe, it, expect } from 'vitest';
import { SeasonClock, SEASON_LENGTH_PX, SEASON_FADE_S, SEASON_STEPS } from '../src/scene/season';
import { Weather } from '../src/scene/weather';
import { mapSeason } from '../src/engine/seasonskin';

const run = (c: SeasonClock, s: number, x = 0) => { for (let i = 0; i < s * 10; i++) c.update(0.1, x); };

describe('SeasonClock', () => {
  it('start: lato, pełny udział', () => {
    const c = new SeasonClock();
    expect(c.current).toBe('summer');
    expect(c.weight('summer')).toBe(1);
    expect(c.choice).toBe('auto');
  });
  it('AUTO: pora zmienia się po SEASON_LENGTH_PX, przejście ~30 s', () => {
    const c = new SeasonClock('summer');
    run(c, 5, SEASON_LENGTH_PX - 1);
    expect(c.to).toBe('summer');
    c.update(0.1, SEASON_LENGTH_PX);
    expect(c.to).toBe('autumn');
    expect(c.mix).toBeLessThan(0.05);
    run(c, SEASON_FADE_S / 2, SEASON_LENGTH_PX);
    expect(c.mix).toBeGreaterThan(0.45);
    expect(c.mix).toBeLessThan(0.55);
    run(c, SEASON_FADE_S, SEASON_LENGTH_PX);
    expect(c.mix).toBe(1);
    expect(c.current).toBe('autumn');
  });
  it('cykl P: AUTO → wiosna → lato → jesień → zima → AUTO; ręczny trzyma porę', () => {
    const c = new SeasonClock('summer');
    const seq = [c.choice];
    for (let i = 0; i < 5; i++) { c.cycle(); seq.push(c.choice); }
    expect(seq).toEqual(['auto', 'spring', 'summer', 'autumn', 'winter', 'auto']);
    c.setManual('winter');
    run(c, 10, SEASON_LENGTH_PX * 5);
    expect(c.current).toBe('winter');
  });
  it('wagi pór sumują się do 1 w przejściu', () => {
    const c = new SeasonClock('autumn');
    c.setManual('winter');
    run(c, 2);
    const sum = (['spring', 'summer', 'autumn', 'winter'] as const).reduce((s, k) => s + c.weight(k), 0);
    expect(sum).toBeCloseTo(1);
    expect(c.step).toBeGreaterThan(0);
    expect(c.step).toBeLessThanOrEqual(SEASON_STEPS);
  });
  it('zima: dzień krótszy, śnieg częstszy; lato: bez śniegu', () => {
    const w = new SeasonClock('winter');
    const s = new SeasonClock('summer');
    expect(w.dayBias).toBeGreaterThan(s.dayBias);
    expect(w.climate.snow).toBeGreaterThan(0.5);
    expect(s.climate.snow).toBe(0);
  });
  it('pogoda AUTO z klimatem lata nie robi śniegu, zimą robi', () => {
    const go = (snow: number) => {
      const wt = new Weather(() => 0.5);
      wt.set('cloudy');
      for (let i = 0; i < 6000; i++) { wt.update(0.1, false, { snow, fog: 0 }); if (wt.kind !== 'cloudy') break; }
      return wt.kind;
    };
    expect(go(0)).toBe('rain');
    expect(go(0.9)).toBe('snow');
  });
});

describe('mapSeason', () => {
  const rgb = (h: string) => parseInt(h.slice(1), 16);
  it('lato = tożsamość; magenta, grafit i czerń JAXAN nietknięte w każdej porze', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
      for (const c of ['#A0157E', '#6E0E58', '#1A1A1E', '#2A2A30', '#8E2A7A', '#1C1C20']) expect(mapSeason(s, rgb(c))).toBe(rgb(c));
    }
    expect(mapSeason('summer', rgb('#4A783A'))).toBe(rgb('#4A783A'));
  });
  it('jesień: zieleń liści → ciepłe barwy; zima: trawa → jasny śnieg', () => {
    const a = mapSeason('autumn', rgb('#4A783A'));
    expect(((a >> 16) & 255)).toBeGreaterThan(a & 255); // czerwień > błękit
    const w = mapSeason('winter', rgb('#A6C250'));
    expect(w & 255).toBeGreaterThan(200); // jasny z niebieskim tonem
  });
});
