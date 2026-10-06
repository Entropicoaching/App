// Ordre 1485 (QA 1481 fund 3): sumo doedloeft har sin egen kurve, fane, rekordraekke og coach-linje
// og havner aldrig i Doedloeft-kurven (V17: een oevelse = eet navn). Syntetisk historik.
// node --test src/athlete/sumoKurve.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exerciseSetView } from '../exerciseSetView.js'
import { bestHeavySetPerDay, grupperOevelsesnavne, hovedloeftFamilie, HOVEDLOEFT_FAMILIER } from '../exerciseProgress.js'
import { bygGrundlag, findRekord, grupperRekorder, rekordListe } from './rekorder.js'
import { hovedloeftStatus, styrkeLinje } from '../coachFremgang.js'

const log = (navn, weight, reps, dag) => ({ weight, reps_completed: reps, logged_at: `${dag}T10:00:00Z`, skipped: false, exercises: { name: navn } })
// Konventionel 170x3 (e1RM 187) / sumo 200x3 (e1RM 220): hvis sumo laekker over i doedloeft, ses det paa tallene.
const LOGS = [
  log('Dødløft topsæt', 165, 3, '2026-09-01'), log('Sumo dødløft topsæt', 190, 3, '2026-09-02'),
  log('Dødløft topsæt', 170, 3, '2026-09-15'), log('Sumo dødløft topsæt', 195, 3, '2026-09-16'),
  log('Dødløft - backoff', 140, 8, '2026-09-15'), log('Sumo dødløft backoff', 150, 8, '2026-09-16'),
  log('Dødløft topsæt', 172.5, 3, '2026-09-29'), log('Sumo dødløft topsæt', 200, 3, '2026-09-30'),
  log('Deficit sumo dødløft', 160, 5, '2026-09-30'), log('Rumænsk dødløft', 120, 8, '2026-09-30'),
]
const kurve = (navn) => bestHeavySetPerDay(LOGS.filter(l => exerciseSetView(l.exercises.name).key === exerciseSetView(navn).key))

test('sumo er sin egen hovedloeft-familie, fire i alt, og skrives paa alle maader som een', () => {
  assert.deepEqual(HOVEDLOEFT_FAMILIER.map(f => f.key), ['squat', 'baenk', 'doedloeft', 'sumo'])
  for (const n of ['Sumo dødløft', 'Sumo doedloeft - backoff', 'Sumo deadlift', 'Dødløft sumo', 'Dødløft - sumo', 'Sumo dødløft topsæt'])
    assert.equal(hovedloeftFamilie(n), 'sumo', n)
  for (const n of ['Dødløft', 'Dødløft topsæt', 'Doedloeft - backoff']) assert.equal(hovedloeftFamilie(n), 'doedloeft', n)
  for (const n of ['Deficit sumo dødløft', 'Rumænsk dødløft', 'Sumo squat', 'Sumo RDL']) assert.equal(hovedloeftFamilie(n), null, `${n} er en variant`)
})

test('vaelgeren: sumo har sin fane, Doedloeft-fanen faar ikke sumo-navne', () => {
  const navne = [...new Set(LOGS.map(l => l.exercises.name))]
  const g = grupperOevelsesnavne(navne.filter((n, i, a) => a.findIndex(m => exerciseSetView(m).key === exerciseSetView(n).key) === i))
  assert.equal(g.sumo.length, 1); assert.equal(exerciseSetView(g.sumo[0]).name, 'Sumo dødløft')
  assert.equal(g.doedloeft.length, 1); assert.equal(exerciseSetView(g.doedloeft[0]).name, 'Dødløft')
  assert.deepEqual(g.andre.map(n => exerciseSetView(n).name).sort(), ['Deficit sumo dødløft', 'Rumænsk dødløft'])
})

test('kurverne: sumo og doedloeft blandes aldrig, lette saet traekker ikke ned', () => {
  const dl = kurve('Dødløft'), su = kurve('Sumo dødløft')
  assert.deepEqual(dl.map(p => p.dag), ['2026-09-01', '2026-09-15', '2026-09-29'])
  assert.deepEqual(su.map(p => p.dag), ['2026-09-02', '2026-09-16', '2026-09-30'])
  assert.ok(dl.every(p => p.e1rm < 200), 'ingen sumo-e1RM i doedloeft-kurven: ' + JSON.stringify(dl))
  assert.ok(su.every(p => p.e1rm >= 209), 'ingen doedloeft-e1RM i sumo-kurven: ' + JSON.stringify(su))
  assert.deepEqual(su.map(p => p.weight), [190, 195, 200])
  assert.ok(dl.every(p => /doedloeft|Dødløft/i.test(p.navn)) && su.every(p => /sumo/i.test(p.navn)))
})

test('rekorder: sumo har sin egen raekke og slaar ikke doedloeft (og omvendt)', () => {
  const saet = LOGS.map(l => ({ navn: exerciseSetView(l.exercises.name).name, weight: l.weight, reps: l.reps_completed, dato: l.logged_at }))
    .filter(s => s.navn === 'Dødløft' || s.navn === 'Sumo dødløft')
  // foerste sumo-saet efter en tung konventionel er IKKE en rekord, og konventionel slaar ikke sumo
  const g = bygGrundlag([{ navn: 'Dødløft', weight: 170, reps: 3, dato: '2026-09-01' }])
  assert.equal(findRekord(g, { navn: 'Sumo dødløft', weight: 150, reps: 3, dato: '2026-09-02' }), null)
  const liste = rekordListe(saet).reverse()
  assert.ok(liste.every(r => r.navn === 'Dødløft' || r.navn === 'Sumo dødløft'))
  const { hoved } = grupperRekorder(liste)
  assert.deepEqual(hoved.map(h => h.key), ['doedloeft', 'sumo'])
  assert.ok(hoved[0].historik.every(r => r.navn === 'Dødløft'), 'doedloeft-raekke uden sumo')
  assert.ok(hoved[1].historik.every(r => r.navn === 'Sumo dødløft'), 'sumo-raekke uden doedloeft')
  assert.equal(hoved[1].bedst.e1rm, 220)
})

test('coachen: samme to loeft, hver med egen kurve og egne tal', () => {
  const st = hovedloeftStatus(LOGS, '2026-10-02')
  const d = st.find(s => s.navn === 'Dødløft'), s = st.find(x => x.navn === 'Sumo dødløft')
  assert.ok(d && s, 'begge loeft findes')
  assert.deepEqual(d.punkter.map(p => p.dag), kurve('Dødløft').map(p => p.dag))
  assert.deepEqual(s.punkter.map(p => p.e1rm), kurve('Sumo dødløft').map(p => p.e1rm))
  assert.ok(d.nu < 200 && s.nu >= 220)
  assert.equal(st.filter(x => /sumo/i.test(x.navn)).length, 1, 'varianter (Deficit sumo) er ikke et hovedloeft hos coachen')
  assert.match(styrkeLinje(LOGS, '2026-10-02').tekst, /^(?!.*Deficit)/)
})

test('kun sumo (ingen konventionel): ingen tom Doedloeft-fane, sumo-kurven staar alene', () => {
  const kunSumo = LOGS.filter(l => hovedloeftFamilie(l.exercises.name) === 'sumo')
  const g = grupperOevelsesnavne([...new Set(kunSumo.map(l => l.exercises.name))].filter((n, i, a) => a.findIndex(m => exerciseSetView(m).key === exerciseSetView(n).key) === i))
  assert.equal(g.doedloeft.length, 0); assert.equal(g.sumo.length, 1)
  assert.equal(bestHeavySetPerDay(kunSumo).length, 3)
})
