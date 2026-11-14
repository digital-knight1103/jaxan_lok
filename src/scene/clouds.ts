// Chmury pikselowe w stylu cumulus (jak na styl.jpg): kłęby nakładane od tyłu do
// przodu, kremowy jasny brzeg od góry, płaski niebiesko-szary spód.
// Paralaksa 0.15 + własny wolny dryf.
import { W } from '../config';
import { PAL } from '../palette';
import { makeSprite } from '../engine/sprite';
import { mulberry32 } from '../engine/rng';

const WRAP = W * 2; // chmury zawijają się co 1280 px
/** Od najjaśniejszego (brzeg) do najciemniejszego (spód). */
const RAMP = [PAL.cloudRim, PAL.cloudLight, PAL.cloudMid, PAL.cloudShade, PAL.cloudBase, PAL.cloudDeep] as const;

interface Cloud { sprite: HTMLCanvasElement; x: number; y: number; speed: number; drift: number }
interface Puff { x: number; y: number; r: number }

/** Uporządkowany dithering 2×2 – miękkie przejścia bez szumu. */
const BAYER = [0, 0.5, 0.75, 0.25];

function makeCloud(rnd: () => number): HTMLCanvasElement {
  const w = 110 + Math.floor(rnd() * 100);
  const h = 46 + Math.floor(rnd() * 26);
  const base = h - 6; // płaska podstawa
  return makeSprite(w, h, (ctx) => {
    // kłęby: niskie i szerokie na dole, wysokie „wieże" w środku
    const puffs: Puff[] = [];
    const atBase = new Uint8Array(w); // kolumny zamalowane na linii podstawy
    const n = 7 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const tall = Math.sin(u * Math.PI); // wyżej w środku
      const r = 9 + tall * (h * 0.28) * (0.7 + rnd() * 0.5);
      puffs.push({ x: 10 + u * (w - 20) + (rnd() - 0.5) * 8, y: base - r * 0.55 - tall * h * 0.18, r });
    }
    // od tyłu (najwyżej) do przodu (najniżej) – przednie kłęby nachodzą na tylne
    puffs.sort((a, b) => a.y - a.r * 0.2 - (b.y - b.r * 0.2));
    for (const p of puffs) {
      const R = Math.ceil(p.r);
      for (let dy = -R; dy <= R; dy++) {
        const y = Math.round(p.y) + dy;
        if (y > base || y < 0) continue;
        for (let dx = -R; dx <= R; dx++) {
          const d = Math.hypot(dx, dy) / p.r;
          if (d > 1) continue;
          const x = Math.round(p.x) + dx;
          if (x < 0 || x >= w) continue;
          // światło z lewej-góry na kłębie + przyciemnienie ku podstawie całej chmury
          const lit = -(dx * 0.45 + dy * 0.9) / p.r; // -1..1
          const low = Math.max(0, (y - (base - h * 0.35)) / (h * 0.35)); // 0..1 przy spodzie
          let t = 1.6 - lit * 1.5 + low * 2.2;
          if (d > 0.9 && dy < 0 && dx < p.r * 0.3) t = 0; // jasny brzeg od góry
          if (d > 0.93 && dy > 0) t += 1; // ciemny obrys od dołu – kłęby się odcinają
          t += BAYER[(x & 1) + (y & 1) * 2] - 0.4;
          ctx.fillStyle = RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(t)))];
          if (y === base) atBase[x] = 1;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    // płaski, ciemniejszy spód
    for (let x = 0; x < w; x++) {
      if (atBase[x]) {
        ctx.fillStyle = PAL.cloudDeep;
        ctx.fillRect(x, base, 1, 1);
      }
    }
  });
}

export class CloudLayer {
  private clouds: Cloud[] = [];

  constructor(seed: number, private factor = 0.15, count = 6) {
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        sprite: makeCloud(rnd),
        x: (i / count) * WRAP + rnd() * 60,
        y: 4 + Math.floor(rnd() * 100),
        speed: 0.6 + rnd() * 0.8,
        drift: 0,
      });
    }
  }

  update(dt: number): void {
    // wolny dryf niezależny od pociągu (zawijany – liczba nie rośnie)
    for (const c of this.clouds) c.drift = (c.drift + dt * 3 * c.speed) % WRAP;
  }

  draw(ctx: CanvasRenderingContext2D, worldX: number): void {
    for (const c of this.clouds) {
      // pozycja w [0, WRAP), a chmura wychodząca z lewej krawędzi – ujemna
      let x = (((c.x - worldX * this.factor - c.drift) % WRAP) + WRAP) % WRAP;
      if (x > WRAP - c.sprite.width) x -= WRAP;
      if (x > W) continue;
      ctx.drawImage(c.sprite, Math.floor(x), c.y);
    }
  }
}
