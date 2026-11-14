import { W, H } from '../config';
import { PAL } from '../palette';

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Największa CAŁKOWITA skala bufora 640×360, która mieści się w oknie
 * (w pikselach fizycznych). Nigdy mniej niż 1, nigdy ułamek.
 */
export function computeViewport(winW: number, winH: number): Viewport {
  const scale = Math.max(1, Math.min(Math.floor(winW / W), Math.floor(winH / H)));
  return {
    scale,
    offsetX: Math.floor((winW - W * scale) / 2),
    offsetY: Math.floor((winH - H * scale) / 2),
  };
}

export interface Screen {
  /** Kontekst bufora 640×360 – tu rysuje cała scena. */
  buffer: CanvasRenderingContext2D;
  /** Przenosi bufor na ekran w skali całkowitej. */
  present(): void;
  toggleFullscreen(): void;
  /** Współrzędne zdarzenia (clientX/Y) → piksele gry. */
  toGame(clientX: number, clientY: number): { x: number; y: number };
  canvas: HTMLCanvasElement;
}

export function createScreen(): Screen {
  const canvas = document.createElement('canvas');
  canvas.id = 'screen';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const buffer = off.getContext('2d')!;
  buffer.imageSmoothingEnabled = false;

  let vp: Viewport = { scale: 1, offsetX: 0, offsetY: 0 };
  let dpr = 1;

  const resize = () => {
    // Liczymy w pikselach fizycznych, żeby ×3 na 1920×1080 było dokładne.
    dpr = window.devicePixelRatio || 1;
    const pw = Math.round(window.innerWidth * dpr);
    const ph = Math.round(window.innerHeight * dpr);
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    vp = computeViewport(pw, ph);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.letterbox;
    ctx.fillRect(0, 0, pw, ph);
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    buffer,
    canvas,
    present() {
      // Letterbox malowany przy resize; tu tylko obraz gry.
      ctx.drawImage(off, vp.offsetX, vp.offsetY, W * vp.scale, H * vp.scale);
    },
    toggleFullscreen() {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => {});
    },
    toGame(clientX, clientY) {
      return {
        x: (clientX * dpr - vp.offsetX) / vp.scale,
        y: (clientY * dpr - vp.offsetY) / vp.scale,
      };
    },
  };
}
