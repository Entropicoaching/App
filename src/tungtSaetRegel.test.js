// Ordre 1451: EN regel for "tungt saet" og "hovedloeft". Klienten (erTungtSaet, mainLiftName)
// er kilden; SQL-migrationen fra 1446 maa give samme svar for de samme navne. Regexene laeses
// ud af migrationsfilen og koeres her (Postgres ARE og JS er ens for de konstruktioner der bruges).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { erTungtSaet, MAX_TUNGE_REPS } from './exerciseProgress.js'
import { mainLiftName } from './exerciseSetView.js'
import { rekordListe, findRekord, bygGrundlag } from './athlete/rekorder.js'

const sql = readFileSync(new URL('../supabase/migrations/20261006120000_training_signals_v3_tunge_saet.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n') // Windows-checkout (autocrlf) giver CRLF
const SUF = sql.match(/SUF constant text := '(.+)';/)[1]
const LET = new RegExp(sql.match(/nm !~ '([^']+)'/)[1].replace(/\\y/g, '\\b'))
const maxReps = Number(sql.match(/reps between 1 and (\d+)/)[1])
// CASE-grenene i migrationen: hver "when ... ~ ('<moenster>' [|| '<mere>'] || SUF || '$') then '<loeft>'".
const caseBlok = sql.slice(sql.indexOf('case'+String.fromCharCode(10)+'        when lower(coalesce(ex.name'), sql.indexOf('end lift'))
const loeftRegex = caseBlok.split(/\n\s*when /).slice(1).map(w => {
  const lits = [...w.split(' then ')[0].matchAll(/'([^']*)'/g)].map(m => m[1])
  assert.equal(lits.at(-1), '$')
  return new RegExp(lits.slice(0, -1).join('') + SUF + '$')
})
assert.equal(loeftRegex.length, 4) // squat, baenk, konventionel og sumo doedloeft (ordre 1508)

const sqlTungt = (navn, reps) => reps >= 1 && reps <= maxReps && !LET.test(navn.toLowerCase())
const sqlLoeft = (navn) => loeftRegex.some(r => r.test(navn.toLowerCase()))

const NAVNE = ['Bænkpres', 'Baenkpres', 'Bænkpres topsæt', 'Bænkpres top set', 'Bænkpres - topsæt', 'Bænkpres - backoff', 'Bænkpres back-off',
  'Bænkpres backoff', 'Bænkpres teknik single', 'baenk teknik single', 'Bænkpres teknik-singler', 'Bænkpres volumen', 'Bænkpres (comp)',
  'Bænkpres primær', 'Bench', 'Bench press', 'Squat', 'Squat - topsæt', 'Squat Top Set', 'Squat backoff', 'Squat volumen', 'Squat comp',
  'Dødløft', 'Dødløft topsæt', 'Dødløft - backoff', 'Sumo dødløft', 'Sumo dødløft topsæt', 'Dødløft (sumo)', 'Deadlift',
  'Front squat', 'Frontsquat', 'Pause bænkpres', 'Close-grip bænkpres', 'Rumænsk dødløft', 'Goblet squat', 'RDL', 'Bænkpres sekundær']

test('SQL og klient er enige om tungt saet for alle navne og rep-tal', () => {
  assert.equal(maxReps, MAX_TUNGE_REPS)
  for (const navn of NAVNE) for (const reps of [0, 1, 3, 5, 8, 9, 12]) {
    assert.equal(sqlTungt(navn, reps), erTungtSaet(navn, reps), `${navn} x ${reps}`)
  }
})

test('SQL og klient er enige om hvad et hovedloeft er (praecis fire, varianter er ikke)', () => {
  for (const navn of NAVNE) assert.equal(sqlLoeft(navn), mainLiftName(navn) != null, navn)
  for (const v of ['Front squat', 'Pause bænkpres', 'Close-grip bænkpres', 'Rumænsk dødløft', 'Goblet squat']) assert.equal(sqlLoeft(v), false, v)
})

test('rekorder bruger samme regel: lette saet og 9+ reps er aldrig rekord', () => {
  const g = bygGrundlag([{ navn: 'Bænkpres topsæt', weight: 100, reps: 3 }])
  // 85 x 12 backoff-volumen har e1RM 119 > 110, men er et let saet og taeller ikke.
  assert.equal(findRekord(g, { navn: 'Bænkpres volumen', weight: 85, reps: 12 }), null)
  assert.equal(findRekord(g, { navn: 'Bænkpres - backoff', weight: 95, reps: 8 }), null)
  assert.equal(findRekord(g, { navn: 'Bænkpres', weight: 80, reps: 9 }), null)
  assert.equal(findRekord(g, { navn: 'Bænkpres top set', weight: 105, reps: 3 })?.type, 'e1rm')
  const liste = rekordListe([
    { navn: 'Bænkpres topsæt', weight: 100, reps: 3, dato: '2026-09-01' },
    { navn: 'Bænkpres volumen', weight: 90, reps: 12, dato: '2026-09-02' },
    { navn: 'Bænkpres topsæt', weight: 105, reps: 3, dato: '2026-09-08' },
  ])
  assert.deepEqual(liste.map(r => r.dato), ['2026-09-08'])
})

test('deload-blok: SQL-regexet og erDeloadBlok er ens, og deload-saet tæller ikke', async () => {
  const { erDeloadBlok, bestHeavySetPerDay } = await import('./exerciseProgress.js')
  const re = new RegExp(sql.match(/~\* '([^']+)' deload/)[1], 'i')
  assert.match(sql, /reps between 1 and 8 and not deload/)
  for (const b of ['Deload', 'deload uge', 'Aflastning', 'Taper', 'Base', 'Peak', 'Stævne', '', null, 'Opbygning 2'])
    assert.equal(re.test(b ?? ''), erDeloadBlok(b), String(b))
  const log = (blok, kg) => ({ weight: kg, reps_completed: 3, logged_at: '2026-09-10T10:00:00Z', exercises: { name: 'Bænkpres topsæt', sessions: { weeks: { block_name: blok } } } })
  assert.equal(bestHeavySetPerDay([log('Deload', 70)]).length, 0)
  assert.equal(bestHeavySetPerDay([log('Base', 100)]).length, 1)
})
