# JAXAN Express

Pikselowa, zapętlona scena kolejowa na ekran w biurze: lokomotywa **Newag Dragon 2 w barwach JAXAN**
ciągnie węglarki **Eamos JAXAN** z kruszywem przez nieskończony krajobraz – lasy, stalowe mosty,
zakłady przemysłowe, **kopalnię kamienia** i **stację Kamieniec Ząbkowicki**.

Vite + TypeScript + Canvas 2D, zero zależności w czasie działania. Grafika i dźwięk generowane w kodzie.

## Uruchomienie

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # wersja produkcyjna w dist/ (wystarczy dowolny serwer plików)
npm run test     # testy logiki (vitest)
```

Na ekranie biurowym: otwórz stronę w Chrome/Firefoksie i naciśnij **F** (pełny ekran).
Na monitorze 1920×1080 obraz to dokładnie 640×360 pikseli gry × 3 – ostro, bez pasów.
W innych rozdzielczościach używana jest największa całkowita skala, a resztę wypełniają ciemne pasy.

## Sterowanie

| Akcja | Klawisz | Mysz / dotyk |
| --- | --- | --- |
| Trąbienie (przytrzymaj = dłużej) | `H` | klik w lokomotywę lub przycisk 📯 |
| Noc / dzień (przejście ~3 s) | `N` | przycisk księżyc/słońce |
| Start / stop | `Spacja` | przycisk ▶/⏸ |
| Prędkość −/+ 10 km/h (0–120) | `←` / `→` | przyciski « » lub klik w pasek prędkości |
| Dźwięk wł./wył. | `M` | przycisk głośnika |
| Pełny ekran | `F` | przycisk ⛶ |
| Skok do poprzedniego / następnego punktu trasy | `[` / `]` | klik w ikonę na mapie trasy |
| Przewijanie podglądu mapy | – | przeciągnij pasek mapy myszą lub palcem |

- **Mapa trasy** (pasek na dole) pokazuje pociąg i punkty w promieniu ±10 km: stację Kamieniec
  Ząbkowicki 🏠, kopalnię ⛏ (pełne ikony) oraz mosty i zakłady (małe znaczniki – pełna ikona po najechaniu).
  Nad paskiem widać nazwę i odległość najbliższej stacji/kopalni (albo punktu pod kursorem).
  Kliknięcie punktu albo `[` / `]` = szybki przejazd: krajobraz mknie z rozmyciem i ściemnia się,
  potem pociąg dojeżdża i **zatrzymuje się** przy punkcie (Spacja – jazda dalej). Wciskając `]` kilka razy
  w trakcie przejazdu, przeskakuje się o kolejne punkty. Podgląd po przeciągnięciu wraca do pociągu po 5 s.
- **Dźwięk jest domyślnie wyłączony** (biuro) – włącz go `M`. Trąbienie płoszy ptaki także bez dźwięku.
  Wszystkie poziomy głośności (silniki, stukot, klakson, pisk) są w `src/config.ts` → `AUDIO`.
- HUD chowa się po 4 s bezczynności, kursor po 3 s. Pierwszy dotyk tylko pokazuje HUD.
- Po **3 minutach bez dotykania** scena wraca do trybu „samograja”: jazda 80 km/h i automatyczny
  cykl dobowy (pełna doba = 8 minut).

## Jak dodać nowy odcinek krajobrazu / nowe miejsce

1. Utwórz plik w `src/scene/segments/`, np. `lake.ts`, eksportujący obiekt `SegmentDef`
   (interfejs w `src/scene/segments/types.ts`):

   ```ts
   import type { SegmentDef } from './types';
   import { mulberry32 } from '../../engine/rng';
   import { drawBackStrip, drawGround } from './common';

   export const lake: SegmentDef = {
     id: 'lake',
     kind: 'filler',      // 'filler' = losowany odcinek, 'landmark' = punkt charakterystyczny
     width: 640,          // szerokość w pikselach gry
     weight: 2,           // jak często losowany (tylko filler)
     render({ back, bed, front }, seed) {
       const rnd = mulberry32(seed);
       // back – za torem, bed – pod torem, front – przed pociągiem; rysowane RAZ
       drawBackStrip(back, 0, 640, rnd);
       drawGround(bed, 0, 640, rnd);
     },
     // opcjonalnie: animate(ctx, x, env, seed) – ruch (dym, taśmy) co klatkę
     // opcjonalnie: lights(ctx, x, env, seed) – światła w nocy (env.night 0..1)
     // opcjonalnie – pokaż na mapie trasy:
     // mapIcon: 'bridge' | 'plant' | 'station' | 'quarry', mapLabel: 'JEZIORO',
     // mapAnchor: 320   // px od początku segmentu, przy którym staje szybki przejazd (domyślnie środek)
   };
   ```

2. Dodaj go do `REGISTRY` w `src/scene/segments/registry.ts`.
3. Jeśli to **punkt charakterystyczny** (jak stacja czy kopalnia), ustaw `kind: 'landmark'` i dopisz jego
   `id` do `LANDMARK_ORDER` – landmarki pojawiają się po kolei co `LANDMARK_SPACING_PX` (`src/config.ts`).

Kolory dodawaj wyłącznie w `src/palette.ts`. Gotowe pomocniki: `drawGround`, `drawBackStrip`,
`scatterBushes`, `plantBackItem` (drzewa/choinki/krzaki) w `segments/common.ts`, `drawText` (pikselowa
czcionka z polskimi znakami) w `engine/font.ts`.

## Struktura

```
src/config.ts        stałe (wymiary, prędkości, czasy)
src/palette.ts       wszystkie kolory
src/main.ts          sklejenie modułów, kolejność rysowania warstw
src/engine/          ekran i skalowanie, pętla, wejście, audio, czcionka, sprite'y, pula cząsteczek
src/scene/           niebo, góry, chmury, wzgórza, tor, sieć trakcyjna, cykl dobowy, ptaki, iskry
src/scene/segments/  odcinki trasy: las, nasyp, most, zakład, kopalnia, stacja
src/sprites/         lokomotywa Dragon 2, węglarka Eamos, koła, drzewa
src/train/           fizyka jazdy i skład
src/ui/hud.ts        panel sterowania
src/ui/routemap.ts   mapa trasy (pasek na dole)
src/scene/routeindex.ts  punkty trasy dla mapy (deterministyczny generator, ten sam seed)
src/scene/travel.ts  animacja szybkiego przejazdu do punktu
```

## Parametry diagnostyczne (adres strony)

- `?x=22820` – start w danym miejscu trasy (px), `?stop` – pociąg stoi,
- `?t=0.0` – pora doby (0 = północ, 0.5 = południe), wyłącza automat,
- `?soak=8` – test wytrzymałości: symulacja 8 godzin bez rysowania; wynik w konsoli
  (liczba segmentów/canvasów/iskier musi być stała).
