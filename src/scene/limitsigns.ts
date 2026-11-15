// Wskaźniki ograniczeń prędkości wg Ie-1 (§ 16):
//  - W 8 „ograniczenia prędkości": biały trójkąt wierzchołkiem w dół, czarne obramowanie,
//    czarna liczba = dozwolona prędkość w dziesiątkach km/h (stoi drogę hamowania przed odcinkiem);
//  - W 9 „odcinka ograniczonej prędkości": biały prostokąt z czarnym obramowaniem i czarnym
//    kątem wierzchołkiem ku dołowi = POCZĄTEK odcinka; odwrotna strona (kąt wierzchołkiem
//    ku górze) = KONIEC odcinka.
// Słupki stoją za torem (warstwa „za pociągiem", przyciemniana nocą jak reszta krajobrazu).
import { TRACK_Y, W } from '../config';
import { PAL } from '../palette';
import { cached, makeSprite, rect } from '../engine/sprite';
import { drawText, textWidth } from '../engine/font';
import { brakeDistance, LINE_KMH, type Zone } from '../train/limits';

const POST_H = 36;
const TRI_W = 17;
const TRI_H = 15;
const RECT_W = 9;
const RECT_H = 13;
/** Szerokość sprite'a (mieści trójkąt). */
const SPR_W = TRI_W;

/** Trójkąt równoboczny wierzchołkiem w dół: wiersz r (0 = górny, szeroki) → połowa szerokości. */
function halfWidth(r: number, h: number, w: number): number {
  return Math.round(((w - 1) / 2) * (1 - r / h));
}

function postBase(c: CanvasRenderingContext2D, top: number, cx: number): void {
  rect(c, cx, top, 1, POST_H - top, PAL.sigMast);
  rect(c, cx + 1, top, 1, POST_H - top, PAL.sigMastShade);
}

/** W 8 z liczbą w dziesiątkach km/h. */
function w8Sprite(kmh: number): HTMLCanvasElement {
  return cached('w8-' + kmh, () =>
    makeSprite(SPR_W, POST_H, (c) => {
      const cx = SPR_W >> 1;
      postBase(c, TRI_H - 1, cx);
      for (let r = 0; r < TRI_H; r++) {
        const hw = halfWidth(r, TRI_H, TRI_W);
        rect(c, cx - hw, r, hw * 2 + 1, 1, PAL.ieBlack);
        // wnętrze: biel, obramowanie 1 px z boków i u góry
        if (r > 0 && hw > 1) rect(c, cx - hw + 1, r, hw * 2 - 1, 1, PAL.ieWhite);
      }
      const txt = String(Math.round(kmh / 10));
      drawText(c, txt, cx - (textWidth(txt) >> 1), 2, PAL.ieBlack);
    }),
  );
}

/** W 9: początek (kąt wierzchołkiem w dół) albo koniec (kąt wierzchołkiem w górę). */
function w9Sprite(end: boolean): HTMLCanvasElement {
  return cached(end ? 'w9-end' : 'w9-start', () =>
    makeSprite(SPR_W, POST_H, (c) => {
      const left = (SPR_W - RECT_W) >> 1;
      const cx = left + (RECT_W >> 1);
      postBase(c, RECT_H - 1, cx);
      rect(c, left, 0, RECT_W, RECT_H, PAL.ieBlack);
      rect(c, left + 1, 1, RECT_W - 2, RECT_H - 2, PAL.ieWhite);
      // czarny kąt oparty na krótszym boku, wierzchołek dotyka przeciwległego boku
      const h = RECT_H - 2;
      for (let r = 0; r < h; r++) {
        const t = end ? h - 1 - r : r; // 0 = podstawa kąta
        const hw = Math.max(0, Math.round(((RECT_W - 2 - 1) / 2) * (1 - t / (h - 1))));
        rect(c, cx - hw, 1 + r, hw * 2 + 1, 1, PAL.ieBlack);
      }
    }),
  );
}

interface Sign {
  x: number;
  sprite: HTMLCanvasElement;
}

/** Znaki dla odcinków: W 8 przed początkiem, W 9 na początku i na końcu. */
function signsOf(z: Zone): Sign[] {
  const s = [
    { x: z.startX - brakeDistance(LINE_KMH, z.kmh), sprite: w8Sprite(z.kmh) },
    // przy stacji W 9 stoi tuż obok semafora wjazdowego, nie na nim
    { x: z.startX - (z.station ? 16 : 0), sprite: w9Sprite(false) },
    { x: z.endX, sprite: w9Sprite(true) },
  ];
  return s;
}

/** Rysuje znaki widoczne w kadrze. */
export function drawLimitSigns(ctx: CanvasRenderingContext2D, camX: number, zones: Zone[]): void {
  for (const z of zones) {
    for (const s of signsOf(z)) {
      const sx = Math.round(s.x - camX);
      if (sx < -SPR_W || sx > W + SPR_W) continue;
      ctx.drawImage(s.sprite, sx - (SPR_W >> 1), TRACK_Y + 3 - POST_H);
    }
  }
}

