import { describe, it, expect } from 'vitest';
import { Weather, WEATHER_FADE_S } from '../src/scene/weather';

const run = (w: Weather, s: number) => { for (let i = 0; i < s * 10; i++) w.update(0.1); };

describe('Weather', () => {
  it('start: pogodnie, zero opadów', () => {
    const w = new Weather(() => 0.5);
    expect(w.kind).toBe('clear');
    expect(w.rain + w.snow + w.cloud).toBe(0);
  });
  it('ręczny cykl: pogodnie → pochmurno → deszcz → śnieg → pogodnie', () => {
    const w = new Weather(() => 0.5);
    const seq = [w.kind];
    for (let i = 0; i < 4; i++) { w.next(); seq.push(w.kind); }
    expect(seq).toEqual(['clear', 'cloudy', 'rain', 'snow', 'clear']);
  });
  it('przejście trwa ok. 20 s: w połowie ok. 0.5, po czasie pełne', () => {
    const w = new Weather(() => 0.5);
    w.set('rain');
    run(w, WEATHER_FADE_S / 2);
    expect(w.rain).toBeGreaterThan(0.4);
    expect(w.rain).toBeLessThan(0.6);
    run(w, WEATHER_FADE_S / 2 + 0.5);
    expect(w.rain).toBe(1);
    run(w, 1);
    expect(w.rain).toBe(1);
  });
  it('deszcz gaśnie, gdy pogoda wraca do pogodnej; śnieg i deszcz nie nakładają się', () => {
    const w = new Weather(() => 0.5);
    w.set('rain'); run(w, 25);
    w.set('snow'); run(w, 25);
    expect(w.rain).toBe(0);
    expect(w.snow).toBe(1);
    w.set('clear'); run(w, 25);
    expect(w.snow + w.rain + w.cloud).toBe(0);
  });
  it('automat: zmiana co 3–10 min; pogodnie→pochmurno→deszcz→pogodnie, śnieg rzadko', () => {
    const w = new Weather(() => 0.5);
    const seq = [w.kind];
    let t = 0;
    while (seq.length < 5 && t < 6000) {
      const k = w.kind;
      w.update(1); t++;
      if (w.kind !== k) seq.push(w.kind);
    }
    expect(seq).toEqual(['clear', 'cloudy', 'rain', 'clear', 'cloudy']);
    // minimalny czas między zmianami
    expect(t).toBeGreaterThanOrEqual(3 * 180);
  });
  it('śnieg wypada rzadko (rnd < 0.15 przy pochmurno)', () => {
    let n = 0;
    const w = new Weather(() => 0.05);
    w.set('cloudy');
    while (w.kind === 'cloudy' && n++ < 5000) w.update(1);
    expect(w.kind).toBe('snow');
    const w2 = new Weather(() => 0.5);
    w2.set('cloudy');
    n = 0;
    while (w2.kind === 'cloudy' && n++ < 5000) w2.update(1);
    expect(w2.kind).toBe('rain');
  });
});
