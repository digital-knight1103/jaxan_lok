// Dźwięk syntetyzowany Web Audio API (bez plików): stukot kół na złączach szyn,
// szum silników trakcyjnych, dwutonowa syrena i pisk hamulców.
// Domyślnie WYCISZONY (ekran w biurze). AudioContext powstaje dopiero w unlock(),
// wywoływanym przy pierwszej interakcji użytkownika.
import { PX_PER_KMH } from '../config';

/** Odstęp złączy szyn (px świata) i rozstaw osi w wózku (px). */
const JOINT_PX = 96;
const AXLE_PX = 14;

/** Akord syreny (Hz). */
const HORN = [370, 466];

type Ctx = AudioContext;

export class AudioEngine {
  muted = true;
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private motor: { osc: OscillatorNode; whine: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private horn: { gain: GainNode } | null = null;
  private squeal: { osc: OscillatorNode; gain: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  private jointDist = 0;
  private hornAt = 0;

  /** Tworzy AudioContext (wymaga gestu użytkownika). Bezpieczne do wielokrotnego wołania. */
  unlock(): void {
    if (this.ctx) {
      if (!this.muted && this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // biały szum do stukotu
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // silniki trakcyjne: niski „szum" + wysoki gwizd falownika
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    const whine = ctx.createOscillator();
    whine.type = 'triangle';
    whine.frequency.value = 200;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.15;
    osc.connect(filter);
    whine.connect(whineGain).connect(filter);
    filter.connect(gain).connect(this.master);
    osc.start();
    whine.start();
    this.motor = { osc, whine, gain, filter };

    // syrena: dwa piłokształtne tony przez filtr, wspólna obwiednia
    const hg = ctx.createGain();
    hg.gain.value = 0;
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 1800;
    for (const f of HORN) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(hf);
      o.start();
    }
    hf.connect(hg).connect(this.master);
    this.horn = { gain: hg };

    // pisk hamulców
    const sg = ctx.createGain();
    sg.gain.value = 0;
    const so = ctx.createOscillator();
    so.type = 'sine';
    so.frequency.value = 2800;
    so.connect(sg).connect(this.master);
    so.start();
    this.squeal = { osc: so, gain: sg };

    if (this.muted) void ctx.suspend();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(m ? 0 : 1, now, 0.05);
    // wyciszony = zawieszony kontekst (zero pracy CPU)
    if (m) setTimeout(() => this.muted && void this.ctx?.suspend(), 200);
    else void this.ctx.resume();
  }

  /** Wołane co klatkę. braking = skład zwalnia. */
  update(kmh: number, braking: boolean, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.motor || !this.squeal) return;
    const now = ctx.currentTime;
    const v = kmh / 120;
    this.motor.osc.frequency.setTargetAtTime(38 + kmh * 0.9, now, 0.2);
    this.motor.whine.frequency.setTargetAtTime(180 + kmh * 9, now, 0.2);
    this.motor.filter.frequency.setTargetAtTime(250 + kmh * 12, now, 0.2);
    this.motor.gain.gain.setTargetAtTime(kmh > 0.5 ? 0.05 + v * 0.07 : 0.015, now, 0.3);

    const sq = braking && kmh > 0.5 && kmh < 40 ? 0.025 * (1 - kmh / 40) + 0.01 : 0;
    this.squeal.gain.gain.setTargetAtTime(sq, now, 0.1);
    this.squeal.osc.frequency.setTargetAtTime(2600 + Math.sin(now * 23) * 120, now, 0.02);

    // stukot: dwa uderzenia na złącze (dwie osie wózka), tempo z prędkości
    const pxs = kmh * PX_PER_KMH;
    if (pxs <= 1) return;
    this.jointDist += pxs * dt;
    while (this.jointDist >= JOINT_PX) {
      this.jointDist -= JOINT_PX;
      this.click(now, v);
      this.click(now + AXLE_PX / pxs, v);
    }
  }

  private click(at: number, v: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + v * 600;
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.18 + v * 0.12, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(at);
    src.stop(at + 0.12);
  }

  hornStart(): void {
    if (!this.ctx || !this.horn || this.muted) return;
    const now = this.ctx.currentTime;
    const g = this.horn.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.16, now + 0.08); // narastanie
    this.hornAt = now;
  }

  hornStop(): void {
    if (!this.ctx || !this.horn) return;
    const now = this.ctx.currentTime;
    const g = this.horn.gain.gain;
    // krótkie naciśnięcie i tak daje sygnał min. 0,4 s (narastanie nie jest przerywane)
    const from = Math.max(now, this.hornAt + 0.4);
    if (from === now) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
    } else {
      g.setValueAtTime(0.16, from);
    }
    g.linearRampToValueAtTime(0, from + 0.3); // wygaszanie
  }
}
