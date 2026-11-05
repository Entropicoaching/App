import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text } from './reactFixture.mjs'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const today = '2026-11-02'
function fixture() {
  return { enabled: true, athlete: { id: 'synthetic-athlete', kcal_target: 2000, protein_target: 150 }, today,
    session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: ['synthetic-athlete'] },
    coachNutrition: { coachId: 'synthetic-coach', day: today, athleteIds: ['synthetic-athlete'],
      from: '2026-10-27', through: today, state: 'ready', complete: true, targets: [], rows: [] } }
}
function meal(p, date, kcal, protein, id = `meal-${p.coachNutrition.rows.length}`) {
  p.coachNutrition.rows.push({ id, athlete_id: p.athlete.id, date, kcal, protein, meal: 'Synthetic meal' })
}
const render = p => mount(KostMaal, p).render()
const lines = tree => nodes(tree, n => n.type === 'p' && text(n).startsWith('Seneste 7 dage med nuværende mål:'))
function line(p) { const result = lines(render(p)); assert.equal(result.length, 1); return text(result[0]) }

test('counts daily sums independently, exact targets and unrounded decimals; includes day seven', () => {
  const p = fixture()
  meal(p, today, '1000,25', '74,5'); meal(p, today, '999,75', '75,5')
  meal(p, '2026-11-01', '1999,9', '150,1')
  meal(p, '2026-10-31', '2000,1', '149,9')
  meal(p, '2026-10-27', 2200, 160)
  const before = structuredClone(p), tree = render(p), result = lines(tree)
  assert.equal(result.length, 1)
  assert.equal(text(result[0]), 'Seneste 7 dage med nuværende mål: energi 3 af 7 dage · protein 3 af 7 dage (4 loggede dage).')
  assert.equal(result[0].props.role, undefined); assert.equal(result[0].props.style, undefined)
  assert.ok(text(tree).indexOf(text(result[0])) > text(tree).indexOf('Protein'))
  assert.ok(text(tree).indexOf(text(result[0])) < text(tree).indexOf('Rediger'))
  assert.deepEqual(p, before)
})

test('zero, one and two logged days are shown without inventing unlogged attainment', () => {
  for (const count of [0, 1, 2]) {
    const p = fixture()
    for (let i = 0; i < count; i++) meal(p, `2026-11-0${2-i}`, 2100, 160)
    assert.equal(line(p), `Seneste 7 dage med nuværende mål: energi ${count} af 7 dage · protein ${count} af 7 dage (${count === 1 ? '1 logget dag' : `${count} loggede dage`}).`)
  }
  const p = fixture(); meal(p, today, 0, 0)
  assert.match(line(p), /energi 0 af 7 dage · protein 0 af 7 dage \(1 logget dag\)/)
})

test('missing or invalid goals are independent and follow existing integer target contract', () => {
  for (const invalid of [undefined, null, '', 0, -1, NaN, Infinity, true, 'oops', '2000,5']) {
    const p = fixture(); meal(p, today, 2500, 160)
    p.athlete.kcal_target = invalid
    assert.match(line(p), /mål: protein 1 af 7 dage/)
    p.athlete.protein_target = invalid
    assert.equal(lines(render(p)).length, 0)
    p.athlete.kcal_target = '2000'
    assert.match(line(p), /mål: energi 1 af 7 dage/)
  }
})

test('metadata adds no day and other roster athletes add no attainment', () => {
  const p = fixture()
  meal(p, today, 2000, 150)
  meal(p, '2026-11-01', NaN, null); p.coachNutrition.rows[1].meal = ' [appData2-day-v1][]'
  p.readContext.athleteIds.push('synthetic-other'); p.coachNutrition.athleteIds.push('synthetic-other')
  p.coachNutrition.rows.push({ id: 'other', athlete_id: 'synthetic-other', date: '2026-10-27', kcal: 9000, protein: 900, meal: 'Synthetic meal' })
  assert.match(line(p), /energi 1 af 7 dage · protein 1 af 7 dage \(1 logget dag\)/)
})

test('untrusted, stale, malformed and out-of-period receipts stay hidden', () => {
  const changes = [p => { p.loading = true }, p => { p.loadError = true }, p => { delete p.session },
    p => { p.readContext.coachId = 'foreign' }, p => { p.readContext.day = '2026-11-01' },
    p => { p.coachNutrition.complete = false }, p => { p.coachNutrition.state = 'loading' },
    p => { p.coachNutrition.from = '2026-10-26' }, p => { p.coachNutrition.through = '2026-11-01' },
    p => { p.coachNutrition.athleteIds = [] }, p => { p.coachNutrition.targets = null },
    p => { p.coachNutrition.rows[0].date = '2026-10-26' }, p => { p.coachNutrition.rows[0].date = '2026-11-03' },
    p => { p.coachNutrition.rows[0].athlete_id = 'foreign' },
    p => { p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0] }) },
    p => { p.coachNutrition.rows.push({ ...p.coachNutrition.rows[0], id: 'overflow', kcal: Number.MAX_VALUE }); p.coachNutrition.rows[0].kcal = Number.MAX_VALUE }]
  for (const change of changes) {
    const p = fixture(); meal(p, today, 2000, 150); change(p)
    assert.equal(lines(render(p)).length, 0)
  }
})

