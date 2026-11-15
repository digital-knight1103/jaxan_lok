// Dźwięk syntetyzowany Web Audio API (bez plików): stukot kół na złączach szyn,
// szum silników trakcyjnych, dwutonowa syrena i pisk hamulców.
// Domyślnie WYCISZONY (ekran w biurze). AudioContext powstaje dopiero w unlock(),
// wywoływanym przy pierwszej interakcji użytkownika.
import { AUDIO, MAX_KMH, PX_PER_KMH } from '../config';

/** Parametry silnika dla prędkości – czysta funkcja (testowana). */
export function motorParams(kmh: number): { gain: number; lowpass: number; pitch: number; whine: number } {
  const v = Math.max(0, Math.min(1, kmh / MAX_KMH));
  return {
    gain: kmh > 0.5 ? AUDIO.motorBase + v * AUDIO.motorPerSpeed : AUDIO.motorIdle,
    lowpass: AUDIO.motorLowpassBase + kmh * AUDIO.motorLowpassPerKmh,
    pitch: AUDIO.motorPitchBase + kmh * AUDIO.motorPitchPerKmh,
    whine: AUDIO.whinePitchBase + kmh * AUDIO.whinePitchPerKmh,
  };
}

/** Odstęp złączy szyn (px świata) i rozstaw osi w wózku (px). */
const JOINT_PX = 96;
const AXLE_PX = 14;

/** Syrena dwutonowa (typu tyfon): dwie niezależne trąbki – niska (H) i wysoka (J); razem dają kwartę. */
export type HornId = 'lo' | 'hi';
const HORN_HZ: Record<HornId, number> = { lo: 311, hi: 415 };

type Ctx = AudioContext;

/** Jedna trąbka: obwiednia głośności i oscylatory (do ślizgu wysokości przy ataku). */
interface HornVoice { gain: GainNode; oscs: { o: OscillatorNode; f: number }[]; at: number }

/**
 * Trąbka lokomotywy: piła + rozstrojona piła + oktawa (trójkąt) przez rezonans kielicha (~1,1 kHz),
 * z cichym szumem powietrza. Atak: wysokość wślizguje się od ~5% niżej w 0,12 s, jak przy wpuszczeniu powietrza.
 */
