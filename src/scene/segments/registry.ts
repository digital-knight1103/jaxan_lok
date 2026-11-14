// Rejestr segmentów trasy.
//
// JAK DODAĆ NOWY SEGMENT / MIEJSCE:
// 1. Utwórz plik w src/scene/segments/ eksportujący obiekt `SegmentDef` (patrz types.ts):
//    - id, kind ('filler' = zwykły odcinek losowany, 'landmark' = punkt charakterystyczny),
//    - width (px), weight (waga losowania fillerów), opcjonalnie bridge: true,
//    - render({back, bed, front}, seed) – rysuje statyczne warstwy RAZ,
//    - opcjonalnie animate(...) (dym, taśmociąg) i lights(...) (światła nocą).
// 2. Dodaj go do REGISTRY poniżej.
// 3. Dla landmarku dopisz jego id do LANDMARK_ORDER we właściwym miejscu „opowieści".
import type { SegmentDef } from './types';
import { forest } from './forest';
import { embankment } from './embankment';
import { bridge } from './bridge';
import { plant } from './plant';

export const REGISTRY: SegmentDef[] = [forest, embankment, bridge, plant];

/** Kolejność punktów charakterystycznych na trasie (cyklicznie). */
export const LANDMARK_ORDER: string[] = ['quarry', 'station'];
