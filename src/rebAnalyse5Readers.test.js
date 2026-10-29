import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const props = {a:{id:'synthetic'},selectedAthlete:{id:'synthetic'},athleteLogs:[],athletePRHistory:[],athleteReadiness:[],athleteWeightLogs:[],exerciseLibrary:[],videoAnalyses:[],videoBaselines:[],weeks:[],videoLiftFilter:'all'}
const hasMessage = existsSync(new URL('./dashboard/analyseConclusionMessage.mjs',import.meta.url))
const groups = {
 coach: ['coachRebase','coachRyd'],
 dashboard: ['exactFinal','rebase'],
 retention: ['retentionApp','retentionExactFinal'],
 fix: ['dashboard/analyseFix','dashboard/analyseFixReview'],
 samlet: ['dashboard/analyseSamlet','dashboard/analyseSamletReview','dashboard/analyseSammenlign','dashboard/rebaseAnalysis','dashboard/rebaseControl'],
 follow: ['dashboard/followUpReview'],
}
for (const [group, readers] of Object.entries(groups)) for (const reader of readers) {
 test('actual-layout shared loader used by '+reader, () => {
  let source = `import assert from 'node:assert/strict'; const props=${JSON.stringify(props)}; globalThis.window={location:{search:''},innerWidth:1024}; globalThis.localStorage={getItem:()=>null,setItem(){}};`
  if (group==='coach') source += `const {app}=await import('./coachRydHarness.mjs'); const load=await app(); const Tab=await load('AnalyseTab.jsx'); assert.ok(Tab(props)); await assert.rejects(load('not-approved.mjs'),/Unapproved dependency/);`
  if (group==='dashboard') source += `const {draw}=await import('./rebaseHarness.mjs'); assert.ok(draw().tree); await assert.rejects(import('rebasedash://final/./dashboard/unknown.mjs'),/Unapproved dashboard/);`
  if (group==='retention') source += `const {app}=await import('./retentionAppHarness.mjs'); const view=await app(); assert.ok(view.render(props)); await assert.rejects(import('retention-1://app/unknown.mjs'),/ENOENT|Forbidden/);`
  if (group==='fix'||group==='samlet') source += `const {install}=await import('./${group==='fix'?'analyseFixLoader':'analyseSamletLoader'}.mjs'); const {mount}=await import('./analyseSamletDom.mjs'); install(); const {default:Tab}=await import('./AnalyseTab.jsx'); assert.ok(mount(Tab,props).render()); ${hasMessage ? "const m=await import('./analyseConclusionMessage.mjs'); assert.equal(m.DEFAULT_ANALYSE_CONCLUSION_MESSAGE,false); assert.equal(m.default({enabled:false}),null);" : ''}`
  if (group==='follow') source += `const {install}=await import('./followUpLoader.mjs'); install(); const {default:Dashboard}=await import('../Dashboard.jsx'); assert.equal(typeof Dashboard,'function'); const m=await import('../Dashboard.jsx'); assert.equal(m.default,Dashboard);`
  const cwd=new URL(group==='fix'||group==='samlet'||group==='follow'?'./dashboard/':'./',import.meta.url)
  const r=spawnSync(process.execPath,['--input-type=module','-e',source],{cwd,encoding:'utf8',timeout:15000})
  assert.equal(r.status,0,r.stdout+r.stderr)
 })
}
