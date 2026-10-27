import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { install } from './mobilityTestLoader.mjs'
import { WARMUP_BASE } from './mobilityCatalog.mjs'

install()
const { default: Tab } = await import('./MobiliseringTab.jsx')

test('R1: existing loader imports the actual shared pure catalog for the actual hub', () => {
  assert.equal(Tab({ mobilitetFokus: true, mobilityMode: 'fokus' }).props.library, WARMUP_BASE)
  assert.ok(Object.keys(WARMUP_BASE).length >= 3)
})

function rejectImport(parent, specifier) {
  // Inject a synthetic source into a recognized public module URL. The real
  // loader must reject its import before any dependency is loaded or executed.
  const source = `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    import { install } from './mobilityTestLoader.mjs';
    install();
    const target = new URL(${JSON.stringify('./' + parent)}, import.meta.url).href;
    registerHooks({ load(url, context, next) {
      if (url === target) return { format: 'module', shortCircuit: true,
        source: ${JSON.stringify('import ' + JSON.stringify(specifier) + '; export default 1;')} };
      return next(url, context);
    }});
    await assert.rejects(import(target), error =>
      error.message === ${JSON.stringify('Forbidden synthetic import: ' + specifier)});
    console.log('guard rejected');
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: new URL('./', import.meta.url), encoding: 'utf8', timeout: 10000,
  })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /guard rejected/)
}

test('R1 countercheck: original hub still rejects unknown and backend imports', () => {
  for (const specifier of ['./notAllowed.mjs', '../supabase.js', 'node:fs', 'https://invalid.example/module.mjs']) {
    rejectImport('MobiliseringTab.jsx', specifier)
  }
})

test('R1 countercheck: newly allowed catalog cannot import unsafe transitive dependencies', () => {
  for (const specifier of ['./notAllowed.mjs', '../supabase.js', 'node:fs', 'https://invalid.example/module.mjs']) {
    rejectImport('mobilityCatalog.mjs', specifier)
  }
})
