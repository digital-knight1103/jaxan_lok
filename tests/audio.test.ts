import { describe, it, expect } from 'vitest';
import { AudioEngine } from '../src/engine/audio';

describe('AudioEngine bez AudioContext (np. przed interakcją / w node)', () => {
  it('wszystkie metody działają bez wyjątków przed i po unlock()', () => {
    const a = new AudioEngine();
    expect(() => {
      a.update(80, false, 1 / 60);
      a.hornStart();
      a.hornStop();
      a.setMuted(false);
      a.unlock();
      a.update(30, true, 1 / 60);
      a.hornStart();
      a.hornStop();
      a.setMuted(true);
    }).not.toThrow();
  });
  it('domyślnie wyciszony (biuro)', () => {
    expect(new AudioEngine().muted).toBe(true);
  });
});
