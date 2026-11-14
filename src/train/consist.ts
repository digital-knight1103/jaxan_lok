// Skład: lokomotywa Dragon 2 + N węglarek Eamos. Pociąg stoi w stałym miejscu
// ekranu (TRAIN_X), a koła obracają się proporcjonalnie do przejechanej drogi.
import { TRACK_Y, TRAIN_X, PX_PER_KMH, DEFAULT_WAGONS } from '../config';
import { getDragon2, LOCO_H, LOCO_LIGHTS, LOCO_W, LOCO_WHEEL_X, LOCO_WHEEL_Y } from '../sprites/dragon2';
import { PAL } from '../palette';
import { disc } from '../engine/sprite';
import { getEamos, WAGON_H, WAGON_W, WAGON_WHEEL_X, WAGON_WHEEL_Y } from '../sprites/eamos';
import { WHEEL_FRAMES } from '../sprites/wheels';

/** Odstęp między pojazdami (zderzaki stykają się). */
const GAP = 1;


export class Consist {
  /** Przejechana droga w px (tylko do animacji kół – zawijana). */
  private dist = 0;
  private kmh = 0;
  /** Przesunięcie „pływającej" kamery (px) – pociąg lekko wysuwa się przy przyspieszaniu. */
  shift = 0;
  /** Załadunek każdego wagonu 0..1. */
  loads: number[];

  constructor(wagons = DEFAULT_WAGONS) {
    this.loads = new Array(wagons).fill(1);
  }

  get wagons(): number {
    return this.loads.length;
  }

  /** Ekranowe x lewej krawędzi lokomotywy. */
  get locoX(): number {
    return TRAIN_X + Math.round(this.shift);
  }

  update(dt: number, kmh: number): void {
    this.kmh = kmh;
    // zawijamy, żeby liczba nie rosła bez końca (praca wielogodzinna)
    this.dist = (this.dist + kmh * PX_PER_KMH * dt) % 100000;
  }

  /** Klatka obrotu koła o średnicy d: 8 pozycji na obrót, 4 klatki symetryczne. */
  private wheelFrame(d: number): number {
    return Math.floor((this.dist / (Math.PI * d)) * 8) % WHEEL_FRAMES;
  }

  /** Drgania pudła na nierównościach toru (±1 px, faza różna dla każdego pojazdu). */
  private bounce(i: number): number {
    const amp = Math.min(1, this.kmh / 40);
    return Math.round(Math.sin(this.dist * 0.045 + i * 1.7) * Math.sin(this.dist * 0.013 + i) * amp * 1.4);
  }

  /** Prostokąt lokomotywy na ekranie (do klikania). */
  locoRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.locoX, y: TRACK_Y - LOCO_H, w: LOCO_W, h: LOCO_H };
  }

  /** x lewej krawędzi i-tego wagonu (wagony ciągnięte w lewo od lokomotywy). */
  wagonX(i: number): number {
    return this.locoX - (i + 1) * (WAGON_W + GAP);
  }

  /** Ekranowe x kół widocznych pojazdów (iskry hamulcowe). */
  wheelXs(): number[] {
    const xs = LOCO_WHEEL_X.map((wx) => this.locoX + wx);
    for (let i = 0; i < this.loads.length; i++) {
      const x = this.wagonX(i);
      if (x + WAGON_W < 0) break;
      for (const wx of WAGON_WHEEL_X) xs.push(x + wx);
    }
    return xs;
  }

  /** Światła lokomotywy nocą: reflektory, stożek światła na torze, czerwone tylne. */
  drawLights(ctx: CanvasRenderingContext2D, night: number): void {
    if (night <= 0.02) return;
    const X = this.locoX;
    const top = TRACK_Y - LOCO_H + this.bounce(-1);
    const low = LOCO_LIGHTS.front[1];
    const lx = X + low.x + 2;
    const ly = top + low.y;
    // stożek światła rozszerzający się ku szynom
    ctx.fillStyle = PAL.headlight;
    for (let dx = 0; dx < 150; dx++) {
      const y0 = Math.round(ly - dx * 0.06);
      const y1 = Math.min(TRACK_Y + 6, Math.round(ly + 1 + dx * 0.3));
      ctx.globalAlpha = night * 0.3 * (1 - dx / 150);
      ctx.fillRect(lx + dx, y0, 1, y1 - y0);
    }
    // reflektory i poświata
    for (const l of LOCO_LIGHTS.front) {
      ctx.globalAlpha = night * 0.45;
      disc(ctx, X + l.x, top + l.y, 3, PAL.headlight);
      ctx.globalAlpha = night;
      ctx.fillStyle = PAL.headlight;
      ctx.fillRect(X + l.x - 1, top + l.y, 2, 1);
    }
    for (const l of LOCO_LIGHTS.rear) {
      ctx.globalAlpha = night;
      ctx.fillStyle = PAL.tailRed;
      ctx.fillRect(X + l.x - 1, top + l.y, 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // cień składu na tłuczniu (pod ramami)
    const leftX = Math.max(0, this.wagonX(this.loads.length - 1));
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(leftX, TRACK_Y + 2, this.locoX + LOCO_W - leftX, 2);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(leftX, TRACK_Y + 4, this.locoX + LOCO_W - leftX, 1);
    ctx.globalAlpha = 1;
    // wagony (od najdalszego), potem lokomotywa; pudła drgają, koła zostają na szynie
    for (let i = this.loads.length - 1; i >= 0; i--) {
      const x = this.wagonX(i);
      if (x + WAGON_W < 0) continue;
      const s = getEamos(this.loads[i]);
      const y = TRACK_Y - WAGON_H;
      ctx.drawImage(s.body, x, y + this.bounce(i));
      const wf = s.wheels[this.wheelFrame(s.wheels[0].width)];
      for (const wx of WAGON_WHEEL_X) ctx.drawImage(wf, x + wx - (wf.width >> 1), y + WAGON_WHEEL_Y);
      ctx.drawImage(s.bogies, x, y);
    }
    const l = getDragon2();
    const X = this.locoX;
    const y = TRACK_Y - LOCO_H;
    const by = y + this.bounce(-1);
    ctx.drawImage(l.pantograph, X, y); // sprężyna dociska ślizg do przewodu – bez drgań
    ctx.drawImage(l.body, X, by);
    const wf = l.wheels[this.wheelFrame(l.wheels[0].width)];
    for (const wx of LOCO_WHEEL_X) ctx.drawImage(wf, X + wx - (wf.width >> 1), y + LOCO_WHEEL_Y);
    ctx.drawImage(l.bogies, X, y);
  }
}
