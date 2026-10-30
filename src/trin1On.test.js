import { install } from './trin1Loader.mjs'
// The only code choice altered in this synthetic load is the release step.
const hooks = install({ trin: 1 })
const { weekCases } = await import('./trin1WeekCases.mjs')
weekCases(true)
const { default: test } = await import('node:test')
const { default: assert } = await import('node:assert/strict')
const { dataEnoughEnabled } = await import('./dataEnough.mjs')
test('profile 1: URL OFF values cannot disable the effective imported gate', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location')
  try {
    for (const search of ['', '?appData2=0', '?appData2=true', '?appData2=0&appData2=1']) {
      Object.defineProperty(globalThis, 'location', { configurable: true, value: { search } })
      assert.equal(dataEnoughEnabled(), true)
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'location', previous)
    else delete globalThis.location
  }
})
test.after(() => hooks.deregister())
