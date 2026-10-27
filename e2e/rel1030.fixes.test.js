import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { install } from './rel1030Harness.mjs'
const root = new URL('./', import.meta.url)
const flat = existsSync(new URL('./App.jsx', root))
const source = name => new URL(flat ? name : '../src/' + name, root).href
function probe(code) {
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: new URL('.', root), encoding: 'utf8', timeout: 15000,
  })
  assert.equal(run.status, 0, run.stdout + run.stderr)
}
test('fund 1: existing friday loader imports actual analysis and still rejects unknown modules', () => {
  probe(`
    import assert from 'node:assert/strict';
    import {createRequire} from 'node:module';
    import {install} from './fridayHermeticLoader.mjs';
    install();
    const target=${JSON.stringify(source('dashboard/analyseSamlet.mjs').replace('/dashboard/',flat?'/':'/dashboard/'))};
    const {analyseSamletEnabled}=await import(target);
    assert.equal(analyseSamletEnabled('?rel1030=1'),true);
    assert.equal(analyseSamletEnabled(''),false);
    const {analyseSammenlignEnabled}=await import(${JSON.stringify(source('dashboard/analyseSammenlign.mjs').replace('/dashboard/',flat?'/':'/dashboard/'))});
    assert.equal(analyseSammenlignEnabled('?rel1030=1'),true);
    assert.throws(()=>createRequire(target).resolve('./unapproved-release.mjs'),/Ukendt hermetisk import/);
  `)
})
test('fund 1: existing coach loader imports actual gates and keeps its closed allowlist', () => {
  const harness = flat ? './coachRydHarness.mjs' : '../src/coachRydHarness.mjs'
  probe(`
    import assert from 'node:assert/strict';
    import {app} from ${JSON.stringify(harness)};
    const load=await app();
    for(const name of ['coachRyd.mjs','coachWeekOverview.mjs','analyseSamlet.mjs','analyseSammenlign.mjs']) await load(name);
    const negative=await app();
    const {registerHooks}=await import('node:module');
    registerHooks({load(url,context,next){
      const result=next(url,context);
      if(url.startsWith('coachryd-test:') && url.endsWith('/coachRyd.mjs')) return {...result,source:result.source+"\\nawait import('./unapproved-release.mjs');"};
      return result;
    }});
    await assert.rejects(negative('coachRyd.mjs'),/Unapproved dependency/);
  `)
})
test('fund 2: test-only helpers and baseline are outside the production source tree', () => {
  for (const name of ['rel1030Harness.mjs','rel1030Runtime.mjs','rel1030Jsx.mjs','rel1030Baseline.txt']) {
    if (flat) {
      const paths=JSON.parse(readFileSync(new URL('rel1030-paths.json',root),'utf8'))
      assert.equal(paths[name],'e2e/'+name)
    } else {
      assert.equal(existsSync(new URL('../src/' + name, root)),false,name)
    }
    assert.equal(existsSync(new URL(name,root)),true,name)
  }
})
test('counterprobe: all five actual readers retain strict release parity and individual opt-ins', async () => {
  const hook=install()
  try {
    const {rel1030Enabled}=await import('../src/rel1030.mjs')
    const {coachRydEnabled}=await import('../src/coachRyd.mjs')
    const {coachWeekFlag}=await import('../src/dashboard/coachWeekOverview.mjs')
    const {analyseSamletEnabled}=await import('../src/dashboard/analyseSamlet.mjs')
    const {analyseSammenlignEnabled}=await import('../src/dashboard/analyseSammenlign.mjs')
    const {videoFeedbackPlaybackEnabled}=await import('../src/athlete/videoFeedbackPlayback.mjs')
    const gates={coachRyd:coachRydEnabled,coachUge:coachWeekFlag,analyseSamlet:analyseSamletEnabled,analyseSammenlign:analyseSammenlignEnabled}
    const storage={getItem:()=>null,setItem:()=>{throw Error('Forbidden write')}}
    for(const query of ['', '?rel1030=1','?rel1030=%31','?rel1030=0','?rel1030=1&rel1030=1','?rel1030=1&rel1030=0','?REL1030=1','?rel1030=true','?rel1030=01','?rel1030=1%20']) {
      for(const gate of Object.values(gates)) assert.equal(gate(query),rel1030Enabled(query),query)
      assert.equal(videoFeedbackPlaybackEnabled(storage,query),rel1030Enabled(query),query)
    }
    for(const [key,gate] of Object.entries(gates)) assert.equal(gate('?rel1030=0&'+key+'=1'),true)
  } finally { hook.deregister() }
})
