import { ATHLETE } from './fridayPreviewSeed.mjs'
// Only the separate preview entry imports this configuration.
export const athleteFlags = Object.freeze(Object.fromEntries([
  'enkelPrototype', 'forenklinger', 'programUgeFoerst', 'fremgangFokus',
  'naesteTraening', 'personalRecords', 'staevnedagFokus', 'fremgangLinjer',
  'mobilitetFoerPas', 'mobilitetFokus', 'kostPerAtlet',
  'blokFremgang', 'vaerdF6',
].map(key => [key, true]).concat([['kostValg', Object.freeze({ [ATHLETE]: true })]])))
export const coachFlags = Object.freeze({ programCopyEnabled: true,
  coachPlanCopyEnabled: true, blokFremgang: true,
  coachFourWeeksEnabled: true, coachTemplateMessages: true })
export const queryFlags = Object.freeze({ appE2E2: '1', appRel3: '1',
  coachRyd: '1', coachUge: '1', analyseSamlet: '1', analyseSammenlign: '1', appData2: '1' })
export const storageFlags = Object.freeze({ 'vc-epik2-playback': '1',
  'entropi:vc-review1': '1', vc_upload_retry_v1: '1' })
export const screens = Object.freeze([
  ['atlet-hjem', 'athlete', 'Hjem', 'Startvisningen'],
  ['atlet-program', 'athlete', 'Program næste uge', 'Mere > Mit program > næste uge'],
  ['atlet-mobilitet', 'athlete', 'Mobilitet', 'Mere > Mobilitet > vælg fokus'],
  ['atlet-fremgang', 'athlete', 'Fremgang', 'Fremgang > Styrke, derefter Rekorder'],
  ['atlet-profil', 'athlete', 'Profil', 'Åbn Konto øverst. Basen har kontomenu, ingen særskilt profilside'],
  ['coach-dagsliste', 'coach', 'Dagsliste', 'Startvisningen'],
  ['coach-atletprofil', 'coach', 'Atletprofil', 'Åbn Testatlet i dagslisten'],
  ['coach-analyse', 'coach', 'Analyse', 'Åbn Testatlet > Analyse > samlet analyse'],
  ['coach-videokoe', 'coach', 'Videokø', 'Arbejdsindbakke > Videoer'],
].map(([id, role, title, steps]) => Object.freeze({ id, role, title, steps, width: 375, height: 900 })))

export function previewUrl(screen, base = 'http://127.0.0.1:4173/scripts/friday-preview.html') {
  const url = new URL(base)
  if (url.protocol !== 'http:' || url.username || url.password ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Kun lokal preview')
  if (!screens.some(item => item.id === screen)) throw new Error('Ukendt skærm')
  url.search = new URLSearchParams({ ...queryFlags, screen }).toString()
  url.hash = ''
  return url.href
}

export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { get length() { return values.size }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)), clear: () => values.clear() }
}

// Applied before importing app modules. Never reads existing browser storage.
export function isolatePreview(target) {
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(target, name,
    { configurable: true, value: memoryStorage(name === 'localStorage' ? storageFlags : {}) })
  const blocked = () => { throw new Error('Netværk er slået fra i syntetisk preview') }
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'])
    Object.defineProperty(target, name, { configurable: true, value: blocked })
}

export function renderScreenList(h, base) {
  return h('nav', { 'aria-label': 'Syntetiske skærme' }, ...screens.map(screen =>
    h('a', { key: screen.id, href: previewUrl(screen.id, base), style: { display: 'block', minHeight: 44 } },
      `${screen.role}: ${screen.title}`)))
}
