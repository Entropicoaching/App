// Ordre 1421: eet navn pr. hovedloeft (alle stavemaader) og en kurve der kun
// bygges af rigtige tunge saet. Syntetisk historik, ingen atletdata.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exerciseSetView, mainLiftName } from './exerciseSetView.js'
import { grundnavn, erLetSaetNavn } from './exerciseNames.js'
import { bestHeavySetPerDay, grupperOevelsesnavne, erTungtSaet } from './exerciseProgress.js'

const BASER = { 'Bænkpres': 'baenkpres', Baenkpres: 'baenkpres', 'bænkpres': 'baenkpres', 'BÆNKPRES': 'baenkpres',
  Squat: 'squat', 'Dødløft': 'doedloeft', 'Sumo dødløft': 'sumo doedloeft' }
const ORD = ['topsæt', 'topsaet', 'top set', 'top-set', 'top sæt', 'Top', 'TOPSÆT', 'Top Set', 'backoff', 'back-off', 'back off',
  'Back-off sæt', 'BACKOFF', 'teknik single', 'teknik-single', 'teknik singler', 'teknik-singler', 'Teknik Singler',
  'teknik singles', 'comp', 'volumen', 'primær', 'primaer', 'sekundær']
const FORMER = [b => b, (b, o) => `${b} - ${o}`, (b, o) => `${b} ${o}`, (b, o) => `${b}-${o}`,
  (b, o) => `${b} – ${o}`, (b, o) => `${b} (${o})`]

test('hver stavemaade af hvert hovedloeft er eet navn i alle visninger', () => {
  let antal = 0
  for (const [base, key] of Object.entries(BASER)) {
    const maal = exerciseSetView(base)
    for (const ord of ORD) for (const form of FORMER) {
      const navn = form(base, ord)
      const v = exerciseSetView(navn)
      assert.equal(v.key, key, navn)
      assert.equal(v.name, maal.name, navn)
      assert.equal(mainLiftName(navn), maal.name, navn)
      antal++
    }
  }
  assert.ok(antal > 500)
})

test('tomme navne, comp-i-parentes og dobbelte suffikser', () => {
  for (const n of ['Bænkpres (comp) - topsæt', 'Baenkpres comp topsaet', 'Bænkpres - teknik single - backoff'])
    assert.equal(exerciseSetView(n).key, 'baenkpres', n)
  assert.equal(grundnavn('Bænkpres - (comp)'), 'Bænkpres')
  assert.equal(grundnavn('Bænkpres – comp'), 'Bænkpres')
  assert.equal(grundnavn('comp'), 'comp') // aldrig hele navnet vaek
})

test('varianter foldes ikke ind i hovedloeftet', () => {
  for (const n of ['Pause bænkpres', 'Close-grip bænkpres', 'Front squat', 'Rumænsk dødløft'])
    assert.equal(mainLiftName(n), null, n)
})

test('Fremgang viser eet hovedloeft-navn naar alle stavemaader er logget', () => {
  const navne = ['Bænkpres topsæt', 'Bænkpres teknik single', 'Baenkpres - back-off', 'Bænkpres (comp)', 'Bænkpres volumen', 'Squat topsæt', 'Squat - backoff']
  const set = new Set(navne.map(n => exerciseSetView(n).name))
  assert.deepEqual([...set].sort(), ['Squat', 'Bænkpres'].sort())
  const g = grupperOevelsesnavne([...set])
  assert.deepEqual(g.baenk, ['Bænkpres'])
  assert.deepEqual(g.squat, ['Squat'])
})

test('lette saet: navne og rep-graense', () => {
  for (const n of ['Bænkpres - backoff', 'Baenkpres teknik singler', 'Bænkpres teknik single', 'Squat volumen', 'Dødløft back-off'])
    assert.ok(erLetSaetNavn(n), n)
  for (const n of ['Bænkpres', 'Bænkpres topsæt', 'Squat (comp)', 'Sumo dødløft - top'])
    assert.ok(!erLetSaetNavn(n), n)
  assert.ok(erTungtSaet('Bænkpres topsæt', 8))
  assert.ok(!erTungtSaet('Bænkpres topsæt', 9))
  assert.ok(!erTungtSaet('Bænkpres - backoff', 3))
  assert.ok(!erTungtSaet('Bænkpres', 0))
})

// Seks uger, tre-fire dage, huller; tunge sæt stiger, lette sæt er lette men har
// MANGE reps eller hoej Epley (volumen 70x12 = 98, backoff 85x8 = 108).
const L = (dato, navn, weight, reps) => ({ weight, reps_completed: reps, logged_at: `${dato}T10:00:00`, exercises: { name: navn } })
const HISTORIK = [
  L('2026-08-31', 'Bænkpres topsæt', 100, 3), L('2026-08-31', 'Bænkpres - backoff', 85, 8), L('2026-08-31', 'Bænkpres volumen', 70, 12),
  L('2026-09-03', 'Bænkpres teknik single', 60, 1),            // dag med kun et let saet: intet punkt
  L('2026-09-07', 'Baenkpres Top set', 102.5, 3), L('2026-09-07', 'Bænkpres back off', 90, 8),
  // hul: uge 37 mangler helt
  L('2026-09-21', 'Bænkpres (comp)', 105, 2), L('2026-09-21', 'Bænkpres teknik-singler', 70, 1), L('2026-09-21', 'Bænkpres - backoff', 85, 6),
  L('2026-09-28', 'Bænkpres topsæt', 105, 4), L('2026-09-28', 'Bænkpres volumen', 75, 12),
  L('2026-10-05', 'Bænkpres topsæt', 107.5, 3), L('2026-10-05', 'Bænkpres teknik singler', 65, 1),
]

test('kurven er hoejeste e1RM pr. dag fra tunge saet og falder ikke af lette saet', () => {
  const k = bestHeavySetPerDay(HISTORIK)
  assert.deepEqual(k.map(p => p.dag), ['2026-08-31', '2026-09-07', '2026-09-21', '2026-09-28', '2026-10-05'])
  assert.deepEqual(k.map(p => p.e1rm), [110, 113, 112, 119, 118])
  // Hvert tal kan forklares: dagens tungeste e1RM blandt saet <= 8 reps der ikke er lette.
  assert.deepEqual(k[0], { dag: '2026-08-31', weight: 100, reps: 3, navn: 'Bænkpres topsæt', e1rm: 110 })
  assert.equal(k[2].weight, 105) // comp 105x2 vinder, ikke backoff 85x6
})

test('uden de lette saet ville samme kurve hoppe - beviset for at filteret goer noget', () => {
  // Backoff 90x8 giver e1RM 114 (> topsaettet 113 den dag): uden filter ville dagen vise et let saet.
  const dag = HISTORIK.filter(l => l.logged_at.startsWith('2026-09-07'))
  const udenFilter = Math.max(...dag.map(l => Math.round(l.weight * (1 + l.reps_completed / 30))))
  assert.equal(udenFilter, 114)
  assert.equal(bestHeavySetPerDay(dag)[0].e1rm, 113)
})

test('dag med kun lette saet giver intet punkt; skipped og 0 reps tæller aldrig', () => {
  const k = bestHeavySetPerDay([
    L('2026-09-03', 'Bænkpres teknik single', 60, 1),
    { ...L('2026-09-04', 'Bænkpres topsæt', 500, 1), skipped: true },
    L('2026-09-05', 'Bænkpres topsæt', 100, 0),
  ])
  assert.deepEqual(k, [])
  assert.deepEqual(bestHeavySetPerDay(undefined), [])
})
