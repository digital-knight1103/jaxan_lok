// Pikselowa czcionka 5 px (wielkie litery) z polskimi znakami.
// Glif = 8 wierszy: 0–1 akcent nad literą, 2–6 litera, 7 ogonek (Ą, Ę).

const BASE: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '#.#', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  Ł: ['#..', '#..', '##.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ' ': ['..', '..', '..', '..', '..'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
};

type Mark = 'acute' | 'dot' | 'ogonek' | null;
const DERIVED: Record<string, [string, Mark]> = {
  Ą: ['A', 'ogonek'], Ć: ['C', 'acute'], Ę: ['E', 'ogonek'], Ń: ['N', 'acute'],
  Ó: ['O', 'acute'], Ś: ['S', 'acute'], Ź: ['Z', 'acute'], Ż: ['Z', 'dot'],
};

function build(rows: string[], mark: Mark): string[] {
  const w = rows[0].length;
  const blank = '.'.repeat(w);
  const set = (i: number) => blank.slice(0, i) + '#' + blank.slice(i + 1);
  const top =
    mark === 'acute' ? [set(Math.min(w - 1, (w >> 1) + 1)), set(w >> 1)]
    : mark === 'dot' ? [blank, set(w >> 1)]
    : [blank, blank];
  const bottom = mark === 'ogonek' ? set(w - 1) : blank;
  return [...top, ...rows, bottom];
}

export const GLYPHS: Record<string, string[]> = {};
for (const [ch, rows] of Object.entries(BASE)) GLYPHS[ch] = build(rows, null);
for (const [ch, [base, mark]] of Object.entries(DERIVED)) GLYPHS[ch] = build(BASE[base], mark);

const FALLBACK = GLYPHS[' '];

function glyph(ch: string): string[] {
  return GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? FALLBACK;
}

/** Szerokość napisu w px (odstęp 1 px między znakami), dla skali 1. */
export function textWidth(text: string, scale = 1): number {
  let w = 0;
  for (const ch of text) w += glyph(ch)[0].length + 1;
  return Math.max(0, w - 1) * scale;
}

/**
 * Rysuje napis. (x, y) = lewy górny róg korpusu litery (wiersz 2 glifu);
 * akcenty wystają 2 px nad y, ogonki 1 px pod.
 */
export function drawText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1,
): void {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const rows = glyph(ch);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '#') ctx.fillRect(cx + c * scale, y + (r - 2) * scale, scale, scale);
      }
    }
    cx += (rows[0].length + 1) * scale;
  }
}
