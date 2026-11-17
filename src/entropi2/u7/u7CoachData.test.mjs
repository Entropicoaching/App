import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarDays } from '../../calendarDate.js'
import { painFromDaily, sleepFromDaily, dayNumbersLine, weekTargetLine, readWeekNutrition, syncCoachTargets } from './coachData.mjs'
import { attentionCandidates } from '../coach/coachAttention.mjs'
import { readCoachAttention, attentionFor } from '../coach/coachAttentionRead.mjs'
import { attentionDraft } from '../u6/coachDraft.mjs'
import { fakeBackend } from './fakeBackend.fixture.mjs'
import { u7Enabled } from './flag.mjs'

// U7 del 4: coachen ser søvn og smerte som tal og ugens kost mod det mål, der gjaldt. Syntetisk.
const A = 'atlet-syntetisk-u7', B = 'atlet-syntetisk-u7-b'
const day = '2026-11-11' // onsdag; ugen starter mandag 9. nov.
const d = n => addCalendarDays(day, n)
const daily = [
  { athlete_id: A, logged_date: d(-9), sleep_quality: 1, pain: 9, pain_location: 'ryg' },
  { athlete_id: A, logged_date: d(-4), sleep_quality: 4, pain: 2, pain_location: null },
  { athlete_id: A, logged_date: d(-2), sleep_quality: 2, pain: 6, pain_location: 'venstre knæ' },
  { athlete_id: A, logged_date: d(-1), sleep_quality: 1, pain: 3, pain_location: null },
]

test('U7 4/5: smerte og søvn som tal, kun inden for vinduet og kun med data', () => {
  assert.deepEqual(painFromDaily(daily, day), { date: d(-2), pain: 6, location: 'venstre knæ', reason: 'Smerte 6/10 (venstre knæ) 9. nov.' })
  assert.equal(sleepFromDaily(daily, day).reason, 'Søvn 1,5/5 i snit de sidste 3 dage')
  assert.equal(dayNumbersLine(daily, day), 'Søvn 2,3/5 (3 dage) · Smerte 3/10 10. nov. · sidste 7 dage')
  assert.equal(painFromDaily(daily.map(r => ({ ...r, pain: Math.min(r.pain, 3) })), day), null)
  assert.equal(sleepFromDaily(daily.slice(0, 3), day), null, 'ét svar de sidste 3 dage er ikke nok')
  assert.equal(dayNumbersLine([], day), null)
  assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-9), sleep_quality: 1 }], day), null)
})

test('U7 4/5: "Kræver dit blik" får smerte og søvn som tal; uden dagsdata er grundene som i U6', () => {
  const athlete = { id: A, name: 'Syntetisk Atlet' }
  const base = { readiness: [], notes: [{ athlete_id: A, logged_at: `${d(-1)}T18:00:00Z`, note: 'lidt smerte i knæet' }] }
  const u6 = attentionCandidates({ athlete, day, attention: base, weeks: [] })
  assert.deepEqual(u6.map(c => c.reason), ['Smerte nævnt 10. nov.'])
  const u7 = attentionCandidates({ athlete, day, attention: { ...base, daily }, weeks: [] })
  assert.deepEqual(u7.map(c => [c.u3, c.reason]), [['pain', 'Smerte 6/10 (venstre knæ) 9. nov.'], ['sleep', 'Søvn 1,5/5 i snit de sidste 3 dage']])
  const draft = attentionDraft({ row: { athlete, u3: 'pain', key: `u3-pain-${A}` }, attention: { ...base, daily }, day })
  assert.match(draft.text, /^Hej Syntetisk\. Du har meldt smerte 6\/10 i venstre knæ 9\. nov\./)
  assert.match(attentionDraft({ row: { athlete, u3: 'sleep', key: `u3-sleep-${A}` }, attention: { ...base, daily }, day }).text, /søvn har ligget på 1,5 ud af 5/)
})

