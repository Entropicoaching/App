import test from 'node:test'
import assert from 'node:assert/strict'
import Volume from './Volume.mjs'
import { volumeModel, formatSets } from './volumeModel.mjs'
import { beregnVolumenPrUge } from '../../volume/beregn.js'

const now = '2026-11-03'
const log = (name = 'Squat', logged_at = '2026-11-03', extra = {}) => ({ exercises: { name }, logged_at, ...extra })
const model = (volumeLogs, extra = {}) => volumeModel({ volumeLogs, volumeLoading: false, now, ...extra })
const render = (volumeLogs, extra = {}) => Volume({ entropi2: true, volumeLogs, volumeLoading: false, now, ...extra })
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props.children].flat(Infinity).flatMap(nodes)]
const text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : [tree.props.children].flat(Infinity).map(text).join(' ')
const tags = (tree, tag) => nodes(tree).filter(n => n.type === tag)
const row = (m, key) => m.rows.find(r => r.key === key)

test('OFF returns before reading any log props; only boolean true opts in', () => {
  for (const entropi2 of [undefined, false, 0, 1, 'true']) {
    assert.equal(Volume({ entropi2, get volumeLogs() { throw Error('OFF accessed logs') } }), null)
  }
  assert.equal(Volume(), null)
})

test('two weeks reuse actual weighted standard calculation; input is unchanged', () => {
  const input = [log(), log(), log('Bænkpres', '2026-10-28'), log('Squat', '2026-11-02', { skipped: true })]
  const before = structuredClone(input)
  input.forEach(r => { Object.freeze(r.exercises); Object.freeze(r) }); Object.freeze(input)
  const m = model(input)
  assert.deepEqual(input, before)
  assert.equal(m.state, 'ready')
  assert.deepEqual([m.current.uge, m.previous.uge], ['2026-W45', '2026-W44'])
  assert.equal(row(m, 'kneeExtensors').current, 2)
  assert.equal(row(m, 'backExtensors').current, 1)
  assert.equal(row(m, 'pectoralisMajor').current, 0)
  assert.equal(row(m, 'pectoralisMajor').previous, 1)
  const expected = beregnVolumenPrUge(input.map(r => ({ oevelseNavn: r.exercises.name, loggetDato: r.logged_at, skipped: r.skipped })), { antalUger: 2, referenceDato: now })
  assert.deepEqual([m.current, m.previous], expected)
  assert.deepEqual(model([...input].reverse()), m)
})

test('last-week-only groups stay visible with an explicit zero this week', () => {
  const m = model([log('Bænkpres', '2026-10-26')])
  assert.equal(m.empty, false)
  assert.equal(row(m, 'pectoralisMajor').current, 0)
  const tree = render([log('Bænkpres', '2026-10-26')])
  const chest = tags(tree, 'tr').find(n => /Brystmuskel/.test(text(n)))
  assert.deepEqual(tags(chest, 'td').map(text), ['0', '1'])
  assert.doesNotMatch(text(tree), /ikke gennemført sæt i disse to uger/)
})

test('empty loaded history differs from loading and absent history', () => {
  assert.equal(model([]).empty, true)
  for (const p of [{ volumeLoading: true }, { volumeLoading: true, volumeLogs: [log()] }]) {
    const tree = Volume({ entropi2: true, now, ...p })
    assert.match(text(tree), /Henter din volumen/)
    assert.equal(tags(tree, 'table').length, 0)
  }
  for (const missing of [undefined, null, {}, '']) {
    const tree = render(missing)
    assert.match(text(tree), /ikke klar endnu/)
    assert.doesNotMatch(text(tree), /ikke gennemført/)
    assert.equal(tags(tree, 'table').length, 0)
  }
  const empty = render([])
  assert.match(text(empty), /ikke gennemført sæt i disse to uger/)
  assert.equal(tags(empty, 'table').length, 0)
  assert.equal(tags(empty, 'p').length, 1)
  assert.equal(tags(empty, 'details').length, 0)
  assert.doesNotMatch(text(empty), /Sæt pr. muskelgruppe|Denne uge er stadig i gang/)
})

