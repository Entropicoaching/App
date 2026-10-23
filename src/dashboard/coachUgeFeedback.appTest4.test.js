import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { coachUgeFeedback, ugeFeedbackTree } from './coachUgeFeedback.js'

const now = () => new Date(2026, 9, 19)
const week = () => ({ id: 'w4', week_number: 4, start_date: '2026-10-12', sessions: [
  { id: 's1', title: 'Mandag', exercises: [
    { id: 'sq', name: 'Squat', sets: 2, reps: '5-8', recommended_weight: 100 },
    { id: 'bp', name: 'Bench', sets: 1, reps: 5, recommended_weight: 80 },
  ] },
] })
const row = (exercise_id, extra = {}) => ({ exercise_id, weight: exercise_id === 'bp' ? 80 : 100, reps_completed: 5, ...extra })
const h = (tag, props, ...children) => ({ tag, props, children })
const text = node => node == null ? '' : typeof node === 'object' ? node.children.map(text).join(' ') : String(node)
const nodes = node => node && typeof node === 'object' ? [node, ...node.children.flatMap(nodes)] : []
const list = (tree, heading) => {
  const block = nodes(tree).find(n => n.tag === 'div' && n.children.some(c => c?.tag === 'h4' && text(c) === heading))
  assert.ok(block, `Mangler sektion: ${heading}`)
  return nodes(block).filter(n => n.tag === 'li').map(text)
}
function inspect(w, logs) {
  const before = JSON.stringify([w, logs])
  const f = coachUgeFeedback(w, logs, now())
  assert.equal(JSON.stringify([w, logs]), before)
  assert.equal(f.automatiskProgramaendring, false)
  const tree = ugeFeedbackTree(h, f, w.week_number, w.id)
  assert.equal(tree.tag, 'section')
  assert.equal(tree.props['aria-label'], 'Coachens ugeoverblik for uge 4')
  assert.deepEqual(list(tree, 'Spørgsmål til coachen'), f.spoergsmaal)
  assert.match(text(tree), /Programmet ændres ikke automatisk\./)
  return { f, tree }
}
function rpe(f, expected) {
  assert.deepEqual([f.rpe.gennemsnit, f.rpe.max, f.rpe.saetMedRpe, f.rpe.saetUdenRpe, f.rpe.ugyldigeRpe], expected)
}

test('APP-TEST4: afsluttet uge med alle sæt og RPE viser fuld status', () => {
  const { f, tree } = inspect(week(), [row('sq', { rpe_actual: 7 }), row('sq', { rpe_actual: 8 }), row('bp', { rpe_actual: 9 })])
  assert.equal(f.status, 'fuld')
  assert.deepEqual(f.afvigelser, [])
  assert.deepEqual(f.spoergsmaal, [])
  assert.deepEqual([f.pas[0].status, f.pas[0].planlagtSaet, f.pas[0].gennemfoertSaet, f.pas[0].sprunget], ['gennemfoert', 3, 3, 0])
  rpe(f, [8, 9, 3, 0, 0])
  assert.match(text(tree), /Afsluttet kalenderuge · Fuldt gennemført/)
  assert.match(text(tree), /Gennemsnit: 8 · Maks: 9 · Med RPE: 3 · Uden RPE: 0 · Ugyldige: 0/)
  assert.deepEqual(list(tree, 'Afvigelser'), [])
})

test('APP-TEST4: delvis uge viser sprungne sæt, vægt, reps og konkrete spørgsmål', () => {
  const { f, tree } = inspect(week(), [row('sq', { reps_completed: 4, weight: 90, rpe_actual: 9 }), row('sq', { skipped: true, rpe_actual: 1 }), row('bp', { rpe_actual: 10 })])
  assert.equal(f.status, 'delvis')
  assert.deepEqual(f.pas[0].manglendeOevelser, ['Squat'])
  assert.deepEqual([f.pas[0].gennemfoertSaet, f.pas[0].sprunget], [2, 1])
  assert.deepEqual(f.afvigelser, [
    { type: 'faerre_saet', ovelse: 'Squat', planlagt: 2, gennemfoert: 1, sprunget: 1 },
    { type: 'faerre_reps', ovelse: 'Squat', saet: 1, planlagt: 5 },
    { type: 'anden_vaegt', ovelse: 'Squat', saet: 1, anbefalet: 100 },
  ])
  assert.equal(f.spoergsmaal.length, 4)
  assert.match(f.spoergsmaal[0], /kun delvist gennemført/)
  assert.match(f.spoergsmaal[1], /Øvelser uden fuld dækning: Squat/)
  assert.match(f.spoergsmaal[2], /afveg fra anbefalet vægt\/reps/)
  assert.match(f.spoergsmaal[3], /RPE var høj \(gns 9.5\)/)
  rpe(f, [9.5, 10, 2, 0, 0])
  assert.match(text(tree), /Delvist gennemført/)
  assert.deepEqual(list(tree, 'Afvigelser'), [
    'Squat: 1/2 gennemførte sæt, 1 sprunget over.',
    'Squat: 1 sæt under planens 5 reps.',
    'Squat: 1 sæt med anden vægt end anbefalet 100 kg.',
  ])
})

