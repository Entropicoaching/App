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

test('ordre 2065: trin 2 lover kun det, klienten ser (pas i dag, senere eller intet)', async () => {
  const { onboardingGuideSteps } = await import('./athleteOnboardingGuide.js')
  const find = kontekst => onboardingGuideSteps(kontekst).find(step => step.key === 'find-session').body
  assert.match(find({ pas: 'i-dag' }), /"Start dagens pas"/)
  const senere = find({ pas: 'senere', dato: 'mandag den 30. november' })
  assert.match(senere, /første pas er mandag den 30. november/)
  assert.match(senere, /"Start næste pas"/)
  assert.match(senere, /under Program/)
  assert.doesNotMatch(senere, /Start dagens pas/)
  const intet = find({ pas: 'intet' })
  assert.doesNotMatch(intet, /Start dagens pas|Start næste pas/)
  assert.match(intet, /under Program/)
  for (const kontekst of [{ pas: 'i-dag' }, { pas: 'senere' }, { pas: 'intet' }]) assert.equal(onboardingGuideSteps(kontekst).length, 3)
})

test('ordre 2065: beregnGuideKontekst følger Hjems model og lander på Hjem, når der er et pas', async () => {
  const { beregnGuideKontekst } = await import('./athleteOnboardingGuide.js')
  const uge = (start, weekday) => ({ id: 'w', week_number: 1, start_date: start, sessions: [{ id: 's', week_id: 'w', weekday, title: 'Dag 1', session_order: 1, exercises: [{ id: 'e', session_id: 's', name: 'Squat', sets: 4, reps: '5', exercise_order: 1 }] }] })
  const now = new Date('2026-11-24T10:00:00Z')
  const ctx = (week, extra = {}) => beregnGuideKontekst({ allWeeks: week ? [week] : [], currentWeek: week, exerciseLogs: [], athlete: { id: 'a' }, now, ...extra })
  assert.deepEqual(ctx(uge('2026-11-23', 1)), { pas: 'i-dag', landing: 'hjem' })
  assert.deepEqual(ctx(uge('2026-11-30', 0)), { pas: 'senere', dato: 'mandag den 30. november', landing: 'hjem' })
  assert.deepEqual(ctx(null), { pas: 'intet', landing: 'hjem' })
  assert.deepEqual(beregnGuideKontekst(), { pas: 'intet', landing: 'hjem' })
})
