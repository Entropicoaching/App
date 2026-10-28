import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'
import { restDays, isRestSession, restDate, REST_DAY_TEXT } from './restDays.mjs'
import { withHvileBaseline } from './hvileBaseline.mjs'
import { install } from './hvileLoader.mjs'
import { mount, nodes, text, io } from './hvileDom.mjs'
const hvile = install()
const { default: Program } = await import('./ProgramTab.jsx')
const helpers = await import('./ugeHjaelp.js')
const source = n => readFileSync(new URL(n, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const hash = s => createHash('sha256').update(s).digest('hex')

test('fresh: exact Program union removes to the entire pinned 9338db3e module', () => {
  const original = source('ProgramTab.jsx')
    .replace("import RestDays from './RestDays.jsx'\nimport { isRestSession } from './restDays.mjs'\n", '')
    .replace('                  <RestDays week={viewedWeek} weekStart={weekStartDate(allWeeks, viewedWeek.week_number)} />\n\n', '')
    .replace('.filter(session => !isRestSession(viewedWeek, session))', '')
  assert.equal(hash(original), '233f0be78b6d7612714462a522badd67abafa8750375fcdaa46c768137f5e8de')
  for (const [n, pin] of [
    ['prog2Baseline.txt', 'ac4cfa59645e9391236b64a7a76eb39bdcdd451ed2c45a0d7b25699087a57f81'],
    ['prog3Baseline.jsx', 'd186954fae25288a57bb15136492f164c20f732350d6386e8b686d6987b689d4'],
    ['prog5Baseline.jsx', 'd3e34c0d58284ddb5d683a95b7c134d92be2628dc62c1788536fc494f0a04c15'],
  ]) assert.equal(hash(source(n)), pin)
  assert.throws(() => withHvileBaseline('no session loop'), /Expected one/)
  const marker = '                  {(viewedWeek.sessions || []).map(session => {'
  assert.throws(() => withHvileBaseline(marker + marker), /Expected one/)
})

test('fresh: incomplete records never invent rest and model stays pure', () => {
  for (const s of [null, {}, 'bad', {weekday: -1, exercises: []}, {weekday: 7, exercises: []}, {weekday: null, exercises: []}, {weekday: 0}]) {
    assert.deepEqual(restDays({ sessions: [s] }), [])
    assert.equal(isRestSession({ sessions: [s] }, s), false)
  }
  const w = Object.freeze({ sessions: Object.freeze([]), coach_note: '  ' })
  assert.deepEqual(restDays(w).map(d => d.weekday), [0,1,2,3,4,5,6])
  assert.ok(restDays(w).every(d => d.text === REST_DAY_TEXT))
  assert.equal(restDate(new Date('invalid'), 0), '')
})

test('fresh: all three new flags coexist with rest; no rest handlers or backend writes', t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-25T12:00:00Z') })
  const allWeeks = ['2026-10-19', '2026-10-26'].map((start_date, i) => ({
    id: 'w' + i, week_number: i+1, start_date, block_name: 'Styrke', coach_note: '<b>Kun tekst</b>',
    sessions: [{id: 's' + i, title: 'Squat', weekday: 0, exercises: [{id:'e', name:'Squat', sets:3, reps:5, intensity:'RPE 8'}]},
      {id:'rest' + i, title:'Pause', weekday:2, exercises:[]}],
  }))
  for (const programNaesteUge of [undefined, false, true, 'true']) {
    const p = {...helpers, allWeeks, currentWeek:allWeeks[0], viewingWeekIdx:1, athlete:{id:'synthetic'},
      exerciseLogs:[],pastLogs:[],progOpenSession:null,readinessLog:{readiness_score:90},sessionRefs:{current:{}},
      dismissedFeedback:new Set(),feedbackInputs:{},logInputs:{},programNaesteUge,programIntensityHelp:true,programBlokOversigt:true}
    const before = JSON.stringify(allWeeks)
    const tree = mount(Program,p).render()
    const rows = nodes(tree,n=>n.props['data-hviledag'] !== undefined)
    assert.deepEqual(rows.map(n=>n.props['data-hviledag']), [1,2,3,4,5,6])
    assert.ok(rows.every(n=>text(n).includes('<b>Kun tekst</b>')))
    assert.equal(nodes(tree,n=>n.type==='b').length,0)
    assert.ok(rows.every(n=>!nodes(n,x=>x.props.onClick || x.type==='button' || x.type==='input').length))
    assert.equal(nodes(tree,n=>n.props['data-program-day-preview']).length,programNaesteUge===true?1:0)
    assert.equal(JSON.stringify(allWeeks),before)
  }
  assert.equal(io.rpc,0)
})

for (const name of ['forenkl6Loader.mjs','vaerd5Loader.mjs']) test('fresh: closed loader rejects path aliases and capabilities: '+name, async () => {
  const { install } = await import('./'+name)
  const loader = install()
  const probe = registerHooks({ resolve(s,c,next) {
    return s.startsWith('counter:') ? next(s.slice(8), {...c,parentURL:new URL('./ProgramTab.jsx',import.meta.url).href}) : next(s,c)
  } })
  try {
    assert.equal(typeof (await import('counter:./RestDays.jsx')).default,'function')
    assert.equal((await import('counter:./restDays.mjs')).restDays({sessions:[]}).length,7)
    for (const bad of ['./RestDays','./restDays','./RESTDAYS.jsx','../RestDays.jsx','./a/../RestDays.jsx','./restDays.mjs?x',
      './RestDays.jsx#x','../../restDays.mjs','./Other.jsx','node:fs','fs','node:child_process','https://example.invalid/x','./x.json']) {
      await assert.rejects(import('counter:'+bad),/Unapproved synthetic dependency/)
    }
  } finally {probe.deregister();loader.deregister()}
})
