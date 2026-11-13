// Klik-guidens knapnavne skal findes i live Hjem-komponenternes kilde (ordre 1269).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ATHLETE_ONBOARDING_GUIDE_STEPS as steps } from './athleteOnboardingGuide.js'

const kilde = fil => readFileSync(new URL(fil, import.meta.url), 'utf8')
const komponenter = [
  './athlete/DagensPasCard.jsx', './athlete/EnkelHjemTab.jsx', './athlete/PasOverblik.jsx', './athlete/dagensPasLayout.mjs',
].map(kilde).join('\n')

test('guiden har 3 til 5 trin', () => {
  assert.ok(steps.length >= 3 && steps.length <= 5, String(steps.length))
})

test('hvert knapnavn i anførselstegn i guiden findes i komponenternes kilde', () => {
  const navne = steps.flatMap(step => [...step.body.matchAll(/"([^"]+)"/g)].map(m => m[1]))
  for (const navn of ['Hele passet', 'Godkendt', 'Parathed']) assert.ok(navne.includes(navn), `guiden nævner ikke ${navn}`)
  for (const navn of navne) {
    assert.ok(komponenter.includes(`>${navn}<`) || komponenter.includes(`'${navn}'`), `knappen "${navn}" findes ikke i kilden`)
  }
})

test('RPE-vælgeren nævnt i guiden findes på sætkortet', () => {
  const log = steps.find(step => step.key === 'log-saet').body
  assert.ok(log.includes('RPE'))
  assert.match(kilde('./athlete/DagensPasCard.jsx'), /Vælg RPE for sæt/)
})
