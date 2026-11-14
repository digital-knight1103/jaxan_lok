# Prompt do Claude Code – „JAXAN Express" pikselowa scena kolejowa

> Jak używać: w folderze `jaxan_lok` muszą być `CLAUDE.md` i folder `reference/` z trzema obrazkami
> (`styl.png` – pikselowa scena z mostem, `dragon2_jaxan.png` – lokomotywa, `eamos_jaxan.png` – wagon).
> Uruchom `claude` w tym folderze i wklej wszystko poniżej linii.

---

## Rola

Jesteś doświadczonym twórcą gier 2D i programistą front-endu, który specjalizuje się w pixel arcie
i animacji na Canvas. Budujesz ze mną interaktywną, zapętloną scenę kolejową w przeglądarce.

## Cel

Pikselowa, klimatyczna scena w stylu `reference/styl.png` (ciepłe chmury, warstwowe góry,
soczysta zieleń, stalowy most, przemysłowe zabudowania). Po torze jedzie **nowoczesna lokomotywa
elektryczna Newag Dragon 2 w barwach JAXAN** ciągnąca skład **czarnych węglarek Eamos JAXAN**.
Krajobraz przewija się w paralaksie, a użytkownik może sterować pociągiem i otoczeniem.

Najpierw obejrzyj wszystkie pliki w `reference/` i opisz mi w kilku zdaniach, co z nich bierzesz.

## Wygląd taboru (bardzo ważne – trzymaj się referencji)

**Lokomotywa Dragon 2 (`reference/dragon2_jaxan.png`)**

