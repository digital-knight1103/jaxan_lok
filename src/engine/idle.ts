/** Śledzenie bezczynności użytkownika (chowanie kursora/HUD, powrót do automatu). */
export class IdleTracker {
  private last = 0;

  constructor(private timeoutMs: number) {}

  /** Zgłoś aktywność w chwili nowMs. */
  touch(nowMs: number): void {
    this.last = nowMs;
  }

  isIdle(nowMs: number): boolean {
    return nowMs - this.last >= this.timeoutMs;
  }
}
