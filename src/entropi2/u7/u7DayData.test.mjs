import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'
import { saveDaily, readDaily, tableState, targetOn, appendTarget, moveLocalOnce, localDayData, cleanDaily } from './dayData.mjs'
import { fakeBackend, memoryStorage } from './fakeBackend.fixture.mjs'
import { u7Enabled } from './flag.mjs'

// U7 del 3: datalaget med reserve. Kun syntetiske id'er og data.
const A = 'atlet-syntetisk-u7'
const enc = encodeURIComponent(A)
const ALL = ['tracking_daily_v1', 'nutrition_targets_v1']
const waterDay = (date, ...ml) => JSON.stringify({ schema: 'entropi2-water-day/v1', athleteId: A, date,
  entries: ml.map((m, i) => ({ id: i + 1, ml: m, at: `${date}T0${i + 7}:00:00.000Z` })) })

test('U7 3/5: uden tabellerne skrives intet, og alt svarer "missing"', async () => {
  const f = fakeBackend({ missing: ALL })
  assert.equal(await tableState(f.client, 'tracking_daily_v1'), 'missing')
  assert.equal(await saveDaily({ client: f.client, athleteId: A, date: '2026-11-11', patch: { water_ml: 500 } }), 'missing')
  assert.equal(await appendTarget({ client: f.client, athleteId: A, day: '2026-11-11', fields: { water_ml: 3000 } }), 'missing')
  assert.deepEqual(await readDaily({ client: f.client, athleteId: A, from: '2026-11-01', to: '2026-11-11' }), { state: 'missing', rows: [] })
  const storage = memoryStorage({ [`entropi2:water-intake:v1:${enc}:2026-11-10`]: waterDay('2026-11-10', 500) })
  assert.equal(await moveLocalOnce({ client: f.client, athleteId: A, storage, today: '2026-11-11' }), 'missing')
  assert.deepEqual(f.writes(), [])
  assert.equal(storage.getItem(`entropi2:u7-flyttet:v1:${enc}`), null)
})

test('U7 3/5: dagens række gemmes som én række pr. dag; kun de givne felter ændres', async () => {
  const f = fakeBackend()
  const save = patch => saveDaily({ client: f.client, athleteId: A, date: '2026-11-11', patch })
  assert.equal(await save({ water_ml: 500 }), 'saved')
  assert.equal(await save({ water_ml: 750 }), 'saved')
  assert.equal(await save({ sleep_quality: 2 }), 'saved')
  assert.equal(await save({ pain: 6, pain_location: '  venstre knæ ' }), 'saved')
  assert.deepEqual(f.db.tracking_daily_v1, [{ athlete_id: A, logged_date: '2026-11-11', water_ml: 750, sleep_quality: 2, pain: 6, pain_location: 'venstre knæ' }])
  // Forkerte tal når aldrig databasen.
  for (const patch of [{ sleep_quality: 6 }, { pain: 11 }, { pain: 2.5 }, { water_ml: -1 }, { kost_done_at: 'ikke en dato' }, {}, { athlete_id: 'x' }])
    assert.equal(cleanDaily(patch), null)
  // En anden telefon når først: INSERT giver 23505, og der opdateres i stedet.
  const g = fakeBackend({ tables: { tracking_daily_v1: [] } })
  const real = g.client.from.bind(g.client)
  let raced = false
  g.client.from = table => {
    const b = real(table), update = b.update
    b.update = payload => { if (!raced) { raced = true; g.db.tracking_daily_v1.push({ athlete_id: A, logged_date: '2026-11-11', sleep_quality: 4 }) ; return real(table).update(payload).eq('athlete_id', 'ingen') } return update(payload) }
    return b
  }
  assert.equal(await saveDaily({ client: g.client, athleteId: A, date: '2026-11-11', patch: { water_ml: 250 } }), 'saved')
  assert.deepEqual(g.db.tracking_daily_v1, [{ athlete_id: A, logged_date: '2026-11-11', sleep_quality: 4, water_ml: 250 }])
})

test('U7 3/5: det mål, der gjaldt en dag, er den seneste daterede række med feltet udfyldt', async () => {
  const rows = [
    { athlete_id: A, effective_from: '2026-11-02', kcal: 2800, protein_g: 180, water_ml: null, created_at: '2026-11-02T10:00:00Z' },
    { athlete_id: A, effective_from: '2026-11-09', kcal: 3000, protein_g: null, water_ml: null, created_at: '2026-11-09T10:00:00Z' },
    { athlete_id: A, effective_from: '2026-11-09', kcal: 3100, protein_g: null, water_ml: null, created_at: '2026-11-09T11:00:00Z' },
    { athlete_id: A, effective_from: '2026-11-10', kcal: null, protein_g: null, water_ml: 3000, created_at: '2026-11-10T10:00:00Z' },
    { athlete_id: 'en-anden', effective_from: '2026-11-01', kcal: 1, protein_g: 1, water_ml: 1, created_at: '2026-11-01T10:00:00Z' },
  ]
  assert.equal(targetOn(rows, A, '2026-11-01', 'kcal'), null)
  assert.deepEqual(targetOn(rows, A, '2026-11-08', 'kcal'), { value: 2800, from: '2026-11-02' })
  assert.deepEqual(targetOn(rows, A, '2026-11-09', 'kcal'), { value: 3100, from: '2026-11-09' })
  assert.deepEqual(targetOn(rows, A, '2026-11-15', 'protein_g'), { value: 180, from: '2026-11-02' })
  assert.deepEqual(targetOn(rows, A, '2026-11-15', 'water_ml'), { value: 3000, from: '2026-11-10' })
})