test('unknown sets are explained separately for each week, including unknown-only history', () => {
  const input = [log('synthetic unknown'), log('synthetic unknown', '2026-10-28')]
  const m = model(input)
  assert.equal(m.rows.length, 0)
  assert.equal(m.empty, false)
  assert.deepEqual([m.current.ukendteSaet, m.previous.ukendteSaet], [1, 1])
  const tree = render(input)
  assert.match(text(tree), /1 sæt denne uge er ikke knyttet/)
  assert.match(text(tree), /1 sæt sidste uge er ikke knyttet/)
  assert.doesNotMatch(text(tree), /ikke gennemført/)
  assert.equal(tags(tree, 'table').length, 0)
})

test('skipped, optimistic, invalid dates and outside-window sets do not count', () => {
  const input = [null, log(), log('Squat', '2026-11-03', { skipped: true }),
    log('Squat', '2026-11-03', { _optimistic: true }), log('Squat', 'bad'),
    log('Squat', '2026-02-30'), log('Squat', '2026-10-25'), log('Squat', '2026-11-09')]
  assert.deepEqual(model(input), model([log()]))
})

test('Monday and Sunday split weeks; year rollover uses existing ISO keys', () => {
  const m = model([log('Squat', '2026-11-01T23:59:59Z'), log('Squat', '2026-11-02T00:00:00Z')])
  assert.deepEqual([row(m, 'kneeExtensors').current, row(m, 'kneeExtensors').previous], [1, 1])
  const rollover = model([log('Squat', '2020-12-28'), log('Squat', '2021-01-03'), log('Squat', '2021-01-04')], { now: '2021-01-04' })
  assert.deepEqual([rollover.current.uge, rollover.previous.uge], ['2021-W01', '2020-W53'])
  assert.deepEqual([row(rollover, 'kneeExtensors').current, row(rollover, 'kneeExtensors').previous], [1, 2])
})

test('invalid reference fails closed; a Date reference is also supported', () => {
  for (const invalid of ['bad', '2026-02-30', new Date(NaN), null]) {
    assert.equal(model([log()], { now: invalid }).state, 'unavailable')
    assert.match(text(render([log()], { now: invalid })), /Dato mangler/)
  }
  assert.deepEqual(model([log()], { now: new Date('2026-11-03T12:00:00Z') }), model([log()]))
})

test('semantic comparison table has column/row headers and Danish half sets', () => {
  const tree = render([log()])
  assert.equal(tree.type, 'section')
  assert.equal(tree.props['aria-label'], 'Din volumen')
  assert.equal(tags(tree, 'caption').length, 1)
  assert.deepEqual(tags(tree, 'th').filter(n => n.props.scope === 'col').map(text), ['Muskelgruppe', 'Denne uge', 'Sidste uge'])
  assert.equal(tags(tree, 'th').filter(n => n.props.scope === 'row').length, 4)
  assert.ok(tags(tree, 'td').some(n => text(n) === '0,5'))
  assert.match(text(tree), /Denne uge er stadig i gang/)
  assert.match(text(tree), /uge 45, 2026/)
  assert.match(text(tree), /uge 44, 2026/)
  assert.equal(tags(tree, 'details').length, 1)
  assert.ok(tags(tree, 'summary')[0].props.style.minHeight >= 44)
  assert.equal(tags(tree, 'table')[0].props.style.tableLayout, 'fixed')
  assert.equal(tree.props.style.boxSizing, 'border-box')
  assert.equal(tree.props.style.width, '100%')
  assert.equal(formatSets(1.5), '1,5')
  assert.equal(formatSets(0), '0')
})

test('exercise names never enter rendered UI and external correction props are ignored', () => {
  const input = [log('<img src=x onerror=synthetic>')]
  const tree = render(input, { rettelser: new Map([['<img src=x onerror=synthetic>', { grupper: [{ gruppe: 'kneeExtensors', andel: 1 }] }]]) })
  assert.doesNotMatch(text(tree), /onerror|synthetic/)
  assert.equal(tags(tree, 'img').length, 0)
  assert.equal(tags(tree, 'table').length, 0)
  assert.match(text(tree), /1 sæt denne uge er ikke knyttet/)
})