test('U7 4/5: læsningen henter dagsdata med tabellen; uden tabellen er L1 komplet som før', async () => {
  const tables = { readiness_logs: [], exercise_logs: [], tracking_daily_v1: [...daily, { athlete_id: B, logged_date: d(-1), sleep_quality: 5 }] }
  const on = await readCoachAttention(fakeBackend({ tables }).client, [A, B], day, { daily: true })
  assert.equal(on.complete, true)
  assert.equal(attentionFor(on, A, day).daily.length, 3, 'kun de sidste 7 dage')
  assert.equal(attentionFor(on, B, day).daily.length, 1)
  const missing = fakeBackend({ tables: { readiness_logs: [], exercise_logs: [] }, missing: ['tracking_daily_v1'] })
  const off = await readCoachAttention(missing.client, [A], day, { daily: true })
  assert.equal(off.complete, true)
  assert.equal(attentionFor(off, A, day).daily, null)
  const flagOff = fakeBackend({ tables })
  assert.equal((await readCoachAttention(flagOff.client, [A], day, { daily: false })).daily, null)
  assert.ok(!flagOff.calls.some(c => c.table === 'tracking_daily_v1'))
})

const meal = (date, kcal, protein) => ({ date, meal: 'Syntetisk måltid', kcal, protein })

test('U7 4/5: ugens kost sammenlignes med athletes-målet, som Uge for uge og Min uge bruger', () => {
  const goal = { kcal_target: 2800, protein_target: 180 }
  const meals = [meal(d(-9), 2600, 170), meal(d(-8), 3000, 190), meal(d(-4), 1000, 50), meal(d(-4), 1000, 50),
    { date: d(-3), meal: '[appData2-day-v1] bekræftet', kcal: 9999, protein: 999 }]
  assert.deepEqual(weekTargetLine({ goal, meals, day }),
    { period: 'sidste uge', text: 'Kost sidste uge: protein 153 g mod mål 180 g, 2.533 kcal mod 2.800 i snit pr. logget dag (3 af 7 dage)' })
  // Ingen loggede dage sidste uge: denne uge.
  const now = [meal(d(-2), 2700, 175), meal(d(-1), 2900, 205)]
  assert.equal(weekTargetLine({ goal, meals: now, day }).text,
    'Kost denne uge: protein 190 g mod mål 180 g, 2.800 kcal mod 2.800 i snit pr. logget dag (2 af 7 dage)')
  assert.equal(weekTargetLine({ goal: { kcal_target: null, protein_target: '180' }, meals: now, day }).text,
    'Kost denne uge: protein 190 g mod mål 180 g i snit pr. logget dag (2 af 7 dage)')
  // Intet mål på atleten: intet vises.
  assert.equal(weekTargetLine({ goal: { kcal_target: null, protein_target: '' }, meals, day }), null)
  assert.equal(weekTargetLine({ goal, meals: [], day }), null)
})

test('U7 4/5 (u8c): forsiden viser samme proteinmål som Uge for uge, også når et ældre dateret mål findes', async () => {
  const f = fakeBackend({ tables: {
    athletes: [{ id: A, kcal_target: 2800, protein_target: 180 }],
    nutrition_targets_v1: [{ athlete_id: A, effective_from: d(-9), kcal: 2800, protein_g: 170, water_ml: null, created_at: '1' }],
    meal_logs: [{ athlete_id: A, ...meal(d(-9), 2600, 170) }, { athlete_id: A, ...meal(d(-8), 3000, 146) }] } })
  const data = await readWeekNutrition({ client: f.client, athleteId: A, day })
  const line = weekTargetLine({ ...data, day })
  assert.match(line.text, /^Kost sidste uge: protein 158 g mod mål 180 g, 2\.800 kcal mod 2\.800 /)
  assert.doesNotMatch(line.text, /170 g/)
  // Uden U7-tabellen vises intet, som før.
  const none = fakeBackend({ tables: { athletes: [{ id: A, kcal_target: 2800, protein_target: 180 }] }, missing: ['nutrition_targets_v1'] })
  assert.equal(await readWeekNutrition({ client: none.client, athleteId: A, day }), null)
})

