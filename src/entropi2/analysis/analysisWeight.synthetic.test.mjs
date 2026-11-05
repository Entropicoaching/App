import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import * as element from './reactElementFixture.mjs'
import { renderTree } from './testDom.mjs'

// Only React's element construction is substituted. All analysis/model imports
// are copied production modules. This does not claim real React validation.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react') return { url: new URL('./reactElementFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: Analysis } = await import('./Analysis.mjs')
hooks.deregister()
const id = 'synthetic-analysis-weight', now = new Date('2026-11-05T12:00:00Z')
const rows = [3, 4].map((day, i) => ({ athlete_id: id, logged_at: `2026-11-0${day}`, weight: 81.25 + i * 1.5 }))
const props = extra => ({ entropi2: true, athlete: { id }, now,
  fremgangLogs: [], historicalMealLogs: [], weightLogs: rows,
  weightStatus: { athleteId: id, state: 'ready' }, ...extra })
const view = p => renderTree(element.createElement(Analysis, p))
const find = (dom, marker) => dom.querySelectorAll(`[${marker}]`)[0]
const buttons = dom => dom.querySelectorAll('button')

test('regression: a failed read cannot present cached weight metrics; retry is visible without opening a fold', () => {
  const dom = view(props({ weightStatus: { athleteId: id, state: 'error' }, retryWeight() {} }))
  const notice = find(dom, 'data-analysis-weight-status')
  assert.ok(notice)
  assert.ok(dom.children.includes(notice), 'notice must have no collapsed ancestor')
  assert.equal(notice.querySelectorAll('p')[0].getAttribute('role'), 'alert')
  assert.match(notice.textContent, /Din vægt kunne ikke hentes/)
  assert.match(notice.textContent, /Hent igen/)
  assert.doesNotMatch(dom.textContent, /81,3|82,8|1,5 kg|dage med registreret kropsvægt|Vægtdata: seneste vejning/)
  assert.doesNotMatch(dom.textContent, /Dine registreringer kunne ikke hentes/)
})

test('loading, not-read, identity switch, ready, empty and unrelated training keep distinct displays', () => {
  for (const weightStatus of [null, { athleteId: 'synthetic-other', state: 'ready' }, { athleteId: id, state: 'loading' }]) {
    const dom = view(props({ weightStatus, retryWeight() {} }))
    assert.doesNotMatch(dom.textContent, /81,3|82,8|dage med registreret kropsvægt|seneste vejning/)
    if (weightStatus?.state === 'loading') {
      assert.match(dom.textContent, /Henter vægtdata/)
      assert.equal(buttons(find(dom, 'data-analysis-weight-status')).length, 0)
    } else {
      assert.equal(find(dom, 'data-analysis-weight-status'), undefined)
      assert.doesNotMatch(dom.textContent, /Vægtdata er ikke klar|Hent igen|kunne ikke hentes/)
    }
  }
  const ready = view(props())
  assert.match(ready.textContent, /Vægtdata: seneste vejning 04.11.2026/)
  assert.match(ready.textContent, /81,3 kg den 03.11.2026 til 82,8 kg den 04.11.2026/)
  assert.match(ready.textContent, /2 dage med registreret kropsvægt/)
  const empty = view(props({ weightLogs: [] }))
  assert.equal(find(empty, 'data-analysis-weight-date'), undefined)
  assert.equal(find(empty, 'data-analysis-weight-status'), undefined)
  assert.doesNotMatch(empty.textContent, /kunne ikke hentes|Hent igen|0 kg/)
  const training = view(props({ weightStatus: { athleteId: id, state: 'error' },
    fremgangLogs: [{ exercise_id: 'synthetic-ex', logged_at: '2026-11-04', weight: 100,
      reps_completed: 3, exercises: { name: 'Squat' } }] }))
  assert.ok(find(training, 'data-analysis-history'))
  assert.match(training.textContent, /300 kg × reps · 1 sæt/)
})

test('retry delegates once while pending, catches rejection and remains available afterwards', async () => {
  let calls = 0, reject
  const pending = new Promise((_, fail) => { reject = fail })
  const dom = view(props({ weightStatus: { athleteId: id, state: 'error' }, retryWeight: () => { calls++; return pending } }))
  const button = buttons(find(dom, 'data-analysis-weight-status'))[0]
  const target = { disabled: false }
  const first = button.dispatchEvent({ type: 'click', currentTarget: target })
  assert.equal(target.disabled, true)
  await button.dispatchEvent({ type: 'click', currentTarget: target })
  assert.equal(calls, 1)
  reject(Error('synthetic read rejected')); await first
  assert.equal(target.disabled, false)
  await button.dispatchEvent({ type: 'click', currentTarget: target })
  assert.equal(calls, 2)
})

test('strict OFF does not inspect weight status, retained data or retry', () => {
  for (const entropi2 of [undefined, false, 1, 'true']) assert.equal(Analysis({ entropi2,
    get weightStatus() { throw Error('OFF read') }, get weightLogs() { throw Error('OFF data') },
    get retryWeight() { throw Error('OFF retry') } }), null)
})

test('the gated host forwards the existing status and stable read callback exactly once', () => {
  const source = readFileSync(new URL('../../AthleteView.jsx', import.meta.url), 'utf8')
  const block = source.match(/\{e2Atlet && tab === 'fremgang' && \([\s\S]*?<Entropi2Analysis[\s\S]*?\/>/)[0]
  assert.equal((block.match(/weightStatus=\{weightStatus\}/g) ?? []).length, 1)
  assert.equal((block.match(/retryWeight=\{retryWeight\}/g) ?? []).length, 1)
})
