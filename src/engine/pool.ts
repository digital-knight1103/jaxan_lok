// Pula obiektów o stałej pojemności – cząsteczki nigdy nie rosną w pamięci,
// nawet po wielu godzinach pracy. Martwe obiekty są wymieniane z ostatnim żywym.

export class Pool<T> {
  private items: T[];
  private n = 0;

  constructor(capacity: number, make: () => T) {
    this.items = Array.from({ length: capacity }, make);
  }

  get alive(): number {
    return this.n;
  }

  /** Zwraca wolny obiekt (do zainicjowania) albo null, gdy pula pełna. */
  spawn(): T | null {
    if (this.n >= this.items.length) return null;
    return this.items[this.n++];
  }

  forEach(fn: (p: T) => void): void {
    for (let i = 0; i < this.n; i++) fn(this.items[i]);
  }

  /** Aktualizuje żywe; isDead może też zmieniać stan obiektu. Martwe wracają do puli. */
  update(isDead: (p: T) => boolean): void {
    for (let i = 0; i < this.n; ) {
      if (isDead(this.items[i])) {
        const last = --this.n;
        const tmp = this.items[i];
        this.items[i] = this.items[last];
        this.items[last] = tmp;
      } else i++;
    }
  }
}
