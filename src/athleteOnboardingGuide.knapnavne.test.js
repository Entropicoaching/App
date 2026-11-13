// Klik-guidens knapnavne skal findes i live Hjem og passet (Entropi 2) (ordre 1269 og 1289).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ATHLETE_ONBOARDING_GUIDE_STEPS as steps } from './athleteOnboardingGuide.js'

const kilde = fil => readFileSync(new URL(fil, import.meta.url), 'utf8')
const komponenter = [
  './entropi2/home/QuickLogs.mjs', './entropi2/home/today/TodayCard.mjs', './entropi2/home/AthleteHome.mjs',
  './entropi2/session/sessionOverview.mjs', './entropi2/session/sessionModel.mjs', './athlete/DagensPasCard.jsx',
].map(kilde).join('\n')
const navneIGuiden = steps.flatMap(step => [...step.body.matchAll(/"([^"]+)"/g)].map(m => m[1]))
const findes = navn => komponenter.includes(`'${navn}'`) || komponenter.includes(`>${navn}<`) || komponenter.includes(`\`${navn} `)

test('guiden har 3 til 5 trin', () => {
  assert.ok(steps.length >= 3 && steps.length <= 5, String(steps.length))
})

test('guiden nævner de knapper, der ses på live Hjem og i loggen', () => {
  for (const navn of ['Udfyld dagsform', 'Dagsform', 'Start dagens pas', 'Overblik over passet', 'Som planlagt', 'Godkendt']) {
    assert.ok(navneIGuiden.includes(navn), `guiden nævner ikke ${navn}`)
  }
})

test('hvert knapnavn i anførselstegn i guiden findes i live komponenternes kilde', () => {
  for (const navn of navneIGuiden) assert.ok(findes(navn), `"${navn}" findes ikke i kilden`)
})

test('Parathed og Hele passet står ikke i guiden, da de kun findes i de gamle skærme', () => {
  const tekst = steps.map(step => [step.heading, step.body].join(' ')).join(' ')
  assert.doesNotMatch(tekst, /Parathed/)
  assert.doesNotMatch(tekst, /Hele passet/)
  assert.ok(!komponenter.includes('>Parathed<') && !komponenter.includes("'Parathed'"))
})

test('RPE-vælgeren nævnt i guiden findes på sætkortet', () => {
  const log = steps.find(step => step.key === 'log-saet').body
  assert.ok(log.includes('RPE'))
  assert.match(kilde('./athlete/DagensPasCard.jsx'), /Vælg RPE for sæt/)
})

test('ingen tekst i guiden er under 11 px (0.7rem)', () => {
  const jsx = kilde('./athlete/OnboardingGuide.jsx')
  const størrelser = [...jsx.matchAll(/fontSize:\s*'([\d.]+)(rem|px)'/g)].map(m => m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]))
  assert.ok(størrelser.length > 0)
  for (const px of størrelser) assert.ok(px >= 11, `tekst på ${px} px`)
  assert.ok(jsx.includes('Spring guiden over'))
})
