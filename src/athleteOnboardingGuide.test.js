import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATHLETE_ONBOARDING_GUIDE_STEPS,
  clampOnboardingGuideStep,
  hasCompletedOnboardingGuide,
  isLastOnboardingGuideStep,
  totalOnboardingGuideSteps,
} from './athleteOnboardingGuide.js'

test('guiden har faa trin — for mange peger paa ingenting', () => {
  // "Vaelg hellere for faa end for mange" (ORDRE 38). Laas et loft fast saa en
  // fremtidig tilfoejelse skal vaere et bevidst valg, ikke en tilfaeldig vaekst.
  assert.ok(ATHLETE_ONBOARDING_GUIDE_STEPS.length >= 3 && ATHLETE_ONBOARDING_GUIDE_STEPS.length <= 5,
    `forventede 3-5 trin, fik ${ATHLETE_ONBOARDING_GUIDE_STEPS.length}`)
  assert.equal(totalOnboardingGuideSteps(), ATHLETE_ONBOARDING_GUIDE_STEPS.length)
})

test('foerste trin er intro-varianten, resten har heading + body', () => {
  assert.equal(ATHLETE_ONBOARDING_GUIDE_STEPS[0].variant, 'intro')
  for (const step of ATHLETE_ONBOARDING_GUIDE_STEPS.slice(1)) {
    assert.equal(typeof step.heading, 'string')
    assert.ok(step.heading.length > 0)
  }
  for (const step of ATHLETE_ONBOARDING_GUIDE_STEPS) {
    assert.equal(typeof step.body, 'string')
    assert.ok(step.body.length > 0)
  }
})

test('teksten holder Marcs stil — ingen udraabstegn, "velkommen ombord" eller tankestreger', () => {
  for (const step of ATHLETE_ONBOARDING_GUIDE_STEPS) {
    const text = [step.heading, step.body].filter(Boolean).join(' ')
    assert.doesNotMatch(text, /!/, `trin "${step.key}" har udraabstegn`)
    assert.doesNotMatch(text, /velkommen ombord/i, `trin "${step.key}" siger "velkommen ombord"`)
    assert.doesNotMatch(text, /[—–]/, `trin "${step.key}" har en tankestreg`)
  }
})

test('isLastOnboardingGuideStep peger kun paa det sidste indeks', () => {
  const last = ATHLETE_ONBOARDING_GUIDE_STEPS.length - 1
  for (let i = 0; i < last; i++) assert.equal(isLastOnboardingGuideStep(i), false)
  assert.equal(isLastOnboardingGuideStep(last), true)
  assert.equal(isLastOnboardingGuideStep(last + 5), true, 'et indeks forbi enden regnes stadig som sidste trin')
})

test('clampOnboardingGuideStep holder sig inden for trinnene', () => {
  assert.equal(clampOnboardingGuideStep(-3), 0)
  assert.equal(clampOnboardingGuideStep(0), 0)
  assert.equal(clampOnboardingGuideStep(999), ATHLETE_ONBOARDING_GUIDE_STEPS.length - 1)
  assert.equal(clampOnboardingGuideStep(undefined), 0)
  assert.equal(clampOnboardingGuideStep(Number.NaN), 0)
})

test('hasCompletedOnboardingGuide laeser den server-gemte tilstand, ikke browseren', () => {
  assert.equal(hasCompletedOnboardingGuide(null), false)
  assert.equal(hasCompletedOnboardingGuide(undefined), false)
  assert.equal(hasCompletedOnboardingGuide({}), false, 'en kolonne der ikke findes endnu (foer migration) skal ikke krashe eller taelle som gennemfoert')
  assert.equal(hasCompletedOnboardingGuide({ onboarding_completed_at: null }), false)
  assert.equal(hasCompletedOnboardingGuide({ onboarding_completed_at: '2026-09-04T10:00:00Z' }), true)
})