test('U7 4/5: coachens mål på athletes dateres én gang pr. ændring; uden tabellen sker intet', async () => {
  const f = fakeBackend({ tables: { nutrition_targets_v1: [] } })
  const current = [{ athlete_id: A, kcal_target: 2800, protein_target: 180 }, { athlete_id: B, kcal_target: null, protein_target: '' }]
  assert.equal(await syncCoachTargets({ client: f.client, targets: current, day }), 'saved')
  assert.deepEqual(f.db.nutrition_targets_v1.map(r => [r.athlete_id, r.effective_from, r.kcal, r.protein_g]), [[A, day, 2800, 180]])
  assert.equal(await syncCoachTargets({ client: f.client, targets: current, day }), 'none')
  assert.equal(await syncCoachTargets({ client: f.client, targets: [{ athlete_id: A, kcal_target: 3000, protein_target: 180 }], day }), 'saved')
  assert.deepEqual(f.db.nutrition_targets_v1.at(-1).kcal, 3000)
  assert.equal(f.db.nutrition_targets_v1.at(-1).protein_g, undefined, 'kun det ændrede felt')
  const none = fakeBackend({ missing: ['nutrition_targets_v1'] })
  assert.equal(await syncCoachTargets({ client: none.client, targets: current, day }), 'missing')
  assert.deepEqual(none.writes(), [])
})

test('U7 4/5: coachens forside viser tallene under rækken kun med flaget', async () => {
  let fixture
  try { fixture = await import('../coach/coachProductionFixture.mjs') } catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') return; throw error }
  const { productionFixture, day: fixtureDay, athleteId } = fixture
  const { CoachView } = await import('../coach/CoachScreen.mjs')
  const { WeekTargetLine } = await import('./CoachWeekTarget.mjs')
  const p = productionFixture()
  const rows = [{ athlete_id: athleteId, logged_date: addCalendarDays(fixtureDay, -1), sleep_quality: 2, pain: 7, pain_location: 'skulder' },
    { athlete_id: athleteId, logged_date: fixtureDay, sleep_quality: 1, pain: 5, pain_location: null }]
  Object.assign(p, { u3Data: true, u3Attention: { day: fixtureDay, ids: [athleteId], complete: true, readiness: [], notes: [], daily: rows },
    openProfile() {}, openCoachPriorityItem() {}, notesClient: {} })
  const props = { ...p, enabled: true, today: new Date(`${fixtureDay}T12:00:00Z`) }
  const texts = node => !node || typeof node !== 'object' ? (typeof node === 'string' ? [node] : []) : Array.isArray(node)
    ? node.flatMap(texts) : [...(node.props?.['data-u7-day'] ? [`DAY:${[].concat(node.props.children).join('')}`] : []), ...texts(node.props?.children)]
  const find = (node, type) => !node || typeof node !== 'object' ? null : Array.isArray(node)
    ? node.map(n => find(n, type)).find(Boolean) ?? null : node.type === type ? node : find(node.props?.children, type)
  const on = CoachView({ ...props, u7CoachData: true })
  const all = texts(on)
  assert.ok(all.includes('Smerte 5/10 11. nov.') || all.some(t => /^Smerte \d+\/10/.test(t)), all.join(' | '))
  assert.ok(all.some(t => t.startsWith('DAY:Søvn 1,5/5 (2 dage) · Smerte 5/10')), all.join(' | '))
  assert.ok(find(on, WeekTargetLine))
  const off = CoachView({ ...props, u7CoachData: false })
  assert.ok(!texts(off).some(t => t.startsWith('DAY:')))
  assert.equal(find(off, WeekTargetLine), null)
})

test('U7 4/5: flaget følger samme mønster', () => {
  assert.equal(u7Enabled('coachData', true), true)
  assert.equal(u7Enabled('coachData', false), false)
})

