import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
for (const loader of ['mob4Loader.mjs', 'coachRydHarness.mjs']) {
  for (const forbidden of [false, true]) test(`${loader}: actual new helper ${forbidden ? 'rejects FS import' : 'loads'}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { registerHooks } from 'node:module';
      const loader=await import(${JSON.stringify(new URL(existsSync(new URL(loader, import.meta.url)) ? loader : 'athlete/' + loader, import.meta.url).href)});
      const load=${loader === 'coachRydHarness.mjs' ? "(await loader.app()).bind(null,'mobilityHomework.mjs')" : "(loader.install(),()=>import('./mobilityHomework.mjs'))"};
      ${forbidden ? `registerHooks({load(url,context,next){if(url.endsWith('/mobilityHomework.mjs')) return {format:'module',shortCircuit:true,source:'import "node:fs";'};return next(url,context)}});
      await assert.rejects(load(), /${loader === 'coachRydHarness.mjs' ? 'Unapproved dependency: node:fs.js' : 'Forbidden synthetic import: node:fs'}/);` : 'await load();'}
    `], { cwd: new URL('./', import.meta.url), encoding: 'utf8', timeout: 10000 })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
}
