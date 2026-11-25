import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AfbrudtVideo, { afbrudtVideo, lukAfbrudtVideo, AFBRUDT_VIDEO_TEKST } from './AfbrudtVideo.mjs'
import { recordSilentFail, clearPendingSilentFails } from '../../athleteSilentFailLog.js'

// ORDRE 2367v: varslet om en afbrudt videoupload står på Entropi 2's Hjem (toast-pladsen tegnes ikke der).
const ATLET = 'synthetic-atlet'
const NOW = Date.parse('2026-11-25T20:00:00Z')
function lager() {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }
}

test('vises kun for en ventende afbrudt upload, og kun til atleten har lukket netop den', () => {
  const storage = lager()
  assert.equal(afbrudtVideo(ATLET, storage, NOW), null)
  assert.equal(afbrudtVideo(null, storage, NOW), null)
  recordSilentFail(ATLET, 'silent:weight-log-failed', storage, '2026-11-25T19:00:00Z')
  assert.equal(afbrudtVideo(ATLET, storage, NOW), null, 'andre stille fejl viser intet')
  recordSilentFail(ATLET, 'silent:video-upload-interrupted', storage, '2026-11-25T19:30:00Z')
  const entry = afbrudtVideo(ATLET, storage, NOW)
  assert.deepEqual(entry, { code: 'silent:video-upload-interrupted', at: '2026-11-25T19:30:00.000Z' })
  assert.equal(afbrudtVideo('synthetic-anden', storage, NOW), null, 'kun den viste atlet')
  lukAfbrudtVideo(ATLET, entry, storage)
  assert.equal(afbrudtVideo(ATLET, storage, NOW), null, 'lukket')
  recordSilentFail(ATLET, 'silent:video-upload-interrupted', storage, '2026-11-25T19:45:00Z')
  assert.equal(afbrudtVideo(ATLET, storage, NOW)?.at, '2026-11-25T19:45:00.000Z', 'en ny afbrydelse vises igen')
  clearPendingSilentFails(ATLET, storage)
  assert.equal(afbrudtVideo(ATLET, storage, NOW), null, 'væk, når næste videorække er bekræftet')
})

test('ældre end 7 dage, manglende eller kastende storage viser intet og kaster ikke', () => {
  const storage = lager()
  recordSilentFail(ATLET, 'silent:video-upload-interrupted', storage, '2026-11-01T19:30:00Z')
  assert.equal(afbrudtVideo(ATLET, storage, NOW), null)
  assert.equal(afbrudtVideo(ATLET, null, NOW), null)
  assert.equal(afbrudtVideo(ATLET, undefined, NOW), null, 'uden localStorage i node')
  const kaster = { getItem() { throw Error('synthetic') }, setItem() { throw Error('synthetic') } }
  assert.equal(afbrudtVideo(ATLET, kaster, NOW), null)
  assert.doesNotThrow(() => lukAfbrudtVideo(ATLET, { at: '2026-11-25T19:30:00.000Z' }, kaster))
})

test('kortet tegnes med teksten, rolle alert og en Luk-knap; uden afbrydelse tegnes intet', () => {
  const storage = lager()
  assert.equal(renderToStaticMarkup(h(AfbrudtVideo, { athleteId: ATLET, storage })), '')
  recordSilentFail(ATLET, 'silent:video-upload-interrupted', storage)
  const markup = renderToStaticMarkup(h(AfbrudtVideo, { athleteId: ATLET, storage }))
  assert.match(markup, /role="alert"/)
  assert.match(markup, /data-afbrudt-video/)
  assert.ok(markup.includes(AFBRUDT_VIDEO_TEKST))
  assert.match(markup, /<button[^>]*type="button"[^>]*>Luk<\/button>/)
  assert.match(markup.match(/<button[^>]*>/)[0], /min-height:44px/)
  assert.equal(renderToStaticMarkup(h(AfbrudtVideo, { athleteId: ATLET, storage: null })), '', 'skrivebeskyttet storage: intet')
})

test('Hjem tegner kortet for atleten og coachens egen træning, ikke i coachens forhåndsvisning', () => {
  const hjem = readFileSync(new URL('./HomeSession.mjs', import.meta.url), 'utf8')
  assert.match(hjem, /import AfbrudtVideo from '\.\/AfbrudtVideo\.mjs'/)
  assert.match(hjem, /athleteId && props\.readOnly !== true &&\s+h\(AfbrudtVideo, \{ key: `afbrudt-video-\$\{athleteId\}`, athleteId, storage: props\.storage \}\)/)
  assert.ok(hjem.indexOf('h(AfbrudtVideo') < hjem.indexOf('h(AtletUgevideo'), 'øverst, før ugevideoen')
})
