// Ordre 1541 (Marc 16. nov. kl. 18:38): "hader at blive mødt af den sort og hvid
// opsætning ... jeg vil gerne det er mere imødekommende ui".
// Appens farver står som faste hex-værdier i hundredvis af inline styles, og mange
// prøver låser kildeteksten. Derfor ændres kilden ikke: Vite oversætter ved bygning
// de faste farver til CSS-variabler (tema.css). Ordre 1542a: mørk varm palet (dyb brun,
// lys creme tekst, amber) er standard; lys tilstand (data-tema="lys") er 1541's lyse palet.

// Kildefarve -> variabel. tema.css giver variablen en varm mørk og en lys værdi.
export const FARVER = {
  // flader
  '#141410': 'e-bg', '#0f0e0b': 'e-bg', '#16160f': 'e-bg',
  '#1c1c18': 'e-flade', '#171713': 'e-flade2', '#171814': 'e-flade2', '#171815': 'e-flade2', '#181816': 'e-flade2',
  '#101815': 'e-flade2', '#242420': 'e-flade3', '#24241f': 'e-flade3', '#24231d': 'e-flade3', '#262621': 'e-flade3',
  '#282821': 'e-flade3', '#2c2c26': 'e-flade3', '#2f2f29': 'e-flade3', '#302a20': 'e-flade3', '#2e2e2a': 'e-flade3',
  '#29251e': 'e-flade3', '#282820': 'e-flade3', '#24241e': 'e-flade3', '#16150f': 'e-bg',
  // kanter
  '#3a3a36': 'e-kant', '#414139': 'e-kant', '#59564c': 'e-kant2', '#575044': 'e-kant2',
  // tekst
  '#edeae2': 'e-tekst', '#f5f5ee': 'e-tekst', '#f0f4f1': 'e-tekst', '#d8d4ca': 'e-tekst', '#d2cfc6': 'e-tekst', '#d1c9b8': 'e-tekst',
  '#b8b4a8': 'e-tekst2', '#a8a498': 'e-tekst2', '#b3afa4': 'e-tekst2', '#a9a69e': 'e-tekst2', '#b9b4a8': 'e-tekst2',
  '#c1beb5': 'e-tekst2', '#c4c0b5': 'e-tekst2', '#c4c0b4': 'e-tekst2', '#a8a59c': 'e-tekst2', '#9f9b91': 'e-tekst2', '#98948a': 'e-tekst2',
  '#7a7770': 'e-daempet', '#77746d': 'e-daempet', '#77776b': 'e-daempet', '#777267': 'e-daempet', '#8f8b82': 'e-daempet',
  '#929083': 'e-daempet', '#89897e': 'e-daempet', '#77756b': 'e-daempet', '#777365': 'e-daempet',
  '#4a4844': 'e-svag',
  // amber
  '#c8923a': 'e-amber', '#e0ae5c': 'e-amber2', '#d8b16b': 'e-amber2', '#f1cf7b': 'e-amber2', '#e0a555': 'e-amber2',
  '#c9b47f': 'e-amber2', '#c8b98a': 'e-amber2', '#f1c675': 'e-amber2', '#e0a94c': 'e-amber2',
  // signalfarver
  '#6cba6c': 'e-groen', '#7a9f78': 'e-groen2', '#8caf88': 'e-groen2', '#9fbd9a': 'e-groen2', '#7fa188': 'e-groen2', '#5fb38a': 'e-groen2',
  '#e05555': 'e-roed', '#cf6b4e': 'e-roed2', '#d79a83': 'e-roed2', '#da9d8e': 'e-roed2', '#e99b86': 'e-roed2',
  '#67dff5': 'e-blaa', '#5b9bb5': 'e-blaa2', '#8be0d4': 'e-blaa2', '#8ab5bc': 'e-blaa2', '#4e8fcf': 'e-blaa2',
  '#9b6bd4': 'e-lilla',
}

// Sjældne farver: lys værdi her; i mørk tilstand falder var() tilbage til den gamle hex (neutrale flader får varm brun i tema.css).
// Videoafspilning og fuldskærmstræning beholder deres farver (ligger over video/mørk flade).
export const EKSTRA = {
  // neutrale mørke flader -> lys flade
  '191915': '#ece4d5', '211f1a': '#ece4d5', '22201a': '#ece4d5', '25251f': '#ece4d5', '262620': '#ece4d5',
  '292923': '#ece4d5', '2a2a24': '#ece4d5', '30302a': '#e4dccc', '383730': '#d8ccb8',
  // tonede flader
  '31291c': '#f1e2c3', '403522': '#f1e2c3', '302719': '#f1e2c3', '2a2416': '#f1e2c3',
  '263b26': '#dcebd9', '243020': '#dcebd9', '17211e': '#dcebd9',
  '2b2538': '#e7def3', '302437': '#e7def3',
  '202b3b': '#dbe6f0', '1c2a38': '#dbe6f0', '20282c': '#dbe6f0',
  // lyse tekstfarver -> mørke
  'd4d0c6': '#4d4436', 'd4d0c4': '#4d4436', 'd5d2c8': '#4d4436', 'd9d4c8': '#4d4436', 'c7c3b9': '#4d4436', 'c9d7c7': '#3a6c41',
  'e0bb7a': '#85570f', 'e6bb76': '#85570f', 'edc17b': '#85570f', 'd7b16e': '#85570f', 'c9b58f': '#85570f', 'ffcb83': '#85570f',
  'b9d5a0': '#3a6c41', 'd7e4aa': '#3a6c41', '8ee3cf': '#1f6b5f', '72daca': '#1f6b5f', '4ec8b4': '#1f6b5f',
  'd7bce7': '#653ca0', 'd3c5f0': '#653ca0', 'b5cbed': '#2b607d', 'ffb0a0': '#9a4329',
}

