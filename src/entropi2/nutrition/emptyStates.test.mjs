import test from 'node:test'
import assert from 'node:assert/strict'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'
import { mountNutritionScreen } from './index.mjs'
import { syntheticHost, find, flush } from './synthetic-dom.mjs'

const id = 'synthetic:empty-states', date = '2026-11-05'
const now = () => new Date('2026-11-05T12:00:00+01:00')
const row = extra => ({ id: 'synthetic:row', athlete_id: id, date, meal: 'Min ret',
  kcal: 400, protein: 25, carb: 40, fat: 10, ...extra })
async function mount(t, { rows = [], athlete = {}, view = {}, contracts = {} } = {}) {
  const writes = []
  const controller = createNutritionController({ enabled: true, athlete: { id, ...athlete }, date,
    storage: { getItem: () => null, setItem: (...args) => writes.push(args) },
    contracts: { load: async () => rows, ...contracts } })
  const host = syntheticHost()
  const cleanup = mountNutrition(host, controller, { clock: now, ...view })
  t.after(cleanup); await flush()
  return { host, controller, cleanup, writes }
}

test('empty diary: one empty message, one coach route and no unknown calculations or empty week overview', async t => {
  let contacted = 0
  const f = await mount(t, { view: { onCoach: () => contacted++ } })
  assert.equal(f.host.querySelectorAll('li').filter(n => n.textContent === 'Ingen måltider registreret i dag.').length, 1)
  assert.doesNotMatch(f.host.textContent, /Ingen vurdering|Ingen mål endnu|ukendt|Ingen vejninger|ikke tilsluttet|Ingen gemt ugekladde/)
  assert.equal(find(f.host, 'h2', 'Din uge'), undefined)
  assert.equal(find(f.host, 'h2', 'Din vægt'), undefined)
  assert.equal(f.host.querySelectorAll('progress').length, 0)
  await find(f.host, 'button', 'Tal med din coach').fire('click')
  assert.equal(contacted, 1)
  await find(f.host, 'button', 'Se historik').fire('click')
  assert.equal(f.host.querySelectorAll('p').filter(n => n.textContent === 'Ingen registreringer i perioden.').length, 1)
  assert.deepEqual(f.writes, [])
})

test('partial goals: only known targets and progress, general examples start collapsed', async t => {
  for (const athlete of [{ kcal_target: 2000 }, { protein_target: 120 }]) {
    const f = await mount(t, { athlete, rows: [row()] })
    const hero = f.host.querySelectorAll('section').find(n => n.getAttribute('data-kost-del') === 'maal')
    assert.doesNotMatch(hero.textContent, /Ingen mål|ukendt/)
    assert.equal(hero.querySelectorAll('p').filter(n => /^(Energi|Protein):/.test(n.textContent)).length, 1)
    assert.equal(f.host.querySelectorAll('progress').length, 1)
    assert.equal(hero.querySelectorAll('details')[0].open, false)
    assert.ok(find(hero, 'summary', 'Generel hjælp til måltider'))
    assert.doesNotMatch(hero.textContent, /Planlæg 4|dagens 4/)
    assert.equal(f.host.querySelectorAll('p').filter(n => n.textContent === 'Aftal dine kostmål med din coach.').length, 1)
  }
})

test('mixed valid and invalid meals: correction belongs only to the invalid row; no unknown totals', async t => {
  const f = await mount(t, { rows: [row(), row({ id: 'synthetic:bad', meal: 'Ret værdier', protein: null })],
    athlete: { kcal_target: 2000, protein_target: 120 }, contracts: { update: async () => true } })
  assert.equal(f.host.querySelectorAll('small').filter(n => /Kontrollér næringsværdierne/.test(n.textContent)).length, 1)
  assert.ok(find(f.host, 'small', '400 kcal · 25 g protein'))
  const protein = find(f.host, 'h3', 'Protein pr. måltid').parentElement
  assert.deepEqual(protein.querySelectorAll('li').map(n => n.textContent), ['Min ret: 25 g protein'])
  assert.ok(find(f.host, 'button', 'Ret måltid: Ret værdier'))
  assert.equal(f.host.querySelectorAll('progress').length, 0)
  assert.doesNotMatch(f.host.textContent, /ukendt|Næringsdata skal kontrolleres|Energi: null|Protein: null/)
})

