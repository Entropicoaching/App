import { registryRecipe } from './testModuleRegistry.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Each closed loader gets a fresh Node module cache and only synthetic imports.
// No application entry, test suite, backend, server or browser is started.
const root = new URL('./', import.meta.url)
// Give strict loaders a repository parent URL without writing a probe under src.
function runProbe(code) {
  const url = new URL('./dashboard/trin1-loader-probe.mjs', root).href
  const bootstrap = `import { registerHooks } from 'node:module';
    const url = ${JSON.stringify(url)};
    registerHooks({
      resolve(specifier, context, next) {
        return specifier === url ? { url, shortCircuit: true } : next(specifier, context);
      },
      load(target, context, next) {
        return target === url ? { format: 'module', source: ${JSON.stringify(code)}, shortCircuit: true } : next(target, context);
      }
    });
    await import(url);`
  execFileSync(process.execPath, ['--input-type=module', '--eval', bootstrap],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}
const installers = [
  'fremgangLoader.mjs', 'athlete/fokusLoader.mjs', 'athlete/forenkl6Loader.mjs',
  'athlete/frem3Loader.mjs', 'athlete/hjem2Loader.mjs', 'athlete/hvileLoader.mjs',
  'athlete/mob3Loader.mjs', 'athlete/prog2Loader.mjs', 'athlete/prog5Loader.mjs',
  'athlete/repRecordsLoader.mjs', 'athlete/staevneLoader.mjs', 'athlete/vaerd3Loader.mjs',
  'athlete/vaerd5Loader.mjs', 'dashboard/analyseConclusionLoader.mjs',
  'dashboard/analyseFixLoader.mjs', 'dashboard/analyseSamletLoader.mjs',
  'dashboard/coachFourWeeksLoader.mjs', 'dashboard/coachPlanLoader.mjs',
]
for (const path of installers) test(`closed loader imports effective profile: ${path}`, () => {
  const loader = new URL(path, root).href
  const code = `import assert from 'node:assert/strict';
    const m = await import(${JSON.stringify(loader)});
    const hooks = m.install();
    globalThis.location = {search:''};
    const data = await import('../dataEnough.mjs');
    assert.equal(data.dataEnoughEnabled(), false);
    globalThis.location.search = '?appData2=1';
    assert.equal(data.dataEnoughEnabled(), true);
    hooks?.deregister();`
  assert.doesNotThrow(() => runProbe(code))
})

for (const path of ['coachRydHarness.mjs', 'coachRyd2Harness.mjs',
  'dashboard/profileWeekHarness.mjs', 'dashboard/vcQueueHarness.mjs']) {
  test(`closed synthetic harness imports effective profile: ${path}`, () => {
    const loader = new URL(path, root).href
    const load = path.endsWith('profileWeekHarness.mjs') ? `await import('../dataEnough.mjs')`
      : path.endsWith('vcQueueHarness.mjs') ? `(await m.app()).load('dataEnough.mjs')`
        : `(await m.app(), await import('coachryd-test://1/dataEnough.mjs'))`
    const code = `import assert from 'node:assert/strict';
      const m = await import(${JSON.stringify(loader)});
      globalThis.location = {search:''};
      const data = await ${load};
      assert.equal(data.dataEnoughEnabled(), false);
      globalThis.location.search = '?appData2=1';
      assert.equal(data.dataEnoughEnabled(), true);`
    assert.doesNotThrow(() => runProbe(code))
  })
}

test('custom closed graph contains the real profile and closed harness registries include it', () => {
  const graph = JSON.parse(readFileSync(new URL('./trin1Imports.json', root), 'utf8'))
  assert.equal(graph['src/dataEnough.mjs']['./udgivelseTrin.mjs'], 'src/udgivelseTrin.mjs')
  assert.deepEqual(graph['src/udgivelseTrin.mjs'], {})
  const loaders = ['coachRydHarness.mjs', 'coachRyd2Harness.mjs',
    'dashboard/profileWeekHarness.mjs', 'dashboard/vcQueueHarness.mjs']
  for (const path of loaders) {
    const name = path.endsWith('profileWeekHarness.mjs') ? 'real' : path.endsWith('vcQueueHarness.mjs') ? 'allowed' : 'real'
    assert.ok(JSON.stringify(registryRecipe(new URL(path, root).href, name)).includes('udgivelseTrin.mjs'))
  }
})
