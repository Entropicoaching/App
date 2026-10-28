import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { mount, nodes, text } from './prog2Dom.mjs'
import { Program, helpers, model } from './prog2Loader.mjs'

test('counter: calendar start overrides stale index in both directions', () => {
  assert.equal(model.upcomingProgramWeek('2026-10-26',false,new Date('2026-10-25T23:00:00Z')),false)
  assert.equal(model.upcomingProgramWeek('2026-11-02',false,new Date('2026-10-26T00:00:00Z')),true)
})
test('counter: raw prescriptions and names survive mixed top and backoff rows', () => {
  const input=[{ name:'Squat top',sets:1,reps:3 },{ name:'Squat backoff',sets:4,reps:'5-8' },{name:'<img onerror=bad>',sets:2,reps:'30 sek'}]
  const before=JSON.stringify(input), result=model.programDayPreview(input)
  assert.deepEqual(result.lines,['Squat top: 1 x 3','Squat backoff: 4 x 5-8','<img onerror=bad>: 2 x 30 sek'])
  assert.equal(JSON.stringify(input),before)
})
test('counter: no sessions has no preview and remains navigable empty state', t => {
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-25T10:00:00Z')})
  const week={id:'w',week_number:1,start_date:'2026-10-26',sessions:[]}
  const p={...helpers,programNaesteUge:true,allWeeks:[week],currentWeek:week,viewingWeekIdx:0,athlete:{},exerciseLogs:[],pastLogs:[]}
  const tree=mount(Program,p).render()
  assert.match(text(tree),/Ingen træninger/)
  assert.equal(nodes(tree,n=>n.props['data-program-day-preview']).length,0)
})
test('counter: flag forwarding and unchanged baseline are independent of LF or CRLF', () => {
  // Source assertions supplement the actual Program handler imports above.
  const root=new URL('./',import.meta.url)
  const file=name => { const flat=new URL(name,root); return existsSync(flat) ? flat : new URL('../'+name,root) }
  for(const ending of ['\n','\r\n']) {
    const app=readFileSync(file('App.jsx'),'utf8').replace(/\r?\n/g,ending)
    const athlete=readFileSync(file('AthleteView.jsx'),'utf8').replace(/\r?\n/g,ending)
    assert.match(app,/programNaesteUge = false/)
    assert.equal((app.match(/programNaesteUge: programNaesteUge === true/g)||[]).length,2)
    assert.match(athlete,/weekStartDate, programIntensityHelp, programUgeFoerst, programNaesteUge, programBlokOversigt, fetchProgramBlockLogs, vaerdF6/)
  }
})
