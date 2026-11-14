/** Maksymalny krok czasu – po powrocie do ukrytej karty świat nie „skacze". */
const MAX_DT = 0.1;

export function clampDt(rawSeconds: number): number {
  return Math.min(MAX_DT, Math.max(0, rawSeconds));
}

/** Pętla requestAnimationFrame z delta time (sekundy). */
export function startLoop(update: (dt: number) => void, render: () => void): void {
  let last = performance.now();
  const frame = (now: number) => {
    const dt = clampDt((now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