test('U7 3/5: telefonens data flyttes op én gang, uden dubletter og uden at overskrive serveren', async () => {
  const f = fakeBackend({ tables: { tracking_daily_v1: [
    { athlete_id: A, logged_date: '2026-11-09', water_ml: 2000, sleep_quality: 3 },
  ], nutrition_targets_v1: [] } })
  const storage = memoryStorage({
    [`entropi2:water-intake:v1:${enc}:2026-11-08`]: waterDay('2026-11-08', 500, 750),
    [`entropi2:water-intake:v1:${enc}:2026-11-09`]: waterDay('2026-11-09', 250),
    [`entropi2:kostvane-faerdig:v1:${enc}:2026-11-09`]: '1',
    [`entropi2:kostvane-faerdig:v1:${enc}:2026-11-10`]: '1',
    [`entropi2:water-goal:v1:${enc}`]: JSON.stringify({ schema: 'entropi2-water-goal/v1', athleteId: A, ml: 3500 }),
    [`entropi2:water-intake:v1:${encodeURIComponent('en-anden')}:2026-11-08`]: waterDay('2026-11-08', 999),
    'entropi2:water-intake:v1:ødelagt': '{',
  })
  assert.equal(localDayData(storage, A).days.size, 3)
  assert.equal(await moveLocalOnce({ client: f.client, athleteId: A, storage, today: '2026-11-11' }), 'moved')
  const byDay = Object.fromEntries(f.db.tracking_daily_v1.map(r => [r.logged_date, r]))
  assert.equal(f.db.tracking_daily_v1.length, 3)
  assert.equal(byDay['2026-11-08'].water_ml, 1250)
  assert.equal(byDay['2026-11-09'].water_ml, 2000, 'serverens tal overskrives ikke')
  assert.equal(byDay['2026-11-09'].kost_done_at, '2026-11-09T12:00:00.000Z')
  assert.equal(byDay['2026-11-10'].kost_done_at, '2026-11-10T12:00:00.000Z')
  assert.deepEqual(f.db.nutrition_targets_v1.map(r => [r.athlete_id, r.effective_from, r.water_ml]), [[A, '2026-11-11', 3500]])
  assert.equal(storage.getItem(`entropi2:u7-flyttet:v1:${enc}`), '2026-11-11')
  // Anden gang: intet skrives.
  const before = f.writes().length
  assert.equal(await moveLocalOnce({ client: f.client, athleteId: A, storage, today: '2026-11-12' }), 'done')
  assert.equal(f.writes().length, before)
  // Glemmer telefonen mærket (fx ryddet), giver en ny kørsel stadig ingen dubletter eller ændringer.
  storage.removeItem(`entropi2:u7-flyttet:v1:${enc}`)
  const snapshot = JSON.stringify(f.db)
  assert.equal(await moveLocalOnce({ client: f.client, athleteId: A, storage, today: '2026-11-12' }), 'moved')
  assert.equal(JSON.stringify(f.db), snapshot)
})

test('U7 3/5: flaget er slukket, indtil sidste commit tænder det', () => {
  assert.equal(u7Enabled('dayData', true), true)
  assert.equal(u7Enabled('dayData', false), false)
})

