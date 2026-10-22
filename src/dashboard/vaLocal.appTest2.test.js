import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { initialLocalVideoState, localVideoTransition } from './vaLocalState.mjs'
import { sessionDocument, modelDocument } from './vaLocalDocuments.js'

// Strings only: never eval, mount, VM, browser, iframe or embedded script execution.
const csp = doc => {
  const match = /<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"[^>]*>/i.exec(doc)
  assert.ok(match, 'CSP meta required')
  return new Map(match[1].split(';').map(s => s.trim().split(/\s+/)).filter(a => a[0]).map(([k, ...v]) => [k, v]))
}
test('APP-TEST2: local page starts closed and frozen', () => {
  assert.deepEqual(initialLocalVideoState, { open: false, tool: 'session' })
  assert.equal(Object.isFrozen(initialLocalVideoState), true)
})
test('APP-TEST2: closed page ignores tool selection; open resets to session', () => {
  const s = { ...initialLocalVideoState }
  for (const action of ['model', 'fund', 'session', 'unknown']) assert.equal(localVideoTransition(s, action), s)
  assert.deepEqual(localVideoTransition({ open: true, tool: 'fund' }, 'open'), { open: true, tool: 'session' })
})
test('APP-TEST2: open page selects known tools and close resets without mutation', () => {
  const s = { open: true, tool: 'session' }
  for (const tool of ['session', 'model', 'fund']) assert.deepEqual(localVideoTransition(s, tool), { open: true, tool })
  assert.equal(localVideoTransition(s, 'unknown'), s)
  assert.deepEqual(localVideoTransition(s, 'close'), initialLocalVideoState)
  assert.equal(s.open, true)
})
test('APP-TEST2: documents are HTML strings with Danish language and blocked external channels', () => {
  for (const doc of [sessionDocument, modelDocument]) {
    assert.equal(typeof doc, 'string'); assert.match(doc, /^<!doctype html>/i); assert.match(doc, /<html lang="da">/)
    const policy = csp(doc)
    for (const key of ['default-src', 'connect-src', 'img-src', 'object-src', 'base-uri', 'form-action']) assert.deepEqual(policy.get(key), ["'none'"])
    assert.doesNotMatch(doc, /<script\b[^>]*\bsrc\s*=/i)
    assert.doesNotMatch(doc, /<(?:iframe|video|audio)\b/i)
  }
})
test('APP-TEST2: session CSP hashes bind every inline script byte', () => {
  const scripts = [...sessionDocument.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1])
  const policy = csp(sessionDocument).get('script-src')
  assert.ok(scripts.length > 0); assert.ok(policy)
  assert.equal(policy.includes("'unsafe-inline'"), false)
  const hashes = scripts.map(s => "'sha256-" + createHash('sha256').update(s, 'utf8').digest('base64') + "'")
  assert.deepEqual([...new Set(policy)].sort(), [...new Set(hashes)].sort())
})
test('APP-TEST2: model inline-script exception is explicit and does not authorize remote URLs', () => {
  assert.deepEqual(csp(modelDocument).get('script-src'), ["'unsafe-inline'"])
  assert.deepEqual(csp(modelDocument).get('media-src'), ["'none'"])
  assert.match(modelDocument, /syntetisk/i)
})
