# JAXAN Express – pikselowa scena kolejowa

Interaktywna scena 2D w przeglądarce: lokomotywa Newag Dragon 2 w barwach JAXAN ciągnie
czarne węglarki Eamos JAXAN przez przewijany pikselowy krajobraz. Pełna specyfikacja: `PROMPT.md`.
Plan prac: `docs/plan.md`. Grafiki wzorcowe: `reference/`.

## Stos

- Vite + TypeScript + Canvas 2D, zero zależności runtime. Web Audio API do dźwięku.
- Rozdzielczość wewnętrzna 640×360, skala całkowita ×3 → 1920×1080. Nigdy skala ułamkowa ani wygładzanie.
- Wszystkie kolory tylko z `src/palette.ts`.

## Komendy

- `npm run dev` – serwer deweloperski (http://localhost:5173)
- `npm run build` – build produkcyjny (musi przechodzić przed commitem)
- `npm run test` – vitest, tylko dla czystej logiki

## Zasady pracy – oszczędnie i szybko (WAŻNE)

- **Pracuj sam, w głównej sesji.** Nie uruchamiaj subagentów (narzędzie Task/Agent).
  Wyjątek: najwyżej 1 subagent naraz i tylko gdy wprost o to poproszę.
- Z pluginu superpowers używaj: `brainstorming`, `writing-plans`, `executing-plans`,
  `systematic-debugging`, `verification-before-completion`.
  **Nie używaj**: `subagent-driven-development`, `dispatching-parallel-agents`,
  `using-git-worktrees` oraz recenzji kodu przez subagenta po każdym zadaniu.
- TDD (`test-driven-development`) tylko dla czystej logiki (fizyka jazdy, interpolacja dnia/nocy,
  generator segmentów). Nie pisz testów do rysowania.
- Nie czytaj ponownie całych plików, które już znasz – edytuj punktowo.
- Zrzuty ekranu Playwright tylko na końcu etapu (1–2 sztuki, okno 1920×1080), nie po każdej zmianie.
- Odpowiedzi krótkie: co zrobiono, co sprawdzić, co dalej. Bez długich podsumowań.
- Po zakończonym i działającym etapie: commit z opisem po polsku (`E2: lokomotywa Dragon 2 JAXAN`).

## Styl kodu

- Moduły w `src/engine`, `src/scene`, `src/sprites`, `src/train`, `src/ui`.
- Sprite'y proceduralne, generowane raz do offscreen canvas i cache'owane.
- Komentarze po polsku przy kluczowych miejscach. Pętla z delta time, logika niezależna od FPS.
- Malowanie JAXAN (pasy, szewrony, X, logo) ma pierwszeństwo przed efektami – brud, dithering
  i rim light nie mogą zniekształcać barw ani kształtów malowania.
