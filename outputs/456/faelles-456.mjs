// ORDRE 456: Bhishaks opsaetning fra 446 (faelles-446.mjs) uaendret, men
// maalingerne skrives her (outputs/456) og byggene i en egen temp-mappe, saa
// intet i outputs/kritik-446 overskrives. Samme syntetiske Testatlet, samme
// aeldre telefon (Slow 4G + 4x CPU), samme e2e-mock. Ingen prod, ingen atletdata.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export * from '../kritik-446/faelles-446.mjs'

export const UD = path.dirname(fileURLToPath(import.meta.url))
export const BYG = process.env.K456_BYG || path.join(process.env.TEMP || '/tmp', 'kritik-456-byg')
export const DIST = path.join(BYG, 'dist-456')

// 450 flyttede rekord-grundlaget fra oejebliksbilledet (rekordFoer) til
// rekord-indekset (src/athlete/rekordIndeks.js). Venter, til det er bygget
// helt (456: alle sider af historikken) og har et grundlag.
export function rekordIndeksBygget(page, timeout = 120000) {
  return page.waitForFunction(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rekord_indeks:'))
    const x = k && JSON.parse(localStorage.getItem(k))
    return !!(x?.bygget && x.base && Object.keys(x.base).length > 0)
  }, null, { timeout, polling: 100 })
}

export function bedstFoerE1rm(page, navn) {
  return page.evaluate((navn) => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rekord_indeks:'))
    return Math.round(JSON.parse(localStorage.getItem(k))?.base?.[navn]?.e1rm || 0)
  }, navn)
}