test('1607: dagslinjen viser væske som snit i liter over dage med mere end 0 ml, uden nyt kald', async () => {
  const water = [2000, 2500, 3000, 2200, 2800].map((ml, i) => ({ athlete_id: A, logged_date: d([0, -1, -2, -4, -5][i]), water_ml: ml }))
  assert.equal(dayNumbersLine(water, day), 'Væske 2,5 l i snit (5 dage) · sidste 7 dage')
  assert.equal(dayNumbersLine([...daily, ...water], day), 'Søvn 2,3/5 (3 dage) · Smerte 3/10 10. nov. · Væske 2,5 l i snit (5 dage) · sidste 7 dage')
  assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-1), water_ml: 1000 }], day), 'Væske 1,0 l i snit (1 dag) · sidste 7 dage')
  assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-9), water_ml: 3000 }], day), null, 'uden for vinduet tæller ikke')
  assert.equal(dayNumbersLine(daily, day), 'Søvn 2,3/5 (3 dage) · Smerte 3/10 10. nov. · sidste 7 dage', 'ingen væske: linjen som før')
  const none = [{ athlete_id: A, logged_date: d(-1), water_ml: null }, { athlete_id: A, logged_date: d(0), water_ml: 0 }, { athlete_id: A, logged_date: d(-2), water_ml: '2000' }]
  assert.equal(dayNumbersLine(none, day), null, 'null, 0 og tekst tælles ikke')
  assert.equal(dayNumbersLine([...daily.slice(0, 3), ...none], day), 'Søvn 3,0/5 (2 dage) · Smerte 6/10 (venstre knæ) 9. nov. · sidste 7 dage')
})

test('1607: kun søvn uden væske giver kun søvndelen', () => {
  assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-1), sleep_quality: 4 }], day), 'Søvn 4,0/5 (1 dag) · sidste 7 dage')
})

test('1607: coachens ene dagslæsning henter water_ml i samme select', async () => {
  const selects = []
  const backend = fakeBackend({ tables: { readiness_logs: [], exercise_logs: [], tracking_daily_v1: [{ athlete_id: A, logged_date: d(-1), water_ml: 2500 }] } })
  const client = { from: table => { const b = backend.client.from(table); const select = b.select; b.select = cols => (selects.push([table, cols]), select(cols)); return b } }
  const result = await readCoachAttention(client, [A], day, { daily: true })
  assert.ok(selects.some(([t, cols]) => t === 'tracking_daily_v1' && /water_ml/.test(cols)), 'select indeholder water_ml')
  assert.equal(attentionFor(result, A, day).daily[0].water_ml, 2500)
})

test('1612: dagslinjen viser Kostvane x af 7 dage for dage med en ikke-tom kost_done_at', () => {
  const done = o => ({ athlete_id: A, logged_date: d(o), kost_done_at: `${d(o)}T10:00:00.000Z` })
  assert.equal(dayNumbersLine([done(0), done(-2), done(-3)], day), 'Kostvane 3 af 7 dage · sidste 7 dage')
  assert.equal(dayNumbersLine([...daily, done(-1)], day), 'Søvn 2,3/5 (3 dage) · Smerte 3/10 10. nov. · Kostvane 1 af 7 dage · sidste 7 dage')
  assert.equal(dayNumbersLine([done(-9)], day), null, 'uden for vinduet tæller ikke')
  assert.equal(dayNumbersLine(daily, day), 'Søvn 2,3/5 (3 dage) · Smerte 3/10 10. nov. · sidste 7 dage', 'ingen kostvane: linjen som efter 1607')
})

test('1612: null og tom kost_done_at tælles ikke', () => {
  const rows = [{ athlete_id: A, logged_date: d(0), kost_done_at: null }, { athlete_id: A, logged_date: d(-1), kost_done_at: '' }, { athlete_id: A, logged_date: d(-2) }]
  assert.equal(dayNumbersLine(rows, day), null)
})

test('1612: coachens ene dagslæsning henter kost_done_at i samme select', async () => {
  const selects = []
  const backend = fakeBackend({ tables: { readiness_logs: [], exercise_logs: [], tracking_daily_v1: [{ athlete_id: A, logged_date: d(-1), kost_done_at: `${d(-1)}T10:00:00.000Z` }] } })
  const client = { from: table => { const b = backend.client.from(table); const select = b.select; b.select = cols => (selects.push([table, cols]), select(cols)); return b } }
  const result = await readCoachAttention(client, [A], day, { daily: true })
  assert.ok(selects.some(([t, cols]) => t === 'tracking_daily_v1' && /kost_done_at/.test(cols)), 'select indeholder kost_done_at')
  assert.equal(selects.filter(([t, cols]) => t === 'tracking_daily_v1' && /logged_date/.test(cols)).length, 1, 'ét datakald, intet ekstra pr. atlet')
  assert.ok(attentionFor(result, A, day).daily[0].kost_done_at)
})

