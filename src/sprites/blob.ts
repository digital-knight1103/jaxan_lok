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

/**
 * Listowie z kępek (korony drzew, krzaki, kępy trawy): ciemna baza w kształcie
 * elipsy, na niej kępki rysowane od tyłu do przodu – każda oświetlona z lewej-góry,
 * z jasnym refleksem. Dolne-prawe kępki ciemniejsze. Bez losowego szumu.
 * ramp: od najjaśniejszego (refleks) do najciemniejszego (głęboki cień).
 */
export function drawFoliage(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  ramp: readonly string[],
  rnd: () => number,
  clump: [number, number] = [2, 4],
  /** bazowa jasność kępek (indeks w ramp); większa = ciemniej */
  tone = 1.6,
): void {
  const last = ramp.length - 1;
  // baza: postrzępiona elipsa w ciemnym odcieniu
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 0.82) continue;
      ctx.fillStyle = ramp[last - 1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // kępki
  const area = Math.PI * rx * ry;
  const avg = (clump[0] + clump[1]) / 2;
  const n = Math.max(4, Math.round((area / (Math.PI * avg * avg)) * 1.6));
  const pts: Circle[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * 0.92;
    pts.push({ x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry, r: clump[0] + rnd() * (clump[1] - clump[0]) });
  }
  pts.sort((p, q) => p.y - q.y);
  for (const p of pts) {
    // położenie w koronie → bazowa jasność kępki (lewa-góra jaśniej)
    const pos = ((p.x - cx) / rx) * 0.45 + ((p.y - cy) / ry) * 0.75; // -1.2..1.2
    const base = tone + pos * 1.4;
    const R = Math.round(p.r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist > p.r) continue;
        const lit = -(dx * 0.6 + dy * 0.8) / p.r; // -1..1
        let idx = Math.round(base - lit * 1.3);
        if (dist > p.r - 0.8 && dy > 0) idx += 1; // ciemny brzeg od dołu – kępki się „odcinają"
        idx = Math.max(1, Math.min(last, idx));
        ctx.fillStyle = ramp[idx];
        ctx.fillRect(Math.round(p.x) + dx, Math.round(p.y) + dy, 1, 1);
      }
    }
    // refleks na kępce z lewej-góry (tylko na oświetlonych)
    if (base < 2.2) {
      ctx.fillStyle = ramp[0];
      ctx.fillRect(Math.round(p.x) - Math.round(R * 0.4), Math.round(p.y) - Math.round(R * 0.5), 1, 1);
    }
  }
}
