import { registryRecipe } from './testModuleRegistry.mjs'
import { assertSourceProperties } from './sourceProperties.mjs'
import { assertAcceptedSource } from './analyse5SourceContract.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {install, mount, memory, text, button, createElement as h} from './mob7Synthetic.mjs'
install()
const {MobilityHomeworkProgress, HomeworkExerciseProgress, readDone}=await import('./mobilityAdherence.mjs')
const {MobilityHomeworkHome,saveHomework,homeworkLibrary}=await import('./mobilityHomework.mjs')
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8')
const ex=homeworkLibrary()[0].exercises[0]

test('REB Home wrapper retains identical OFF element and route null, including nonboolean flags',()=>{
 const home=h(MobilityHomeworkHome,{enabled:true,athleteId:'a'})
 for(const enabled of [undefined,false,0,1,'true']) assert.equal(MobilityHomeworkProgress({enabled,athleteId:'a',children:home}),home)
 for(const children of [false,null,undefined]) assert.equal(MobilityHomeworkProgress({enabled:true,children}),children)
 const on=MobilityHomeworkProgress({enabled:true,athleteId:'a',children:home})
 assert.equal(on.type,home.type); assert.equal(on.props.key,home.props.key)
 assert.equal(on.props.athleteId,'a'); assert.equal(on.props.adherenceEnabled,true)
 const progress=on.props.renderExerciseProgress(ex)
 assert.equal(progress.type,HomeworkExerciseProgress); assert.equal(progress.props.athleteId,'a'); assert.equal(progress.props.exercise,ex)
})

test('REB actual wrapped Home mounts assigned controls once; click reaches scoped actual storage handler',()=>{
 const storage=memory();saveHomework('a',{problemId:'squat-hip',exerciseIds:[ex.id]},storage)
 const original=h(MobilityHomeworkHome,{enabled:true,athleteId:'a',storage})
 const before=mount(MobilityHomeworkProgress,{children:original}).render()
 assert.equal(text(before),text(mount(MobilityHomeworkHome,original.props).render()))
 const previous=globalThis.localStorage; globalThis.localStorage=storage
 const view=mount(MobilityHomeworkProgress,{enabled:true,athleteId:'a',children:original})
 try {
  button(view.render(),'Lavet i dag: '+ex.name).props.onClick()
  assert.equal(readDone('a',storage).rows.length,1)
  assert.equal(readDone('b',storage).rows.length,0)
  assert.equal(button(view.render(),'Lavet i dag: '+ex.name).props['aria-pressed'],true)
 } finally {
  view.unmount()
  if(previous===undefined) delete globalThis.localStorage; else globalThis.localStorage=previous
 }
})

test('REB existing full Home JSX line and exact initial Athlete import contract survive',()=>{
 const athlete=read('AthleteView.jsx')
 assert.ok(athlete.split(/\r?\n/).includes("        {tab === 'hjem' && (!enkelOn || ['traening', 'alle'].includes(route)) && <MobilityHomeworkHome key={athlete?.id} enabled={mobilitetHjemme} athleteId={athlete?.id} />}"))
 assert.ok(athlete.startsWith("import NytIAppen, { nytAthleteNavigation } from './nytIAppen.mjs'\r\nimport { contactLatestEnabled, enterContact, scrollContactEnd } from './athlete/contactLatest.mjs'\r\nimport { VIDEO_SET_SELECTION_ENABLED, videoOptionsForDay, resolveVideoSet } from './athlete/videoSetSelection.mjs'\r\nimport { findDagensPas } from './nextSet.js'\r\n"))
 assert.match(athlete,/<MobilityHomeworkProgress enabled=\{mobilitetOpfoelgning === true && !coachAthleteId\} athleteId=\{athlete\?\.id\}>\s*\{tab === 'hjem'/)
})

test('REB intentional profile pin matches exact normalized final source',()=>{
 const profile=read('dashboard/ProfilHoved.jsx'), source=read('dashboard/coachNotesReview.test.js')
 assertSourceProperties('profile-mobility', profile)
 assert.match(profile,/mobilitetOpfoelgning = false, adherenceContent = null/)
 assert.match(profile,/mobilitetOpfoelgning === true \? adherenceContent : null/)
})

test('REB closed loader lists admit only the new explicit dashboard export, keep rejection guards',()=>{
 const follow=read('dashboard/followUpLoader.mjs'), rebase=read('rebaseHarness.mjs')
 const recipe=registryRecipe(new URL('./dashboard/followUpLoader.mjs', import.meta.url).href, 'dependencies')
 assert.ok(recipe.some(([parent, specifier, target]) => parent === '../Dashboard.jsx' && specifier === './mobilityAdherence.mjs' && target.stub === 'export const MobilityAdherenceProfile = () => null;'))
 assert.ok(rebase.includes("'./mobilityAdherence.mjs': {MobilityAdherenceProfile:noop},"))
 assert.match(follow,/if \(!target\) return unapproved\(specifier\)/)
 assert.match(rebase,/if \(!\(specifier in fakes\)\) throw Error\('Unapproved dashboard import: '\+specifier\)/)
 assert.equal(recipe.filter(([, specifier]) => specifier === './mobilityAdherence.mjs').length,1)
 assert.equal((rebase.match(/mobilityAdherence\.mjs/g)||[]).length,1)
})

test('REB follow closed-list remainder is pinned unchanged',()=>{
 assertAcceptedSource('src/dashboard/followUpLoader.mjs', read('dashboard/followUpLoader.mjs'))
})

test('REB rebase closed-list remainder is pinned unchanged',()=>{
 assertAcceptedSource('src/rebaseHarness.mjs', read('rebaseHarness.mjs'))
})
