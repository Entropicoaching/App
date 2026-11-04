// Hermetic fallback evidence, explicitly synthetic; this does not certify React.
import test from 'node:test'
import { loadBundNav } from './bundNavHarness.mjs'
import { navigationCases } from './bundNavCases.mjs'
const { BundNav, dispose } = await loadBundNav('synthetic')
test.after(dispose)
navigationCases(BundNav)
