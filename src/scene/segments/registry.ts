// Rejestr segmentów trasy.
//
// JAK DODAĆ NOWY SEGMENT / MIEJSCE:
// 1. Utwórz plik w src/scene/segments/ eksportujący obiekt `SegmentDef` (patrz types.ts):
//    - id, kind ('filler' = zwykły odcinek losowany, 'landmark' = punkt charakterystyczny),
//    - width (px), weight (waga losowania fillerów), opcjonalnie bridge: true,
//    - render({back, bed, front}, seed) – rysuje statyczne warstwy RAZ,
//    - opcjonalnie animate(...) (dym, taśmociąg) i lights(...) (światła nocą).
// 2. Dodaj go do REGISTRY poniżej.
// 3. Dla landmarku dopisz go do LANDMARK_ORDER: lokalizacja = grupa id (segmenty jeden
//    za drugim, gapPx = odstęp wypełniony fillerami). Stacje z semaforami: signals: true.
import type { SegmentDef } from './types';
import type { LandmarkStop } from '../route';
import { forest } from './forest';
import { embankment } from './embankment';
import { bridge } from './bridge';
import { plant } from './plant';
import { quarry } from './quarry';
import { station } from './station';
import { sokolka } from './sokolka';
import { wisla } from './wisla';
import { warszawa } from './warszawa';

export const REGISTRY: SegmentDef[] = [forest, embankment, bridge, plant, quarry, station, sokolka, wisla, warszawa];

/**
 * Pętla lokalizacji (cyklicznie), między nimi pola i lasy:
 * SOKÓŁKA (stacja + żwirownia) → WARSZAWA (most na Wiśle + stacja) →
 * KAMIENIEC ZĄBKOWICKI (kamieniołom, kawałek dalej stacja) → SOKÓŁKA …
 */
export const LANDMARK_ORDER: LandmarkStop[] = [
  { ids: ['sokolka'] },
  { ids: ['wisla', 'warszawa'] },
  { ids: ['quarry', 'station'], gapPx: 2400 },
];
