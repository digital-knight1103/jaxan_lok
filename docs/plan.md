# JAXAN Express – plan wykonania

> **Wykonanie:** superpowers:executing-plans, w głównej sesji, bez subagentów (CLAUDE.md).
> Kroki jako checkboxy `- [ ]`. Commit **na koniec etapu**, nie zadania.

**Cel:** Zapętlona pikselowa scena kolejowa na biurowy ekran 1920×1080 – Dragon 2 JAXAN ciągnie
węglarki Eamos JAXAN przez nieskończoną trasę z kopalnią kamienia i stacją Kamieniec Ząbkowicki.

**Architektura:** Bufor 640×360 rysowany co klatkę i skalowany całkowicie na ekran. Świat = pozycja
`worldX` (px, float64) rosnąca z prędkością; warstwy paralaksy biorą `worldX * factor`. Trasa to
okno segmentów z rejestru (generator z seeda + „opowieść" landmarków). Sprite'y proceduralne, raz do
offscreen canvas. Oświetlenie: paleta dzienna + nakładka nocna sterowana `night ∈ [0,1]`.

**Stos:** Vite + TypeScript (strict), Canvas 2D, Web Audio API, vitest (tylko czysta logika). Zero zależności runtime.

**Spec:** `PROMPT.md` + `docs/superpowers/specs/2026-11-14-jaxan-express-design.md` (czytaj oba).

## Ograniczenia globalne

- Rozdzielczość wewnętrzna **640×360**; skala tylko całkowita; 1920×1080 → ×3 bez pasów; letterbox **#0E0E12**.
- `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`.
- Wszystkie kolory wyłącznie z `src/palette.ts` (m.in. #1A1A1E, #2A2A30, #A0157E, #6E0E58, #C42A9C, #5BC236, #1FA02E, #8E2A7A).
- Tor na ~62% wysokości: `TRACK_Y = 223` (górna krawędź szyny w px bufora).
- Lokomotywa ~**150×44 px**, wagon ~**96×40 px**, domyślnie **6** wagonów, Co'Co' (2×3 osie), Eamos 2×2 osie.
- Brak dymu z lokomotywy; pantograf podniesiony; sieć trakcyjna przesuwa się z prędkością toru.
- Prędkość zadana 0–120 km/h; start: jazda 80 km/h; wizualnie 120 km/h ≈ 200 px/s warstwy toru (`PX_PER_KMH = 200/120`).
- Dźwięk **domyślnie wyciszony**, nie zapamiętywany; AudioContext dopiero po interakcji.
- Bezczynność: kursor znika po 3 s, HUD po 4 s, powrót do automatu (jazda + cykl dobowy) po 180 s.
- Cykl dobowy: pełny obieg 8 min; ręczne `N` – przejście 3 s.
- Landmarki na zmianę co `LANDMARK_SPACING_PX = 20000` (~2,5 min przy 80 km/h): kopalnia → … → stacja → …
- Logika niezależna od FPS; `dt` przycinane do 0,1 s. Cel 60 FPS.
- Komentarze po polsku przy kluczowych miejscach. Klawisze: `H` trąbienie, `N` noc/dzień, `Spacja` start/stop, `←/→` prędkość, `M` dźwięk, `F` pełny ekran.

## Na co uważać w przeglądzie (Review Focus)

1. **Wielogodzinna praca** – liczba segmentów w pamięci, cząsteczek i ptaków musi być ograniczona niezależnie od przejechanego dystansu (testy w Zad. 6 i 11).
2. **Powrót do ukrytej karty** – po długiej przerwie rAF daje ogromne `dt`; ma być przycięte, bez skoku fizyki ani lawiny cząsteczek (test w Zad. 2).
3. **Dziwne rozmiary okna** (1366×768, 2560×1440, okno mniejsze niż 640×360) – zawsze całkowita skala ≥1, wyśrodkowanie (test w Zad. 1).
4. **Przytrzymane klawisze / autorepeat** – `H` trzymane = jeden ciągły sygnał (ignoruj `repeat`), `←/→` nie wychodzą poza 0–120 (test w Zad. 4).
5. **Dźwięk przed interakcją / wyciszony** – żadnych wyjątków, gdy AudioContext nie istnieje; trąbienie przy wyciszeniu dalej płoszy ptaki (test w Zad. 8).

---

## Struktura plików

```
index.html, vite.config.ts, tsconfig.json, package.json, vitest.config.ts
src/main.ts                 – start, sklejenie modułów
src/config.ts               – stałe (wymiary, TRACK_Y, prędkości, czasy bezczynności)
src/palette.ts              – wszystkie kolory + paleta nocna
src/state.ts                – AppState (jedno źródło prawdy dla UI/sceny)
src/engine/screen.ts        – skalowanie, canvas, fullscreen
src/engine/loop.ts          – rAF z dt
src/engine/input.ts         – klawiatura/mysz/dotyk → akcje
src/engine/audio.ts         – Web Audio: stukot, silniki, trąbienie, pisk
src/engine/rng.ts           – mulberry32
src/engine/font.ts          – bitmapowa czcionka 5 px z PL znakami
src/engine/sprite.ts        – makeSprite() + cache
src/engine/idle.ts          – IdleTracker
src/engine/pool.ts          – pula cząsteczek
src/train/physics.ts        – bezwładność
src/train/consist.ts        – skład, pozycje wagonów, obrót kół, drgania
src/sprites/dragon2.ts, eamos.ts, nature.ts, industry.ts, station.ts, quarry.ts
src/scene/daycycle.ts       – czas doby, night, kolory nieba
src/scene/sky.ts, mountains.ts, clouds.ts, track.ts, catenary.ts, birds.ts, sparks.ts
src/scene/route.ts          – generator segmentów (okno + opowieść)
src/scene/segments/types.ts – interfejs Segment
src/scene/segments/registry.ts + forest.ts, embankment.ts, bridge.ts, plant.ts, station.ts, quarry.ts
src/ui/hud.ts
tests/*.test.ts
```

---

## E1 – szkielet, skalowanie, niebo + 1 warstwa paralaksy

### Task 1: Projekt Vite + skalowanie pikseli

**Pliki:** utwórz `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/config.ts`, `src/palette.ts`, `src/engine/screen.ts`, `tests/screen.test.ts`

**Interfejsy (produkuje):**
- `config.ts`: `W=640, H=360, TRACK_Y=223, PX_PER_KMH, MAX_KMH=120, START_KMH=80` itd. (wartości z „Ograniczeń").
- `computeViewport(winW: number, winH: number): { scale: number; offsetX: number; offsetY: number }`
- `createScreen(): { ctx: CanvasRenderingContext2D; buffer: CanvasRenderingContext2D; present(): void; toggleFullscreen(): void; toGame(clientX, clientY): {x,y} }`

- [x] `npm create vite` (vanilla-ts) w bieżącym katalogu, `npm i -D vitest`; skrypty `dev`, `build`, `test` (`vitest run`).
- [x] Test `computeViewport`: `(1920,1080)→{3,0,0}`, `(1366,768)→{2,43,24}`, `(2560,1440)→{4,0,0}`, `(600,300)→scale 1` (nigdy <1), offsety zaokrąglone w dół.
- [x] `npm run test` → FAIL; zaimplementuj; → PASS.
- [x] `screen.ts`: widoczny canvas na całe okno (devicePixelRatio uwzględnione, by ×3 było fizycznymi pikselami), tło #0E0E12, `present()` kopiuje bufor z `drawImage` w skali całkowitej; resize nasłuchiwany; `F` → Fullscreen API.

### Task 2: Pętla, niebo, pierwsza warstwa gór

**Pliki:** `src/engine/loop.ts`, `src/engine/rng.ts`, `src/scene/sky.ts`, `src/scene/mountains.ts`, `src/main.ts`, `tests/loop.test.ts`

**Interfejsy:** `clampDt(rawSeconds: number): number` (max 0,1, min 0); `startLoop(update(dt), render())`; `mulberry32(seed): () => number`; `drawSky(ctx, colors)`; `MountainLayer { constructor(seed, factor, palette); draw(ctx, worldX) }` – profil gór generowany raz, kafel szer. 640 px powtarzany bez szwu.

- [x] Test `clampDt`: `0.016→0.016`, `5→0.1`, `-1→0`; test `mulberry32(1)` deterministyczny (dwie instancje = te same 5 liczb).
- [x] FAIL → implementacja → PASS.
- [x] `main.ts`: `worldX += START_KMH*PX_PER_KMH*dt`; niebo gradientowe (kolory z palety, styl.jpg: błękit → turkus przy horyzoncie) + 1 warstwa gór `factor 0.1`.
- [x] Weryfikacja E1: `npm run build` przechodzi; `npm run dev`, Playwright 1920×1080 → `screenshots/e1.png`; ostre piksele, brak pasów, brak błędów w konsoli.
- [x] Commit `E1: szkielet Vite, skalowanie pikseli, niebo i góry`.

---

## E2 – tabor i jazda

### Task 3: Sprite'y Dragon 2 JAXAN i Eamos JAXAN

**Pliki:** `src/engine/sprite.ts`, `src/engine/font.ts`, `src/sprites/dragon2.ts`, `src/sprites/eamos.ts`, `tests/font.test.ts`

**Interfejsy:** `makeSprite(w, h, draw: (ctx) => void): HTMLCanvasElement`; `GLYPHS: Record<string, string[]>` (5 wierszy, szer. 3–5); `drawText(ctx, text, x, y, color)`; `textWidth(text): number`; `getDragon2(): { body: HTMLCanvasElement; wheel: HTMLCanvasElement[] /*klatki obrotu*/; pantograph: HTMLCanvasElement; lightsMask: HTMLCanvasElement }`; `getEamos(load: 0..1): { body; wheel[] }`.

- [x] Test czcionki: każdy znak z `"KAMIENIEC ZĄBKOWICKI"`, `"JAXAN"`, `"KM/H 0123456789"`, `"ĄĆĘŁŃÓŚŹŻ"` ma glif; `textWidth("JAXAN")` ≤ 30.
- [x] FAIL → glify → PASS.
- [x] Dragon 2 150×44 (bez pantografu): czarne kabiny o skośnych czołach, magentowy środek z cieniem/blaskiem, szewrony czarny-zielony-czarny przy obu kabinach (skierowane jak na referencji), logo „JAXAN" z X-rombem, kratki wentylacyjne, rama + 2 wózki trzyosiowe, białe drobne napisy, reflektory 2 dolne + 1 górny.
- [x] Eamos 96×40: czarne pudło z pionowymi żebrami, zielony pas u góry przechodzący w magentę, „X" zielono-magentowy po prawej, białe tabliczki, magentowe poręcze, bufory, 2 wózki dwuosiowe; ładunek szarego kruszywa z nierównym wierzchem (wysokość zależna od `load`).

### Task 4: Fizyka jazdy i skład

**Pliki:** `src/train/physics.ts`, `src/train/consist.ts`, `src/scene/track.ts` (prosta wersja: szyny + podkłady), `tests/physics.test.ts`

**Interfejsy:** `stepSpeed(kmh: number, targetKmh: number, dt: number): number` (ACCEL 3 km/h/s, BRAKE 6 km/h/s); `adjustTarget(target: number, delta: number): number` (krok 10, clamp 0–120); `Consist { wagons: number; update(dt, kmh); draw(ctx, screenX) }` – lokomotywa na `TRAIN_X = 230`, wagony ciągnięte w lewo, koła obracają się proporcjonalnie do drogi.

- [x] Testy: rośnie do celu bez przestrzelenia; maleje do 0 i nie spada poniżej; 60×`dt=1/60` ≈ 1×`dt=1` (±0,01); `adjustTarget(115,+10)=120`, `adjustTarget(5,-10)=0`.
- [x] FAIL → implementacja → PASS.
- [x] Rysowanie składu na torze w `main.ts`; tor przewija się z `worldX`.
- [x] Weryfikacja E2: build, Playwright → `screenshots/e2.png`; porównaj z `reference/dragon2_jaxan.png` i `eamos_jaxan.png` (czytelność JAXAN, szewrony, proporcje); popraw sprite'y, jeśli trzeba.
- [x] Commit `E2: lokomotywa Dragon 2 JAXAN i węglarki Eamos`.

---

## E3 – pełna paralaksa, trasa, most, sieć trakcyjna

### Task 5: Warstwy tła i pierwszego planu

**Pliki:** `src/scene/clouds.ts`, `src/scene/mountains.ts` (druga warstwa), `src/sprites/nature.ts`, `src/scene/catenary.ts`

**Interfejsy:** `CloudLayer { update(dt); draw(ctx, worldX) }` (stała liczba chmur, zawijane); `CatenaryLayer.draw(ctx, worldX)` (słup co 120 px, przewód jezdny ~ `TRACK_Y-58`, lekko zwisający); `nature.ts`: `getTree(variant)`, `getBush(variant)`, `getGrassStrip()`.

- [x] Kolejność i współczynniki: góry 0,05 i 0,1; chmury 0,15 + własny dryf; średni plan 0,4; sieć i tor 1,0; pierwszy plan 1,3.
- [x] Pantograf styka się z przewodem jezdnym (dopasuj wysokość).

### Task 6: Generator trasy i segmenty

**Pliki:** `src/scene/segments/types.ts`, `registry.ts`, `forest.ts`, `embankment.ts`, `bridge.ts`, `plant.ts`, `src/scene/route.ts`, `tests/route.test.ts`

**Interfejsy:**
```ts
interface SegmentEnv { night: number; time: number; rng: () => number }
interface SegmentDef {
  id: string; kind: 'filler' | 'landmark'; width: number;   // px świata
  bridge?: boolean;                                         // tor na moście zamiast nasypu
  drawMid?(ctx, x, env): void;   // średni plan (rysowany z factor 0.4 – x już przeliczony)
  drawBed(ctx, x, env): void;    // nasyp/most pod torem
  drawFront?(ctx, x, env): void; // pierwszy plan
  hopperX?: number;              // pozycja leja (kopalnia)
}
class Route { constructor(seed: number, registry: SegmentDef[]); visible(x0: number, x1: number): { def: SegmentDef; startX: number }[]; get cachedCount(): number }
```
Opowieść: po landmarku dokładane są fillery aż do `LANDMARK_SPACING_PX`, potem następny landmark z cyklu `['quarry','station']`; dwa mosty nigdy pod rząd.

- [x] Testy: deterministyczny dla seeda; segmenty ciągłe (`startX` następnego = koniec poprzedniego); landmarki na zmianę i w odstępie ≥ `LANDMARK_SPACING_PX`; brak dwóch `bridge` pod rząd; po `visible(1e8, 1e8+640)` → `cachedCount ≤ 16` (pamięć ograniczona).
- [x] FAIL → implementacja (segmenty za lewą krawędzią usuwane) → PASS.
- [x] Fillery: las, nasyp z krzakami, **stalowy most łukowy nad doliną** (jak styl.jpg), zakład przemysłowy z kominami (dym z kominów OK), silosy, okna.
- [x] Weryfikacja E3: build, Playwright → `screenshots/e3.png` (kadr z mostem); porównaj kompozycję ze `styl.jpg`.
- [x] Commit `E3: paralaksa, generator trasy, most i sieć trakcyjna`.

### Task 7: Landmarki – kopalnia i stacja Kamieniec Ząbkowicki

**Pliki:** `src/sprites/quarry.ts`, `src/sprites/station.ts`, `src/scene/segments/quarry.ts`, `src/scene/segments/station.ts`, `registry.ts`

- [x] Kopalnia (szer. ~900 px): tarasowe ściany wyrobiska szaro-beżowe, koparka, wywrotki, przenośnik taśmowy z sypiącym się kruszywem na hałdę, lej nad torem (`hopperX`).
- [x] Stacja (szer. ~800 px): peron, wiata, budynek dworca, lampy, tablica „KAMIENIEC ZĄBKOWICKI" (`drawText`), w tle sylwetka pałacu Marianny Orańskiej (neogotyk, wieżyczki).
- [x] Rejestracja w `registry.ts`; zapisz w komentarzu na górze pliku, jak dodać nowy landmark.
- [x] Zrzut kontrolny obu landmarków (ustaw `worldX` ręcznie) → `screenshots/e3-landmarki.png`; commit `E3: kopalnia i stacja Kamieniec Ząbkowicki`.

---

## E4 – interakcje MVP, HUD, dźwięk

### Task 8: Stan, wejście, bezczynność, dźwięk

**Pliki:** `src/state.ts`, `src/engine/input.ts`, `src/engine/idle.ts`, `src/engine/audio.ts`, `tests/idle.test.ts`, `tests/audio.test.ts`

**Interfejsy:**
```ts
interface AppState { running: boolean; targetKmh: number; kmh: number; muted: boolean; horn: boolean;
  dayAuto: boolean; wagons: number; hudVisible: boolean }
type Action = 'horn-down'|'horn-up'|'toggle-night'|'toggle-run'|'faster'|'slower'|'toggle-mute'|'fullscreen'
bindInput(target: HTMLElement, onAction: (a: Action) => void, onActivity: () => void): void
class IdleTracker { constructor(timeoutMs: number); touch(nowMs: number): void; isIdle(nowMs: number): boolean }
class AudioEngine { unlock(): void; setMuted(m: boolean): void; update(kmh: number, braking: boolean): void; hornStart(): void; hornStop(): void }
```
- [x] Testy: `IdleTracker(3000)` – `touch(0)`, `isIdle(2999)=false`, `isIdle(3000)=true`; `AudioEngine` w środowisku bez `AudioContext` (node): wszystkie metody bez wyjątku przed `unlock()`.
- [x] FAIL → implementacja → PASS.
- [x] `input.ts`: zdarzenia `keydown` z `repeat=true` ignorowane; `H` keydown/keyup → horn-down/up; klik/dotyk w prostokąt lokomotywy → horn; każde zdarzenie → `onActivity` i `audio.unlock()`.
- [x] Audio: stukot kół (2 uderzenia na złącze co 25 m wizualnie → tempo ∝ prędkość), szum silników (oscylator + filtr, ton rośnie z prędkością), trąbienie 370+466 Hz z narastaniem/wygaszaniem, pisk hamulców przy hamowaniu < 40 km/h. Start: `muted = true`.
- [x] Bezczynność 180 s → `running=true`, `targetKmh=START_KMH`, `dayAuto=true`.

### Task 9: HUD

**Pliki:** `src/ui/hud.ts`

- [x] HUD rysowany w buforze 640×360 czcionką pikselową, barwy JAXAN: prędkościomierz (aktualna/zadana), przyciski 📯 ☀/🌙 ▶/⏸ − + (suwak jako 2 przyciski + pasek), 🔊/🔇, ⛶ – ikony jako mini-sprite'y pikselowe (nie emoji).
- [x] Klik/dotyk przez `screen.toGame()`; HUD i kursor chowają się po 4 s / 3 s bezczynności.
- [x] Iskry spod kół przy hamowaniu (`src/scene/sparks.ts` na puli z Zad. 11 – tu prosta wersja z tablicą o stałej pojemności 64).
- [x] Weryfikacja E4: build; ręcznie: H, Spacja, ←/→, M, F, klik w lokomotywę, dotyk (Playwright emulacja mobilna); Playwright → `screenshots/e4.png`; commit `E4: sterowanie, HUD i dźwięk`.

---

## E5 – noc/dzień i oświetlenie

### Task 10: Cykl dobowy

**Pliki:** `src/scene/daycycle.ts`, `src/palette.ts`, `tests/daycycle.test.ts`, oraz `drawNight?` / użycie `env.night` w segmentach

**Interfejsy:**
```ts
lerpColor(a: string, b: string, t: number): string           // '#rrggbb'
class DayCycle { t: number /*0=północ,0.5=południe*/; auto: boolean;
  update(dt: number): void; toggleManual(): void; get night(): number; skyColors(): { top: string; horizon: string } }
```
- [x] Testy: `lerpColor('#000000','#ffffff',0.5)='#808080'`; `night` przy `t=0` = 1, `t=0.5` = 0, ciągłe (różnica dla `t` co 0,001 < 0,05); auto: 480 s `update` = pełny obieg; `toggleManual()` w dzień → po 3 s `night=1`, `auto=false`.
- [x] FAIL → implementacja → PASS.
- [x] Oświetlenie: nakładka przyciemniająca (multiply kolorem nocnym), gwiazdy, księżyc, okna zakładu/stacji, lampy peronowe, reflektory lokomotywy ze stożkiem na torze (rysowane po nakładce, `lighter`), ciepłe barwy zachodu/wschodu.
- [x] Iskry z pantografu w nocy (losowo, częściej przy dużej prędkości).
- [x] Weryfikacja E5: build; Playwright → `screenshots/e5-noc.png` i `e5-zachod.png`; commit `E5: cykl dobowy i oświetlenie`.

---

## E6 – dopracowanie

### Task 11: Ożywienie sceny i stabilność

**Pliki:** `src/engine/pool.ts`, `src/scene/birds.ts`, `src/scene/sparks.ts`, `src/train/consist.ts`, `src/scene/catenary.ts`, `tests/pool.test.ts`

**Interfejsy:** `class Pool<T> { constructor(capacity: number, make: () => T); spawn(): T | null; forEach(fn); update(dt, isDead: (p: T) => boolean) ; get alive(): number }`

- [x] Test: `Pool(64)` – 1000× `spawn()` → `alive ≤ 64`, nadmiar zwraca `null`; martwe wracają do puli.
- [x] FAIL → implementacja → PASS; iskry, dym kominów, kruszywo i ptaki przechodzą na `Pool`.
- [x] Drgania wagonów (±1 px z przesunięciem fazy), kołysanie przewodu, ptaki na drzewach zrywające się na trąbienie, kamera „pływa" (±6 px) przy przyspieszaniu/hamowaniu.
- [x] Test wytrzymałości: tryb `?soak` w `main.ts` – symulacja 8 h (`update` w pętli bez renderu, dt=1/60) → log liczby segmentów i cząsteczek; muszą być stałe. Uruchom w Playwright, sprawdź log.
- [x] Profil w Chrome: stabilne 60 FPS przy 6 wagonach w nocy.
- [x] `README.md` po polsku: uruchomienie, sterowanie, jak dodać segment/landmark.
- [x] Weryfikacja E6: build, test, Playwright → `screenshots/e6.png`; Firefox (Playwright firefox) bez błędów; commit `E6: dopracowanie, ptaki, iskry, README`.

---

## Etap 2 (po akceptacji MVP)

Każdy punkt osobno: implementacja → build → zrzut → commit.

- [x] **Pogoda `W`** – zrobione 15.11 (patrz „Zmiana planu 15.11”).
- [x] ~~**Załadunek w kopalni**~~ (rezygnacja – scena tła): zatrzymanie z wagonem pod `hopperX` (±12 px) → sypanie kruszywa, `load` 0→1 w 3 s, kolejny wagon wymaga podjechania. Wagony w trasie wracają do „pustych" po stacji (logika w `consist.ts`, test na stan wagonów).
- [x] **Semafory** – zrobione w poprawkach 2026-11-14 (część 2), patrz niżej.
- [x] ~~**Liczba wagonów**~~ (rezygnacja – scena tła).
- [x] ~~**Licznik km i ton**~~ (rezygnacja – scena tła).
- [x] **Tryb kinowy `C`** – zrobione 15.11 (płynny zoom ułamkowy ×1–1,3 zamiast całkowitego ×1/×2).

---

## Poprawki po MVP (2026-11-14) – zrobione

MVP zaakceptowane. Trzy poprawki, każda osobnym commitem.

- [x] **Grafika v2** – porównanie zrzutów 1920×1080 (dzień/noc) z `reference/styl.jpg`, 6 ulepszeń:
  chmury cumulus (warstwowe kłęby, jasny brzeg, płaski niebiesko‑szary spód, bez szumu); góry z fasetami
  (jasna lewa ściana / cień za linią od szczytu), mgiełka ku podstawie, trzecie najdalsze pasmo;
  trawa ze skośnymi źdźbłami i refleksami, krzaki/korony z kępek liści (`drawFoliage`); wzgórza 3‑tonowe
  z mgiełką; most: cień pomostu (3 stopnie), mgiełka w dolinie, kratownica z refleksem, spoiny filarów;
  tor w perspektywie (tłuczeń z wierzchu, podkłady‑trapezy, błysk szyny); tabor: połysk lakieru, nity,
  cień składu na tłuczniu, koła 8 klatek ze znacznikiem obrotu i błyskiem obręczy.
  Dragon 2 nie ma korbowodów (napęd indywidualny) – zamiast nich wyraźny obrót piast.
  Wydajność bez zmian: wszystko prerenderowane, max klatka 13,5 ms.
- [x] **Dźwięk** – silniki ~60% ciszej, dwa filtry dolnoprzepustowe w szeregu, ton rośnie łagodnie
  (gwizd ≤ ~380 Hz); stukot i klakson bez zmian; wszystkie poziomy w `config.ts` → `AUDIO`;
  test `tests/audio-levels.test.ts` (`motorParams`).
- [x] **Mapa trasy** – pasek na dole (±10 km, 1 km = 3600·PX_PER_KMH px), ikony stacji/kopalni,
  znaczniki mostów/zakładów, przeciąganie, klik w punkt / `[` `]` = szybki przejazd (rozmycie +
  ściemnienie 0,5 s, dojazd z hamowaniem 3 s, postój przy punkcie). Chowa się z HUD.
  `RouteIndex` (deterministyczna kopia generatora, pamięć ograniczona), `TravelAnim`, skok wstecz
  odbudowuje trasę z seeda (`World.prepare` + `Route.firstX`). Testy: `routeindex.test.ts`,
  `travel.test.ts`, `route.test.ts` (firstX).

---

## Poprawki 2026-11-14 (część 2) – zrobione

Cztery zmiany, każda osobnym commitem.

- [x] **Szewrony lokomotywy** – lustrzane względem środka: `<` przy lewej kabinie, `>` przy prawej;
  pasy czarny/zielony/czarny po 4 px; logo JAXAN na środku, kratki symetrycznie, prawa kabina
  lustrzanie do lewej. Zrzut: `screenshots/p1-szewrony.png`.
- [x] **Semafory PKP** – `src/train/signals.ts` (czysta logika: losowanie sygnału przy zbliżaniu,
  czerwone 5–15 s odliczane blisko semafora/na postoju, krzywa hamowania automatu, 40 km/h przy
  pomarańczowym do końca stacji, wykrycie przejechania „stój”), `src/scene/signals.ts` (tarcza „OA”
  i semafor „A” na słupie, światła z poświatą mocniejszą nocą). Tryb AUTO/RĘCZNA w HUD, RADIOSTOP
  (alarm `audio.radiostop()`, `emergencyStep`, komunikat), szybki przejazd bez kar, znaczniki na mapie.
  Testy: `tests/signals.test.ts`.
- [x] **Nowe lokalizacje** – pętla w `LANDMARK_ORDER` jako grupy segmentów (`LandmarkStop`):
  Sokółka (`sokolka.ts`: stacja z otynkowanym dworcem + żwirownia: piaszczysta skarpa z sosnami, staw,
  koparka na półce, sortownia z sitami, stożkowe hałdy, taśmociągi, lej JAXAN), most na Wiśle
  (`wisla.ts`) tuż przed Warszawą (`warszawa.ts`: dwa perony pod wiatami, panorama z PKiN, Varso,
  Złotą 44, Warsaw Spire; nocą okna i światła przeszkodowe), Kamieniec (kamieniołom, 2400 px dalej
  stacja) bez zmian. Odstęp `LANDMARK_SPACING_PX = 22000` → miasta co ~2,4 min przy 100 km/h.
  Testy: `tests/route.test.ts` (pętla grup), `tests/locations.test.ts` (prawdziwy rejestr).
- [x] **Łany pól** (`fields.ts`, najczęstszy filler) – falujące zboże na pierwszym planie (3 pasy
  głębi × 4 klatki wychylenia, fala wiatru per kolumna, hook `animateBed`), średni plan w pasy
  (zboże, rzepak, zielone, ściernisko z belami), drzewa na miedzach, skośne miedze na brzegach,
  czasem kombajn w pracy. Nocą ciemnieje razem ze sceną. Uwaga: `reference/pole.png` nie było
  w repozytorium – styl wg opisu i `styl.jpg`.
- Zrzuty: `screenshots/s1-*-dzien.png` / `s1-*-noc.png` (Sokółka stacja i żwirownia, Warszawa,
  Kamieniec, pola).

---

## STAN NA 14.11

Przebudowa stylu grafiki wg `reference/styl2.png` (ciepłe światło z jednej strony, rim light,
chłodne cienie, perspektywa powietrzna, dithering na przejściach, 5 tonów na materiał).

### Zrobione

- [x] **A – próbka krajobrazu** (`49a3ca1`): niebo z ditherowanym gradientem i poświatą słońca,
  chmury podświetlone od słońca, 6 planów tła – zalesione pasma z pojedynczymi koronami
  (`ridges.ts`), bufor pikseli `pixbuf.ts`.
- [x] **B – reszta krajobrazu** (`36dcdfd`): nakładki rim light liczone raz na segment (`light.ts`),
  odcinek WIEŚ (stodoła, koźlak, bocian, kapliczka, domy z dachówką, płoty), topole i wierzby,
  pola w bruzdach, Kamieniec / Sokółka / Warszawa / kamieniołom / zakład / most / semafory
  w 5 tonach (`shade.ts`), szybkie malowanie pikselami (`paint`) – brak przycięć.
- [x] **C – pory dnia** (`dd93d9b`): złota godzina rano i wieczorem, chłodne południe, księżycowa
  poświata; kierunek rim light za słońcem/księżycem (`DayCycle.golden`, `DayCycle.light` + testy);
  wzgórza i chmury w dwóch wariantach światła.
- [x] **D – lokomotywa Dragon 2** (`1613cf6`): 5 tonów magenty/czerni/zieleni, pas połysku, cień pod
  okapem, odbicie nieba w szybach, wycieraczki, drzwi z klamkami, poręcze, bufory i sprzęgi,
  przewody, wózki ze sprężynami i maźnicami, pantograf z cieniem. Zrzut `screenshots/d1-lokomotywa.png`.
- [x] **D – węglarka Eamos** (`9cc285c`): ostojnica na wózkach Y25 bez prześwitu, koła na główce szyny,
  zderzaki na wysokości lokomotywy, sprzęgi i przewody między pojazdami, podwozie z hamulcem,
  malowanie JAXAN wg zdjęcia (pas, X z grubych ramion), rdza tylko na czerni, podskakuje tylko pudło.
  Zrzuty `screenshots/d2-weglarka.png`, `screenshots/d3-weglarka-vs-wzor-2.png`.

### DO ZROBIENIA (w kolejności)

1. [x] **Etap D – domknięcie**: zrzuty dzień i noc każdej lokalizacji w `screenshots/s2-*-{dzien,noc}.png`
   (Sokółka stacja i żwirownia, Wisła, Warszawa, Kamieniec kamieniołom i stacja, wieś, pola, most).
2. [x] **Etap D – dokumentacja**: aktualizacja `README.md` (styl2, wieś, pory dnia, tabor).
3. [x] **Etap D – lista do sprawdzenia na żywo**: wygląd zaakceptowany przez użytkownika (15.11).
   **Płynność przy wjazdach – pomiar 15.11** (Playwright, 1920×1080, monitor 75 Hz, 120 km/h):
   - przed: śr. 75 FPS, ale pojedyncze klatki 40–53 ms przy wjazdach (render Sokółki 36–48 ms,
     stacja Kamieniec 87 ms na zimno, pola 13–22 ms, nakładka rim light do 23 ms na warstwę);
   - przyczyny: sprite'y na GPU wklejane do warstw segmentów na CPU (odczyt z karty) oraz
     niepodzielny render segmentu i nakładek w jednej klatce;
   - poprawki: wszystkie sprite'y na CPU (`makeSprite`), render segmentów jako generator z `yield`
     (Sokółka, Warszawa, stacja, kamieniołom, pola, wieś), nakładki rim light liczone porcjami wierszy
     (`rimPixels` + test zgodności ze starym algorytmem), budżet prerenderu 3 ms/klatkę w `World`,
     rozgrzewka cache'u sprite'ów w tle po starcie;
   - po: najdłuższy krok prerenderu ≤ 11 ms (panorama Warszawy), typowo 4–9 ms; bez spowolnienia CPU
     75 FPS, najdłuższa klatka 13,5 ms (Sokółka, Wisła, Kamieniec, pola/wieś, stacja), `?soak=2` –
     liczba canvasów stała (2–4). Przy CPU spowolnionym 4× zostają przycięcia – dalszej optymalizacji
     nie robimy (decyzja 15.11).
4. ~~**Etap 2 – Załadunek w kopalni**~~ (rezygnacja – scena tła) (`hopperX`, `load` 0→1 w 3 s, test stanu wagonów).
5. ~~**Etap 2 – Liczba wagonów**~~ (rezygnacja – scena tła) (1–12, test clamp).
6. ~~**Etap 2 – Licznik km i ton**~~ (rezygnacja – scena tła) w `localStorage` (try/catch, zapis co 10 s).
7. [x] Tryb kinowy `C` – zrobione 15.11.
8. [x] Pogoda `W` – zrobione 15.11.

---

## Zmiana planu 15.11 – scena jako tło (zrobione)

Scena działa głównie jako tło; logiki gry nie rozbudowujemy. Wagony, licznik km/ton i załadunek –
rezygnacja. Każdy punkt osobnym commitem.

- [x] **Pogoda** (`scene/weather.ts` – logika + testy, `scene/weatherfx.ts` – rysowanie): zmiana sama co 3–10 min
  (pogodnie → pochmurno → deszcz → pogodnie, śnieg 15% po pochmurnym), przejścia 20 s, `W` ręcznie.
  Deszcz: skośne krople w 2 głębiach z rozpryskami, mokry połysk szyn, ciemniejsze niebo, cichy szum
  (`audio.setRain`). Śnieg: płatki z paralaksą, biel na górnych krawędziach (dachy, korony, nasyp) i na ziemi,
  bez oprószania taboru. Zrzuty: `screenshots/w1-deszcz.png`, `w2-snieg.png`.
- [x] **Ograniczenia prędkości wg Ie-1** (`train/limits.ts` + `tests/limits.test.ts`, `scene/limitsigns.ts`):
  W 8 (biały trójkąt wierzchołkiem w dół, czarna liczba w dziesiątkach km/h, w odległości drogi hamowania),
  W 9 początek (kąt wierzchołkiem w dół) i koniec (odwrotna strona – kąt w górę); wzór z Ie-1 § 16 pkt 7–8.
  Szlak 120 km/h; odcinki 100/80/60 po 1–3 km; przy stacjach 60/80 od semafora do końca stacji; z seeda.
  AUTO: krzywa hamowania przed W 9, przyspieszanie, gdy ogon minie koniec odcinka. RĘCZNA: miganie panelu.
  HUD „obowiązuje / następne / prędkość”, paski na mapie. Zrzuty: `screenshots/l1-w8.png`, `l2-w9.png`.
- [x] **Tryb kinowy** (`scene/cinema.ts` + testy): `C` lub 3 min bezczynności, chowa HUD i mapę, zoom ×1–1,3
  (skala ułamkowa tylko w tym trybie), pan wzdłuż składu; dowolny klawisz/ruch myszy = powrót.
  Zrzut: `screenshots/c1-kinowy.png`.
- Uwaga: Ie-1 nie definiuje osobnego wskaźnika końca ograniczenia – koniec to odwrotna strona W 9.
