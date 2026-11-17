import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, act } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createRoot } from 'react-dom/client'
import Home from './AthleteHome.mjs'
import { createDocument, elements } from '../onboarding/firstVisitDom.mjs'

// Ordre 1602: nedtælling til stævne øverst på Entropi 2's Hjem. Genuine React, syntetiske data.
const NOW = new Date('2026-11-17T10:00:00Z')
const week = { id: 'synthetic-w', athlete_id: 'synthetic-a', start_date: '2026-11-16', week_number: 3, block_name: 'Styrke',
  sessions: [{ id: 'synthetic-s', title: 'Syntetisk pas', weekday: 1, exercises: [{ id: 'synthetic-e', name: 'Syntetisk løft', sets: 2 }] }] }
const props = (date, extra = {}) => ({ enabled: true, athlete: { id: 'synthetic-a', competition_date: date }, now: NOW,
  allWeeks: [week], currentWeek: week, exerciseLogs: [], storage: null, setTab() {}, ...extra })
const html = (date, extra) => renderToStaticMarkup(h(Home, props(date, extra)))
const forekomster = (markup, re) => (markup.match(re) || []).length

test('0, 1 og 23 dage giver rigtig tekst, én knap, mindst 44 px', () => {
  for (const [date, tekst] of [['2026-11-17', 'Stævne i dag'], ['2026-11-18', '1 dag til stævne'], ['2026-12-10', '23 dage til stævne']]) {
    const markup = html(date)
    assert.equal(forekomster(markup, /data-staevne-home/g), 1, date)
    assert.equal(forekomster(markup, new RegExp(tekst, 'g')), 1, date)
    assert.match(markup, /Ugens fokus: Styrke/)
    assert.match(markup.match(/<button[^>]*data-staevne-home[^>]*>/)[0], /min-height:44px/)
  }
})

test('nedtællingen står kun én gang og først på siden', () => {
  const markup = html('2026-12-10')
  assert.equal(forekomster(markup, /dage? til stævne|Stævne i dag/g), 1)
  assert.ok(markup.indexOf('data-staevne-home') < markup.indexOf('<h1'))
})

test('ingen dato, ugyldig dato og dato i fortiden skjuler knappen; uden blokkens navn kun nedtællingen', () => {
  for (const date of [null, undefined, '', '2026-11-16', '2025-01-01', 'ikke-en-dato', '2026-02-31'])
    assert.doesNotMatch(html(date), /data-staevne-home|til stævne|Stævne i dag/, String(date))
  const uden = html('2026-12-10', { currentWeek: { ...week, block_name: ' ' } })
  assert.match(uden, /23 dage til stævne/)
  assert.doesNotMatch(uden, /Ugens fokus/)
})

test('dage regnes i dansk dato, ikke UTC', () => {
  // 23:30 UTC 17. nov. er 00:30 18. nov. i København: stævne 18. nov. er i dag.
  assert.match(html('2026-11-18', { now: new Date('2026-11-17T23:30:00Z') }), /Stævne i dag/)
})

test('tryk åbner Stævne-fanen med setTab', async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const priorAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  const doc = createDocument(), createElement = doc.createElement, valgt = []
  doc.createElement = tag => {
    const el = createElement(tag)
    if (tag === 'select') Object.defineProperty(el, 'options', { get: () => el.children.filter(n => n.tagName === 'OPTION') })
    return el
  }
  const host = doc.createElement('div')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const root = createRoot(host)
  try {
    await act(async () => root.render(h(Home, props('2026-12-10', { setTab: tab => valgt.push(tab) }))))
    const knap = elements(host).filter(n => n.getAttribute('data-staevne-home') !== null)
    assert.equal(knap.length, 1)
    const event = { type: 'click', target: knap[0], button: 0, bubbles: true, defaultPrevented: false, preventDefault() {}, stopPropagation() {} }
    await act(async () => { host.events.get('click:capture')?.(event); host.events.get('click:bubble')(event) })
    assert.deepEqual(valgt, ['stævnedag'])
  } finally {
    await act(async () => root.unmount())
    for (const [k, d] of [['window', prior], ['IS_REACT_ACT_ENVIRONMENT', priorAct]]) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k]
  }
})
