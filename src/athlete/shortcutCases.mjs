import test from 'node:test'
import assert from 'node:assert/strict'

export function shortcutCases(openSurface) {
  function fixture({ logged = false, program = null, reduced = false, mount = true } = {}) {
    const input = { sleep: '7,5', energy: 3, motivation: 4, stress: 2, soreness: 3, soreZones: ['Ryg'] }
    const history = [{ logged_date: '2026-10-24', readiness_score: 60 }]
    const state = { tab: 'program', mere: true, readiness: false, input, history, program,
      error: 'Kunne ikke gemme parathed. Tjek din forbindelse og prøv igen.',
      log: logged ? { logged_date: '2026-10-25', readiness_score: 65 } : null }
    const frames = [], events = []
    const ref = { current: null }
    const card = { focus: options => events.push(['focus', options]), scrollIntoView: options => events.push(['scroll', options]) }
    const options = { setTab: value => state.tab = value, setMereOpen: value => state.mere = value,
      setReadinessOpen: value => state.readiness = value, readinessCardRef: ref,
      requestFrame: callback => frames.push(callback), matchMedia: () => ({ matches: reduced }) }
    openSurface(options)
    if (mount) ref.current = card
    function flush() { while (frames.length) frames.shift()() }
    return { state, input, history, events, frames, ref, flush }
  }
  test('genvejen åbner parathed og lader Mere være lukket', () => {
    const f = fixture(); f.flush()
    assert.equal(f.state.tab, 'hjem'); assert.equal(f.state.readiness, true); assert.equal(f.state.mere, false)
  })
  test('uden program åbnes samme check-in', () => {
    const f = fixture({ program: null }); f.flush()
    assert.equal(f.state.readiness, true); assert.equal(f.state.program, null); assert.equal(f.state.mere, false)
  })
  test('udfyldt dag beholder resultat og historik og får fokus', () => {
    const f = fixture({ logged: true }); f.flush()
    assert.equal(f.state.readiness, true); assert.equal(f.state.log.readiness_score, 65)
    assert.strictEqual(f.state.history, f.history)
    assert.deepEqual(f.events[0], ['focus', { preventScroll: true }])
  })
  test('venter to frames så den fælles ref kan monteres', () => {
    const f = fixture(); assert.deepEqual(f.events, [])
    f.frames.shift()(); assert.deepEqual(f.events, [])
    f.flush(); assert.deepEqual(f.events.map(e => e[0]), ['focus', 'scroll'])
  })
  test('respekterer reduceret bevægelse', () => {
    const f = fixture({ reduced: true }); f.flush()
    assert.deepEqual(f.events.at(-1), ['scroll', { behavior: 'auto', block: 'start' }])
  })
  test('tåler at fladen er afmonteret', () => {
    const f = fixture({ mount: false }); assert.doesNotThrow(f.flush); assert.deepEqual(f.events, [])
  })
  test('åbning bevarer felter, udkastgrundlag og gemmefejl', () => {
    const f = fixture(); f.flush()
    assert.strictEqual(f.state.input, f.input); assert.strictEqual(f.state.history, f.history)
    assert.equal(f.state.input.sleep, '7,5'); assert.deepEqual(f.state.input.soreZones, ['Ryg'])
    assert.match(f.state.error, /Kunne ikke gemme/)
  })
}
