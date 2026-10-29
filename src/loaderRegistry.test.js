import test from 'node:test'
import assert from 'node:assert/strict'
import * as vm from 'node:vm'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve as absolute } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRegistry, wrapRegistryHooks } from './testModuleRegistry.mjs'
import { syntheticModules } from './registrySyntheticFs.mjs'
import { snapshotFiles } from './registryTestFiles.mjs'
if (!vm.SourceTextModule) {
  test('registry synthetic ESM checks in isolated VM-capable process', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url)], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  })
} else {
const { SourceTextModule } = vm
const root = process.argv[2] ? pathToFileURL(absolute(process.argv[2]) + '/') : new URL('../', import.meta.url)
const files = snapshotFiles(root)
const data = JSON.parse(readFileSync(new URL('./testModuleRegistry.json', import.meta.url), 'utf8'))
const after = files.has(new URL('src/testModuleRegistry.mjs', root).href)
const probe = { module: 'RegistryProbe.mjs', path: 'src/athlete/RegistryProbe.mjs', allowedImporters: ['src/athlete/ProgramTab.jsx'] }
const parent = new URL('src/athlete/ProgramTab.jsx', root).href
const bad = ['./RegistryProbe', './missing.mjs', './x/../RegistryProbe.mjs', '../athlete/RegistryProbe.mjs',
  './REGISTRYPROBE.mjs', './RegistryProbe.MJS', './RegistryProbe%2emjs', './RegistryProbe.mjs?x', './RegistryProbe.mjs#x',
  './x\\..\\RegistryProbe.mjs', '../../outside.mjs', 'node:fs', 'fs', 'https://invalid.test/m.mjs']

for (const [identifier, source] of files) if (identifier.includes('/src/') && identifier.endsWith('.test.js')) {
  test('source inventory parses actual layout: ' + identifier.slice(root.href.length), () => {
    assert.doesNotThrow(() => new SourceTextModule(source, { identifier }))
  })
}
async function open(loader, input = files) {
  const engine = syntheticModules(input, root)
  const mod = await engine.import(loader)
  if (typeof mod.install === 'function') await mod.install()
  else if (typeof mod.app === 'function') await mod.app()
  else if (typeof mod.bridge === 'function') await mod.bridge()
  assert.ok(engine.registrations.length || typeof mod.resolve === 'function', 'actual handler registered or exported')
  if (!engine.registrations.length && typeof mod.resolve === 'function') engine.register({ resolve: mod.resolve, load: mod.load })
  return { engine, mod, resolve: engine.resolve }
}
for (const loader of Object.keys(data.loaders)) {
  test('actual synthetic handler import: ' + loader, async () => { await open(loader) })
  test('one registry entry admits a new module and closes its graph: ' + loader, { skip: !after }, async () => {
    const extended = structuredClone(data); extended.modules.push(probe)
    const input = new Map(files)
    input.set(new URL('src/testModuleRegistry.json', root).href, JSON.stringify(extended))
    input.set(new URL(probe.path, root).href, 'export const syntheticToken = 1917\n')
    const view = await open(loader, input)
    const target = view.resolve('./RegistryProbe.mjs', parent)
    assert.equal(target, new URL(probe.path, root).href)
    const virtual = data.loaders[loader].virtual
    if (virtual) {
      const protocol = virtual.protocol.replace('number', '1'), host = virtual.host === 'number' ? '1' : virtual.host
      const virtualParent = protocol + '//' + host + '/' + (virtual.mode === 'path' ? 'src/athlete/ProgramTab.jsx' : 'ProgramTab.jsx')
      assert.equal(view.resolve('./RegistryProbe.mjs', virtualParent), target, 'actual virtual-parent route')
    }

    for (const specifier of bad) assert.throws(() => view.resolve(specifier, target), /Closed registry import/, specifier)
  })
  test('one module row supports existing dependencies and JSX handler rendering: ' + loader, { skip: !after }, async () => {
    const extended = structuredClone(data)
    extended.modules.push({ module: 'RegistryJsxProbe.jsx', path: 'src/athlete/RegistryJsxProbe.jsx',
      allowedImporters: ['src/athlete/ProgramTab.jsx'], imports: { '../calendarDate.js': 'src/calendarDate.js', react: '@runtime' } })
    const input = new Map(files)
    input.set(new URL('src/testModuleRegistry.json', root).href, JSON.stringify(extended))
    input.set(new URL('src/athlete/RegistryJsxProbe.jsx', root).href,
      "import { createElement } from 'react';\nimport { calendarDay } from '../calendarDate.js';\nexport default function Probe({onClick}) { return <button data-day={calendarDay('2026-10-29T12:00:00Z')} onClick={onClick}>Probe</button> }\n")
    const view = await open(loader, input)
    assert.equal(view.resolve('./RegistryJsxProbe.jsx', parent), new URL('src/athlete/RegistryJsxProbe.jsx', root).href)
    const mod = await view.engine.import('src/athlete/RegistryJsxProbe.jsx')
    let clicked = 0
    const tree = mod.default({ onClick: () => clicked++ })
    assert.equal(tree.type, 'button')
    assert.equal(tree.children[0], 'Probe')
    const dependency = await view.engine.import('src/calendarDate.js')
    assert.equal(tree.props['data-day'], dependency.calendarDay('2026-10-29T12:00:00Z'), 'existing dependency keeps the owning loader semantics')
    tree.props.onClick(); assert.equal(clicked, 1)
  })

}
test('registry rejects aliases, wrong importers, wrong loaders, duplicates and invalid metadata', () => {
  const extended = structuredClone(data); extended.modules.push(probe)
  const rules = createRegistry(extended, root)
  for (const loader of Object.keys(extended.loaders)) {
    for (const specifier of bad) assert.equal(rules.lookup(loader, specifier, parent), null, loader + ' ' + specifier)
    assert.equal(rules.lookup(loader, './RegistryProbe.mjs', new URL('src/athlete/RestDays.jsx', root).href), null)
  }
  assert.equal(rules.lookup('src/unknownLoader.mjs', './RegistryProbe.mjs', parent), null)
  for (const change of [d => d.version++, d => d.modules.push(probe), d => d.modules[0].path = '../escape.mjs',
    d => d.modules[0].allowedImporters = ['../outside.jsx'], d => d.modules[0].allowedLoaders = ['unknown']]) {
    const value = structuredClone(extended); change(value); assert.throws(() => createRegistry(value, root))
  }
  const restricted = structuredClone(extended); restricted.modules.at(-1).allowedLoaders = ['src/trin1Loader.mjs']
  const only = createRegistry(restricted, root)
  assert.ok(only.lookup('src/trin1Loader.mjs', './RegistryProbe.mjs', parent))
  assert.equal(only.lookup('src/athlete/hvileLoader.mjs', './RegistryProbe.mjs', parent), null)
})
test('shared wrapper owns registered source, preserves legacy rendering and never consults host for new graph', () => {
  const extended = structuredClone(data); extended.modules.push(probe)
  const rules = createRegistry(extended, root)
  let host = 0
  const hooks = wrapRegistryHooks(new URL('src/trin1Loader.mjs', root).href,
    { resolve: (s, c, next) => next(s, c), load: (u, c, next) => next(u, c) },
    { registry: rules, readSource: () => 'export const token = 1917' })
  const target = hooks.resolve('./RegistryProbe.mjs', { parentURL: parent }, () => { host++; throw Error('host') })
  assert.equal(hooks.load(target.url, {}, () => { host++; throw Error('host') }).source, 'export const token = 1917')
  for (const s of bad) assert.throws(() => hooks.resolve(s, { parentURL: target.url }, () => { host++ }), /Closed registry import/)
  assert.equal(host, 0)
})

test('removing an authoritative closed edge still fails; unrelated recipes may grow', { skip: !after }, async () => {
  const extended = structuredClone(data)
  delete extended.recipes['src/trin1Loader.mjs#manifest:./trin1Imports.json']['src/dataEnough.mjs']['./udgivelseTrin.mjs']
  const input = new Map(files)
  input.set(new URL('src/testModuleRegistry.json', root).href, JSON.stringify(extended))
  const view = await open('src/trin1Loader.mjs', input)
  assert.throws(() => view.resolve('./udgivelseTrin.mjs', new URL('src/dataEnough.mjs', root).href), /Closed trin1 import/)
})
test('existing source-reader checks consult the shared recipes', { skip: !after }, async () => {
  for (const [path, title] of [
    ['src/trin1Loaders.test.js', /^custom closed graph/],
    ['src/rebMob7.test.js', /^REB closed loader lists/],
  ]) {
    const engine = syntheticModules(files, root); await engine.import(path)
    const selected = engine.tests.filter(entry => title.test(entry.name)); assert.equal(selected.length, 1)
    await selected[0].callback()
  }
})

for (const loader of ['src/athlete/forenkl6Loader.mjs','src/athlete/hvileLoader.mjs','src/athlete/prog2Loader.mjs',
  'src/athlete/prog5Loader.mjs','src/athlete/vaerd5Loader.mjs','src/trin1Loader.mjs']) {
  test('existing rest-mobility rejection probes in actual layout: ' + loader, async () => {
    const view = await open(loader)
    const owner = new URL('src/athlete/RestDays.jsx', root).href
    assert.equal(view.resolve('./restMobility.mjs', owner), new URL('src/athlete/restMobility.mjs', root).href)
    for (const specifier of ['./restMobility','../restMobility.mjs','./x/../restMobility.mjs','./restMobility.mjs?x',
      './restMobility.mjs#x','./RESTMOBILITY.mjs','./restMobility.MJS','./restMobility%2Emjs','./x\\..\\restMobility.mjs'])
      assert.throws(() => view.resolve(specifier, owner), /Unapproved|Closed/)
    const helper = new URL('src/athlete/restMobility.mjs', root).href
    for (const specifier of ['node:fs','node:child_process','https://example.invalid/module','./unknown.mjs','./x/../mobilityFocus.mjs','../athlete/mobilityFocus.mjs'])
      assert.throws(() => view.resolve(specifier, helper), /Unapproved|Closed/)
  })
}
for (const loader of ['src/dashboard/analyseSamletLoader.mjs','src/dashboard/analyseConclusionLoader.mjs']) {
  test('existing analysis rejection probes: ' + loader, async () => {
    const view = await open(loader), owner = new URL('src/dashboard/rebaseControl.test.js', root).href
    for (const specifier of ['node:http','react-dom','./unknown.mjs','./dataEnough','../../dataEnough.mjs','./unknown/../dataEnough.mjs'])
      assert.throws(() => view.resolve(specifier, owner), /Closed loader/)
  })
}
for (const [loader, prefix] of [['src/coachRydHarness.mjs','coachryd-test://1/'],['src/coachRyd2Harness.mjs','coachryd-test://1/'],['src/retentionAppHarness.mjs','retention-1://app/']]) {
  test('existing virtual-graph unknown/capability probes: ' + loader, async () => {
    const view = await open(loader)
    if (loader === 'src/retentionAppHarness.mjs') {
      for (const target of ['./unknown.mjs','ORDER.md','node:fs'])
        assert.throws(() => view.resolve(target, prefix + 'AnalyseTab.jsx'), /Forbidden/)
      await assert.rejects(view.engine.import(prefix + 'unknown.mjs'), /ENOENT|Forbidden/)
    } else {
      for (const target of ['unknown.mjs','ORDER.md','node:fs','../supabase.js'])
        assert.throws(() => view.resolve(prefix + target, new URL(loader, root).href), /Unapproved/)
    }
  })
}

}