test('switching athletes or receipt state removes prior counts; draft edits do not change saved goals', () => {
  const p = fixture(); meal(p, today, 2000, 150)
  const view = mount(KostMaal, p)
  assert.equal(lines(view.render()).length, 1)
  assert.equal(lines(view.render({ athlete: { id: 'synthetic-other' } })).length, 0)
  assert.equal(lines(view.render(p)).length, 1)
  assert.equal(lines(view.render({ coachNutrition: { ...p.coachNutrition, state: 'loading' } })).length, 0)
  let calls = 0
  Object.assign(p, { editing: 'setup', editData: { kcal_target: 9000, protein_target: 900 },
    startEdit() { calls++ }, setEditData() { calls++ }, setEditing() { calls++ }, saveEdit() { calls++ } })
  assert.match(line(p), /energi 1 af 7 dage · protein 1 af 7 dage/)
  assert.equal(calls, 0)
})

test('OFF reads only enabled even with hostile goal and receipt getters', () => {
  for (const enabled of [undefined, false, 0, 1, 'true']) {
    assert.equal(KostMaal(new Proxy({ enabled }, { get(p, key) {
      if (key !== 'enabled') throw Error('OFF read')
      return p.enabled
    } })), null)
  }
})


test('three decimal meals exactly on each goal survive floating point accumulation', () => {
  for (const values of [[19.2, 115.6, 15.2], [19.201, 115.602, 15.197]]) {
    const p = fixture()
    p.athlete.kcal_target = p.athlete.protein_target = 150
    for (const value of values) meal(p, today, value, value)
    assert.match(line(p), /energi 1 af 7 dage · protein 1 af 7 dage/)
  }
})

test('three decimal meals 0.01 below each goal remain below independently', () => {
  for (const key of ['kcal', 'protein']) {
    const p = fixture()
    p.athlete.kcal_target = p.athlete.protein_target = 150
    for (const [index, value] of [19.2, 115.6, 15.2].entries())
      meal(p, today, value - (key === 'kcal' && index === 2 ? 0.01 : 0),
        value - (key === 'protein' && index === 2 ? 0.01 : 0))
    assert.match(line(p), key === 'kcal'
      ? /energi 0 af 7 dage · protein 1 af 7 dage/
      : /energi 1 af 7 dage · protein 0 af 7 dage/)
  }
})

test('comma text with three decimal meals reaches both goals without rounding up 0.01 under', () => {
  for (const under of [false, true]) {
    const p = fixture()
    for (const [kcal, protein] of [['19,2', '19,2'], ['1965,6', '115,6'],
      under ? ['15,19', '15,19'] : ['15,2', '15,2']]) meal(p, today, kcal, protein)
    assert.match(line(p), under ? /energi 0 af 7 dage · protein 0 af 7 dage/
      : /energi 1 af 7 dage · protein 1 af 7 dage/)
  }
})

test('300 reproducible random exact triples reach energy and protein goals; 0.01 under does not', () => {
  let seed = 0x5eed2026
  const random = limit => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed % limit
  }
  const triple = target => {
    const first = 1 + random(target * 10 - 2)
    const second = 1 + random(target * 10 - first - 1)
    return [first, second, target * 10 - first - second]
  }
  for (let iteration = 0; iteration < 300; iteration++) {
    const energy = triple(2000), protein = triple(150)
    assert.equal(energy.reduce((a, b) => a + b), 20000)
    assert.equal(protein.reduce((a, b) => a + b), 1500)
    for (const under of [false, true]) {
      const p = fixture()
      for (let i = 0; i < 3; i++) {
        const format = units => ((units / 10) - (under && i === 2 ? 0.01 : 0))
          .toFixed(2).replace('.', iteration % 2 ? ',' : '.')
        meal(p, today, format(energy[i]), format(protein[i]))
      }
      assert.match(line(p), under ? /energi 0 af 7 dage · protein 0 af 7 dage/
        : /energi 1 af 7 dage · protein 1 af 7 dage/, `triple ${iteration}, under=${under}`)
    }
  }
})

test('goal counts retain seven civil days across DST and year boundaries', () => {
  for (const [day, from] of [['2026-10-27', '2026-10-21'], ['2027-01-03', '2026-12-28']]) {
    const p = fixture()
    p.today = p.readContext.day = p.coachNutrition.day = p.coachNutrition.through = day
    p.coachNutrition.from = from
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.parse(day + 'T00:00:00Z') - i * 86400000).toISOString().slice(0, 10)
      meal(p, date, 2000, 150)
    }
    assert.match(line(p), /energi 7 af 7 dage · protein 7 af 7 dage \(7 loggede dage\)/)
  }
})
