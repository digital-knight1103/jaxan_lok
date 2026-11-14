// Wszystkie kolory sceny. Żaden inny plik nie definiuje kolorów (CLAUDE.md).

export const PAL = {
  letterbox: '#0E0E12',

  // --- JAXAN: lokomotywa Dragon 2 ---
  locoBlack: '#1A1A1E',
  locoGraphite: '#2A2A30',
  locoGraphiteHi: '#3A3A42',
  locoMagenta: '#A0157E',
  locoMagentaShade: '#6E0E58',
  locoMagentaHi: '#C42A9C',
  jaxanGreen: '#5BC236',
  jaxanGreenShade: '#3E8A24',
  logoDark: '#2A0A22',
  glass: '#2E3A4A',
  glassHi: '#5A7088',
  white: '#E8E8EC',
  headlight: '#FFF2C0',
  headlightOff: '#8A8A80',
  tailOff: '#5A1E22',
  tailRed: '#E0343C',
  wheelDark: '#141416',
  wheelRim: '#6A6A72',
  steel: '#8A8E96',

  // --- JAXAN: węglarka Eamos ---
  wagonBlack: '#1C1C20',
  wagonRib: '#2C2C32',
  wagonShade: '#121214',
  wagonGreen: '#1FA02E',
  wagonGreenShade: '#157620',
  wagonMagenta: '#8E2A7A',
  wagonMagentaShade: '#661D58',
  aggregate: '#8C8A86',
  aggregateHi: '#B0ADA6',
  aggregateShade: '#5E5C5A',

  // --- tor ---
  railHead: '#B4B8BE',
  railFoot: '#4A4A52',
  sleeper: '#4A3A2E',
  ballast: '#6E6A64',
  ballastShade: '#4E4A46',

  // --- niebo (dzień) wg styl.jpg ---
  skyTop: '#3E6E9A',
  skyMid: '#5E94B8',
  skyHorizon: '#8EC2CC',
  cloudLight: '#F4EBC8',
  cloudMid: '#D8D2B4',
  cloudShade: '#9AAEB8',
  cloudDark: '#6E8A9C',

  // --- góry ---
  mountFar: '#7FA6BC',
  mountFarHi: '#A4C4D2',
  mountNear: '#4E7E96',
  mountNearHi: '#6E9EB2',
  mountNearShade: '#3A6478',
} as const;

export type PalKey = keyof typeof PAL;
