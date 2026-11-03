// Udgivelse 1 runde 3: en funktion erklaeret i et <script type="module"> er ikke synlig
// for det almindelige script. Det almindelige script maa derfor aldrig kalde den.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('./videocoach.html', import.meta.url), 'utf8')
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .filter(([, attrs]) => !/\bsrc=/.test(attrs))
  .map(([, attrs, body]) => ({ module: /type="module"/.test(attrs), body }))
const classic = scripts.filter(s => !s.module).map(s => s.body).join('\n')
const modules = scripts.filter(s => s.module).map(s => s.body).join('\n')
const declared = body => new Set([...body.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]))

test('almindeligt script kalder ingen funktion, der kun er erklaeret i et modulscript', () => {
  const classicDecl = declared(classic)
  const onlyModule = [...declared(modules)].filter(name => !classicDecl.has(name))
  const leaks = onlyModule.filter(name => new RegExp(`(^|[^\\w$.])${name.replace('$', '\\$')}\\s*\\(`).test(classic))
  assert.deepEqual(leaks, [])
})

test('appData2VideoCurrent er erklaeret i det almindelige script og bruger kun dets egne hjaelpere', () => {
  assert.ok(declared(classic).has('appData2VideoCurrent'))
  assert.ok(!declared(modules).has('appData2VideoCurrent'))
  assert.match(classic, /const vcV3AnalysisIds = new WeakMap\(\)/)
  assert.match(classic, /function vcV3Uuid\(/)
})

test('appData2VideoCurrent giver stabilt id pr. sti og bevarer et givet id', () => {
  const start = classic.indexOf('function appData2VideoCurrent(')
  const end = classic.indexOf('\n}', start) + 2
  const src = classic.slice(start, end)
  let n = 0
  const fn = new Function('vcV3AnalysisIds', 'vcV3Uuid', `${src}; return appData2VideoCurrent`)(new WeakMap(), () => `uuid-${++n}`)
  const path = {}
  const a = fn(path, 'atlet-1')
  const b = fn(path, 'atlet-1')
  assert.equal(a.id, 'uuid-1')
  assert.equal(b.id, 'uuid-1')
  assert.equal(a.athlete_id, 'atlet-1')
  assert.equal(fn({}, 'atlet-1', 'givet').id, 'givet')
  assert.equal(fn(null, 'atlet-1').id, null)
})
