import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const pathMap = JSON.parse(readFileSync(new URL('./source-map.json', import.meta.url), 'utf8'))
const moduleUrl = name => {
  const flat = new URL(name, import.meta.url)
  return (existsSync(flat) ? flat : new URL(pathMap[name].slice(4), import.meta.url)).href
}
const before = process.argv.includes('--before')
const entry = before ? './input-494-test-loader.mjs' : './test-loader.mjs'
const hooks = await import(before ? entry : './loader-hooks.mjs')
await import(entry)
test('L1: loader bruger den asynkrone register-kontrakt', () => {
  const source = readFileSync(new URL(entry, import.meta.url), 'utf8')
  assert.doesNotMatch(source, /registerHooks/)
  assert.match(source, /register\(/)
})
test('L2: relative importer bevarer fuld sti og kan ikke falde tilbage til samme filnavn', async () => {
  await assert.rejects(import('./absent/useVideoCoachBro.js'), { code: 'ERR_MODULE_NOT_FOUND' })
  if (before) return
  const parentURL = moduleUrl('HjemTab.jsx')
  const next = specifier => ({ url: `unresolved:${specifier}` })
  assert.deepEqual(hooks.resolve('./useVideoCoachBro.js', { parentURL }, next), { url: 'unresolved:./useVideoCoachBro.js' })
  assert.deepEqual(hooks.resolve('./laesninger.js', { parentURL }, next), { url: 'unresolved:./laesninger.js' })
  const dashboard = moduleUrl('videoReviewHandlinger.js')
  assert.equal(hooks.resolve('./useVideoCoachBro.js', { parentURL: dashboard }, next).url,
    moduleUrl('useVideoCoachBro.js'))
  assert.equal(hooks.resolve('../vcForenkl4.mjs', { parentURL }, next).url,
    new URL('./vcForenkl4.mjs', import.meta.url).href)
})
