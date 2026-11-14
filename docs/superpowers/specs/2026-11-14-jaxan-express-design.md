# JAXAN Express – opis projektu (design)

Data: 2026-11-14. Źródła: `PROMPT.md` (pełna specyfikacja techniczna), `CLAUDE.md` (zasady pracy),
`reference/` (`styl.jpg`, `dragon2_jaxan.png`, `eamos_jaxan.png`). Ten dokument **uzupełnia** PROMPT.md
o ustalenia z rozmowy – wszystko, czego tu nie ma, obowiązuje tak, jak jest w PROMPT.md.

## Po co i dla kogo

Scena wisi na **ekranie w biurze** JAXAN (monitor 1920×1080, pełny ekran) i działa godzinami bez
nadzoru jako wizytówka firmy. Przez większość czasu nikt jej nie dotyka – ma ładnie wyglądać sama
z siebie. Od czasu do czasu ktoś podchodzi do klawiatury i potrąbi, przełączy noc albo zmieni prędkość.

Sukces: każdy przechodzący od razu rozpoznaje Dragona 2 i węglarki w barwach JAXAN, a na trasie
widzi znajome miejsca (stacja Kamieniec Ząbkowicki, kopalnia kamienia).

## Cele

- Wszystko z PROMPT.md (MVP E1–E5, dopracowanie E6, potem etap 2).
- **Tryb „samograj"**: po starcie pociąg od razu jedzie (domyślnie ok. 80 km/h). Po kilku minutach
  bezczynności scena wraca do jazdy automatycznej, jeśli ktoś pociąg zatrzymał.
- **Automatyczny cykl dobowy przeniesiony do MVP** i domyślnie włączony (dzień → zachód → noc → wschód).
  `N` dalej działa ręcznie (płynne przejście ~3 s); po bezczynności cykl wraca do automatu.
- **HUD i kursor chowają się** po kilku sekundach bezczynności, wracają po ruchu myszy / klawiszu / dotyku.
- **Punkty charakterystyczne trasy** (nowe względem PROMPT.md):
  1. **Stacja Kamieniec Ząbkowicki** – peron z wiatą, tablica „KAMIENIEC ZĄBKOWICKI" (pikselowa
     czcionka z polskimi znakami), lampy świecące w nocy, budynek dworca, w tle sylwetka pałacu
     Marianny Orańskiej. Pociąg przejeżdża bez zatrzymania (towarowy); użytkownik może się zatrzymać.
  2. **Kopalnia kamienia** – tarasowe ściany wyrobiska, koparka i wywrotki w tle, przenośnik taśmowy,
     **lej nad torem**. W MVP: przejazd z animacją sypiącego się kruszywa z przenośnika na hałdę.
     W etapie 2: zatrzymanie pod lejem napełnia wagony po kolei (łączy się z pozycją „stacja załadunku"
     z PROMPT.md).
- **Kolejność „opowieści"**: kopalnia → losowe odcinki → stacja Kamieniec → losowe odcinki → kopalnia…
  Zwykłe odcinki (las, nasyp, most, zakład) losowane z seeda.
- **Łatwe dokładanie miejsc** – użytkownik zapowiedział, że kolejne miejsca dojdą później. Każdy segment
  (zwykły i punkt charakterystyczny) to osobny moduł o wspólnym interfejsie (szerokość, rysowanie warstw,
  opcjonalne elementy nocne i interaktywne), rejestrowany w jednym miejscu. README opisuje, jak dodać nowy.
- **Stabilność wielogodzinna**: brak rosnących tablic i wycieków; segmenty i cząsteczki poza ekranem
  zwalniane lub z puli; pozycja świata trzymana tak, by nie tracić precyzji float po wielu godzinach.

## Dźwięk

- **Domyślnie wyciszony.** Włącza się ręcznie (`M` lub przycisk w HUD). Stan wyciszenia nie jest
  zapamiętywany – po przeładowaniu znowu cisza (biuro).
- Trąbienie pod `H` (oraz klik w lokomotywę / przycisk). Gdy dźwięk wyłączony, trąbienie dalej płoszy
  ptaki (efekt wizualny), tylko bez dźwięku.

## Sterowanie

Klawiatura jest przy ekranie – podstawowa metoda. Mysz i dotyk zgodnie z PROMPT.md (kryterium „gotowe").

## Poza zakresem (na teraz)

- Inne miejsca niż Kamieniec i kopalnia (dojdą później).
- Konkretne nazwy kopalń, bocznice, numery taboru zgodne z rzeczywistością.
- Pliki graficzne/audio, silniki gier, biblioteki runtime.

## Anty-cele (porażka, nawet jeśli „działa")

- Tabor nierozpoznawalny jako JAXAN (zła paleta, nieczytelne logo/szewrony).
- Rozmyte piksele lub skala ułamkowa.
- Scena, która po kilku godzinach zwalnia, zacina się albo się wysypuje.
- Hałas w biurze bez zgody (dźwięk sam się włącza).
- Dym z lokomotywy elektrycznej.

## Decyzje podjęte przeze mnie (do sprawdzenia)

- Cykl dobowy: pełny obieg ok. 8 min; powrót do automatu po 3 min bezczynności.
- Punkty charakterystyczne co ok. 2–3 min jazdy przy 80 km/h, na zmianę.
- Skala prędkości „wizualna", nie fizyczna: 120 km/h ≈ ok. 200 px/s dla warstwy toru (fizycznie
  byłoby ~250 px/s przy długości lokomotywy 150 px – za szybko na oko). Do strojenia w E3.
- Własna czcionka bitmapowa 5 px z polskimi znakami (Ą, Ę, Ł, Ó, Ś, Ż, Ź, Ć, Ń) dla HUD i tablic.
- Referencja stylu to `reference/styl.jpg` (PROMPT.md mówi `.png`).
- Ładunek węglarek – kruszywo szare (pasuje do kopalni kamienia); węgiel czarny jako wariant.

## Pozostawione wykonawcy

Dokładny układ pikseli sprite'ów, kształty gór/chmur, parametry fizyki jazdy, barwy przejść dobowych
(w ramach `palette.ts`), synteza dźwięków – według PROMPT.md i referencji.
