// Ordre 1429: coachens fremgang matcher atletens (samme tunge-saet-regel, eet
// navn pr. hovedloeft) og styrkelinjen oeverst paa profilen. Syntetiske data.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestHeavySetPerDay } from './exerciseProgress.js'
import { hovedloeftStatus, lokalDag, smerteNoter, styrkeLinje, styrkeSmerteRegel } from './coachFremgang.js'
import { bedsteRekorder, normaliserRekorder, tungeRekorder } from './personalRecords.js'
import { detectSignalsV2 } from './coachBriefingRules.js'

const TODAY = '2026-10-06'
const dagMinus = (n) => new Date(Date.parse(`${TODAY}T10:00:00Z`) - n * 86400000).toISOString()
const log = (navn, weight, reps, dage, extra = {}) => ({ exercises: { name: navn, sessions: extra.sess }, weight, reps_completed: reps, logged_at: dagMinus(dage), skipped: false, note: extra.note ?? null, exercise_id: extra.eid ?? null })

// Bænk: tunge sæt stiger ikke (112 -> 112), backoff og volumen er lette og hoeje i Epley.
const BAENK = [
  log('Bænkpres topsæt', 100, 4, 70), log('Baenkpres - backoff', 85, 8, 70), // 113 / 108
  log('Bænkpres', 100, 4, 50), log('Bænkpres teknik single', 90, 1, 50),
  log('Bænkpres comp', 100, 4, 30), log('Bænkpres back-off', 90, 10, 30), // backoff 120 maa IKKE taelle
  log('Bænkpres topsæt', 100, 4, 3),
]
// Squat stiger: 140 -> 150 -> 160 (x5)
const SQUAT = [
  log('Squat (comp)', 130, 5, 60), log('Squat topsæt', 140, 5, 40), log('Squat - topsæt', 150, 5, 5), log('Squat volumen', 100, 12, 5),
]

test('coachens dagskurve er identisk med atletens (samme funktion, eet navn)', () => {
  const s = hovedloeftStatus([...BAENK, ...SQUAT], TODAY)
  assert.deepEqual(s.map(x => x.navn), ['Squat', 'Bænkpres'])
  const baenk = s.find(x => x.navn === 'Bænkpres')
  assert.deepEqual(baenk.punkter, bestHeavySetPerDay(BAENK))
  assert.deepEqual(baenk.punkter.map(p => p.e1rm), [113, 113, 113, 113])
  const squat = s.find(x => x.navn === 'Squat')
  assert.deepEqual(squat.punkter.map(p => p.e1rm), [152, 163, 175]) // 130x5, 140x5, 150x5; volumen 100x12 taeller ikke
  assert.equal(squat.nu, 175)
  assert.equal(squat.foer, 163)
})

test('lette saet traekker aldrig coachens tal ned eller op', () => {
  const kunLette = [log('Bænkpres backoff', 120, 5, 3), log('Bænkpres teknik single', 130, 1, 4)]
  assert.deepEqual(hovedloeftStatus(kunLette, TODAY).find(x => x.navn === 'Bænkpres').punkter, [])
  const medLette = [...BAENK, log('Bænkpres backoff', 140, 5, 1)]
  assert.deepEqual(hovedloeftStatus(medLette, TODAY).find(x => x.navn === 'Bænkpres').punkter, hovedloeftStatus(BAENK, TODAY).find(x => x.navn === 'Bænkpres').punkter)
})

test('styrkelinjen: stagnation og svageste hovedloeft, hvert tal fra loggen', () => {
  const l = styrkeLinje([...BAENK, ...SQUAT], TODAY)
  assert.equal(l.dele[0].type, 'stagnation')
  assert.match(l.dele[0].tekst, /^Bænkpres: ingen ny top i 10 uger \(e1RM 113 kg, 28\. jul\)/)
  assert.ok(!l.tekst.includes('Squat')) // squat stiger og er ikke svagest
  const jaevn = styrkeLinje([...SQUAT], TODAY)
  assert.equal(jaevn.dele[0].type, 'ok')
})