function makeHornVoice(ctx: Ctx, out: AudioNode, hz: number): HornVoice {
  const env = ctx.createGain();
  env.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  lp.Q.value = 0.7;
  const bell = ctx.createBiquadFilter();
  bell.type = 'peaking';
  bell.frequency.value = 1100;
  bell.Q.value = 1.2;
  bell.gain.value = 7;
  lp.connect(bell).connect(env).connect(out);
  const oscs: { o: OscillatorNode; f: number }[] = [];
  for (const [type, mul, det, g] of [['sawtooth', 1, -4, 0.55], ['sawtooth', 1, 5, 0.45], ['triangle', 2, 0, 0.3]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = hz * mul;
    o.detune.value = det;
    const og = ctx.createGain();
    og.gain.value = g;
    o.connect(og).connect(lp);
    o.start();
    oscs.push({ o, f: hz * mul });
  }
  // szum powietrza przez trąbkę (pętla), mocno przytłumiony
  const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const ns = ctx.createBufferSource();
  ns.buffer = nb;
  ns.loop = true;
  const nbp = ctx.createBiquadFilter();
  nbp.type = 'bandpass';
  nbp.frequency.value = hz * 6;
  nbp.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.value = 0.05;
  ns.connect(nbp).connect(ng).connect(env);
  ns.start();
  return { gain: env, oscs, at: 0 };
}

export class AudioEngine {
  muted = true;
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private motor: { osc: OscillatorNode; whine: OscillatorNode; gain: GainNode; filter: BiquadFilterNode; filter2: BiquadFilterNode } | null = null;
  private horn: Record<HornId, HornVoice> | null = null;
  private squeal: { osc: OscillatorNode; gain: GainNode } | null = null;
  private noise: AudioBuffer | null = null;
  private jointDist = 0;
  private lastKmh = -1;
  private lastSq = 0;
  private rain: { gain: GainNode } | null = null;
  private rainLevel = 0;

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

    // silniki trakcyjne: niski „szum" + cichy gwizd falownika, przez DWA filtry
    // dolnoprzepustowe w szeregu (stromsze tłumienie – dźwięk „pod spodem")
    const m0 = motorParams(0);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = m0.lowpass;
    filter.Q.value = 0.5;
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = m0.lowpass;
    filter2.Q.value = 0.5;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = m0.pitch;
    const whine = ctx.createOscillator();
    whine.type = 'triangle';
    whine.frequency.value = m0.whine;
    const whineGain = ctx.createGain();
    whineGain.gain.value = AUDIO.motorWhineMix;
    osc.connect(filter);
    whine.connect(whineGain).connect(filter);
    filter.connect(filter2).connect(gain).connect(this.master);
    osc.start();
    whine.start();
    this.motor = { osc, whine, gain, filter, filter2 };

    // syrena dwutonowa: dwie niezależne trąbki (niska i wysoka)
    this.horn = { lo: makeHornVoice(ctx, this.master, HORN_HZ.lo), hi: makeHornVoice(ctx, this.master, HORN_HZ.hi) };

    // pisk hamulców
    const sg = ctx.createGain();
    sg.gain.value = 0;
    const so = ctx.createOscillator();
    so.type = 'sine';
    so.frequency.value = 2600;
    // wibrato pisku: LFO 23 Hz ±120 Hz (ustawione raz, bez zmian co klatkę)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 23;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(so.frequency);
    lfo.start();
    so.connect(sg).connect(this.master);
    so.start();
    this.squeal = { osc: so, gain: sg };

    // deszcz: pętla szumu przez pasmo 600–5000 Hz, głośność ustawia setRain()
    const rb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const rd = rb.getChannelData(0);
    for (let i = 0; i < rd.length; i++) rd[i] = Math.random() * 2 - 1;
    const rs = ctx.createBufferSource();
    rs.buffer = rb;
    rs.loop = true;
    const rhp = ctx.createBiquadFilter();
    rhp.type = 'highpass';
    rhp.frequency.value = 600;
    const rlp = ctx.createBiquadFilter();
    rlp.type = 'lowpass';
    rlp.frequency.value = 5000;
    const rg = ctx.createGain();
    rg.gain.value = AUDIO.rain * this.rainLevel;
    rs.connect(rhp).connect(rlp).connect(rg).connect(this.master);
    rs.start();
    this.rain = { gain: rg };

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

  /** Poziom deszczu 0..1 (szum w tle). Zmiana parametru tylko przy realnej różnicy. */
  setRain(level: number): void {
    const l = Math.max(0, Math.min(1, level));
    if (Math.abs(l - this.rainLevel) < 0.02 && !(l === 0 && this.rainLevel !== 0)) return;
    this.rainLevel = l;
    if (this.ctx && this.rain) this.rain.gain.gain.setTargetAtTime(AUDIO.rain * l, this.ctx.currentTime, 0.5);
  }

  /** Wołane co klatkę. braking = skład zwalnia. */
  update(kmh: number, braking: boolean, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.motor || !this.squeal) return;
    const now = ctx.currentTime;
    const v = kmh / 120;
    // parametry zmieniamy tylko przy realnej zmianie (nie co klatkę) – oś czasu
    // AudioParam nie puchnie przy wielogodzinnej pracy
    const sq = braking && kmh > 0.5 && kmh < 40 ? AUDIO.squealRange * (1 - kmh / 40) + AUDIO.squealBase : 0;
    if (Math.abs(kmh - this.lastKmh) >= 0.5 || (sq > 0) !== (this.lastSq > 0)) {
      this.lastKmh = kmh;
      this.lastSq = sq;
      const m = motorParams(kmh);
      this.motor.osc.frequency.setTargetAtTime(m.pitch, now, 0.2);
      this.motor.whine.frequency.setTargetAtTime(m.whine, now, 0.2);
      this.motor.filter.frequency.setTargetAtTime(m.lowpass, now, 0.2);
      this.motor.filter2.frequency.setTargetAtTime(m.lowpass, now, 0.2);
      this.motor.gain.gain.setTargetAtTime(m.gain, now, 0.3);
      this.squeal.gain.gain.setTargetAtTime(sq, now, 0.1);
    }

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
    g.gain.linearRampToValueAtTime(AUDIO.clackBase + v * AUDIO.clackPerSpeed, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(at);
    src.stop(at + 0.12);
  }

  hornStart(id: HornId = 'lo'): void {
    if (!this.ctx || !this.horn || this.muted) return;
    const now = this.ctx.currentTime;
    const v = this.horn[id];
    const g = v.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(AUDIO.horn, now + 0.06); // szybkie narastanie (powietrze)
    // ślizg wysokości od ~5% niżej – wejście tonu
    for (const { o, f } of v.oscs) {
      o.frequency.cancelScheduledValues(now);
      o.frequency.setValueAtTime(f * 0.95, now);
      o.frequency.exponentialRampToValueAtTime(f, now + 0.12);
    }
    v.at = now;
  }

  hornStop(id: HornId = 'lo'): void {
    if (!this.ctx || !this.horn) return;
    const now = this.ctx.currentTime;
    const v = this.horn[id];
    const g = v.gain.gain;
    // krótkie naciśnięcie i tak daje sygnał min. 0,4 s (narastanie nie jest przerywane)
    const from = Math.max(now, v.at + 0.4);
    if (from === now) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
    } else {
      g.setValueAtTime(AUDIO.horn, from);
    }
    g.linearRampToValueAtTime(0, from + 0.25); // wygaszanie
  }

  /**
   * Przelot pociągu z naprzeciwka: szum powietrza i stukot kół. Narasta do szczytu (minięcie
   * środka składu), potem opada; filtr schodzi z góry w dół (efekt Dopplera: zbliżanie i oddalanie).
   * heavy – skład towarowy: niższy, głośniejszy, wolniejszy stukot.
   */
  passby(peakS: number, totalS: number, heavy: boolean): void {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const peak = t0 + peakS;
    const end = t0 + totalS + 0.6;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.7;
    const f0 = heavy ? 520 : 760;
    bp.frequency.setValueAtTime(f0 * 1.5, t0);
    bp.frequency.exponentialRampToValueAtTime(f0, peak);
    bp.frequency.exponentialRampToValueAtTime(f0 * 0.55, end);
    const g = ctx.createGain();
    const level = AUDIO.passby * (heavy ? 1.2 : 1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(level, peak);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t0);
    src.stop(end + 0.1);
    // stukot kół na złączach: krótkie impulsy, częstsze i głośniejsze blisko szczytu
    const clack = ctx.createBufferSource();
    clack.buffer = this.noise;
    clack.loop = true;
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = heavy ? 260 : 340;
    cf.Q.value = 1.2;
    const cg = ctx.createGain();
    cg.gain.value = 0;
    const step = heavy ? 0.11 : 0.085;
    for (let t = t0 + 0.2; t < end - 0.2; t += step) {
      const near = 1 - Math.min(1, Math.abs(t - peak) / Math.max(0.5, totalS * 0.5));
      cg.gain.setValueAtTime(AUDIO.passby * 1.4 * near * near, t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    }
    clack.connect(cf).connect(cg).connect(this.master);
    clack.start(t0);
    clack.stop(end + 0.1);
  }

  /** RADIOSTOP: przenikliwy, przerywany alarm dwutonowy (~2,5 s) po przejechaniu sygnału STÓJ. */
  radiostop(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    const g = ctx.createGain();
    g.gain.value = 0;
    for (let i = 0; i < 10; i++) {
      const t = now + i * 0.25;
      osc.frequency.setValueAtTime(i % 2 ? 1040 : 760, t);
      g.gain.setValueAtTime(AUDIO.radiostop, t);
      g.gain.setValueAtTime(0, t + 0.2);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 2.6);
  }
}