// ===== Komponenterne: uden tabellerne præcis som U6; med tabellerne gemmes og hentes =====
let React, act, createRoot, hostFixture, tick, propsOf, missingReact = false
try {
  React = await import('react'); ({ act } = React)
  ;({ createRoot } = await import('react-dom/client'))
  ;({ hostFixture, tick, propsOf } = await import('../nutrition/diaryTemplate.fixture.mjs'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  missingReact = true
}
const gate = { skip: missingReact ? 'Kræver ægte React.' : false }
// Prøve-DOM'en har ingen innerHTML; tag, attributter og tekst i rækkefølge er nok til at se forskel.
const serialize = n => typeof n === 'string' ? JSON.stringify(n) : typeof n?.tagName !== 'string' ? JSON.stringify(n?.textContent ?? n?.data ?? n?.nodeValue ?? '')
  : `<${n.tagName}${Object.entries(n.attributes ?? {}).sort().map(([k, v]) => ` ${k}=${JSON.stringify(v)}`).join('')}${n.value !== undefined ? ` .value=${JSON.stringify(n.value)}` : ''}${n.disabled ? ' .disabled' : ''}>${[...(n.childNodes ?? n.children ?? [])].map(serialize).join('')}</${n.tagName}>`
async function mount(element, storage) {
  const dom = hostFixture(), root = createRoot(dom.host)
  dom.globals({ localStorage: storage })
  const render = el => act(async () => { root.render(el); for (let i = 0; i < 8; i++) await tick() })
  await render(element)
  return { dom, render, html: () => (dom.host.childNodes ?? dom.host.children ?? []).map(serialize).join(''), text: () => dom.host.textContent,
    // Prøve-DOM'en bobler ikke hændelser op til Reacts rod; kald knappens egen onClick som de andre prøver.
    click: async el => act(async () => { propsOf(el).onClick({ preventDefault() {} }); for (let i = 0; i < 8; i++) await tick() }),
    byLabel: text => [...dom.host.querySelectorAll('button, input')].find(el => el.getAttribute('aria-label') === text) ?? null,
    async done() { await act(async () => { root.unmount(); await tick() }); dom.restore() } }
}

test('U7 3/5: vand og væskemål uden tabellerne er tegnet præcis som U6', gate, async () => {
  const { default: WaterDayLog } = await import('../kostplan/atlet/WaterDayLog.mjs')
  const today = calendarDay()
  const fresh = () => memoryStorage({ [`entropi2:water-intake:v1:${enc}:${today}`]: waterDay(today, 500),
    [`entropi2:water-goal:v1:${enc}`]: JSON.stringify({ schema: 'entropi2-water-goal/v1', athleteId: A, ml: 3000 }) })
  const off = await mount(React.createElement(WaterDayLog, { enabled: true, athleteId: A, date: today, u7DayData: false }), fresh())
  const u6 = off.html(), u6Text = off.text(); await off.done()
  const f = fakeBackend({ missing: ALL })
  const on = await mount(React.createElement(WaterDayLog, { enabled: true, athleteId: A, date: today, client: f.client, u7DayData: true }), fresh())
  assert.equal(on.html(), u6)
  assert.equal(on.text(), u6Text)
  assert.match(on.text(), /Kun lokal lagring på denne enhed/)
  await on.done()
  assert.deepEqual(f.writes(), [])
})

test('U7 3/5: med tabellerne følger vand og væskemål med til en ny telefon og gemmes ved hver ændring', gate, async () => {
  const { default: WaterDayLog } = await import('../kostplan/atlet/WaterDayLog.mjs')
  const today = calendarDay()
  const f = fakeBackend({ tables: {
    tracking_daily_v1: [{ athlete_id: A, logged_date: today, water_ml: 1500 }],
    nutrition_targets_v1: [{ id: 't0', athlete_id: A, effective_from: addCalendarDays(today, -3), kcal: null, protein_g: null, water_ml: 3200, created_at: '2026-01-01T00:00:00Z' }],
  } })
  const storage = memoryStorage()
  const m = await mount(React.createElement(WaterDayLog, { enabled: true, athleteId: A, date: today, client: f.client, u7DayData: true }), storage)
  try {
    assert.match(m.text(), /1\.500 af 3\.200 ml/)
    assert.match(m.text(), /din coach kan se dagens total/)
    assert.equal(JSON.parse(storage.getItem(`entropi2:water-goal:v1:${enc}`)).ml, 3200)
    const plus = [...m.dom.host.querySelectorAll('button')].find(b => b.textContent === '+ 250 ml')
    await m.click(plus)
    assert.match(m.text(), /1\.750 af 3\.200 ml/)
    assert.equal(f.db.tracking_daily_v1.length, 1)
    assert.equal(f.db.tracking_daily_v1[0].water_ml, 1750)
  } finally { await m.done() }
})

test('U7 3/5: søvn og smerte vises kun med tabellen, og ét tryk gemmer tallet', gate, async () => {
  const { default: DayFeeling } = await import('./DayFeeling.mjs')
  const today = calendarDay()
  const none = fakeBackend({ missing: ALL })
  const off = await mount(React.createElement(DayFeeling, { athleteId: A, today, client: none.client, storage: memoryStorage() }), memoryStorage())
  assert.equal(off.html(), '')
  await off.done()
  const f = fakeBackend({ tables: { tracking_daily_v1: [], nutrition_targets_v1: [] } })
  const m = await mount(React.createElement(DayFeeling, { athleteId: A, today, client: f.client, storage: memoryStorage() }), memoryStorage())
  try {
    assert.match(m.text(), /Søvnkvalitet i nat/)
    assert.doesNotMatch(m.text(), /Hvor\?/)
    await m.click(m.byLabel('Søvnkvalitet 2'))
    await m.click(m.byLabel('Smerte 6'))
    assert.deepEqual(f.db.tracking_daily_v1, [{ athlete_id: A, logged_date: today, sleep_quality: 2, pain: 6 }])
    assert.equal(m.byLabel('Smerte 6').getAttribute('aria-pressed'), 'true')
    assert.match(m.text(), /Gemt\. Din coach kan se tallene\./)
    assert.ok(m.byLabel('Hvor sidder smerten (valgfrit)'))
    await m.click(m.byLabel('Smerte 0'))
    assert.deepEqual(f.db.tracking_daily_v1, [{ athlete_id: A, logged_date: today, sleep_quality: 2, pain: 0, pain_location: null }])
  } finally { await m.done() }
})
