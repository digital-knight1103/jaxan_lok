// Skład: lokomotywa Dragon 2 + N węglarek Eamos. Pociąg stoi w stałym miejscu
// ekranu (TRAIN_X), a koła obracają się proporcjonalnie do przejechanej drogi.
import { TRACK_Y, TRAIN_X, PX_PER_KMH, DEFAULT_WAGONS } from '../config';
import { getDragon2, LOCO_H, LOCO_W, LOCO_WHEEL_X, LOCO_WHEEL_Y } from '../sprites/dragon2';
import { getEamos, WAGON_H, WAGON_W, WAGON_WHEEL_X, WAGON_WHEEL_Y } from '../sprites/eamos';
import { WHEEL_FRAMES } from '../sprites/wheels';

/** Odstęp między pojazdami (zderzaki stykają się). */
const GAP = 1;

export class Consist {
  /** Przejechana droga w px (tylko do animacji kół – zawijana). */
  private dist = 0;
  /** Załadunek każdego wagonu 0..1. */
  loads: number[];

  constructor(wagons = DEFAULT_WAGONS) {
    this.loads = new Array(wagons).fill(1);
  }

  get wagons(): number {
    return this.loads.length;
  }

  update(dt: number, kmh: number): void {
    // zawijamy, żeby liczba nie rosła bez końca (praca wielogodzinna)
    this.dist = (this.dist + kmh * PX_PER_KMH * dt) % 100000;
  }

  /** Klatka obrotu koła o średnicy d: 8 pozycji na obrót, 4 klatki symetryczne. */
  private wheelFrame(d: number): number {
    return Math.floor((this.dist / (Math.PI * d)) * 8) % WHEEL_FRAMES;
  }

  /** Prostokąt lokomotywy na ekranie (do klikania). */
  locoRect(): { x: number; y: number; w: number; h: number } {
    return { x: TRAIN_X, y: TRACK_Y - LOCO_H, w: LOCO_W, h: LOCO_H };
  }

  /** x lewej krawędzi i-tego wagonu (wagony ciągnięte w lewo od lokomotywy). */
  wagonX(i: number): number {
    return TRAIN_X - (i + 1) * (WAGON_W + GAP);
  }

  /** Ekranowe x kół widocznych pojazdów (iskry hamulcowe). */
  wheelXs(): number[] {
    const xs = LOCO_WHEEL_X.map((wx) => TRAIN_X + wx);
    for (let i = 0; i < this.loads.length; i++) {
      const x = this.wagonX(i);
      if (x + WAGON_W < 0) break;
      for (const wx of WAGON_WHEEL_X) xs.push(x + wx);
    }
    return xs;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // wagony (od najdalszego), potem lokomotywa
    for (let i = this.loads.length - 1; i >= 0; i--) {
      const x = this.wagonX(i);
      if (x + WAGON_W < 0) continue;
      const s = getEamos(this.loads[i]);
      const y = TRACK_Y - WAGON_H;
      ctx.drawImage(s.body, x, y);
      const wf = s.wheels[this.wheelFrame(s.wheels[0].width)];
      for (const wx of WAGON_WHEEL_X) ctx.drawImage(wf, x + wx - (wf.width >> 1), y + WAGON_WHEEL_Y);
      ctx.drawImage(s.bogies, x, y);
    }
    const l = getDragon2();
    const y = TRACK_Y - LOCO_H;
    ctx.drawImage(l.pantograph, TRAIN_X, y);
    ctx.drawImage(l.body, TRAIN_X, y);
    const wf = l.wheels[this.wheelFrame(l.wheels[0].width)];
    for (const wx of LOCO_WHEEL_X) ctx.drawImage(wf, TRAIN_X + wx - (wf.width >> 1), y + LOCO_WHEEL_Y);
    ctx.drawImage(l.bogies, TRAIN_X, y);
  }
}
