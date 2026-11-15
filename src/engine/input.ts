// Wejście: klawiatura, mysz i dotyk → akcje. Autorepeat klawiszy ignorowany,
// więc przytrzymane H = jeden ciągły sygnał.

export type Action =
  | 'horn-down' | 'horn-up' | 'toggle-night' | 'toggle-run' | 'faster' | 'slower'
  | 'toggle-mute' | 'fullscreen' | 'weather' | 'cinema' | 'wagon-add' | 'wagon-remove'
  | 'poi-prev' | 'poi-next' | 'toggle-auto' | 'help';

const KEYS: Record<string, Action> = {
  KeyH: 'horn-down',
  KeyA: 'toggle-auto',
  KeyN: 'toggle-night',
  Space: 'toggle-run',
  ArrowRight: 'faster',
  ArrowLeft: 'slower',
  KeyM: 'toggle-mute',
  KeyF: 'fullscreen',
  KeyW: 'weather',
  KeyC: 'cinema',
  Equal: 'wagon-add',
  NumpadAdd: 'wagon-add',
  Minus: 'wagon-remove',
  NumpadSubtract: 'wagon-remove',
  BracketLeft: 'poi-prev',
  BracketRight: 'poi-next',
};

export interface InputHandlers {
  onAction(a: Action): void;
  /** Każda aktywność (klawisz, ruch, dotyk) – reset bezczynności, odblokowanie audio. */
  onActivity(): void;
  /** Wciśnięcie klawisza (po onActivity, przed akcją); true = klawisz zjedzony (np. zamyka nakładkę pomocy). */
  onKey?(e: KeyboardEvent): boolean;
  /** Wciśnięcie wskaźnika (mysz/dotyk) – współrzędne clientX/Y. */
  onPointerDown(clientX: number, clientY: number): void;
  /** Ruch wskaźnika (przeciąganie mapy, podświetlenie punktów). */
  onPointerMove(clientX: number, clientY: number): void;
  onPointerUp(clientX: number, clientY: number): void;
}

export function bindInput(target: HTMLElement, h: InputHandlers): void {
  window.addEventListener('keydown', (e) => {
    const a: Action | undefined = e.key === '?' ? 'help' : KEYS[e.code];
    h.onActivity();
    if (h.onKey?.(e)) {
      e.preventDefault();
      return;
    }
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    h.onAction(a);
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyH') h.onAction('horn-up');
  });
  // utrata fokusu – nie zostawiaj „zaciętej" syreny
  window.addEventListener('blur', () => h.onAction('horn-up'));

  target.addEventListener('pointerdown', (e) => {
    h.onActivity();
    h.onPointerDown(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', (e) => h.onPointerUp(e.clientX, e.clientY));
  window.addEventListener('pointercancel', (e) => h.onPointerUp(e.clientX, e.clientY));
  window.addEventListener('pointermove', (e) => {
    h.onActivity();
    h.onPointerMove(e.clientX, e.clientY);
  });
}
