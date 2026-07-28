import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { sanitizeVideoCoachFeedbackEvidence } from '../src/videoCoachFeedbackEvidence.js'
import { videoCoachFeedbackQuality } from '../src/videoCoachFeedbackQuality.js'

const strong = videoCoachFeedbackQuality({
  works: [{ text: 'Bundpositionen gentages fra rep til rep.' }],
  focus: [{ text: 'Overkroppen falder frem i starten af opstigningen.' }],
  next_set: [{ text: 'Bevar trykket gennem foden, mens hofte og skuldre rejser sig sammen.' }],
})
assert.equal(strong.level, 'strong')
assert.equal(strong.canShare, true)

const missingAction = videoCoachFeedbackQuality({ focus: 'Farten falder i den svære del.' })
assert.equal(missingAction.canShare, false)
assert.match(missingAction.detail, /handling til næste sæt/)

const repeated = videoCoachFeedbackQuality({
  focus: 'Hold stangen tæt og spænd lats',
  next_set: 'Hold stangen tæt og spænd lats',
})
assert.equal(repeated.canShare, false)
assert.match(repeated.detail, /omsætter observationen/)

const competingCues = videoCoachFeedbackQuality({
  focus: 'Stanglinjen flytter sig fra kroppen.',
  next_set: 'Hold stangen tæt.\nSkub gulvet væk.',
})
assert.equal(competingCues.canShare, false)
assert.match(competingCues.detail, /prioriteret cue/)

const review = videoCoachFeedbackQuality({
  focus: 'Farten falder i den svære del.',
  next_set: 'Et bedre opspænd ved 55% sticking point.',
})
assert.equal(review.canShare, true)
assert.equal(review.needsReview, true)
assert.equal(review.warnings.length, 3)

const html = fs.readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8')
const modelMatch = html.match(/\/\/ COACH_FEEDBACK_MODEL_START([\s\S]*?)\/\/ COACH_FEEDBACK_MODEL_END/)
assert.ok(modelMatch, 'Det prioriterede feedbacklag skal kunne udtrækkes')
const context = {}
vm.runInNewContext(`${modelMatch[1]}; this.buildCoachFeedback = buildCoachFeedback`, context)

const evidenceMatch = html.match(/\/\/ COACH_FEEDBACK_EVIDENCE_START([\s\S]*?)\/\/ COACH_FEEDBACK_EVIDENCE_END/)
assert.ok(evidenceMatch, 'Feedbackens coach-only målegrundlag skal kunne udtrækkes')
vm.runInNewContext(`${evidenceMatch[1]}; this.vcV3FeedbackEvidence = vcV3FeedbackEvidence`, context)

const deadlift = context.buildCoachFeedback('Dødløft', {
  driftCm: 6.2,
  dipPct: 70,
  lossPct: 24,
  lowConfPct: 2,
})
assert.equal(deadlift.primary.title, 'Tydelig udtrætning over sættet')
assert.match(deadlift.athlete.next, /stoppe sættet|reducere reps|længere pause/)

const uncertain = context.buildCoachFeedback('Squat', { lowConfPct: 22, driftCm: 7 })
assert.equal(uncertain.primary.title, 'Kontrollér banen først')
assert.match(uncertain.athlete.next, /Kør analysen igen/)

const squat = context.buildCoachFeedback('Squat', {
  driftCm: 7.4,
  dipPct: 68,
  effPct: 82,
  lowConfPct: 2,
})
assert.equal(squat.primary.title, 'Stangen forlader den lodrette linje')
assert.match(squat.athlete.next, /midtfod/)
assert.equal(videoCoachFeedbackQuality({
  works: squat.athlete.works,
  focus: squat.athlete.focus,
  next_set: squat.athlete.next,
}).level, 'strong')

const squatEvidence = sanitizeVideoCoachFeedbackEvidence(context.vcV3FeedbackEvidence(squat))
assert.equal(squatEvidence.priority.title, 'Stangen forlader den lodrette linje')
assert.match(squatEvidence.priority.evidence, /7.4 cm/)

const hostileEvidence = sanitizeVideoCoachFeedbackEvidence({
  version: 'not-reviewed',
  priority: { title: ' Tydeligt fokus ', why: 'x'.repeat(900), evidence: ' 7 cm  drift ' },
  strength: [],
})
assert.equal(hostileEvidence.version, 'coach-feedback-unknown')
assert.equal(hostileEvidence.priority.why.length, 500)
assert.equal(hostileEvidence.priority.evidence, '7 cm drift')
assert.equal(hostileEvidence.strength, null)
assert.equal(sanitizeVideoCoachFeedbackEvidence({ priority: { title: 'Mangler evidens' } }), null)

const bench = context.buildCoachFeedback('Bænkpres', {
  benchTowardShoulderCm: -3.6,
  dipPct: 70,
  positionModelQualityPct: 8,
  lowConfPct: 1,
})
assert.equal(bench.primary.title, 'Stangen bevæger sig væk fra skulderlinjen')
assert.match(bench.athlete.next, /pressets retning/)
assert.equal(videoCoachFeedbackQuality({
  works: bench.athlete.works,
  focus: bench.athlete.focus,
  next_set: bench.athlete.next,
}).level, 'strong')

assert.match(html, /const prioritizedFeedback = buildCoachFeedback/)
assert.doesNotMatch(html, /const cues = suggestCues\(lift, vals\)\.slice\(0, 2\)/)
assert.match(html, /feedback: 'coach-feedback-priority-v2-2026-07-27'/)
assert.match(html, /feedback_evidence: vcV3FeedbackEvidence\(prioritizedFeedback\)/)

const athleteView = fs.readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')
assert.match(athleteView, /feedback_evidence:\s*sanitizeVideoCoachFeedbackEvidence\(/)
assert.match(athleteView, /v=20260728-feedback-evidence/)

const dashboard = fs.readFileSync(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8')
assert.match(dashboard, /Målegrundlag for feedbackudkastet/)
assert.match(dashboard, /Coach-only · automatisk udgangspunkt/)
assert.match(dashboard, /feedback_evidence:\s*sanitizeVideoCoachFeedbackEvidence\(\s*message\.row\.session_context\?\.feedback_evidence\)/)

console.log('VideoCoach gemmer ét prioriteret, handlingsrettet cue og reviewet fanger svag feedback.')
