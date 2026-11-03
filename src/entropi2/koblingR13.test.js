// Entropi 2-kobling runde 13: K-R12 fund 1. Startdagsstemplet gælder kun med Entropi 2 tændt;
// den gamle ?coachMorgen=1-vej med Entropi 2 slukket beholder originalens kontrakt (dagen ved afslutning).
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readMorningSource, morningDay } from '../dashboard/coachMorningSource.mjs'

async function acrossMidnight(key, options) {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T22:59:50Z') })
  try {
    const startDay = morningDay()
    let release, data = {}
    const run = () => new Promise(resolve => { release = resolve })
    const pending = options === undefined
      ? readMorningSource(true, key, key === 'videos' ? null : ['syn-atlet'], f => { data = f(data) }, run)
      : readMorningSource(true, key, key === 'videos' ? null : ['syn-atlet'], f => { data = f(data) }, run, options)
    mock.timers.setTime(Date.parse('2026-11-02T23:00:05Z'))
    const endDay = morningDay()
    assert.notEqual(endDay, startDay, 'syntetisk forudsætning: dansk midnat er passeret')
    release({ data: [], error: null })
    await pending
    return { startDay, endDay, source: data[key] }
  } finally { mock.timers.reset() }
}

for (const key of ['messages', 'videos', 'logs']) {
  test(`fund 1, OFF (?coachMorgen=1 uden Entropi 2): ${key} stemples med dagen ved afslutning som originalen`, async () => {
    for (const options of [undefined, { startDay: false }, {}]) {
      const { endDay, source } = await acrossMidnight(key, options)
      assert.equal(source.day, endDay)
      assert.equal(source.state, 'ready')
    }
  })
  test(`fund 1, ON (Entropi 2): ${key} bærer startdagen`, async () => {
    const { startDay, source } = await acrossMidnight(key, { startDay: true })
    assert.equal(source.day, startDay)
    assert.equal(source.state, 'ready')
  })
}

test('fund 1: læserne giver kun startdag videre, når Entropi 2-sømmene er givet (flag ON)', () => {
  const src = readFileSync(new URL('../dashboard/laesninger.js', import.meta.url), 'utf8')
  assert.match(src, /const morningStartDay = \{ startDay: typeof entropi2CalendarRead === 'function' \|\| typeof entropi2ReadGate === 'function' \}/)
  assert.equal((src.match(/, morningStartDay\)/g) || []).length, 3)
})
