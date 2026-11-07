// Two bounded integration probes. Real React runs with a lexical DOM window;
// copied product modules run in a closed VM with synthetic storage/transport.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import * as vm from 'node:vm'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { webcrypto } from 'node:crypto'
import { sessionReactDocument } from '../session/sessionQuickSetReactDom.mjs'
import * as nativeHost from '../../athlete/coachOwnTrainingFixture.mjs'
import Entropi2Kost from '../Entropi2Kost.mjs'
import { fixture, athleteId, date } from './atlet/daySession.fixture.mjs'
import { tableNames } from './coach/activation.fixture.mjs'
import { uuid } from './dailyReference.fixture.mjs'

if (!vm.SourceTextModule) {
  test('recovery compatibility: serial real React VM child', () => {
    const result = spawnSync(process.execPath, ['--max-old-space-size=256', '--experimental-vm-modules', '--test',
      '--test-concurrency=1', fileURLToPath(import.meta.url)], { encoding: 'utf8', env: {} })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /# tests 2\b|tests 2\b/)
    assert.match(result.stdout, /# pass 2\b|pass 2\b/)
  })
} else {
  const require = createRequire(import.meta.url), { act, createElement: h, StrictMode } = React
  const { useSyncExternalStore } = nativeHost
  const tick = () => new Promise(resolve => setImmediate(resolve))
  const propsOf = n => n[Object.keys(n).find(k => k.startsWith('__reactProps$'))]
  function host() {
    const document = sessionReactDocument(), container = document.createElement('div')
    document.body.append(container)
    const filename = require.resolve('react-dom/client').replace(/client\.js$/, 'cjs/react-dom-client.development.js')
    const module = { exports: {} }
    vm.compileFunction(readFileSync(filename, 'utf8'), ['module', 'exports', 'require', 'window', 'document', 'IS_REACT_ACT_ENVIRONMENT'],
      { filename })(module, module.exports, createRequire(filename), document.defaultView, document, true)
    return { document, container, dom: module.exports }
  }
  async function productModule(relative, storage, dom) {
    const sourceRoot = new URL('../../', import.meta.url).href
    const context = vm.createContext({ crypto: webcrypto, localStorage: storage, structuredClone, console,
      setTimeout, clearTimeout, queueMicrotask, URL, TextEncoder, TextDecoder })
    const modules = new Map()
    const namespace = (name, exports) => {
      const module = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
      }, { context })
      modules.set(name, module)
    }
    namespace('react', React); namespace('react-dom/client', dom)
    const get = url => {
      if (modules.has(url)) return modules.get(url)
      assert.ok(url.startsWith(sourceRoot) && !url.endsWith('/supabase.js'), 'Only copied source and synthetic client')
      const module = new vm.SourceTextModule(readFileSync(fileURLToPath(url), 'utf8'), { context, identifier: url,
        initializeImportMeta(meta) { meta.url = url },
        importModuleDynamically: async (specifier, ref) => {
          const child = get(specifier.startsWith('.') ? new URL(specifier, ref.identifier).href : specifier)
          if (child.status === 'unlinked') await child.link(link)
          if (child.status === 'linked') await child.evaluate()
          return child
        } })
      modules.set(url, module); return module
    }
    const link = (specifier, ref) => get(specifier.startsWith('.') ? new URL(specifier, ref.identifier).href : specifier)
    const module = get(new URL(relative, import.meta.url).href)
    await module.link(link); await module.evaluate(); return module.namespace
  }

  test('native fixture store hook subscribes, updates and cleans up; live select values and honest SSR content', async () => {
    assert.strictEqual(useSyncExternalStore, React.useSyncExternalStore)
    const f = host(), root = f.dom.createRoot(f.container), listeners = new Set()
    let snapshot = { phase: 'idle', value: 'first' }, subscriptions = 0, cleanups = 0
    const subscribe = notify => { subscriptions++; listeners.add(notify); return () => { cleanups++; listeners.delete(notify) } }
    const read = () => snapshot
    function Consumer() {
      const current = useSyncExternalStore(subscribe, read, read)
      return h('div', null, h('p', null, current.phase), h('select', { value: current.value, onChange() {} },
        h('optgroup', { label: 'Group' }, h('option', { value: 'first' }, 'First'), h('option', { value: 'second' }, 'Second'))))
    }
    try {
      await act(async () => { root.render(h(StrictMode, null, h(Consumer))); await tick() })
      assert.match(f.container.textContent, /idle/); assert.doesNotMatch(f.container.textContent, /ready/)
      assert.equal(listeners.size, 1)
      const select = f.container.querySelector('select'), options = select.options
      assert.equal(options.length, 2); assert.equal(select.value, 'first'); assert.equal(select.selectedIndex, 0)
      await act(async () => { snapshot = { phase: 'load-error', value: 'second' }; for (const notify of listeners) notify(); await tick() })
      assert.match(f.container.textContent, /load-error/); assert.equal(select.value, 'second'); assert.equal(options[1].selected, true)
      assert.equal(options[0].selected, false)
      const option = f.document.createElement('option'); option.textContent = '  Plain   option  '
      select.append(option); assert.equal(options.length, 3); assert.equal(options.item(2), option)
      assert.equal(option.value, 'Plain option'); select.value = 'Plain option'; assert.equal(select.selectedIndex, 2)
      option.remove(); assert.equal(options.length, 2); select.value = 'absent'; assert.equal(select.selectedIndex, -1)
      assert.equal(select.value, '')
      const html = renderToStaticMarkup(h(Entropi2Kost, { enabled: true, athlete: { id: athleteId }, date }))
      assert.match(html, /Kostlog og vejning/); assert.match(html, /Henter kostlog og vejning…/)
      assert.match(html, /dagens mad og vejning/); assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /100%|Spist som planlagt/)
    } finally { await act(async () => root.unmount()) }
    assert.equal(listeners.size, 0); assert.equal(subscriptions, cleanups)
  })

  test('isolated mounted current day keeps manual/search/week drafts and hidden inert tracker through all future previews', async () => {
    const f = fixture(); f.approve()
    const days = ['2026-11-06', '2026-11-07', '2026-11-08']
    for (const [i, day] of days.entries()) {
      const version = structuredClone(f.plan.data[tableNames[1]][0])
      Object.assign(version, { id: uuid(900 + i), version_no: i + 2, effective_from: day,
        portion_guidance: `Råd ${day}\nVæske, æble og timing`, meals: version.meals.map(m => ({ ...m, name: `${day} ${m.name}` })) })
      f.plan.data[tableNames[1]].push(version)
      f.plan.data[tableNames[2]].push({ ...f.plan.data[tableNames[2]][0], version_id: version.id })
    }
    f.rows.push({ id: 'retention-row', athlete_id: athleteId, date, meal: 'Eksisterende måltid', kcal: 170, protein: 0, carb: 0, fat: 0 })
    const ui = host(), root = ui.dom.createRoot(ui.container)
    const { default: Entry } = await productModule('../Entropi2Kost.mjs', f.storage, ui.dom)
    const props = { enabled: true, athlete: { id: athleteId }, date, currentDay: () => date, client: f.client,
      foods: [{ id: 'first', name: 'Første', kcal100: 100, protein100: 0, carb100: 0, fat100: 0 },
        { id: 'chosen', name: 'Øllebrød, ÆBLE', kcal100: 200, protein100: 0, carb100: 20, fat100: 0, isCustom: true, unit_label: 'skål', unit_grams: 80 }],
      weightLogs: [], weightStatus: { athleteId, state: 'ready' } }
    const all = selector => ui.container.querySelectorAll(selector)
    const key = value => all('[data-focus]').find(n => n.getAttribute('data-focus') === value)
    const input = (name, value, event = 'input') => { const n = key(name); assert.ok(n, name); n.value = value; n.dispatch(event, { target: n }); return n }
    const click = async label => { const n = all('button').find(b => b.textContent === label); assert.ok(n, label); await act(async () => { n.click(); await tick() }) }
    const show = async () => act(async () => { root.render(h(StrictMode, null, h(Entry, props))); await tick() })
    try {
      await show(); await click('Gem som skabelon: Eksisterende måltid')
      const fold = key('week-plan'); assert.ok(fold)
      await act(async () => { fold.open = true; fold.dispatch('toggle'); await tick() })
      for (let i = 0; i < 100 && !key('week-plan-add-0'); i++) await act(async () => { await new Promise(r => setTimeout(r, 5)) })
      const nested = key('week-plan-add-0'); assert.ok(nested, 'actual lazy week planner mounted')
      key('log-form').open = true
      input('field-Måltid', 'Ugemt æble <&>'); input('field-Energi (kcal)', '125,5')
      input('field-Protein (g)', '0'); input('field-Kulhydrat (g)', '0'); input('field-Fedt (g)', '2,5')
      input('food-search', 'øLLEBRØD, æble')
      input('food-choice', '1', 'change'); input('unit-choice', '1', 'change'); input('field-Mængde', '1,25')
      const manual = key('field-Måltid'), search = key('food-search')
      const tracker = all('[data-entropi2-kost]')[0], storage = [...f.values], rows = structuredClone(f.rows)
      const localWrites = f.writes.length, calls = f.calls.length
      const retainedSubmit = manual.parentElement.parentElement
      for (const day of [...days, date]) {
        const picker = all('select').find(n => n.getAttribute('aria-label') === 'Vælg plandato')
        await act(async () => { picker.value = day; propsOf(picker).onChange({ currentTarget: picker }); await tick() })
        if (day !== date) {
          const preview = all('section').find(n => n.getAttribute('aria-label') === 'Kommende kostplan')
          assert.ok(preview); assert.match(preview.textContent, new RegExp('Råd ' + day))
          assert.equal(preview.querySelectorAll('input,form').length, 0)
          assert.deepEqual(preview.querySelectorAll('button').map(n => n.textContent), ['Hent planen igen'])
          assert.equal(tracker.parentElement.parentElement.getAttribute('hidden'), '')
          assert.equal(tracker.parentElement.parentElement.getAttribute('inert'), '')
        }
        assert.ok(all('[data-entropi2-kost]')[0] === tracker, 'tracker identity'); assert.ok(key('field-Måltid') === manual, 'manual identity')
        assert.equal(manual.value, 'Ugemt æble <&>'); assert.ok(key('food-search') === search, 'search identity')
        assert.equal(search.value, 'øLLEBRØD, æble'); assert.equal(key('food-choice').value, '1')
        assert.equal(key('unit-choice').value, '1'); assert.equal(key('field-Mængde').value, '1,25')
        assert.equal(key('field-Energi (kcal)').value, '125,5'); assert.equal(key('field-Protein (g)').value, '0')
        assert.ok(key('week-plan-add-0') === nested, 'nested week identity'); assert.equal(fold.open, true)
        assert.deepEqual([...f.values], storage); assert.equal(f.writes.length, localWrites)
        assert.deepEqual(f.rows, rows); assert.equal(f.calls.length, calls); assert.equal(f.plan.writes().length, 0)
      }
      props.enabled = false; await show()
      await act(async () => { retainedSubmit.dispatch('submit'); await tick() })
      assert.equal(ui.container.textContent, ''); assert.deepEqual(f.rows, rows)
      assert.equal(f.calls.filter(c => c.action !== 'select').length, 0)
    } finally { await act(async () => { root.unmount(); await tick() }) }
  })
}