test('weight reads: unconfirmed, loading, failed and other-athlete responses never assert empty or show stale numbers', async t => {
  const f = await mount(t)
  assert.doesNotMatch(f.host.textContent, /Ingen vejninger/)
  for (const weightStatus of [{ athleteId: id, state: 'loading' }, { athleteId: 'synthetic:other', state: 'ready' }]) {
    f.cleanup.updateWeight({ weightStatus, weightLogs: [{ athlete_id: id, logged_at: date, weight: 80 }] })
    assert.doesNotMatch(f.host.textContent, /Ingen vejninger|Seneste vægt|80 kg/)
  }
  f.cleanup.updateWeight({ weightStatus: { athleteId: id, state: 'error' } })
  assert.ok(f.host.querySelectorAll('p').some(n => n.getAttribute('role') === 'alert' && /Vejningerne kunne ikke hentes/.test(n.textContent)))
  assert.doesNotMatch(f.host.textContent, /Ingen vejninger|80 kg/)
  f.cleanup.updateWeight({ weightStatus: { athleteId: id, state: 'ready' }, weightLogs: [] })
  assert.equal(f.host.querySelectorAll('p').filter(n => n.textContent === 'Ingen vejninger endnu').length, 1)
})

test('selected day: date-aware labels, historical measurements and no weight form, today remainder or evening advice', async t => {
  let writes = 0
  const f = await mount(t, { rows: [row()], athlete: { kcal_target: 2000, protein_target: 120 },
    view: { clock: () => new Date('2026-11-06T19:00:00+01:00'),
      weightLogs: [{ athlete_id: id, logged_at: date, weight: 80 }], onWeightInput() {}, logWeight() { writes++ } } })
  for (const label of ['Kost · den valgte dag', 'Mål for den valgte dag', 'Dagbog for den valgte dag']) assert.ok(f.host.textContent.includes(label))
  assert.match(f.host.textContent, /Seneste vægt: 80 kg/)
  assert.equal(find(f.host, 'h2', 'Din vægt').parentElement.querySelectorAll('form').length, 0)
  assert.doesNotMatch(f.host.textContent, /Kost i dag|Dagens mål|Dagens dagbog|Tilbage i dag|Til resten af dagen|ikke tilsluttet/)
  assert.equal(writes, 0)
})

test('weight writes: a retained submit handler cannot write after the calendar day changes', async t => {
  let current = now(), writes = 0
  const f = await mount(t, { view: { clock: () => current, weightInput: '80', onWeightInput() {}, logWeight() { writes++ } } })
  const form = find(f.host, 'h2', 'Din vægt').parentElement.querySelectorAll('form')[0]
  current = new Date('2026-11-06T00:01:00+01:00')
  await form.fire('submit')
  assert.equal(writes, 0)
})

test('load failure retains retry and never becomes an empty diary or empty history claim', async t => {
  let fail = true
  const f = await mount(t, { contracts: { load: async () => { if (fail) throw Error('synthetic'); return [] } } })
  assert.match(f.host.textContent, /Kostloggen kunne ikke hentes/)
  assert.doesNotMatch(f.host.textContent, /Ingen måltider registreret|Ingen registreringer i perioden|Din uge/)
  fail = false
  await find(f.host, 'button', 'Hent kostloggen igen').fire('click')
  assert.match(f.host.textContent, /Ingen måltider registreret i dag/)
})

test('assembly forwards explicit weight read status; strict OFF leaves dependencies untouched', async t => {
  const host = syntheticHost()
  const query = { select() { return this }, eq() { return this }, gte() { return this }, lte() { return this },
    order: async () => ({ data: [], error: null }) }
  t.after(mountNutritionScreen(host, { entropi2: true, athlete: { id }, date, clock: now,
    client: { from: () => query }, weightLogs: [], weightStatus: { athleteId: id, state: 'ready' } }))
  await flush()
  assert.match(host.textContent, /Ingen vejninger endnu/)
  const poison = new Proxy({}, { get() { throw Error('OFF access') } })
  for (const entropi2 of [undefined, false, 1, 'true']) mountNutritionScreen(poison, { entropi2, weightStatus: poison, clock: poison })()
})
