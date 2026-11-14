import { describe, it, expect } from 'vitest';
import { lerpColor } from '../src/engine/color';

describe('lerpColor', () => {
  it('połowa między czernią a bielą', () => expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080'));
  it('t=0 i t=1 zwracają końce', () => {
    expect(lerpColor('#A0157E', '#5BC236', 0)).toBe('#a0157e');
    expect(lerpColor('#A0157E', '#5BC236', 1)).toBe('#5bc236');
  });
  it('t poza zakresem przycięte', () => expect(lerpColor('#000000', '#ffffff', 2)).toBe('#ffffff'));
});
