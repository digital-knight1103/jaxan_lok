// Wspólne cieniowanie materiałów (styl2): rampa 5 tonów [blask, światło, baza, półcień, cień],
// światło z lewej-góry, przejścia ditherowane (ditherEdge), cień pod okapem i u podstawy.
import { bayer, ditherEdge, paint } from '../../engine/pixbuf';

export type Ramp5 = readonly [string, string, string, string, string];

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, 1, 1);
};

/**
 * Płaska ściana oświetlona z lewej: jaśniejsza przy lewej krawędzi, ku prawej ciemniej,
 * rim light na lewej krawędzi, ciemniejszy pas pod okapem (`eave` px) i przy ziemi.
 */
export function shadeWall(
  ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, r: Ramp5, eave = 2,
): void {
  paint(ctx, x0, y0, w, h, (X, Y) => {
    const x = X - x0;
    const y = Y - y0;
    const u = w > 1 ? x / (w - 1) : 0;
    let t = 1.5 + u * 1.3; // światło → półcień w poprzek ściany
    if (y < eave) t += 1.6 - y * 0.5; // cień pod okapem
    if (y >= h - 2) t += 0.6; // kontakt z ziemią
    if (x === 0) t = 0; // rim light
    if (x === w - 1) t = Math.max(t, 3.6);
    return r[ditherEdge(t, 5, X, Y)];
  });
}

/** Kolor kolumny walca (zbiornik, komin): blask z lewej, głęboki cień z prawej. */
export function cylinderTone(r: Ramp5, i: number, w: number, x: number, y: number): string {
  const u = i / Math.max(1, w - 1);
  // profil walca: blask ~1/6 szerokości, potem baza i szybki spadek w cień
  const t = i === 0 ? 1 : u < 0.18 ? 0.4 + u * 3 : 1.6 + Math.pow(u, 1.6) * 2.6;
  return r[ditherEdge(t, 5, x, y)];
}

/** Pionowy walec w prostokącie. */
export function shadeCylinder(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, r: Ramp5): void {
  paint(ctx, x0, y0, w, h, (x, y) => cylinderTone(r, x - x0, w, x, y));
}

/** Szyba: odbicie nieba (jasny górny-lewy róg), ciemny dół. */
export function skyWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sky: string, glass: string, deep: string): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (i + j) / Math.max(1, w + h - 2);
      px(ctx, x + i, y + j, k < 0.3 ? sky : k < 0.55 && bayer(x + i, y + j) < 0.5 ? sky : j >= h - 1 ? deep : glass);
    }
  }
}