// rgba(r,g,b, a) med en mørk-tema-trippel -> rgba(var(--x-rgb), a). Gælder tynde
// kanter og overlag; alfa ganges med --e-alfa, så kanterne kan ses på lys bund.
export const TRIPLER = {
  '237,234,226': ['e-tekst-rgb', true],
  '20,20,16': ['e-bg-rgb', false], '10,10,8': ['e-bg-rgb', false], '14,14,10': ['e-bg-rgb', false], '28,28,24': ['e-flade-rgb', false],
}

const HEX = /(?<![\w&])#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-fA-F])/g
// SVG-attributter (fill="#..") forstår ikke var(); dem farver tema.css med attributvælgere.
const SVG_ATTR = /(?:fill|stroke|stopColor|stop-color)=["']$/

function hexTilVar(kode, fra) {
  return kode.replace(HEX, (hel, seks, alfa, pos, kilde) => {
    const lav = seks.toLowerCase()
    const navn = FARVER['#' + lav]
    if (!navn && !EKSTRA[lav]) return hel
    if (SVG_ATTR.test(kilde.slice(Math.max(0, pos - 12), pos))) return hel
    const v = navn ? `var(--${navn})` : `var(--e-h${lav}, #${lav})`
    if (!alfa) return v
    const procent = Math.round(parseInt(alfa, 16) / 255 * 1000) / 10
    return `color-mix(in srgb, ${v} ${procent}%, transparent)`
  })
}

function rgbaTilVar(kode) {
  return kode.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g, (hel, r, g, b, a, pos, kilde) => {
    const tripel = TRIPLER[`${r},${g},${b}`]
    if (!tripel) return hel
    if (/(?:fill|stroke)=["']$/.test(kilde.slice(Math.max(0, pos - 8), pos))) return hel
    const [navn, forstaerk] = tripel
    return forstaerk ? `rgba(var(--${navn}), calc(${a} * var(--e-alfa)))` : `rgba(var(--${navn}), ${a})`
  })
}

// En farvevariabel plus to hex-cifre (`${color}22`, color + '33') giver ugyldig CSS,
// når farven er blevet var(). __eAlfa laver i stedet color-mix; hex virker som før.
const ALFA_HJAELPER = `\nfunction __eAlfa(c, a) { if (typeof c !== 'string' || c.slice(0, 4) !== 'var(') return c + a; return 'color-mix(in srgb, ' + c + ' ' + Math.round(parseInt(a, 16) / 2.55) + '%, transparent)' }\n`

function alfaSammensaetning(kode) {
  let n = 0
  const ud = kode
    .replace(/\$\{([^{}`]+)\}([0-9a-fA-F]{2})(?=[`'" ;,)])/g, (_, udtryk, a) => { n++; return `\${__eAlfa(${udtryk}, '${a}')}` })
    .replace(/([A-Za-z_$][\w$.]*)\s*\+\s*\(([^()]*\?\s*'[0-9a-fA-F]{2}'\s*:\s*'[0-9a-fA-F]{2}')\)/g, (_, v, t) => { n++; return `__eAlfa(${v}, (${t}))` })
    .replace(/([A-Za-z_$][\w$.]*)\s*\+\s*'([0-9a-fA-F]{2})'/g, (_, v, a) => { n++; return `__eAlfa(${v}, '${a}')` })
  return n ? ud + ALFA_HJAELPER : ud
}

export function varmTemaKode(kode, id = '') {
  const css = /\.css(\?|$)/.test(id)
  let ud = rgbaTilVar(hexTilVar(kode, id))
  if (!css) ud = alfaSammensaetning(ud)
  return ud
}

// Kun appens egne filer; aldrig prøver, temaet selv eller lærred-kode (canvas forstår ikke var()).
export function skalTemaes(id) {
  const sti = id.split('?')[0].replace(/\\/g, '/')
  if (!/\/src\//.test(sti) || /node_modules/.test(sti)) return false
  if (/\.test\.|\/tema\//.test(sti)) return false
  if (/videoCompression2|vaLocalDocuments/.test(sti)) return false
  return /\.(jsx|js|mjs|css)$/.test(sti)
}

export function varmTemaPlugin() {
  return {
    name: 'entropi-varmt-tema',
    enforce: 'pre',
    transform(kode, id) {
      if (!skalTemaes(id)) return null
      const ud = varmTemaKode(kode, id)
      return ud === kode ? null : { code: ud, map: null }
    },
  }
}