test('svageste hovedloeft vaelges efter atletens EGEN udvikling (ikke atlet mod atlet)', () => {
  const dl = [log('Dødløft', 160, 3, 60), log('Dødløft', 160, 3, 50), log('Dødløft', 160, 3, 40), log('Dødløft', 162.5, 3, 10), log('Dødløft', 162.5, 3, 2)]
  const l = styrkeLinje([...SQUAT, ...dl], TODAY)
  const svag = l.dele.find(d => d.type === 'svageste')
  assert.ok(svag)
  assert.match(svag.tekst, /Dødløft \(e1RM 176 → 179 kg, \+1,7 % /)
})

test('smerte-note: kropsdel og dato, kommentaren citeres aldrig, gammel/negeret tæller ikke', () => {
  const sess = { id: 's1', athlete_comment: 'Det stikker i knæet ved bunden' }
  const logs = [log('Squat topsæt', 150, 5, 2, { sess }), log('Squat topsæt', 150, 5, 2, { sess }), log('Squat', 140, 5, 30, { sess: { id: 's0', athlete_comment: 'ondt i ryggen' } }), log('Bænkpres', 100, 4, 1, { sess: { id: 's2', athlete_comment: 'ingen smerter' } })]
  const n = smerteNoter(logs, TODAY)
  assert.equal(n.length, 1)
  assert.equal(n[0].del, 'knæet')
  const l = styrkeLinje(logs, TODAY)
  assert.equal(l.dele[0].type, 'smerte')
  assert.match(l.dele[0].tekst, /^Smerte: knæet nævnt i pas-kommentar 4\. okt \(squat\)/)
  assert.ok(!l.tekst.includes('stikker'))
})

test('uden tunge saet: siger det ærligt i stedet for et tal', () => {
  const l = styrkeLinje([log('Bænkpres backoff', 90, 8, 3)], TODAY)
  assert.equal(l.dele[0].type, 'ok')
  assert.match(l.tekst, /Endnu ikke nok tunge sæt/)
})

test('coachens rekordlister tæller kun tunge sæt og har eet navn', () => {
  const rows = [
    { id: 1, exercise_name: 'Bænkpres topsæt', weight: 100, reps: 4, logged_at: '2026-09-01' },
    { id: 2, exercise_name: 'Bænkpres - backoff', weight: 105, reps: 10, logged_at: '2026-09-20' }, // backoff
    { id: 3, exercise_name: 'Bænkpres teknik single', weight: 110, reps: 1, logged_at: '2026-09-21' }, // teknik
    { id: 4, exercise_name: 'Baenkpres', weight: 102.5, reps: 3, logged_at: '2026-09-25' },
    { id: 5, exercise_name: 'Squat', weight: 100, reps: 15, logged_at: '2026-09-26' }, // >8 reps
  ]
  const tunge = tungeRekorder(rows)
  assert.deepEqual(tunge.map(r => r.id), [1, 4])
  const bedst = bedsteRekorder(tunge)
  assert.equal(bedst.length, 1)
  assert.equal(bedst[0].weight, 102.5)
  assert.deepEqual([...new Set(normaliserRekorder(tunge).map(r => r.exercise_name))], ['Bænkpres'])
})

test('stagnations-detektoren tæller ikke lette sæt (backoff 12 reps ville ellers skjule stilstand)', () => {
  const athlete = { id: 'a1', name: 'Test', status: 'active' }
  const logs = []
  const monday = new Date('2026-08-03T10:00:00Z').getTime()
  for (let w = 0; w < 9; w++) {
    const d = new Date(monday + w * 7 * 86400000).toISOString()
    logs.push({ session_id: 'x', name: 'Bænkpres topsæt', weight: 100, reps_completed: 4, logged_at: d, rpe_actual: 8, rpe_planned: 8 })
    // let backoff med stigende vaegt: ville vaere en ny "top" hver uge uden filteret
    logs.push({ session_id: 'x', name: 'Bænkpres backoff', weight: 70 + w * 2.5, reps_completed: 8, logged_at: d, rpe_actual: 7, rpe_planned: 7 })
  }
  const sig = detectSignalsV2({ athlete, logs, weeks: [], readiness: [], personal_records: [], today: '2026-10-06' })
  const st = sig.find(x => x.detector === 'stagnation')
  assert.ok(st, 'stilstand skal fanges')
  assert.match(st.headline, /Bænk/)
  assert.equal(st.metrics.top_weight, 100)
})

// Ordre 1440 (QA 1437 fund 2): planlagt deload/taper tier stille om stagnation.
const medBlok = (l, blok) => ({ ...l, exercises: { ...l.exercises, sessions: { id: 's1', weeks: { block_name: blok } } } })
test('deload-uge: ingen stagnation- eller svageste-vurdering, kun en rolig linje', () => {
  const normal = styrkeLinje(BAENK, TODAY)
  assert.ok(normal.dele.some(d => d.type === 'stagnation'), 'uden deload staar der stagnation')
  const deload = styrkeLinje(BAENK.map((l, i) => i === BAENK.length - 1 ? medBlok(l, 'Deload') : l), TODAY)
  assert.deepEqual(deload.dele.map(d => d.type), ['let-uge'])
})
test('gammel deload (over 10 dage) taler ikke; smerte staar stadig i en deload-uge', () => {
  const gammel = BAENK.map((l, i) => i === 4 ? medBlok(l, 'Deload') : l)
  assert.ok(styrkeLinje(gammel, TODAY).dele.some(d => d.type === 'stagnation'))
  const smerte = { ...medBlok(BAENK[6], 'Taper'), exercises: { name: 'Bænkpres topsæt', sessions: { id: 's2', athlete_comment: 'ondt i skulderen', weeks: { block_name: 'Taper' } } } }
  const t = styrkeLinje([...BAENK.slice(0, 6), smerte], TODAY).dele.map(d => d.type)
  assert.equal(t[0], 'smerte')
  assert.ok(!t.includes('stagnation'))
})

test('lokalDag bruger lokal kalenderdag (som dagNoegle), ikke UTC-dato (ordre 1492)', () => {
  assert.equal(lokalDag(new Date(2026, 9, 7, 0, 30)), '2026-10-07')
  assert.equal(lokalDag(new Date(2026, 9, 7, 23, 59)), '2026-10-07')
})

test('ordre 1545: naar alt stiger, staar tallene i linjen (e1RM mod 1-3 mdr. foer), ikke kun en floskel', () => {
  const stiger = [
    log('Squat', 100, 5, 60), log('Squat', 100, 5, 40), log('Squat', 105, 5, 20), log('Squat', 110, 5, 3),
    log('Bænkpres', 80, 5, 60), log('Bænkpres', 80, 5, 40), log('Bænkpres', 82.5, 5, 20), log('Bænkpres', 85, 5, 3),
  ]
  const l = styrkeLinje(stiger, TODAY)
  assert.equal(l.dele[0].type, 'ok')
  assert.match(l.tekst, /Alle hovedløft stiger eller holder \(e1RM mod 1-3 mdr\. før: Squat \+9,4 %, Bænkpres \+6,5 %\); ingen smerte-noter/)
})

test('ordre 1545: styrkeSmerteRegel gentager kun reglen, ikke kropsdel og dato', () => {
  const tekst = 'Smerte: knæet nævnt i pas-kommentar 6. okt. Ingen stigning, før du har talt med atleten'
  assert.equal(styrkeSmerteRegel(tekst), 'Ingen stigning, før du har talt med atleten')
  assert.equal(styrkeSmerteRegel('anden tekst'), 'anden tekst')
})

test('ordre 1545: smerte skrevet kun paa et saet-note taeller (3A), kilde staar i linjen, noten citeres aldrig', () => {
  const logs = [
    log('Bænkpres', 100, 5, 2, { note: 'Skarp smerte i venstre skulder', eid: 'e1' }),
    log('Bænkpres', 100, 5, 2, { note: 'Skarp smerte i venstre skulder', eid: 'e1' }), // samme saet-note samme dag taeller een gang
    log('Squat', 120, 5, 3, { note: 'ingen smerter, gik fint', eid: 'e2' }),
  ]
  const n = smerteNoter(logs, TODAY)
  assert.equal(n.length, 1)
  assert.equal(n[0].kilde, 'sæt-note')
  assert.equal(n[0].del, 'skulderen')
  const l = styrkeLinje(logs, TODAY)
  assert.equal(l.dele[0].type, 'smerte')
  assert.match(l.dele[0].tekst, /^Smerte: skulderen nævnt i sæt-note 4\. okt \(bænkpres\)\. Ingen stigning, før du har talt med atleten$/)
  assert.ok(!l.tekst.includes('Skarp'))
})
