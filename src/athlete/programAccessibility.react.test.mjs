// Discovered by the app's npm test. React and ReactDOM must resolve normally.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installProgramReactLoader } from '../entropi2/program/blok/programReactLoader.mjs'
import { accessibilityFixture, sessionName, setName, inputKey, completeLogs } from './programAccessibilityFixture.mjs'
installProgramReactLoader()
const { default: Program } = await import('./ProgramTab.jsx')
const render = extra => renderToStaticMarkup(createElement(Program, accessibilityFixture(extra)))
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const namedTag = (html, tag, name) => {
  const matches = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*aria-label="${escape(name)}"[^>]*>`, 'g'))]
  assert.equal(matches.length, 1, name)
  return matches[0][0]
}

test('real React F1: native disclosure buttons, expanded target and separate sibling actions', () => {
  const html = render()
  assert.match(namedTag(html, 'button', sessionName(1)), /type="button"/)
  assert.match(namedTag(html, 'button', sessionName(1)), /aria-expanded="true"/)
  assert.match(namedTag(html, 'button', sessionName(2)), /aria-expanded="false"/)
  const panel = /aria-controls="([^"]+)"/.exec(namedTag(html, 'button', sessionName(1)))[1]
  assert.ok(html.includes(`id="${panel}"`))
  assert.ok(namedTag(html, 'button', `Auto-udfyld · ${sessionName(1)}`))
  assert.ok(namedTag(html, 'button', `Spring resten over · ${sessionName(1)}`))
  // Catch invalid nested actions without substituting a React or DOM implementation.
  let depth = 0
  for (const tag of html.matchAll(/<\/?button\b[^>]*>/g)) {
    if (tag[0].startsWith('</')) depth--
    else { assert.equal(depth, 0, 'buttons cannot contain another button'); depth++ }
  }
  assert.equal(depth, 0)
  const closed = render({ progOpenSession: null })
  assert.doesNotMatch(closed, /<input\b|<textarea\b|aria-expanded="true"/)
  assert.match(html, /Næste pas/)
  assert.match(html, /I dag/)
})

test('real React F3/F5: scoped focus CSS and distinct names for repeated fields/actions', () => {
  const html = render()
  const names = [...html.matchAll(/<(?:input|textarea)\b[^>]*aria-label="([^"]+)"/g)].map(m => m[1])
  assert.equal(names.length, 12)
  assert.equal(new Set(names).size, 12)
  for (const exercise of [1, 2]) for (const set of [1, 2]) {
    for (const field of ['Vægt', 'Reps', 'Note']) assert.ok(namedTag(html, 'input', `${field} · ${setName(exercise, set)}`))
    for (const action of ['Log sæt', 'Spring over', 'Hvad er RPE?']) assert.ok(namedTag(html, 'button', `${action} · ${setName(exercise, set)}`))
  }
  assert.match(html, /\[data-program-accessible\] :is\(input, textarea, select, button\):focus-visible/)
  assert.match(html, /outline: 3px solid #c8923a !important/)
  assert.match(html, /outline-offset: 3px/)
  assert.match(html, /background:#1c1c18/)
})

test('real React F5: RPE, feedback and saved/error status describe actual state', () => {
  const key = inputKey(1, 1)
  const rpe = render({ openRpePicker: key, logInputs: { [key]: { rpe: '7', note: '', weight: '', reps: '5' } } })
  assert.match(namedTag(rpe, 'button', `Vælg RPE 7 · ${setName(1, 1)}`), /aria-expanded="true"/)
  assert.match(namedTag(rpe, 'button', `RPE 7 · ${setName(1, 1)}`), /aria-pressed="true"/)
  assert.match(namedTag(rpe, 'button', `RPE 8 · ${setName(1, 1)}`), /aria-pressed="false"/)
  assert.match(rpe, />7 ✓<\/button>/)
  const saved = render({ exerciseLogs: completeLogs(), feedbackInputs: { 'session-1-0': { rating: 4 } }, setConfirm: { [key]: 'saved' } })
  assert.match(saved, /Gennemført ✓/)
  assert.match(saved, /role="status" aria-atomic="true"/)
  assert.ok(namedTag(saved, 'button', `Gemt ✓, opdatér sæt · ${setName(1, 1)}`))
  assert.match(namedTag(saved, 'button', `Vurder træningen 4 af 5 · ${sessionName(1)}`), /aria-pressed="true"/)
  assert.ok(namedTag(saved, 'textarea', `Kommentar til træningsfeedback · ${sessionName(1)}`))
  const failed = render({ setConfirm: { [key]: 'error' } })
  assert.match(failed, /Ikke gemt\. Prøv igen/)
  assert.doesNotMatch(failed, /Gemt ✓|Træningsfeedback gemt/)
})

test('real React OFF and read-only retain existing gates and never introduce write controls', () => {
  for (const entropi2 of [false, null, 0, 1, 'true']) {
    const html = render({ entropi2 })
    assert.doesNotMatch(html, /data-program-accessible|<style>|Vælg RPE|aria-expanded=/)
    assert.match(html, /aria-label="Vægt, sæt 1"/)
  }
  const readOnly = render({ readOnly: true })
  assert.doesNotMatch(readOnly, /<input\b|<textarea\b|aria-label="Log sæt/)
})
