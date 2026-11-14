import { describe, it, expect } from 'vitest';
import { IdleTracker } from '../src/engine/idle';

describe('IdleTracker', () => {
  it('bezczynność dopiero po upływie limitu', () => {
    const t = new IdleTracker(3000);
    t.touch(0);
    expect(t.isIdle(2999)).toBe(false);
    expect(t.isIdle(3000)).toBe(true);
  });
  it('aktywność resetuje licznik', () => {
    const t = new IdleTracker(3000);
    t.touch(0);
    t.touch(2500);
    expect(t.isIdle(4000)).toBe(false);
    expect(t.isIdle(5500)).toBe(true);
  });
});
