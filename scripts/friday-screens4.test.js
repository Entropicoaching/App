import test from 'node:test'
import assert from 'node:assert/strict'
import { motifs, domStep, captureMotif, main } from './friday-shots.mjs'
import { routes, element as el, withDom } from './shotsFake.mjs'
const canonical = import.meta.url.endsWith('/scripts/friday-screens4.test.js')
const src = canonical ? '../src/' : './'
const { buildPreviewSeed, ATHLETE } = await import(src + 'fridayPreviewSeed.mjs')
const { createPreviewDatabase } = await import(src + 'fridayPreviewAdapter.mjs')
const { athleteFlags, coachFlags } = await import(src + 'fridayPreview.mjs')
const { compareBlocks, renderBlockComparison } = await import(src + 'blokFremgang.mjs')
const { repRecordRows, renderRepRecords, DEFAULT_REP_RECORDS } = await import(src + (canonical ? 'athlete/' : '') + 'repRecords.mjs')
const { coachCalendarDays } = await import(src + (canonical ? 'dashboard/' : '') + 'coachCalendarEvents.mjs')
const { mobilityLibrary } = await import(src + (canonical ? 'athlete/' : '') + 'mobilityLibrary.mjs')
const { focusPlan } = await import(src + (canonical ? 'athlete/' : '') + 'mobilityFocus.mjs')
const { WARMUP_BASE } = await import(src + (canonical ? 'athlete/' : '') + 'mobilityCatalog.mjs')
const { renderNav, renderControls, previewNavigation } = await import(src + (canonical ? 'athlete/' : '') + 'enkelPrototype.mjs')
const h = (tag, attrs, ...children) => ({ tag, attrs, children: children.flat(Infinity).filter(x => x != null) })
const allText = node => typeof node === 'object' ? node.children.map(allText).join(' ') : String(node)

test('all 16 paths execute imported domStep against event-driven synthetic DOM', async () => {
  for (const motif of motifs) {
    const fixture = routes[motif.id]
    let step = 0, shots = 0
    const root = el('div')
    function render() {
      root.children.splice(0)
      if (step < fixture.clicks.length) {
        const q = motif.steps[step]
        const child = el(q.role === 'summary' ? 'summary' : 'button', fixture.clicks[step], {
          onClick() { step++; render() },
        }, q.leafText ? [el('span', q.leafText)] : [])
        child.parentElement = root; root.children.push(child)
      } else {
        for (const [i,q] of [motif.title, ...(motif.checks || [])].entries()) {
          const content = i === 0 ? fixture.title : fixture.checks[i-1]
          const child = el(q.role === 'heading' ? 'h2' : q.role === 'title' ? 'div' : q.role === 'summary' ? 'summary' : q.role === 'button' ? 'button' : 'p', content,
            { ...(q.role === 'status' ? { role: 'status' } : {}), ...(q.pressed === undefined ? {} : { 'aria-pressed': String(q.pressed) }) },
            q.leafText ? [el('span', q.leafText)] : [])
          child.parentElement = root; root.children.push(child)
        }
      }
    }
    render()
    const result = await captureMotif({
      async open() {}, async closeList() {}, async ready() {}, async settle() {},
      async click(q) { assert.ok(withDom(root, () => domStep(q, 'click')), motif.id) },
      async find(q) { return withDom(root, () => domStep(q)) },
      async shot() { shots++ },
    }, motif, 'synthetic')
    assert.equal(result.ok, true, result.error)
    assert.equal(shots, 1)
  }
})

test('seed populates actual block, rep and calendar models without writes', async () => {
  const seed = buildPreviewSeed(new Date(2026, 9, 28, 12))
  const db = createPreviewDatabase(seed)
  const { data: weeks } = await db.from('weeks').select().eq('athlete_id', ATHLETE)
  const { data: logs } = await db.from('exercise_logs').select().eq('athlete_id', ATHLETE)
  const options = { enabled: true, weeks, logs, today: '2026-10-28', athleteId: ATHLETE }
  const model = compareBlocks(options)
  assert.equal(model.status, 'known')
  assert.ok(model.lifts.filter(l => l.name !== 'Sumo dødløft').every(l => l.status === 'ready'))
  assert.match(allText(renderBlockComparison(h, options)), /Styrke, uge 4 til 6/)
  const records = repRecordRows({ logs })
  assert.ok(records.slice(0,3).every(l => l.records.every(r => r.weight > 0 && r.day)))
  assert.match(allText(renderRepRecords(h, { enabled: true, logs })), /Rekorder pr. antal gentagelser/)
  assert.equal(coachCalendarDays(seed.athletes)[0].athletes[0].name, 'Testatlet')
  assert.equal(coachCalendarDays(seed.athletes)[0].date, seed.athletes[0].competition_date)
  assert.equal((await db.from('exercise_logs').insert({}).select()).error.code, 'PREVIEW_ONLY')
  assert.equal((await db.functions.invoke('draft-next-week')).error.code, 'PREVIEW_ONLY')
  assert.equal((await db.from('exercise_logs').select()).data.length, logs.length)
  assert.equal(athleteFlags.repRecords, true); assert.equal(coachFlags.coachCalendarEvents, true)
})

test('actual pinned mobility catalog supplies library and focus routine', () => {
  const groups = mobilityLibrary('Squat', WARMUP_BASE)
  assert.equal(groups.length, 2)
  assert.ok(groups.every(g => g.exercises.length > 0))
  const plan = focusPlan('Squat', 'Mere dybde', WARMUP_BASE, [])
  assert.ok(plan.exercises.length > 1)
})

test('counterexamples: absent data stays absent and defaults remain OFF', async () => {
  assert.equal(compareBlocks(), null)
  assert.equal(DEFAULT_REP_RECORDS, false)
  assert.equal(renderRepRecords(h, { logs: [] }), null)
  assert.deepEqual(coachCalendarDays([{ id: 'x', competition_date: 'invalid' }]), [])
  assert.deepEqual(mobilityLibrary('Squat', {}), [])
  assert.ok(repRecordRows({ logs: [] }).every(l => l.records.every(r => r.weight === null)))
  const guard = new Proxy({}, { get() { throw Error('access while OFF') } })
  assert.deepEqual(await main([], guard), { off: true, results: [] })
})

test('counterexamples: duplicate titles, hidden and disabled summary fail closed', () => {
  const q = { role: 'summary', name: '^Mere$' }
  for (const children of [[el('summary','Mere',{hidden:true})], [el('summary','Mere',{disabled:true})], [el('summary','Mere'),el('summary','Mere')]])
    withDom(el('div','',{},children), () => assert.equal(domStep(q,'click'), false))
  const loading = el('p','Henter…')
  withDom(el('div','',{},[loading]), () => assert.equal(domStep(null,'ready'), false))
})

test('pinned navigation handlers reach record and strength routes with actual labels', () => {
  const visited = [], tabs = []
  const go = previewNavigation(true, tab => tabs.push(tab), route => visited.push(route))
  const nav = renderNav(h, { route: 'traening', go })
  const progress = nav.children.find(n => n.children[0] === 'Fremgang')
  progress.attrs.onClick()
  const controls = renderControls(h, { route: visited.at(-1), go })
  const record = controls.children.find(n => n.tag === 'nav').children.find(n => n.children[0] === 'Rekorder')
  record.attrs.onClick()
  assert.deepEqual(visited, ['styrke', 'rekorder'])
  assert.deepEqual(tabs, ['fremgang', 'fremgang'])
  assert.match(allText(renderNav(h, { route: 'traening', go })), /Kontakt/)
})