test('1614: dagslinjen viser Væske x af y l, når atleten har et mål; ellers som efter 1607', () => {
  const rows = [2000, 2500, 3000, 2200, 2800].map((ml, i) => ({ athlete_id: A, logged_date: d([0, -1, -2, -4, -5][i]), water_ml: ml, water_goal_ml: 3000 }))
  assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-1), water_ml: 2400, water_goal_ml: 3000 }], day), 'Væske 2,4 af 3,0 l i snit (1 dag) · sidste 7 dage')
  assert.equal(dayNumbersLine(rows, day), 'Væske 2,5 af 3,0 l i snit (5 dage) · sidste 7 dage')
  assert.equal(dayNumbersLine([...daily, ...rows], day), 'Søvn 2,3/5 (3 dage) · Smerte 3/10 10. nov. · Væske 2,5 af 3,0 l i snit (5 dage) · sidste 7 dage')
  assert.equal(dayNumbersLine(rows.map(({ water_goal_ml, ...r }) => r), day), 'Væske 2,5 l i snit (5 dage) · sidste 7 dage', 'intet mål: linjen som før')
  for (const goal of [0, null, undefined, '3000', -5, NaN]) {
    assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-1), water_ml: 2400, water_goal_ml: goal }], day), 'Væske 2,4 l i snit (1 dag) · sidste 7 dage', `mål ${String(goal)} tælles som intet mål`)
  }
  assert.equal(dayNumbersLine([{ athlete_id: A, logged_date: d(-1), water_goal_ml: 3000 }], day), null, 'mål uden loggede dage giver ingen linje')
})

test('1614: coachens dagslæsning henter alle atleters væskemål i ét samlet kald og lægger målet på rækkerne', async () => {
  const calls = []
  const backend = fakeBackend({ tables: { readiness_logs: [], exercise_logs: [],
    tracking_daily_v1: [{ athlete_id: A, logged_date: d(-1), water_ml: 2400 }, { athlete_id: B, logged_date: d(-1), water_ml: 1800 }],
    nutrition_targets_v1: [
      { id: 't1', athlete_id: A, effective_from: d(-20), kcal: null, protein_g: null, water_ml: 2500, created_at: '1' },
      { id: 't2', athlete_id: A, effective_from: d(-3), kcal: null, protein_g: null, water_ml: 3000, created_at: '2' },
      { id: 't3', athlete_id: A, effective_from: d(2), kcal: null, protein_g: null, water_ml: 9000, created_at: '3' },
      { id: 't4', athlete_id: B, effective_from: d(-3), kcal: 2500, protein_g: 150, water_ml: null, created_at: '4' }] } })
  const client = { from: table => { const b = backend.client.from(table); const select = b.select; b.select = cols => (calls.push([table, cols]), select(cols)); return b } }
  const result = await readCoachAttention(client, [A, B], day, { daily: true })
  assert.equal(calls.filter(([t, cols]) => t === 'nutrition_targets_v1' && /water_ml/.test(cols)).length, 1, 'ét målkald for to atleter')
  assert.equal(attentionFor(result, A, day).daily[0].water_goal_ml, 3000, 'målet, der gælder i dag')
  assert.equal(attentionFor(result, B, day).daily[0].water_goal_ml, undefined, 'intet væskemål hos B')
  assert.equal(dayNumbersLine(attentionFor(result, A, day).daily, day), 'Væske 2,4 af 3,0 l i snit (1 dag) · sidste 7 dage')
  assert.equal(dayNumbersLine(attentionFor(result, B, day).daily, day), 'Væske 1,8 l i snit (1 dag) · sidste 7 dage')
})

test('1614: mangler målene, eller fejler læsningen, er dagsrækkerne som før', async () => {
  const backend = fakeBackend({ tables: { readiness_logs: [], exercise_logs: [], tracking_daily_v1: [{ athlete_id: A, logged_date: d(-1), water_ml: 2400 }] } })
  const result = await readCoachAttention(backend.client, [A], day, { daily: true })
  assert.equal(attentionFor(result, A, day).daily[0].water_ml, 2400)
  assert.equal('water_goal_ml' in attentionFor(result, A, day).daily[0], false)
})
