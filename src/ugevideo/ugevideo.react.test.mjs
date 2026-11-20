// ORDRE 1953: kortene for coach og atlet, gengivet med React.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachUgevideo from './CoachUgevideo.mjs'
import AtletUgevideo from './AtletUgevideo.mjs'

test('coachens kort: ugevalg med næste uge forvalgt om fredagen, knap slået fra uden video', () => {
  const html = renderToStaticMarkup(h(CoachUgevideo, { client: {}, athlete: { id: 'a1' }, day: '2026-11-20', hent: async () => ({ videoer: [] }) }))
  assert.match(html, /aria-label="Ugevideo"/)
  assert.match(html, /role="radio" aria-checked="false"[^>]*>Denne uge \(16\. nov\.\)/)
  assert.match(html, /role="radio" aria-checked="true"[^>]*>Næste uge \(23\. nov\.\)/)
  assert.match(html, /type="file" accept="video\/\*"/)
  assert.match(html, /disabled="">Læg ugevideo</)
  assert.match(html, /Kun atleten og du kan se den/)
})

test('coachens kort vises ikke uden atlet', () => {
  assert.equal(renderToStaticMarkup(h(CoachUgevideo, { client: {}, athlete: null })), '')
})

test('atletens kort er tomt, indtil en video er hentet', () => {
  assert.equal(renderToStaticMarkup(h(AtletUgevideo, { client: {}, athleteId: 'a1', hent: async () => null })), '')
})
