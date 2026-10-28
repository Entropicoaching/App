import { install } from './trin1Loader.mjs'
const hooks = install()
const { weekCases } = await import('./trin1WeekCases.mjs')
weekCases(false)
const { default: test } = await import('node:test')
test.after(() => hooks.deregister())
