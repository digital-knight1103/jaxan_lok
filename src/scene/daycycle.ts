// Cykl dobowy: t ∈ [0,1) – 0 = północ, 0.5 = południe. Tryb automatyczny (pełna
// doba w DAY_LENGTH_S) albo ręczny (N): płynne przejście ~3 s do nocy/dnia.
import { DAY_LENGTH_S, NIGHT_TOGGLE_S, W } from '../config';
import { PAL } from '../palette';
import { lerpColor } from '../engine/color';
import type { SkyColors } from './sky';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Linia horyzontu dla słońca/księżyca (y bufora). */
const SUN_HORIZON = 200;

export class DayCycle {
  auto = true;
  private trans: { from: number; to: number; elapsed: number } | null = null;

  constructor(public t = 0.42) {}

  /** Wysokość słońca: −1 o północy, +1 w południe. */
  get elevation(): number {
    return -Math.cos(2 * Math.PI * this.t);
  }

  /** 0 = dzień, 1 = pełna noc. */
  get night(): number {
    return clamp01((0.05 - this.elevation) / 0.5);
  }

  /** Ciepło świtu/zmierzchu 0..1. */
  get warmth(): number {
    return clamp01(1 - Math.abs(this.elevation + 0.05) / 0.35);
  }

  update(dt: number): void {
    if (this.trans) {
      const tr = this.trans;
      tr.elapsed += dt;
      const u = Math.min(1, tr.elapsed / NIGHT_TOGGLE_S);
      this.t = tr.from + (tr.to - tr.from) * smooth(u);
      if (u >= 1) {
        this.t = tr.to % 1;
        this.trans = null;
      }
      return;
    }
    if (this.auto) this.t = (this.t + dt / DAY_LENGTH_S) % 1;
  }

  /** N: przełącz noc/dzień. Czas biegnie zawsze do przodu (przez zachód/świt). */
  toggleManual(): void {
    this.auto = false;
    const target = this.night > 0.5 ? 0.5 : 0; // południe albo północ
    const from = this.t;
    const dist = (((target - from) % 1) + 1) % 1;
    this.trans = { from, to: from + dist, elapsed: 0 };
  }

  /** Powrót do automatu (po bezczynności). */
  resumeAuto(): void {
    this.auto = true;
  }

  skyColors(): SkyColors {
    const n = this.night;
    const w = this.warmth;
    const base = {
      top: lerpColor(PAL.skyTop, PAL.skyNightTop, n),
      mid: lerpColor(PAL.skyMid, PAL.skyNightMid, n),
      horizon: lerpColor(PAL.skyHorizon, PAL.skyNightHorizon, n),
    };
    return {
      top: lerpColor(base.top, PAL.skyWarmTop, w * 0.5),
      mid: lerpColor(base.mid, PAL.skyWarmMid, w * 0.8),
      horizon: lerpColor(base.horizon, PAL.skyWarmHorizon, w * 0.9),
    };
  }

  /** Pozycja ciała niebieskiego dla fazy t (słońce: t, księżyc: t+0.5). */
  static bodyPos(t: number): { x: number; y: number; up: number } {
    const e = -Math.cos(2 * Math.PI * t);
    const u = (((t - 0.25) % 1) + 1) % 1; // 0 = wschód, 0.5 = zachód
    return { x: Math.round(W * (0.04 + u * 1.84)), y: Math.round(SUN_HORIZON - e * 170), up: e };
  }
}
