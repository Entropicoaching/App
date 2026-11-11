import { test } from 'node:test'
import assert from 'node:assert/strict'
import process from 'node:process'
import { shouldReloadOnControllerChange, nudgeServiceWorker } from './appUpdate.js'

// ORDRE 167 · commit 2 — Login (og strukturelt hele appens skal) genindlæste
// sig selv midt i den ALLERFØRSTE sideindlæsning: self.clients.claim() i
// public/sw.js's activate-håndtering fyrer controllerchange for enhver klient
// der lige har registreret workeren for første gang, ikke kun ved en ægte
// deploy-afløsning. Se docs/RAPPORT-167-DEL1.md for målingen der fandt det.

test('en ny bruger uden en tidligere service worker (hadController=false) udløser IKKE et genload', () => {
  assert.equal(shouldReloadOnControllerChange(false, false), false)
})

test('en ægte afløsning af en tidligere aktiv worker (hadController=true) udløser et genload', () => {
  assert.equal(shouldReloadOnControllerChange(true, false), true)
})

test('et genload allerede i gang (refreshing=true) udløser ikke et andet, selv ved en ægte afløsning', () => {
  assert.equal(shouldReloadOnControllerChange(true, true), false)
})

test('en ny bruger med et genload "i gang" (umuligt i praksis, men skal stadig være falsk) udløser ikke', () => {
  assert.equal(shouldReloadOnControllerChange(false, true), false)
})

// Generalprøven (ordre 80): mens en ny service worker installeres, afviser reg.update() med
// InvalidStateError. Den afvisning må ikke slippe ud som en ufanget browserfejl.
test('en afvist reg.update() fanges, og getRegistration-fejl fanges også', async () => {
  const loose = []
  const onRejection = reason => loose.push(reason)
  process.on('unhandledRejection', onRejection)
  try {
    const invalid = Object.assign(new Error('The object is in an invalid state.'), { name: 'InvalidStateError' })
    await nudgeServiceWorker({ getRegistration: async () => ({ update: () => Promise.reject(invalid) }) })
    await nudgeServiceWorker({ getRegistration: () => Promise.reject(invalid) })
    await nudgeServiceWorker(undefined)
    await new Promise(resolve => setTimeout(resolve, 20))
    assert.deepEqual(loose, [])
  } finally { process.off('unhandledRejection', onRejection) }
})
