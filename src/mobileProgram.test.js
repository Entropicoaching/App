import test from 'node:test'
import assert from 'node:assert/strict'
import { mobileProgramHarness } from './mobileProgramHarness.mjs'
import { reset, begin, nodes, text } from './mobileProgramRuntime.mjs'
const hooks = mobileProgramHarness()
const { default: Dashboard } = await import('./Dashboard.jsx')
const { default: MobilNav } = await import('./dashboard/MobilNav.jsx')
const { default: Sidebar } = await import('./dashboard/Sidebar.jsx')
const { default: ProgramOverblik } = await import('./dashboard/ProgramOverblikView.mjs')
const noop = () => {}
const component = (tree, type) => nodes(tree, n => n.type === type)[0]
const labelText = n => text(n).replace(/\s+/g, ' ').trim()
function button(tree, label) {
  const found = nodes(tree, n => n.type === 'button' && labelText(n) === label)
  assert.equal(found.length, 1, `unique button: ${label}`)
  return found[0]
}
function mobile(props) {
  const inner = MobilNav(props)
  return inner.type(inner.props)
}
function dashboard(search = '', props = {}, width = 375) {
  globalThis.window = { innerWidth: width, location: { search } }
  globalThis.localStorage = { getItem: () => null, setItem() { throw Error('Unexpected storage write') } }
  begin()
  return Dashboard({session: {user: {id:'synthetic'}}, ...props})
}
function geometry(tree) {
  return nodes(tree, n => ['rect','line','path','polygon','circle'].includes(n.type)).map(n => [n.type,n.props])
}
for (const coachRyd of [false, true]) {
  test(`375px actual Menu click -> overview -> sheet closes; coachRyd=${coachRyd}`, () => {
    reset()
    let tree = dashboard('?programOverblik=1')
    let nav = component(tree, MobilNav)
    assert.equal(nav.props.isMobile, true)
    assert.equal(nav.props.programOverblik, true)
    let dom = mobile({...nav.props, coachRyd})
    assert.equal(nodes(dom,n => n.type === 'button' && labelText(n)==='Programoverblik').length,0)
    button(dom,'Menu').props.onClick()
    tree = dashboard('?programOverblik=1')
    nav = component(tree, MobilNav)
    dom = mobile({...nav.props, coachRyd})
    const entry = button(dom,'Programoverblik')
    assert.equal(nodes(dom,n => n.type === 'button' && labelText(n)==='Kalender').length,0)
    const desktop = Sidebar({...component(tree,Sidebar).props, coachRyd})
    const desktopEntry = nodes(desktop,n => typeof n.props.onClick === 'function' && labelText(n)==='Programoverblik')[0]
    assert.ok(desktopEntry)
    assert.deepEqual(geometry(entry), geometry(desktopEntry), 'same calendar icon geometry as sidebar')
    assert.equal(nodes(entry,n => n.type === 'svg').length,1)
    entry.props.onClick()
    tree = dashboard('?programOverblik=1')
    assert.ok(component(tree,ProgramOverblik), 'same imported overview as desktop')
    assert.match(text(tree),/Programoverblik/)
    nav = component(tree,MobilNav)
    assert.equal(nav.props.view,'calendar')
    assert.equal(nav.props.selectedAthlete,null)
    assert.equal(nav.props.menuSheetOpen,false)
    assert.equal(nodes(mobile({...nav.props,coachRyd}), n => n.type === 'button' && labelText(n)==='Programoverblik').length,0)
  })
  test(`375px default OFF preserves calendar and menu actions; coachRyd=${coachRyd}`, () => {
    reset()
    let tree = dashboard()
    let nav = component(tree,MobilNav)
    assert.equal(nav.props.programOverblik,undefined)
    button(mobile({...nav.props,coachRyd}),'Menu').props.onClick()
    tree = dashboard()
    nav = component(tree,MobilNav)
    const dom = mobile({...nav.props,coachRyd})
    const entry = button(dom,'Kalender')
    for (const label of ['Bibliotek','VideoCoach','Se som atlet']) button(dom,label)
    assert.equal(nodes(dom,n => labelText(n)==='Programoverblik').length,0)
    assert.equal(nodes(entry,n => n.type === 'svg').length,coachRyd ? 0 : 1, 'original OFF icon rendering')
    entry.props.onClick()
    tree = dashboard()
    assert.equal(component(tree,ProgramOverblik),undefined)
    assert.equal(nodes(tree,n => Object.hasOwn(n.props,'generateWeeksFromPlan')).length,1,'original calendar view')
    assert.equal(component(tree,MobilNav).props.menuSheetOpen,false)
  })
}
test('strict query and explicit prop reach mobile; default and false values stay OFF', () => {
  for (const [search,props,on] of [['',{},false],['?programOverblik=0',{},false],['?programOverblik=true',{},false],['?programOverblik=1&programOverblik=0',{},false],['?rel1030=1',{},true],['',{programOverblik:true},true],['',{programOverblik:'true'},false]]) {
    reset()
    const tree = dashboard(search,props)
    assert.equal(component(tree,MobilNav).props.programOverblik,on ? true : undefined)
  }
})
test('desktop width never renders mobile menu', () => {
  reset()
  const tree = dashboard('?programOverblik=1',{},1280)
  const props = component(tree,MobilNav).props
  assert.equal(props.isMobile,false)
  assert.equal(nodes(mobile({...props,menuSheetOpen:true}),n=>n.type==='button').length,0)
})
test('both mobile variants require boolean true and retain exact calendar handler order', () => {
  for (const coachRyd of [false,true]) for (const programOverblik of [undefined,false,'true',true]) {
    const events=[]
    const props={coachRyd,programOverblik,isMobile:true,menuSheetOpen:true,athletes:[],view:'profile',
      setMenuSheetOpen:v=>events.push(['sheet',v]),setSelectedAthlete:v=>events.push(['athlete',v]),setView:v=>events.push(['view',v]),
      setSheetPreviewPick:noop}
    button(mobile(props),programOverblik===true?'Programoverblik':'Kalender').props.onClick()
    assert.deepEqual(events,[['sheet',false],['athlete',null],['view','calendar']])
  }
})
test.after(() => { hooks.deregister(); delete globalThis.window; delete globalThis.localStorage })
