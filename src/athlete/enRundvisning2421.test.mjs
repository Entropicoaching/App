// Ordre 2421: en ny atlet moeder én rundvisning. Guiden (gennemfoert eller sprunget) markerer Hjem-turen "Trin 1 af 4" som set
// lokalt, mens athlete-rækken endnu mangler onboarding_completed_at. Atlet der har set guiden foer, og genaabning, aendres ikke.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AthleteHome from '../entropi2/home/AthleteHome.mjs'
import { firstVisitKey, markFirstVisitAfterGuide } from '../entropi2/onboarding/firstVisitState.mjs'

const tur = /data-home-onboarding|Trin 1 af 4/
const butik = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m } }
const hjem = (athlete, storage) => renderToStaticMarkup(h(AthleteHome, { enabled: true, athlete, today: '2026-11-24',
  now: new Date('2026-11-24T12:00:00Z'), allWeeks: [], currentWeek: undefined, exerciseLogs: [], storage, setTab() {}, onStartSession() {} }))

test('2421: ny atlet gennemfoerer eller springer guiden over: Hjem-turen er markeret set og vises ikke', () => {
  for (const onboarding_completed_at of [null, undefined]) {
    const atlet = { id: 'synthetic-athlete', name: 'Testfornavn', onboarding_completed_at }, lager = butik()
    assert.match(hjem(atlet, lager), tur)
    assert.equal(markFirstVisitAfterGuide(atlet, lager), true)
    assert.equal(lager.m.get(firstVisitKey(atlet.id)), '1')
    assert.doesNotMatch(hjem(atlet, lager), tur)
  }
})

test('2421: atlet der har set guiden foer i dag aendres ikke, og genaabning skriver intet', () => {
  const lager = butik()
  assert.equal(markFirstVisitAfterGuide({ id: 'synthetic-athlete', onboarding_completed_at: '2026-11-01T10:00:00Z' }, lager), false)
  assert.equal(lager.m.size, 0)
})

test('2421: atlet uden gyldigt id eller uden lager faar ingen skrivning og ingen fejl', () => {
  assert.equal(markFirstVisitAfterGuide({ id: null, onboarding_completed_at: null }, butik()), false)
  assert.equal(markFirstVisitAfterGuide({ id: 'synthetic-athlete', onboarding_completed_at: null }, null), false)
})

test('2421: Hjem uden at guiden er gennemgaaet viser turen som foer (2035f)', () => {
  assert.match(hjem({ id: 'synthetic-athlete', name: 'Testfornavn' }, butik()), tur)
})
