import { install } from './trin1Loader.mjs'
// The only code choice altered in this synthetic load is the release step.
const hooks = install({ trin: 1 })
const { weekCases } = await import('./trin1WeekCases.mjs')
weekCases(true)
const { default: test } = await import('node:test')
test.after(() => hooks.deregister())
