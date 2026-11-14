import { describe, it, expect } from 'vitest';
import { Pool } from '../src/engine/pool';

interface P { life: number }

describe('Pool – stała pojemność cząsteczek', () => {
  it('1000× spawn → najwyżej capacity żywych, nadmiar = null', () => {
    const pool = new Pool<P>(64, () => ({ life: 0 }));
    let nulls = 0;
    for (let i = 0; i < 1000; i++) {
      const p = pool.spawn();
      if (p) p.life = 1;
      else nulls++;
    }
    expect(pool.alive).toBe(64);
    expect(nulls).toBe(1000 - 64);
  });
  it('martwe wracają do puli i można je użyć ponownie', () => {
    const pool = new Pool<P>(4, () => ({ life: 0 }));
    for (let i = 0; i < 4; i++) pool.spawn()!.life = 1;
    pool.update((p) => p.life <= 0 || ((p.life -= 2), p.life <= 0));
    expect(pool.alive).toBe(0);
    expect(pool.spawn()).not.toBeNull();
  });
  it('forEach odwiedza tylko żywe', () => {
    const pool = new Pool<P>(8, () => ({ life: 0 }));
    pool.spawn()!.life = 5;
    pool.spawn()!.life = 7;
    let n = 0;
    pool.forEach(() => n++);
    expect(n).toBe(2);
  });
});
