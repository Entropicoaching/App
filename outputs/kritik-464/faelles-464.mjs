// ORDRE 464: min opsaetning fra 446 (faelles-446.mjs) uaendret, men maalingerne
// skrives her (outputs/kritik-464) og byggene i en egen temp-mappe. Samme
// syntetiske Testatlet, samme aeldre telefon (Slow 4G + 4x CPU), samme e2e-mock.
// Ingen prod, ingen atletdata. Rekord-indekset (450, version 2 i 456) laeses her.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export * from '../kritik-446/faelles-446.mjs'

export const UD = path.dirname(fileURLToPath(import.meta.url))
export const BYG = process.env.K464_BYG || path.join(process.env.TEMP || '/tmp', 'kritik-464-byg')
export const DIST = path.join(BYG, 'dist-main')

// Rekord-indekset er bygget helt (alle sider) og har et grundlag.
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
