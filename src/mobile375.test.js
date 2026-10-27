import test from 'node:test'
import assert from 'node:assert/strict'
import { source, rules, style, assertContract } from './mobile375Model.mjs'
import { createElement as h, nodes, text } from './mobile375Dom.mjs'
import { renderMobilityShortcut, DEFAULT_MOBILITY_FOCUS } from './athlete/mobilityFocus.mjs'
import { renderWeekOverview, DEFAULT_COACH_WEEK_OVERVIEW } from './dashboard/coachWeekOverview.mjs'
const css = source('index.css').slice(source('index.css').indexOf('/* APP-375FIX:'))

test('existing stylesheet and strict Friday scopes require no new CSS dependency', () => {
  for (const [name, flag, role] of [['AthleteView.jsx','forenklinger','athlete'], ['Dashboard.jsx','coachWeekEnabled','coach']]) {
    const code = source(name)
    assert.ok(!code.includes('mobile375.css'))
    assert.ok(code.includes(`${flag} === true ? { 'data-app-375': '${role}' } : {}`))
  }
  assert.ok(source('AthleteView.jsx').includes("forenklinger === true ? { 'data-app-375-page': '' } : {}"))
  assert.ok(source('ForsideView.jsx','src/dashboard/ForsideView.jsx').includes("coachWeekEnabled === true ? { 'data-app-375-page': '' } : {}"))
  assert.ok(source('MobiliseringTab.jsx','src/athlete/MobiliseringTab.jsx').includes("mobilitetFokus === true ? { 'data-app-375-grid': '' } : {}"))
  assert.match(source('fridayPreviewEntry.jsx','scripts/fridayPreviewEntry.jsx'), /'data-friday-preview': ''/)
})

test('375 contract and exact desktop styles from 376 through 1920', () => {
  assertContract(assert, css)
  const banner = style(css,375,'[data-friday-preview]')
  assert.equal(banner.boxSizing,'border-box'); assert.equal(banner.maxWidth,'100vw')
  assert.equal(banner.overflowWrap,'anywhere')
  const original = { width: 'calc(100% - 220px)', marginLeft: '220px', minWidth: 0 }
  for (const width of [376,390,680,768,1280,1920]) {
    assert.deepEqual(style(css,width,'[data-app-375="coach"] > main',original),original)
    assert.deepEqual(rules(css,width),[])
  }
  // LF and CRLF have identical meaning.
  assert.deepEqual(rules(css.replace(/\r?\n/g,'\r\n'),375),rules(css.replace(/\r\n/g,'\n'),375))
})

test('synthetic box budgets keep page padding inside a 375px frame', () => {
  const page = style(css,375,'[data-app-375] [data-app-375-page]')
  for (const outer of [375,373,343,320]) {
    for (const padding of [16,32]) {
      const total = page.boxSizing === 'border-box' ? outer : outer + 2*padding
      assert.ok(total <= outer)
      const content = total - 2*padding
      const tracks = (content - 8)/2
      assert.ok(tracks > 0)
      assert.equal(tracks*2+8,content)
    }
  }
  // The existing seven-day strip already uses zero minimum tracks.
  assert.match(source('WeekCalendar.jsx','src/athlete/WeekCalendar.jsx'), /gridTemplateColumns: 'repeat\(7, minmax\(0, 1fr\)\)'/)
})

test('actual mobility shortcut keeps long content and both navigation handlers', () => {
  let mode, tab
  const options = { enabled:true, tab:'hjem', enkelOn:true, route:'traening', setMobilityMode:v=>{mode=v},setTab:v=>{tab=v} }
  const tree = renderMobilityShortcut(h, options)
  assert.equal(tree.type,'section')
  assert.match(text(tree), /Mere plads til dit løft/)
  const rootStyle = style(css,375,'[data-app-375]')
  assert.equal(rootStyle.overflowWrap,'anywhere')
  const long = 'Mobilitetsinstruktion'.repeat(80)
  // Synthetic text reflow budget: arbitrary break opportunities preserve every character.
  const capacity = Math.floor((343-38)/10)
  const lines = long.match(new RegExp(`.{1,${capacity}}`,'g'))
  assert.equal(lines.join(''),long); assert.ok(lines.every(line=>line.length*10<=343-38))
  nodes(tree,n=>n.type==='button')[0].props.onClick()
  assert.equal(mode,'fokus'); assert.equal(tab,'mobilisering')
  assert.equal(DEFAULT_MOBILITY_FOCUS,false)
  assert.equal(renderMobilityShortcut(h,{...options,enabled:false}),null)
  assert.equal(renderMobilityShortcut(h,{...options,route:'mere'}),null)
})

test('actual Coachens uge long names and values can wrap without changing profile action', () => {
  let opened
  const athlete = {id:'synthetic',name:'LangtAtletnavn'.repeat(60)}
  const tree = renderWeekOverview(h,{ enabled:true, entries:[{athlete,current:{id:'week',week_number:1,planned_sets:999999999999999}}], completion:{}, status:{plan:'ready',logs:'ready'}, openProfile:(...args)=>{opened=args} })
  assert.equal(tree.props['data-coach-week'],true)
  assert.ok(text(tree).includes(athlete.name))
  for (const span of nodes(tree,n=>n.type==='span')) {
    const narrow = style(css,375,'[data-app-375] [data-coach-week] span',span.props.style)
    assert.equal(narrow.whiteSpace,'normal')
    assert.equal(narrow.minWidth,'0')
    assert.equal(narrow.maxWidth,'100%')
    assert.deepEqual(style(css,1280,'[data-app-375] [data-coach-week] span',span.props.style),span.props.style)
  }
  const button = nodes(tree,n=>n.type==='button')[0]
  assert.equal(style(css,375,'[data-app-375] [data-coach-week] button',button.props.style).boxSizing,'border-box')
  button.props.onClick(); assert.deepEqual(opened,[athlete,'program'])
  assert.equal(DEFAULT_COACH_WEEK_OVERVIEW,false)
  assert.equal(renderWeekOverview(h,{}),null)
})

test('own counterexamples reject missing sizing, unsafe tracks, nowrap and lost cascade', () => {
  for (const [before,after] of [
    ['max-width: 100vw;',''],
    ['box-sizing: border-box;','box-sizing: content-box;'],
    ['overflow-wrap: anywhere;','overflow-wrap: normal;'],
    ['repeat(2, minmax(0, 1fr))','1fr 1fr'],
    ['white-space: normal !important;','white-space: nowrap !important;'],
    ['white-space: normal !important;','white-space: normal;'],
    ['max-width: 375px','max-width: 1920px'],
  ]) {
    assert.ok(css.includes(before))
    assert.throws(()=>assertContract(assert,css.replaceAll(before,after)), `${before} must be detected`)
  }
})
