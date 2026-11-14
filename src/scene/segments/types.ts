// Interfejs segmentu trasy. Segment = odcinek świata o stałej szerokości.
// Statyczne warstwy rysowane są RAZ do własnych canvasów (render), a elementy
// ruchome (dym, taśmociąg) i nocne światła – co klatkę (animate / lights).

/** Canvasy segmentu (szer. = width, wys. = H), rysowane raz. */
export interface SegmentLayers {
  /** Za torem (budynki, drzewa za nasypem) – przed słupami trakcji. */
  back: CanvasRenderingContext2D;
  /** Pod torem: nasyp / most / dolina. */
  bed: CanvasRenderingContext2D;
  /** Przed pociągiem (np. krawędź peronu, krzaki przy torze). */
  front: CanvasRenderingContext2D;
}

export interface SegmentEnv {
  /** 0 = dzień, 1 = pełna noc. */
  night: number;
  /** Czas sceny w sekundach (animacje). */
  time: number;
  /** Krycie nakładek światła: słońce z lewej / z prawej (0..1). */
  sunL: number;
  sunR: number;
}

export interface SegmentDef {
  id: string;
  kind: 'filler' | 'landmark';
  /** Szerokość w px świata. */
  width: number;
  /** Tor na moście (dolina pod spodem) zamiast na nasypie. */
  bridge?: boolean;
  /** Waga losowania (tylko fillery). */
  weight: number;
  /** Rysuje statyczne warstwy RAZ; seed – ziarno tego egzemplarza. */
  render(layers: SegmentLayers, seed: number): void;
  /** Animacje za pociągiem (x = ekranowy x początku segmentu). */
  animate?(ctx: CanvasRenderingContext2D, x: number, env: SegmentEnv, seed: number): void;
  /** Animacje pierwszego planu pod torem (np. falujące zboże) – po warstwie bed, przed nakładką nocy. */
  animateBed?(ctx: CanvasRenderingContext2D, x: number, env: SegmentEnv, seed: number): void;
  /** Źródła światła w nocy – rysowane po nakładce nocy. */
  lights?(ctx: CanvasRenderingContext2D, x: number, env: SegmentEnv, seed: number): void;
  /** x leja załadowczego względem początku segmentu (kopalnia). */
  hopperX?: number;
  /** Stacja z semaforami: tarcza ostrzegawcza 1 km przed i semafor wjazdowy przed peronem. */
  signals?: boolean;
  /** Ikona na mapie trasy (brak = segment nie pojawia się na mapie). */
  mapIcon?: MapIcon;
  /** Podpis na mapie (np. nazwa stacji). */
  mapLabel?: string;
  /** Punkt segmentu (px od początku), przy którym zatrzymuje się szybki przejazd; domyślnie środek. */
  mapAnchor?: number;
}

export type MapIcon = 'station' | 'quarry' | 'bridge' | 'plant' | 'gravel' | 'city';

/** Segment umieszczony na trasie. */
export interface Placed {
  def: SegmentDef;
  /** x początku w px świata. */
  startX: number;
  /** Numer kolejny na trasie (rosnący). */
  index: number;
  /** Ziarno tego egzemplarza (render/animate). */
  seed: number;
}
