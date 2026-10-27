import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { ambiguousImports, relativeImports, resolveInsensitive } from './importSafety.mjs'

function sourceTree(directory, prefix = 'src') {
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    const path = prefix + '/' + entry.name
    return entry.isDirectory() ? Object.entries(sourceTree(url, path))
      : [[path, /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(path) ? readFileSync(url, 'utf8') : '']]
  }))
}

test('all relative src imports have an extension when case-insensitive stems collide', () => {
  assert.deepEqual(ambiguousImports(sourceTree(new URL('../', import.meta.url))), [])
})

test('actual ForsideView import resolves to the JSX component on a case-insensitive virtual FS', () => {
  const files = sourceTree(new URL('../', import.meta.url))
  const file = 'src/dashboard/ForsideView.jsx'
  const specifier = relativeImports(files[file]).find(value => /\/CoachActions(?:\.jsx)?$/.test(value))
  assert.ok(specifier)
  for (const names of [Object.keys(files), Object.keys(files).reverse()]) {
    for (const extensions of [['.mjs', '.js', '.jsx'], ['.jsx', '.js', '.mjs']]) {
      assert.equal(resolveInsensitive(file, specifier, names, extensions), 'src/dashboard/CoachActions.jsx')
    }
  }
})

test('counterexamples detect static, side-effect, dynamic and re-export imports with LF or CRLF', () => {
  for (const newline of ['\n', '\r\n']) {
    for (const statement of ["import Thing from './thing'", "import './thing'", "import('./thing')", "export { x } from './thing'", "const x = require('./thing')"]) {
      const files = { 'src/view.js': statement + newline, 'src/Thing.jsx': '', 'src/thing.mjs': '' }
      assert.equal(ambiguousImports(files).length, 1)
      assert.equal(ambiguousImports({ ...files, 'src/view.js': statement.replace('./thing', './Thing.jsx') + newline }).length, 0)
    }
  }
})

test('counterexamples preserve unambiguous extensionless imports and detect same-extension case variants', () => {
  assert.deepEqual(ambiguousImports({ 'src/view.js': "import X from './Thing'", 'src/Thing.jsx': '' }), [])
  assert.equal(ambiguousImports({ 'src/view.js': "import X from './Thing'", 'src/Thing.jsx': '', 'src/thing.jsx': '' }).length, 1)
  assert.equal(ambiguousImports({ 'src/view.js': "import X from './Thing'", 'src/Thing.jsx': '', 'elsewhere/thing.mjs': '' }).length, 0)
  assert.equal(ambiguousImports({ 'src/view.js': "import X from '../lib/thing.v2'", 'lib/Thing.v2.jsx': '', 'lib/thing.v2.mjs': '' }).length, 1)
})


test('actual JSX module imports with its helper and retains default OFF in synthetic DOM', async () => {
  await import('./kandFlet3Dom.mjs')
  const { default: CoachActions } = await import('./CoachActions.jsx')
  const { COACH_ACTIONS_ENABLED, buildCoachActions } = await import('./coachActions.mjs')
  assert.equal(typeof CoachActions, 'function')
  assert.equal(typeof buildCoachActions, 'function')
  assert.equal(COACH_ACTIONS_ENABLED, false)
  assert.equal(CoachActions({}), null)
  const tree = CoachActions({ enabled: true, athletes: [], dataStatus: { calendar: 'ready', progress: 'ready' } })
  assert.equal(tree.type, 'section')
  assert.equal(tree.props['data-coach-actions'], true)
})
