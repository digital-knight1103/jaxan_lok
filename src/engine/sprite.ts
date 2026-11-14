// Sprite'y proceduralne: rysowane raz do offscreen canvas i cache'owane.

export type DrawFn = (ctx: CanvasRenderingContext2D) => void;

export function makeSprite(w: number, h: number, draw: DrawFn): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return c;
}

const cache = new Map<string, unknown>();

/** Zwraca obiekt z cache albo tworzy go raz. */
export function cached<T>(key: string, make: () => T): T {
  let v = cache.get(key) as T | undefined;
  if (v === undefined) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

/** Skrót: prostokąt w kolorze. */
export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