- Widok z boku, 6 osi w dwóch trzyosiowych wózkach (układ Co'Co'), długie pudło z dwiema kabinami.
- Kabiny, dach, rama i wózki: **czarne / grafitowe** (#1A1A1E, #2A2A30).
- Środek pudła: **magenta / fiolet JAXAN** (#A0157E, cień #6E0E58, blask #C42A9C).
- Przy obu kabinach skośne **szewrony**: czarny + jasnozielony (#5BC236) + czarny.
- Na boku logo **JAXAN** (ciemne litery, „X" jako stylizowany znak) – w pixel arcie uprość do czytelnych liter 5 px.
- Na dachu **pantograf** (podniesiony, cienkie linie) – to lokomotywa elektryczna, więc nad torem musi być **sieć trakcyjna** (słupy + przewód jezdny) w warstwie przesuwającej się z prędkością toru. **Brak dymu z lokomotywy.**
- Reflektory: 2 dolne + 1 górny; w nocy świecą ciepłym światłem i rzucają stożek na tor.

**Węglarka Eamos (`reference/eamos_jaxan.png`)**

- Czarne wysokie pudło z pionowymi żebrami, 2 wózki dwuosiowe, buforów po bokach.
- **Zielony pas** wzdłuż górnej krawędzi (#1FA02E), przy prawym końcu przechodzi w **magentowy** (#8E2A7A).
- Na prawej części duży znak „**X**": zielone ramię + magentowe ramię.
- Białe drobne oznaczenia (numer, tabliczki) jako kilka białych pikseli.
- Wagony są **załadowane kruszywem / węglem** (szary lub czarny, nierówny wierzch ładunku).
- Domyślnie 6 wagonów.

## Technologia

- **Vite + TypeScript**, czysty **Canvas 2D**, bez silników gier (zero zależności runtime).
- **Docelowy ekran: monitor 1920×1080, pełny ekran.** Rozdzielczość wewnętrzna **640×360**,
  skalowana całkowicie **×3 = dokładnie 1920×1080** (każdy piksel gry = 3×3 piksele ekranu,
  zero rozmycia). `imageSmoothingEnabled = false`, `image-rendering: pixelated`.
- Dla innych rozmiarów okna: największa całkowita skala, która się mieści, a reszta to
  ciemne pasy (letterbox) w kolorze #0E0E12. Nigdy skala ułamkowa.
- Tryb pełnoekranowy: klawisz `F` i przycisk w HUD (Fullscreen API). Kursor chowa się po 3 s bezczynności.
- Kompozycja kadru pod 16:9: tor na wysokości ok. 62% ekranu, nad nim dużo nieba i gór,
  pod nim dolina/most – jak na `reference/styl.png`.
- Proporcje taboru w pikselach gry: lokomotywa ok. **150×44 px**, wagon ok. **96×40 px**,
  żeby logo JAXAN i szewrony były czytelne z odległości od monitora.
- Sprite'y rysowane **proceduralnie w kodzie** (tablice znaków + paleta albo funkcje rysujące
  do offscreen canvas, generowane raz przy starcie i cache'owane). Żadnych zewnętrznych grafik.
- Dźwięk syntetyzowany przez **Web Audio API** (bez plików audio). AudioContext uruchamiany po
  pierwszej interakcji użytkownika.
- Pętla `requestAnimationFrame` z delta time, logika niezależna od FPS.
- Struktura modułowa: `src/engine/` (pętla, input, audio), `src/scene/` (warstwy, pogoda,
  cykl dobowy), `src/sprites/` (lokomotywa, wagon, drzewa, budynki), `src/ui/` (HUD).

## Scena i paralaksa (od tyłu do przodu)

1. Niebo z gradientem zależnym od pory dnia, słońce/księżyc, gwiazdy w nocy.
2. Odległe góry (2 warstwy, chłodne, wolne przesuwanie).
3. Chmury pikselowe (przesuwają się też same, wolno).
4. Średni plan: lasy, zakłady przemysłowe / kopalnia kruszywa z kominami (dym z kominów zakładu
   jest OK), silosy, okna świecące w nocy.
5. Słupy i przewód sieci trakcyjnej.
6. Tor (szyny, podkłady) – na przemian odcinki na nasypie i na **stalowym moście** nad doliną.
7. Pierwszy plan: trawa, krzaki, drzewa – najszybsza warstwa.

- Krajobraz generowany z „kafelków" segmentów (las, most, zakład, stacja), losowanych z seeda,
  żeby trasa była nieskończona i różnorodna.
- Pociąg stoi w poziomie mniej więcej w stałym miejscu ekranu (lekko na lewo od środka),
  a świat przesuwa się – kamera delikatnie „pływa" przy przyspieszaniu/hamowaniu.

## Interakcje (MVP)

| Akcja        | Klawisz                   | Przycisk w HUD | Efekt                                                                                                                                      |
| ------------ | ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Trąbienie    | `H` lub klik w lokomotywę | 📯             | Syntetyzowany dwutonowy sygnał (akord ~ 370 Hz + 466 Hz, narastanie/wygaszanie), przytrzymanie = dłuższy sygnał; ptaki zrywają się z drzew |
| Noc / dzień  | `N`                       | 🌙/☀️          | Płynne przejście (~3 s) palety całej sceny; w nocy: gwiazdy, światła lokomotywy, okna zakładów, iskry z pantografu                         |
| Start / stop | `Spacja`                  | ▶/⏸            | Realistyczne przyspieszanie i hamowanie (bezwładność), pisk hamulców, iskry spod kół przy hamowaniu                                        |
| Prędkość     | `←` / `→`                 | suwak          | Zadana prędkość 0–120 km/h, prędkościomierz w HUD                                                                                          |

- Dźwięk tła: rytmiczny stukot kół na złączach szyn (tempo zależne od prędkości) i szum silników
  trakcyjnych (ton rośnie z prędkością). Przycisk wyciszenia `M`.
- HUD minimalistyczny, pikselowa czcionka, w barwach JAXAN (czerń + magenta + zieleń).

## Interakcje dodatkowe (etap 2 – po MVP)

- **Automatyczny cykl dobowy** (opcja): zachód i wschód słońca z ciepłymi kolorami.
- **Pogoda** `W`: słońce → deszcz → śnieg (cząsteczki, mokre odbicia na szynach).
- **Stacja załadunku kruszywa**: co jakiś czas pojawia się kopalnia z lejem; jeśli zatrzymasz
  pociąg pod lejem, wagony napełniają się po kolei (animacja sypiącego się kruszywa).
- **Semafory** przy torze: czerwony = trzeba zahamować, zielony = jazda (mini-wyzwanie).
- **Liczba wagonów** `+` / `-` (1–12).
- **Licznik przejechanych km** i przewiezionych ton zapisywany w `localStorage`.
- **Tryb kinowy** `C`: chowa HUD, kamera powoli przybliża/oddala.

## Sposób pracy

0. **Przestrzegaj zasad z `CLAUDE.md`** – szczególnie: pracujesz sam, bez równoległych subagentów.
1. Najpierw zaproponuj krótki plan (skill `brainstorming` → `writing-plans`), zapisz go
   w `docs/plan.md` i poczekaj na moją akceptację. Realizuj go skillem `executing-plans`.
2. Buduj etapami, po każdym etapie projekt musi się uruchamiać (`npm run dev`):
   - E1: szkielet Vite, pętla, skalowanie pikseli, niebo + 1 warstwa paralaksy.
   - E2: sprite lokomotywy Dragon 2 JAXAN + wagon Eamos, jazda składu, koła w ruchu.
   - E3: pełna paralaksa, most, sieć trakcyjna, generator segmentów trasy.
   - E4: interakcje MVP + HUD + dźwięk.
   - E5: noc/dzień z oświetleniem.
   - E6: dopracowanie (drgania wagonów, kołysanie przewodu, ptaki, iskry), potem etap 2.
3. Na koniec każdego etapu (nie po każdej zmianie!) zrób 1–2 zrzuty ekranu Playwright
   w oknie **1920×1080**, zapisz w `screenshots/` i porównaj wizualnie z `reference/`;
   szczególnie sprawdź, czy barwy JAXAN są czytelne i proporcje lokomotywy się zgadzają.
4. Kod czysty, z komentarzami po polsku przy kluczowych miejscach, stałe kolorów w jednym pliku `palette.ts`.
5. Na końcu `README.md` po polsku: jak uruchomić, sterowanie, jak dodać nowy segment krajobrazu.
6. Celuj w stabilne 60 FPS na zwykłym laptopie.

## Kryteria „gotowe"

- Na monitorze 1920×1080 w pełnym ekranie obraz wypełnia cały ekran bez pasów i bez rozmycia.
- Scena działa w Chrome i Firefoxie, ostre piksele także w innych rozdzielczościach.
- Od pierwszego spojrzenia widać, że to Dragon 2 w barwach JAXAN i węglarki JAXAN.
- Trąbienie, noc/dzień, start/stop i prędkość działają z klawiatury, myszy i na dotyku (telefon).
- Brak błędów w konsoli, `npm run build` przechodzi.
