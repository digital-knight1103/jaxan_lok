// „Kleks" pikselowy: suma kół z cieniowaniem od światła z lewej-góry i lekkim
// ditheringiem. Wspólny dla koron drzew, krzaków, chmur, dymu.

export interface Circle { x: number; y: number; r: number }

/**
 * Wypełnia sumę kół na ctx. ramp: kolory od najjaśniejszego do najciemniejszego.
 * light: kierunek światła (domyślnie z lewej-góry).
 */
export function drawBlob(
  ctx: CanvasRenderingContext2D,
  circles: Circle[],
  ramp: readonly string[],
  rnd: () => number,
  ox = 0,
  oy = 0,
  light = { x: -0.6, y: -0.8 },
  /** 0..1 – udział cieniowania „od góry całego kleksa" (chmury, kępy) zamiast per koło. */
  vertical = 0,
): void {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of circles) {
    minX = Math.min(minX, c.x - c.r); maxX = Math.max(maxX, c.x + c.r);
    minY = Math.min(minY, c.y - c.r); maxY = Math.max(maxY, c.y + c.r);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      // najbliższe koło, w którym leży piksel (dla „normalnej" do cieniowania)
      let best = -Infinity;
      let shade = 0;
      for (const c of circles) {
        const dx = x + 0.5 - c.x;
        const dy = y + 0.5 - c.y;
        const inside = 1 - Math.hypot(dx, dy) / c.r;
        if (inside >= 0 && inside > best - 0.15) {
          // iloczyn z kierunkiem światła: >0 = oświetlone
          const lit = (dx * light.x + dy * light.y) / c.r;
          if (inside > best) { best = inside; shade = lit; }
        }
      }
      if (best < 0) continue;
      // 0 = najjaśniejszy … 1 = najciemniejszy, z ditheringiem
      const perCircle = 0.5 - shade * 0.6;
      const fromTop = (y - minY) / Math.max(1, maxY - minY);
      let t = perCircle * (1 - vertical) + fromTop * vertical + (rnd() - 0.5) * 0.25;
      t = Math.min(0.999, Math.max(0, t));
      ctx.fillStyle = ramp[Math.floor(t * ramp.length)];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}
