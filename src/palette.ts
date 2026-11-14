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


  // --- zieleń (styl.jpg: soczysta, żółtozielone światła) ---
  grassHi: '#B6E04A',
  grass: '#7EC23A',
  grassMid: '#4E9A2E',
  grassDark: '#2E6A26',
  grassDeep: '#1C4420',
  foliageHi: '#8ED04A',
  foliage: '#4E9A36',
  foliageShade: '#2E6A2E',
  foliageDeep: '#1A4224',
  pine: '#2A5A34',
  pineHi: '#3E7A40',
  trunk: '#4A3424',
  earth: '#4A3A2A',
  earthShade: '#33281E',
  midHill: '#3E7A5A',
  midHillHi: '#5A9A6A',
  midHillShade: '#2E5E4A',
  frontDeep: '#123018',

  // --- most stalowy (ciemne żelazo jak na styl.jpg) ---
  bridge: '#4A3E36',
  bridgeHi: '#6A5A4C',
  bridgeShade: '#2E2620',
  bridgeRivet: '#7A6A58',

  // --- przemysł ---
  plant: '#5A5048',
  plantHi: '#7A6E62',
  plantShade: '#3A332E',
  plantDark: '#2A2420',
  rust: '#7A4A2E',
  windowDay: '#3A3A3A',
  windowLit: '#F0A830',
  windowGlow: '#FFD070',
  smoke: '#6A6E72',
  smokeHi: '#8A8E92',
  smokeDark: '#4A4E52',

  // --- sieć trakcyjna ---
  pole: '#5A5E66',
  poleHi: '#80848C',
  wire: '#2A2C30',
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
