import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REL1030_FEATURES } from './rel1030.mjs'
import { createRegistry } from './testModuleRegistry.mjs'
import { programOverblikHarness } from './programOverblikHarness.mjs'
import { reset, begin, nodes, text, calls } from './programOverblikRuntime.mjs'
const hooks = programOverblikHarness()
const { default: Dashboard } = await import('./Dashboard.jsx')
const { default: Sidebar } = await import('./dashboard/Sidebar.jsx')
const { default: ProgramOverblik } = await import('./dashboard/ProgramOverblikView.mjs')

const noop = () => {}
const sidebarProps = { athletes: [], hiddenAthleteIds: new Set(), athleteWeekSummary: {}, unreadCounts: {}, todayData: {logs: []}, setView: noop, setSelectedAthlete: noop, setSidebarOpen: noop }
const render = (search = '', props = {}) => {
  globalThis.window = { location: {search} }
  begin()
  return Dashboard({ session: {user: {id: 'synthetic-coach'}}, ...props })
}
const component = (tree, type) => nodes(tree, n => n.type === type)[0]

test('actual Sidebar OFF label and handlers unchanged; ON replaces calendar and supports keyboard', () => {
  for (const coachRyd of [false, true]) for (const programOverblik of [false, true]) {
    const events = []
    const props = { ...sidebarProps, coachRyd, programOverblik, view:'calendar', setView: v => events.push(v), setSelectedAthlete: v => events.push(v), setSidebarOpen: v => events.push(v) }
    const tree = Sidebar(props)
    const label = programOverblik ? 'Programoverblik' : 'Kalender'
    const entry = nodes(tree, n => typeof n.props?.onClick === 'function' && text(n).trim() === label)[0]
    assert.ok(entry, label)
    assert.equal(text(tree).includes(programOverblik ? 'Kalender' : 'Programoverblik'), false)
    entry.props.onClick()
    assert.deepEqual(events, ['calendar',null,false])
    if (programOverblik && !coachRyd) {
      for (const key of ['Enter', ' ']) {
        events.length = 0
        let prevented = false
        entry.props.onKeyDown({key, preventDefault() { prevented = true }})
        assert.equal(prevented, true)
        assert.deepEqual(events, ['calendar',null,false])
      }
    }
  }
})

test('imported overview renders one row per visible athlete, urgency text, dates, next meet and exact existing navigation', () => {
  const athletes = [{id:'empty',name:'Ingen'}, {id:'red',name:'Roed'}, {id:'yellow',name:'Gul'}, {id:'normal',name:'Normal'}, {id:'hidden',name:'Skjult'}]
  const week = start_date => [{start_date,week_number:4,exercise_count:1}]
  const calendarWeeks = {red:week('2026-10-26'), yellow:week('2026-10-27'), normal:week('2026-11-03')}
  athletes[1].competition_date = '2026-12-01'
  const opened = []
  const tree = ProgramOverblik({athletes, calendarWeeks, today:'2026-10-26', hiddenAthleteIds:new Set(['hidden']), openProfile:(...args) => opened.push(args)})
  const buttons = nodes(tree, n => n.type === 'button')
  assert.equal(buttons.length,4)
  assert.match(text(buttons[0]), /Roed.*01\.11\.2026.*Uge 44, 2026.*Under 1 uge.*01\.12\.2026/)
  assert.match(text(buttons[1]), /Gul.*1 uge tilbage.*Under 2 uger/)
  assert.match(text(buttons[3]), /Intet program/)
  assert.equal(buttons[0].props.style.color, '#ffb0a0')
  assert.equal(buttons[1].props.style.color, '#f1cf7b')
  assert.doesNotMatch(text(tree), /Skjult/)
  for (const button of buttons) button.props.onClick()
  assert.deepEqual(opened, [athletes[1],athletes[2],athletes[3],athletes[0]].map(a => [a,'program']))
  assert.match(text(ProgramOverblik({})), /Ingen atleter at vise/)
  assert.match(text(ProgramOverblik({loading:true})), /Henter atleter/)
  assert.match(text(ProgramOverblik({loadError:true})), /kunne ikke hentes/)
})

test('actual full Dashboard connects strict flag to Sidebar, header and overview while reusing calendar route', () => {
  const priorWindow = globalThis.window, priorStorage = globalThis.localStorage
  globalThis.localStorage = {getItem: () => null, setItem() {throw Error('Storage write forbidden')}}
  try {
    for (const [search, props, enabled] of [['',{},false], ['?programOverblik=1',{},true], ['?rel1030=1',{},true], ['?programOverblik=1&programOverblik=0',{},false], ['',{programOverblik:true},true], ['',{programOverblik:'true'},false]]) {
      reset()
      let tree = render(search, props)
      let sidebar = component(tree, Sidebar)
      assert.ok(sidebar)
      assert.equal(sidebar.props.programOverblik, enabled ? true : undefined)
      const nav = Sidebar({...sidebar.props})
      const label = enabled ? 'Programoverblik' : 'Kalender'
      nodes(nav, n => typeof n.props?.onClick === 'function' && text(n).trim() === label)[0].props.onClick()
      tree = render(search, props)
      assert.match(text(tree), new RegExp(label))
      const overview = component(tree, ProgramOverblik)
      assert.equal(Boolean(overview), enabled)
      assert.equal(nodes(tree, n => Object.hasOwn(n.props, 'generateWeeksFromPlan')).length, enabled ? 0 : 1, 'original calendar stays mounted only when OFF')
      if (enabled) {
        assert.equal(Array.isArray(overview.props.athletes), true)
        assert.equal(typeof overview.props.calendarWeeks, 'object')
        overview.props.openProfile({id:'synthetic-nav'},'program')
        assert.deepEqual(calls.at(-1), [{id:'synthetic-nav'},'program'])
      }
    }
  } finally {
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow
    if (priorStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = priorStorage
  }
})

test('closed release list and registry include exact new modules and canonical dependency', () => {
  const registry = JSON.parse(readFileSync(new URL('./testModuleRegistry.json', import.meta.url), 'utf8'))
  const pure = registry.modules.find(m => m.path === 'src/programOverblik.mjs')
  const ui = registry.modules.find(m => m.path === 'src/dashboard/ProgramOverblikView.mjs')
  assert.ok(pure.allowedImporters.includes('src/dashboard/ProgramOverblikView.mjs'))
  assert.equal(ui.imports['../programOverblik.mjs'], pure.path)
  assert.equal(ui.imports.react, '@runtime')
  const rules = createRegistry(registry)
  const loader = 'src/coachRydHarness.mjs'
  assert.equal(rules.lookup(loader, './programOverblik.mjs', new URL('./Dashboard.jsx', import.meta.url).href).url, new URL('./programOverblik.mjs', import.meta.url).href)
  assert.equal(rules.lookup(loader, '../programOverblik.mjs', new URL('./dashboard/ProgramOverblikView.mjs', import.meta.url).href).url, new URL('./programOverblik.mjs', import.meta.url).href)
  const e2e = readFileSync(new URL('../e2e/rel1030.test.js',import.meta.url),'utf8')
  const closedList = e2e.match(/assert.deepEqual\(REL1030_FEATURES, (\[[^\n]+\])\)/)[1]
  assert.deepEqual(JSON.parse(closedList.replaceAll("'", '"')), REL1030_FEATURES)
})

test.after(() => { hooks.deregister(); delete globalThis.window })
