import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Coach-menuens harnesser tillader ingen nye imports i Sidebar.jsx; funktionen hentes derfor fra kilden.
const kilde = readFileSync(new URL('./Sidebar.jsx', import.meta.url), 'utf8')
const sidebarNavn = new Function(kilde.match(/function sidebarNavn[\s\S]*?\r?\n}\r?\n/)[0] + '\nreturn sidebarNavn')()

const liste = [
  { id: 1, name: 'Testa Alfa' }, { id: 2, name: 'Testa Beta' }, { id: 3, name: 'Soli Gamma' }, { id: 4, name: 'Enkel' },
]

test('ordre 2487: fornavn alene, naar det er unikt', () => {
  assert.equal(sidebarNavn(liste[2], liste), 'Soli')
  assert.equal(sidebarNavn(liste[3], liste), 'Enkel')
})

test('ordre 2487: ens fornavn faar efternavnets forbogstav', () => {
  assert.equal(sidebarNavn(liste[0], liste), 'Testa A.')
  assert.equal(sidebarNavn(liste[1], liste), 'Testa B.')
})

test('ordre 2487: mail-knappen hedder Gem mail', () => {
  const k = readFileSync(new URL('./ProfilHoved.jsx', import.meta.url), 'utf8')
  assert.match(k, /'Gem mail'/)
  assert.doesNotMatch(k, /gemmerMail \? 'Gemmer' : 'Gem'\}/)
})