test('APP-TEST4: uge uden logs beskriver usikkerheden og gætter ikke sprunget over', () => {
  const { f, tree } = inspect(week(), [])
  assert.equal(f.status, 'ingen_logs')
  assert.deepEqual(f.afvigelser, [
    { type: 'ikke_logget', ovelse: 'Squat', planlagt: 2 },
    { type: 'ikke_logget', ovelse: 'Bench', planlagt: 1 },
  ])
  assert.equal(f.pas[0].status, 'ikke_logget')
  assert.deepEqual(f.spoergsmaal, ['Der er ingen loggede sæt. Blev ugen trænet uden logning, eller blev den ikke gennemført?'])
  rpe(f, [null, null, 0, 0, 0])
  assert.match(text(tree), /Afsluttet kalenderuge · Ingen registrerede sæt/)
  assert.match(text(tree), /Gennemsnit: ukendt · Maks: ukendt/)
})

test('APP-TEST4: eksplicit sprunget uge har ingen gennemførte sæt eller RPE', () => {
  const { f, tree } = inspect(week(), [row('sq', { skipped: true, rpe_actual: 10 }), row('sq', { skipped: true }), row('bp', { skipped: true, rpe_actual: 0 })])
  assert.equal(f.status, 'sprunget_over')
  assert.deepEqual(f.afvigelser, [
    { type: 'faerre_saet', ovelse: 'Squat', planlagt: 2, gennemfoert: 0, sprunget: 2 },
    { type: 'faerre_saet', ovelse: 'Bench', planlagt: 1, gennemfoert: 0, sprunget: 1 },
  ])
  assert.deepEqual(f.spoergsmaal, ['Alle 3 registrerede sæt er markeret som sprunget over. Hvorfor blev ugen sprunget over, og var det aftalt med atleten?'])
  rpe(f, [null, null, 0, 0, 0])
  assert.match(text(tree), /Afsluttet kalenderuge · Sprunget over/)
})

test('APP-TEST4: udateret og endnu åben uge giver intet kort, heller ikke med fulde logs', () => {
  for (const start_date of [undefined, '', '2026-10-13', '2026-10-19']) {
    const w = { ...week(), start_date }
    for (const logs of [[], [row('sq'), row('sq'), row('bp')]]) {
      const f = coachUgeFeedback(w, logs, now())
      assert.equal(f, null)
      assert.equal(ugeFeedbackTree(h, f, 4), null)
    }
  }
})

test('APP-TEST4: kun ukendte logs knyttet til ugens pas giver afvigelse', () => {
  const { f, tree } = inspect(week(), [row('sq', { rpe_actual: 7 }), row('sq', { rpe_actual: 7 }), row('bp', { rpe_actual: 7 }),
    row('deleted', { exercises: { session_id: 's1' }, rpe_actual: 10, note: 'Uden for planen' }),
    row('elsewhere', { exercises: { session_id: 's2' }, rpe_actual: 1 }), row('unscoped', { rpe_actual: 1 }),
  ])
  assert.equal(f.status, 'fuld')
  assert.deepEqual(f.afvigelser, [{ type: 'ukendt_ovelse_log', antal: 1 }])
  assert.deepEqual(f.spoergsmaal, ['Der er logs for øvelser uden for ugens program. Hvor hører de hjemme?'])
  assert.deepEqual(f.noter, [])
  rpe(f, [7, 7, 3, 0, 0])
  assert.deepEqual(list(tree, 'Afvigelser'), ['1 registreringer på øvelser uden for ugeplanen.'])
})

test('APP-TEST4: RPE 1 og 10 tæller, værdier uden for intervallet gør ikke', () => {
  const w = week()
  w.sessions[0].exercises = [{ ...w.sessions[0].exercises[0], sets: 6 }]
  const { f, tree } = inspect(w, [1, 10, 0, 11, null, ''].map(rpe_actual => row('sq', { rpe_actual, rpe: 9 })))
  assert.equal(f.status, 'fuld')
  assert.deepEqual(f.afvigelser, [])
  rpe(f, [5.5, 10, 2, 2, 2])
  assert.deepEqual(f.spoergsmaal, ['RPE mangler eller er ugyldig for 4 sæt; oversigten bygger kun på de øvrige.'])
  assert.match(text(tree), /Gennemsnit: 5.5 · Maks: 10 · Med RPE: 2 · Uden RPE: 2 · Ugyldige: 2/)
})

test('APP-TEST4: kun ugyldig eller manglende RPE giver ukendte tal og spørgsmål', () => {
  const { f, tree } = inspect(week(), [row('sq', { rpe_actual: -1 }), row('sq', { rpe_actual: 10.1 }), row('bp')])
  assert.equal(f.status, 'fuld')
  assert.deepEqual(f.afvigelser, [])
  rpe(f, [null, null, 0, 1, 2])
  assert.deepEqual(f.spoergsmaal, ['RPE mangler helt for ugen. Skal atleten spørges direkte?'])
  assert.match(text(tree), /Gennemsnit: ukendt · Maks: ukendt · Med RPE: 0 · Uden RPE: 1 · Ugyldige: 2/)
})

test('APP-TEST4: UgeFeedbackKort forbinder props, ur, navne og pure træ', () => {
  const source = readFileSync(new URL('./UgeFeedbackKort.jsx', import.meta.url), 'utf8')
  const check = value => {
    const compact = value.replace(/\s+/g, ' ').trim()
    assert.match(compact, /import \{ coachUgeFeedback, ugeFeedbackTree \} from '\.\/coachUgeFeedback\.js'/)
    assert.match(compact, /const feedback = coachUgeFeedback\(week, athleteLogs, new Date\(\)\)/)
    assert.match(compact, /return ugeFeedbackTree\(createElement, feedback, week\.week_number, week\.id \?\? week\.start_date \?\? week\.week_number, \{ atlet: atletNavn, coach: coachNavn \}\)/)
  }
  check(source)
  check(source.replace(/\r?\n/g, '\r\n'))
  check(source.replace(/\r\n/g, '\n'))
})
