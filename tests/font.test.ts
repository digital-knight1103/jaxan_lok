import { describe, it, expect } from 'vitest';
import { GLYPHS, textWidth } from '../src/engine/font';

describe('czcionka pikselowa', () => {
  const needed = ['KAMIENIEC ZĄBKOWICKI', 'JAXAN', 'KM/H 0123456789', 'ĄĆĘŁŃÓŚŹŻ', 'DRAGON 2', 'EAMOS'];
  for (const text of needed) {
    it(`ma glify dla „${text}"`, () => {
      for (const ch of text) expect(GLYPHS[ch], `brak znaku ${ch}`).toBeDefined();
    });
  }
  it('każdy glif ma 8 wierszy (2 akcent + 5 litera + 1 ogonek) i równą szerokość 1–5', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(8);
      const w = rows[0].length;
      expect(w, ch).toBeGreaterThanOrEqual(1);
      expect(w, ch).toBeLessThanOrEqual(5);
      for (const r of rows) expect(r.length, ch).toBe(w);
    }
  });
  it('JAXAN mieści się w 30 px', () => expect(textWidth('JAXAN')).toBeLessThanOrEqual(30));
  it('nieznany znak nie wywraca szerokości', () => expect(textWidth('A~A')).toBeGreaterThan(0));
});
