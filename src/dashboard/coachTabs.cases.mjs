import assert from 'node:assert/strict'
import { baseProps, ready } from './coachTabsFixture.mjs'
export async function coachTabsCases(test, render) {
 const views = {}
 for (const name of ['OversigtTab','ProgramTab','LogTab','AnalyseTab','StaevneTab','HubTab','NoterTab','VolumenKort']) views[name] = (await import(`./${name}.jsx`)).default
 const show = (name, extra = {}) => render(views[name], baseProps(extra))
 const read = (state, retry = () => {}) => Object.assign([], { coachRead: { state, athleteId: 'synthetic-a', retry } })
 test('sparse overview: no absent fields, invented maxima/totals or duplicate targets', () => {
  const output = show('OversigtTab')
  assert.doesNotMatch(output, /Ikke angivet|Ikke sat|Comp total|Trænings total|Ingen stævnedato/)
  assert.match(output, /Sæt kostmål/); assert.match(output, /Tilføj stævnedato/); assert.match(output, /Rediger/)
  const partial = show('OversigtTab', { a: {id:'synthetic-a',squat:100} })
  assert.match(partial,/100/); assert.doesNotMatch(partial,/Comp total/)
  const full = show('OversigtTab', { a: {id:'synthetic-a',squat:100,bench:80,deadlift:180} })
  assert.match(full,/360/)
 })
 test('overview distinguishes unread, failed and ready-empty check-in', () => {
  for(const state of ['loading','error','incomplete']) {
   const output=show('OversigtTab',{athleteReadiness:read(state)})
   assert.doesNotMatch(output,/Ingen check-in/)
   assert.match(output,state==='loading'?/Henter dagens check-in/:state==='error'?/Dagens check-in kunne ikke hentes/:/delvist hentet/)
  }
  assert.match(show('OversigtTab'),/Ingen check-in/)
 })
 test('program has one confirmed-empty start, no empty result after failure', () => {
  assert.match(show('ProgramTab'),/Ingen uger endnu/)
  assert.match(show('ProgramTab'),/Ny uge/)
  for(const state of ['loading','error','incomplete']) {
   const output=show('ProgramTab',{weeks:read(state)})
   assert.doesNotMatch(output,/Ingen uger|Ny uge/); assert.match(output,state==='loading'?/Henter program/:/Prøv igen/)
  }
 })
 test('log distinguishes failed load and removes blank plan labels', () => {
  assert.doesNotMatch(show('LogTab',{athleteLogs:read('error')}),/Ingen loggede/)
  const logs=ready([{exercise_id:'synthetic-ex',set_number:1,weight:100,reps_completed:1,logged_at:'2026-11-03T12:00:00Z',exercises:{name:'Squat',session_id:'synthetic-session',sessions:{title:'Pas',weeks:{week_number:1}}}}])
  assert.doesNotMatch(show('LogTab',{athleteLogs:logs,openLogWeeks:new Set(['1'])}),/Plan:/)
  const filtered=show('LogTab',{athleteLogs:logs,logExerciseFilter:'Bænkpres'})
  assert.match(filtered,/Vis alle øvelser/)
 })
 test('analysis hides synthetic tools, blank charts and duplicate training absence', () => {
  const output=show('AnalyseTab')
  assert.doesNotMatch(output,/lokalt analyseværktøj|Træningskonsistens|Ingen data endnu|kg ikke angivet/)
  assert.equal((output.match(/Ingen loggede sessioner endnu/g)||[]).length,1)
  assert.doesNotMatch(show('AnalyseTab',{athleteLogs:read('error')}),/Ingen loggede sessioner endnu/)
 })
 test('one known lift does not mount empty graphs for unrelated lifts', () => {
  const logs=ready([{exercise_id:'synthetic-ex',set_number:1,weight:100,reps_completed:3,logged_at:'2026-11-03T12:00:00Z',exercises:{name:'Squat',session_id:'synthetic-session',intensity:'100kg',sessions:{title:'Pas',weeks:{week_number:1}}}}])
  const output=show('AnalyseTab',{athleteLogs:logs})
  assert.doesNotMatch(output,/Ingen data endnu|Ikke nok data endnu|Ukendt/)
 })
 test('analysis shows one recorded readiness score including known zero', () => {
  const output=show('AnalyseTab',{athleteReadiness:ready([{logged_date:'2026-11-03',readiness_score:0}])})
  assert.match(output,/Seneste parathed/); assert.doesNotMatch(output,/Ikke nok data endnu|Gns. søvn/)
 })
 test('meet errors block the unknown plan form; empty history has one result entry', () => {
  const output=show('StaevneTab')
  assert.match(output,/Registrér resultat/); assert.doesNotMatch(output,/Ingen PR|Ingen stævner registreret/)
  const failed=show('StaevneTab',{meetPlanForm:{meet_type:'sbd',coachRead:{athleteId:'synthetic-a',state:'error',retry:()=>{}}}})
  assert.match(failed,/Stævneplan kunne ikke hentes/);assert.doesNotMatch(failed,/Gem plan/)
  assert.match(show('StaevneTab',{meetResults:read('error')}),/Stævnehistorik kunne ikke hentes/)
 })
 test('known meet results remain usable if the independent PR read fails', () => {
  const output=show('StaevneTab',{meetResults:ready([{id:'synthetic-result',meet_date:'2026-11-01',meet_name:'Syntetisk stævne',bench:100,total:100}]),athletePRs:read('error')})
  assert.match(output,/Syntetisk stævne/);assert.match(output,/Stævnehistorik kunne ikke hentes/);assert.doesNotMatch(output,/Ingen PR/)
 })
 test('notes keep one honest start and an explicit add action', () => {
  const output=show('NoterTab');assert.match(output,/Ingen noter endnu/);assert.match(output,/Tilføj note/)
 })
 test('OFF retains existing overview, program, log and meet empty copy', () => {
  assert.match(show('OversigtTab',{coachTabCleanup:false}),/Ikke angivet|Ikke sat/)
  assert.match(show('StaevneTab',{coachTabCleanup:false}),/Ingen PR/)
  assert.match(show('LogTab',{coachTabCleanup:false}),/Ingen loggede træninger/)
 })
 test('volume keeps the missing calendar date explanation and unknown planned sets, ON and OFF', t => {
  t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-03T12:00:00Z')})
  const logs=ready([{logged_at:'2026-11-03T12:00:00Z',reps_completed:3,exercises:{name:'Squat',session_id:'synthetic-session'}}])
  const weeks=ready([{id:'synthetic-week',week_number:1,sessions:[{exercises:[{name:'Squat',sets:3}]}]}])
  for(const coachTabCleanup of [false,true]) {
   const output=show('VolumenKort',{coachTabCleanup,athleteLogs:logs,weeks})
   assert.match(output,/Denne programuge har ikke en kalenderdato endnu/)
   assert.match(output,/planlagt.*kan derfor ikke vises/)
   assert.match(output,/1\s*\/\s*–/)
   assert.doesNotMatch(output,/1\s*\/\s*0/)
   const dated=show('VolumenKort',{coachTabCleanup,athleteLogs:logs,weeks:ready([{...weeks[0],start_date:'2026-11-02'}])})
   assert.doesNotMatch(dated,/har ikke en kalenderdato/)
   assert.match(dated,/1\s*\/\s*3/)
  }
 })
}
