// ORDRE 439 · blok 1: rekord-reglerne (rekorder.js). node --test src/athlete/rekorder.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bygGrundlag, findRekord, rekordTekst, rekordListe, tidligereSaet, ugensSaet, e1rmKg, grupperRekorder } from './rekorder.js'

const saet = (navn, weight, reps, dato = '2026-09-01T10:00:00Z', ekstra = {}) => ({ navn, weight, reps, dato, ...ekstra })

test('højere e1RM end før er en rekord, med +kg i hele kg', () => {
  const g = bygGrundlag([saet('Squat', 100, 5)]) // e1RM 116,7 → 117
  const r = findRekord(g, saet('Squat', 105, 5)) // 122,5 → 123 (Math.round)
  assert.equal(r.type, 'e1rm')
  assert.equal(r.e1rm, e1rmKg(105, 5))
  assert.equal(r.plus, e1rmKg(105, 5) - e1rmKg(100, 5))
  assert.match(rekordTekst(r), /^Ny rekord: Squat e1RM \d+ kg, \+\d+ kg$/)
})

test('flest reps på en vægt der er løftet før', () => {
  const g = bygGrundlag([saet('Bænkpres', 80, 8), saet('Bænkpres', 90, 3)]) // bedst e1RM: 80×8 = 101,3
  const r = findRekord(g, saet('Bænkpres', 90, 4)) // 102 → e1RM-rekord (+1)
  assert.equal(r.type, 'e1rm')
  const r2 = findRekord(bygGrundlag([saet('Bænkpres', 100, 5), saet('Bænkpres', 80, 5)]), saet('Bænkpres', 80, 7))
  assert.equal(r2.type, 'reps')
  assert.equal(r2.plus, 2)
  assert.equal(rekordTekst(r2), 'Ny rekord: Bænkpres 80 kg × 7, 2 reps mere end før')
})

test('første sæt på en øvelse er ingen rekord (intet at slå)', () => {
  assert.equal(findRekord({}, saet('Dødløft', 180, 3)), null)
})

test('samme e1RM (afrundet) er ingen rekord: aldrig "+0 kg"', () => {
  const g = bygGrundlag([saet('Squat', 100, 5)])
  assert.equal(findRekord(g, saet('Squat', 100, 5)), null)
  assert.equal(findRekord(g, saet('Squat', 100.2, 5)), null)
})

test('ny vægt der ikke er løftet før og ikke slår e1RM: ingen rekord', () => {
  const g = bygGrundlag([saet('Squat', 100, 5)])
  assert.equal(findRekord(g, saet('Squat', 90, 6)), null)
})

test('sprungne sæt giver aldrig rekord, og tæller ikke i grundlaget', () => {
  const g = bygGrundlag([saet('Squat', 100, 5)])
  assert.equal(findRekord(g, saet('Squat', 140, 5, undefined, { skipped: true })), null)
  const g2 = bygGrundlag([saet('Squat', 100, 5), saet('Squat', 200, 5, undefined, { skipped: true })])
  assert.ok(findRekord(g2, saet('Squat', 105, 5)))
})

test('vægt 0 eller reps 0 (kropsvægt, planke) er aldrig en rekord', () => {
  const g = bygGrundlag([saet('Pull-ups', 0, 6), saet('Squat', 100, 5)])
  assert.equal(findRekord(g, saet('Pull-ups', 0, 10)), null)
  assert.equal(findRekord(g, saet('Squat', 150, 0)), null)
})

test('navne sammenlignes uden store/små bogstaver og mellemrum', () => {
  const g = bygGrundlag([saet(' squat', 100, 5)])
  assert.ok(findRekord(g, saet('Squat', 110, 5)))
})

test('rekordListe: kronologisk, hver rekord én gang med dato', () => {
  const liste = rekordListe([
    saet('Squat', 105, 5, '2026-09-08T10:00:00Z'),
    saet('Squat', 100, 5, '2026-09-01T10:00:00Z'),
    saet('Squat', 105, 5, '2026-09-15T10:00:00Z'), // samme som før: ingen
    saet('Squat', 110, 5, '2026-09-22T10:00:00Z'),
  ])
  assert.deepEqual(liste.map(r => r.dato.slice(0, 10)), ['2026-09-08', '2026-09-22'])
})

test('ugens sæt fra exerciseLogs: fortrudt sæt er væk, sendt sæt tælles ikke to gange', () => {
  const week = { id: 'u4', sessions: [{ exercises: [{ id: 'ex-sq', name: 'Squat' }] }] }
  const fremgang = [
    { exercise_id: 'ex-gammel', weight: 100, reps_completed: 5, logged_at: '2026-09-01T10:00:00Z', exercises: { name: 'Squat' } },
    // Denne uges sæt, allerede sendt: står også i exerciseLogs → tages derfra.
    { exercise_id: 'ex-sq', weight: 110, reps_completed: 5, logged_at: '2026-09-22T10:00:00Z', exercises: { name: 'Squat' } },
  ]
  const logs = [{ exercise_id: 'ex-sq', set_number: 1, weight: 110, reps_completed: 5, logged_at: '2026-09-22T10:00:00Z', skipped: false }]
  const alle = [...tidligereSaet(fremgang, week), ...ugensSaet(logs, week, [week])]
  assert.equal(rekordListe(alle).length, 1)
  // Fortrudt: rækken er væk fra exerciseLogs → ingen rekord.
  assert.equal(rekordListe([...tidligereSaet(fremgang, week), ...ugensSaet([], week, [week])]).length, 0)
  // Sættet selv holdes ude, når det testes mod resten.
  assert.equal(ugensSaet(logs, week, [week], 'ex-sq_1').length, 0)
})

test('grupperRekorder: en raekke pr. hovedloeft med bedste vaerdi, historik bag, varianter for sig', () => {
  const r = (navn, dato, e1rm, type = 'e1rm') => ({ navn, dato, e1rm, type, weight: 100, reps: 5, plus: 1 })
  const liste = [
    r('Militærpres', '6', 60), r('Squat', '5', 165), r('Bænkpres', '4', 127), r('Pause squat', '3', 140),
    r('Sumo dødløft', '2', 200), r('Squat', '1', 162), r('Squat', '0', 160),
  ]
  const g = grupperRekorder(liste)
  assert.deepEqual(g.hoved.map(x => x.navn), ['Squat', 'Bænkpres', 'Sumo dødløft'])
  assert.equal(g.hoved[0].bedst.e1rm, 165)
  assert.equal(g.hoved[0].bedst.dato, '5')
  assert.deepEqual(g.hoved[0].historik.map(x => x.e1rm), [165, 162, 160])
  assert.deepEqual(g.andre.map(x => x.navn), ['Militærpres', 'Pause squat'])
  assert.equal(grupperRekorder(null).hoved.length, 0)
})

test('grupperRekorder: bedste er hoejeste e1RM, ikke nyeste reps-rekord', () => {
  const liste = [
    { navn: 'Squat', dato: '9', type: 'reps', weight: 80, reps: 6, plus: 1 },
    { navn: 'Squat', dato: '5', type: 'e1rm', e1rm: 165, weight: 140, reps: 5, plus: 3 },
  ]
  const g = grupperRekorder(liste)
  assert.equal(g.hoved.length, 1)
  assert.equal(g.hoved[0].bedst.e1rm, 165)
  assert.equal(g.hoved[0].historik.length, 2)
})
